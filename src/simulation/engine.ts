/**
 * engine.ts
 * Central simulation engine. Manages the tick loop and all state mutations.
 * Called from the Zustand store; NOT a React component.
 *
 * Key separation maintained:
 *   groundTruth → stored internally in TelemetrySample
 *   ObservableTelemetry → what gets pushed to D3
 */

import { GroundStation, Satellite, Debris, wavelengthIntersection } from '../types/nodes';
import { Link, PATState, Route, LinkStatus, RouteChange, RouteChangeReason } from '../types/links';
import { ObservableTelemetry, TelemetrySample, GroundTruth } from '../types/telemetry';
import { ActiveDisturbance, DisturbanceType, DisturbanceEffect } from '../types/disturbances';
import { computeDisturbanceEffect, combineEffects, createNullEffect } from './disturbances';
import { tickPAT, createInitialPATState, computeBeaconJitter, FOV_TO_URAD } from './pat';
import { tickSatellite, tickDebris, satCanvasPos, debrisCanvasPos, groundSatDistanceKm, elevationAngleDeg, hasGroundSatLOS, predictLOSWindowS, satSatDistanceKm, EARTH_RADIUS_CANVAS, debrisToPathDistanceKm, predictDebrisEtaS, DEBRIS_BLOCK_KM } from './orbital';
import { computeLinkBudget, distanceKm, orbitalAngularVelocityRadS, clamp } from './physics';
import { findGroundRoutes, evaluateGroundPath, groundHopLink, evaluateD2Path, enumerateD2Paths, GroundRouteContext, D2Node, D2CorridorContext, NOMINAL_HOP, HopConditions, hopKey } from './routing';

const R_EARTH_KM = 6371;
const SCALE_KM_PER_PX = R_EARTH_KM / EARTH_RADIUS_CANVAS;
const DEBRIS_INTERFERENCE_KM = 80; // km within comm path = potential interference

// ─── D1 State ─────────────────────────────────────────────────────────────────
export interface D1State {
  nodes: GroundStation[];
  sourceNodeId: string;
  destNodeId: string;
  primaryLink: Link | null;
  activeRoute: Route | null;
  alternateRoutes: Route[];
  /** Displayed/telemetry PAT — tracks whichever physical link is actually carrying traffic right now. */
  patState: PATState;
  /** Ground-truth PAT for the source↔destination corridor specifically — always driven by the real disturbance, regardless of reroute. Used only to evaluate the direct hop's real health for routing decisions. */
  corridorPatState: PATState;
  activeDisturbances: ActiveDisturbance[];
  telemetryHistory: TelemetrySample[];
  phase: number;
  prevBeaconX: number;
  prevBeaconY: number;
  // NOTE: primaryLink above is always the DIRECT source↔destination link
  // (the one the PAT camera tracks), even when traffic is on a relay route.
  /** Worst hop of the ACTIVE route — what traffic actually experiences. */
  activeLink: Link | null;
  /** Sim time the direct path has been continuously healthy (for auto fail-back). */
  directHealthySinceS: number | null;
  lastRouteChange: RouteChange | null;
}

export const D1_SOURCE_ID = 'gs_a';
export const D1_DEST_ID = 'gs_b';
export const D1_MAX_NODES = 8;
/** Direct path must stay healthy this long before AUTO fails back to it. */
export const D1_REVERT_HOLD_S = 8;
let routeChangeCounter = 0;

// ─── D2 State ─────────────────────────────────────────────────────────────────
export interface D2State {
  groundStations: GroundStation[];
  satellites: Satellite[];
  debris: Debris[];
  primaryLink: Link | null;
  activeRoute: Route | null;
  alternateRoutes: Route[];
  /** Displayed/telemetry PAT — tracks whichever physical link is actually carrying traffic right now. */
  patState: PATState;
  /** Ground-truth PAT for the configured source↔target corridor — always driven by the real disturbance/debris effect, regardless of reroute. Used only to evaluate the direct hop's real health for routing decisions. */
  corridorPatState: PATState;
  activeDisturbances: ActiveDisturbance[];
  telemetryHistory: TelemetrySample[];
  phase: number;
  prevBeaconX: number;
  prevBeaconY: number;
  linkType: 'ground_sat' | 'sat_sat';
  sourceNodeId: string;
  targetNodeId: string;
  /** Node-by-node path the operator built manually — kept until cleared or the endpoints change. */
  manualPath: string[] | null;
  /** Sim time the direct path has been continuously healthy (for auto fail-back off a relay). */
  directHealthySinceS: number | null;
  lastRouteChange: RouteChange | null;
}

export const D2_REVERT_HOLD_S = 8;
export const D2_MAX_RELAYS = 3;
let d2RouteChangeCounter = 0;

// ─── Default Nodes ────────────────────────────────────────────────────────────
export function defaultD1Nodes(): GroundStation[] {
  return [
    {
      id: 'gs_a',
      name: 'Ground A',
      type: 'ground',
      x: 0.2,
      y: 0.5,
      homeX: 0.2,
      homeY: 0.5,
      motionPhase: 0,
      latDeg: 28.6,
      lonDeg: 77.2,
      supportedWavelengths: [1064, 1550],
      txPowerDbm: 23,
      rxSensitivityDbm: -45,
      maxRangeKm: 380,
      hasPAT: true,
      beamDivergenceUrad: 100,
    },
    {
      id: 'gs_b',
      name: 'Ground B',
      type: 'ground',
      x: 0.8,
      y: 0.5,
      homeX: 0.8,
      homeY: 0.5,
      motionPhase: 1.7,
      latDeg: 28.7,
      lonDeg: 77.8,
      supportedWavelengths: [850, 1550],
      txPowerDbm: 23,
      rxSensitivityDbm: -45,
      maxRangeKm: 380,
      hasPAT: true,
      beamDivergenceUrad: 100,
    },
    {
      id: 'gs_c',
      name: 'Ground C',
      type: 'ground',
      x: 0.5,
      y: 0.2,
      homeX: 0.5,
      homeY: 0.2,
      motionPhase: 3.4,
      latDeg: 29.0,
      lonDeg: 77.5,
      supportedWavelengths: [1064, 1550],
      txPowerDbm: 20,
      rxSensitivityDbm: -42,
      maxRangeKm: 260,
      hasPAT: true,
      beamDivergenceUrad: 120,
    },
  ];
}

export function defaultD2Config(): Omit<D2State, 'telemetryHistory' | 'phase' | 'prevBeaconX' | 'prevBeaconY' | 'alternateRoutes' | 'primaryLink' | 'activeRoute' | 'patState' | 'corridorPatState' | 'activeDisturbances' | 'manualPath' | 'directHealthySinceS' | 'lastRouteChange'> {
  const gs: GroundStation = {
    id: 'gs_main',
    name: 'Ground Station Alpha',
    type: 'ground',
    x: 0.5,
    y: 0.9,
    latDeg: 25,
    lonDeg: 0,
    supportedWavelengths: [1064, 1550],
    txPowerDbm: 30,
    rxSensitivityDbm: -50,
    maxRangeKm: 2000,
    hasPAT: true,
    beamDivergenceUrad: 50,
  };

  const sats: Satellite[] = [
    {
      id: 'sat_a',
      name: 'FSOC-SAT-A',
      type: 'satellite',
      altitudeKm: 550,
      inclinationDeg: 53,
      trueAnomalyRad: 0,
      raanDeg: 0,
      supportedWavelengths: [1550],
      txPowerDbm: 28,
      rxSensitivityDbm: -55,
      maxRangeKm: 8000,
      hasPAT: true,
      beamDivergenceUrad: 40,
      canvasX: 0,
      canvasY: 0,
    },
    {
      id: 'sat_b',
      name: 'FSOC-SAT-B',
      type: 'satellite',
      altitudeKm: 550,
      inclinationDeg: 53,
      trueAnomalyRad: Math.PI * 0.7,
      raanDeg: 30,
      supportedWavelengths: [1064, 1550],
      txPowerDbm: 28,
      rxSensitivityDbm: -55,
      maxRangeKm: 8000,
      hasPAT: true,
      beamDivergenceUrad: 40,
      canvasX: 0,
      canvasY: 0,
    },
  ];

  const debris: Debris[] = [
    {
      id: 'debris_1',
      name: 'Debris Alpha',
      altitudeKm: 540,
      trueAnomalyRad: Math.PI * 1.2,
      angularVelocityRadS: orbitalAngularVelocityRadS(540) * 1.1, // slightly faster
      sizeM: 0.15,
      riskLevel: 'medium',
      canvasX: 0,
      canvasY: 0,
      distanceFromPathKm: 999,
      predictedIntersection: false,
      etaToIntersectionS: 999,
      intersectionDurationS: 0,
    },
  ];

  return {
    groundStations: [gs],
    satellites: sats,
    debris,
    linkType: 'ground_sat',
    sourceNodeId: 'sat_a',
    targetNodeId: 'sat_a',
  };
}

/**
 * Combined effect of every active disturbance that targets the specific hop
 * (a, b) — most disturbances target just one hop, but nothing stops two from
 * overlapping on the same one.
 */
function effectForHop(activeDisturbances: ActiveDisturbance[], phase: number, simTimeS: number, a: string, b: string): DisturbanceEffect {
  const k = hopKey(a, b);
  let merged = createNullEffect();
  for (const dist of activeDisturbances) {
    if (!dist.targetHops.some(([x, y]) => hopKey(x, y) === k)) continue;
    merged = combineEffects(merged, computeDisturbanceEffect(dist.type, dist.intensity, phase, simTimeS));
  }
  return merged;
}

/**
 * Live per-hop conditions for every hop any active D1 disturbance targets. A
 * relay hop has no dedicated PAT control loop, so its pointing error is a
 * lightweight stateless estimate from the same disturbance-effect fields
 * tickPAT itself reacts to — real degradation, without a second PID loop. The
 * literal source↔destination corridor uses the real, stateful corridor PAT.
 */
export function buildD1HopConditions(
  activeDisturbances: ActiveDisturbance[],
  sourceId: string,
  destId: string,
  corridorPointingErrorUrad: number,
  corridorPatLocked: boolean,
  phase: number,
  simTimeS: number
): Map<string, HopConditions & { patLocked: boolean }> {
  const literalCorridorKey = hopKey(sourceId, destId);
  const targetPairs = new Map<string, [string, string]>();
  for (const dist of activeDisturbances) {
    for (const [a, b] of dist.targetHops) targetPairs.set(hopKey(a, b), [a, b]);
  }
  const hopConditions = new Map<string, HopConditions & { patLocked: boolean }>();
  for (const [key, [a, b]] of targetPairs) {
    const effect = effectForHop(activeDisturbances, phase, simTimeS, a, b);
    if (key === literalCorridorKey) {
      hopConditions.set(key, {
        atmosphericLossDb: 0.5 + effect.additionalAttenuationDb,
        pointingErrorUrad: corridorPointingErrorUrad,
        losBlocked: effect.losBlocked,
        patLocked: corridorPatLocked,
      });
    } else {
      const pointingErrorUrad = 5 + effect.beaconJitterAmplitude * FOV_TO_URAD
        + Math.hypot(effect.cameraCenterOffsetX, effect.cameraCenterOffsetY) * FOV_TO_URAD;
      hopConditions.set(key, {
        atmosphericLossDb: 0.5 + effect.additionalAttenuationDb,
        pointingErrorUrad,
        losBlocked: effect.losBlocked,
        patLocked: pointingErrorUrad < 100,
      });
    }
  }
  return hopConditions;
}

// ─── D1 Tick ──────────────────────────────────────────────────────────────────
export function tickD1(state: D1State, simTimeS: number, dtS: number, speed: number, opts: { autoReroute?: boolean } = {}): D1State {
  const phase = simTimeS * 2.0;

  // Ground terminals are represented as mobile optical nodes in the virtual
  // testbed. Their motion is deliberately slow and visible so topology and
  // route geometry evolve with the link, rather than looking like a static
  // network diagram.
  const movingNodes = state.nodes.map((node, index) => {
    const phaseOffset = node.motionPhase ?? index * 1.7;
    // Every node orbits its own fixed home point (added nodes included).
    const baseX = node.homeX ?? node.x;
    const baseY = node.homeY ?? node.y;
    const isC = node.id === 'gs_c';
    const ampX = isC ? 0.045 : 0.035;
    const ampY = isC ? 0.035 : 0.025;
    return {
      ...node,
      homeX: baseX,
      homeY: baseY,
      x: clamp(baseX + ampX * Math.sin(simTimeS * 0.22 + phaseOffset), 0.08, 0.92),
      y: clamp(baseY + ampY * Math.cos(simTimeS * 0.18 + phaseOffset * 0.7), 0.10, 0.88),
    };
  });

  // Each active disturbance targets whichever specific hop(s) were carrying
  // traffic when it was injected (see injectD1Disturbance) — usually the
  // configured source↔destination corridor, but a relay hop if the operator
  // had already rerouted and chose to hit the new path instead.
  const sourceId = state.sourceNodeId ?? D1_SOURCE_ID;
  const destId = state.destNodeId ?? D1_DEST_ID;
  const literalCorridorKey = hopKey(sourceId, destId);

  // Ground-truth PAT for the corridor: always driven by whatever disturbance
  // actually targets it, independent of whether traffic is currently using
  // this hop. This is what route-health checks (below) evaluate the direct
  // hop against, so rerouting can never make the direct path *look*
  // healthier than it really is.
  const corridorEffect = effectForHop(state.activeDisturbances, phase, simTimeS, sourceId, destId);
  const corridorPAT = tickPAT(state.corridorPatState, corridorEffect, simTimeS, dtS, phase);

  // Displayed/telemetry PAT tracks whichever physical link is actually
  // carrying traffic right now — specifically, the FIRST hop of the active
  // route (the local terminal only ever points at its immediate neighbor).
  // Once traffic is rerouted off a disturbed hop onto a healthy one, the
  // terminal is pointed at a beacon the disturbance never touches — that
  // recovery is the whole point of rerouting. But if a *later* disturbance
  // targets the new active hop instead (e.g. re-injected after rerouting),
  // this correctly picks that up too, rather than only ever watching the
  // original source↔destination corridor.
  const activeNodeIds = state.activeRoute?.nodeIds ?? [sourceId, destId];
  const firstHopKey = activeNodeIds.length >= 2 ? hopKey(activeNodeIds[0], activeNodeIds[1]) : null;
  const patEffect = firstHopKey === literalCorridorKey
    ? corridorEffect
    : firstHopKey
      ? effectForHop(state.activeDisturbances, phase, simTimeS, activeNodeIds[0], activeNodeIds[1])
      : createNullEffect();
  const newPAT = tickPAT(state.patState, patEffect, simTimeS, dtS, phase);

  // Compute beacon jitter from position delta
  const beaconJitter = computeBeaconJitter(
    state.prevBeaconX, state.prevBeaconY,
    newPAT.beaconX, newPAT.beaconY
  );

  // ── Links + routes ─────────────────────────────────────────────────────────
  const nodeA = movingNodes.find(n => n.id === sourceId);
  const nodeB = movingNodes.find(n => n.id === destId);

  const hopConditions = buildD1HopConditions(
    state.activeDisturbances, sourceId, destId,
    corridorPAT.pointingErrorUrad, corridorPAT.trackingStatus === 'LOCKED',
    phase, simTimeS
  );

  const ctx: GroundRouteContext = {
    sourceId,
    destId,
    hopConditions,
    preferredWavelength: state.primaryLink?.selectedWavelength ?? null,
  };

  const directCond = hopConditions.get(literalCorridorKey);
  const newLink: Link | null = nodeA && nodeB
    ? groundHopLink(nodeA, nodeB, directCond ?? NOMINAL_HOP, ctx.preferredWavelength)
    : state.primaryLink;

  const candidates = nodeA && nodeB ? findGroundRoutes(movingNodes, ctx) : [];
  const directPath = [sourceId, destId];
  const samePath = (x: string[], y: string[]) => x.length === y.length && x.every((id, i) => id === y[i]);
  const routeLinkStatus = (r: Route): LinkStatus =>
    r.status === 'UNAVAILABLE' ? 'DISCONNECTED'
    : (r.hopLinks ?? []).some(l => l.status === 'CRITICAL') ? 'CRITICAL'
    : (r.hopLinks ?? []).some(l => l.status === 'DEGRADED') ? 'DEGRADED' : 'CONNECTED';

  const previousPath = state.activeRoute?.nodeIds ?? directPath;
  let activePath = previousPath;
  let routeChange = state.lastRouteChange;
  let directHealthySinceS = state.directHealthySinceS;
  const noteChange = (reason: RouteChangeReason, to: string[]) => {
    routeChange = { id: ++routeChangeCounter, atS: simTimeS, reason, from: previousPath, to };
    activePath = to;
    directHealthySinceS = null;
  };

  let activeEval = evaluateGroundPath(activePath, movingNodes, ctx);

  if (!activeEval && nodeA && nodeB) {
    // A node on the active path was removed: fall back to the best surviving route.
    const usable = candidates.find(r => r.status !== 'UNAVAILABLE');
    const fallback = candidates.find(r => samePath(r.nodeIds, directPath) && r.status !== 'UNAVAILABLE') ?? usable ?? candidates[0];
    if (fallback) { noteChange('FALLBACK', fallback.nodeIds); activeEval = fallback; }
  }

  if (activeEval && opts.autoReroute) {
    const status = routeLinkStatus(activeEval);
    if (status === 'CRITICAL' || status === 'DISCONNECTED') {
      // Active path is failing: move to the best healthy alternative.
      const best = candidates.find(r =>
        !samePath(r.nodeIds, activeEval!.nodeIds) && r.status !== 'UNAVAILABLE' && r.analysis.score > activeEval!.analysis.score);
      if (best) { noteChange('AUTO', best.nodeIds); activeEval = best; }
      else directHealthySinceS = null;
    } else if (activeEval.nodeIds.length > 2) {
      // On a relay: fail back to the direct path once it has been healthy for a while.
      const direct = candidates.find(r => samePath(r.nodeIds, directPath));
      const healthy = !!direct && direct.status === 'AVAILABLE' && direct.worstSnrDb >= 15 && direct.analysis.patStable;
      if (healthy) {
        directHealthySinceS = directHealthySinceS ?? simTimeS;
        if (simTimeS - directHealthySinceS >= D1_REVERT_HOLD_S) { noteChange('REVERT', directPath); activeEval = direct!; }
      } else {
        directHealthySinceS = null;
      }
    } else {
      directHealthySinceS = null;
    }
  } else if (!opts.autoReroute) {
    directHealthySinceS = null;
  }

  const primaryRoute: Route = activeEval
    ? { ...activeEval, isPrimary: true, status: activeEval.status === 'AVAILABLE' ? 'ACTIVE' : activeEval.status }
    : (state.activeRoute ?? {
        id: 'route_gs_a>gs_b', hops: [], nodeIds: directPath, status: 'UNAVAILABLE', totalDistanceKm: 0,
        worstSnrDb: -999, worstLinkMarginDb: -999, isPrimary: true,
        analysis: { wavelengthCompatible: false, hasLOS: false, snrAcceptable: false, linkMarginAcceptable: false, patStable: false, debrisFree: true, predictedStability: 'unstable', score: 0 },
      });

  const newAlternates = candidates.filter(r => r.id !== primaryRoute.id).slice(0, 6);

  // What traffic really experiences = the weakest hop of the active route.
  const activeLink: Link | null = primaryRoute.hopLinks && primaryRoute.hopLinks.length > 0
    ? primaryRoute.hopLinks.reduce((w, l) => (l.snrDb < w.snrDb ? l : w))
    : newLink;
  const effLink = activeLink ?? newLink;

  // Build observable telemetry
  const obs: ObservableTelemetry = {
    timestamp: simTimeS,
    wallTime: Date.now(),
    beaconX: newPAT.beaconX,
    beaconY: newPAT.beaconY,
    cameraCenterX: newPAT.cameraCenterX,
    cameraCenterY: newPAT.cameraCenterY,
    pointingErrorUrad: newPAT.pointingErrorUrad,
    beaconJitterUrad: beaconJitter,
    detectionConfidence: newPAT.detectionConfidence,
    trackingStatus: newPAT.trackingStatus,
    receivedPowerDbm: effLink?.receivedPowerDbm ?? -999,
    snrDb: effLink?.snrDb ?? -999,
    berLog10: effLink?.berLog10 ?? 0,
    linkMarginDb: effLink?.linkMarginDb ?? -999,
    atmosphericLossDb: effLink?.atmosphericLossDb ?? 0,
    hasLOS: effLink?.hasLOS ?? false,
    linkStatusRaw: effLink?.status ?? 'DISCONNECTED',
    activeRouteNodeIds: primaryRoute.nodeIds,
    primaryRouteAvailable: (effLink?.status === 'CONNECTED' || effLink?.status === 'DEGRADED'),
    alternateRouteAvailable: newAlternates.some(r => r.status !== 'UNAVAILABLE'),
  };

  // Ground truth is for internal tracking only — NOT exposed to intelligence
  const gt: GroundTruth | null = state.activeDisturbances.length > 0
    ? {
        disturbanceType: state.activeDisturbances.map(d => d.type).join('+'),
        disturbanceIntensity: state.activeDisturbances[0].intensity,
        actualCause: state.activeDisturbances[0].type,
        predictedFutureStatus: (effLink?.snrDb ?? -999) < 10 ? 'critical' : (effLink?.snrDb ?? -999) < 18 ? 'degrading' : 'stable',
        estimatedTimeToCriticalS: effLink?.snrDb
          ? Math.max(0, (effLink.snrDb - 8) * 5)
          : 999,
      }
    : null;

  const sample: TelemetrySample = { observable: obs, groundTruth: gt };

  // Keep 10 minutes of history at 2 Hz = 1200 samples
  const newHistory = [...state.telemetryHistory, sample].slice(-1200);

  return {
    ...state,
    nodes: movingNodes,
    activeRoute: primaryRoute,
    patState: newPAT,
    corridorPatState: corridorPAT,
    primaryLink: newLink,
    activeLink,
    alternateRoutes: newAlternates,
    directHealthySinceS,
    lastRouteChange: routeChange,
    telemetryHistory: newHistory,
    phase,
    prevBeaconX: newPAT.beaconX,
    prevBeaconY: newPAT.beaconY,
  };
}

// ─── D2 Tick ──────────────────────────────────────────────────────────────────
export function tickD2(state: D2State, simTimeS: number, dtS: number, speed: number, opts: { autoReroute?: boolean } = {}): D2State {
  const phase = simTimeS * 2.0;

  // Advance orbital positions
  const newSatellites = state.satellites.map(s => {
    const advanced = tickSatellite(s, dtS, speed);
    const pos = satCanvasPos(advanced);
    return { ...advanced, canvasX: pos.x, canvasY: pos.y };
  });

  // Advance debris
  const gs = state.groundStations[0];
  const primarySat = newSatellites.find(s => s.id === state.targetNodeId) ?? newSatellites[0];
  const sourceSat = newSatellites.find(s => s.id === state.sourceNodeId) ?? newSatellites[0];
  if (!gs || !primarySat) return state;

  // Compute ground station canvas position
  const gsAngle = (gs.lonDeg * Math.PI) / 180;
  const gsCanvasX = EARTH_RADIUS_CANVAS * Math.cos(gsAngle);
  const gsCanvasY = EARTH_RADIUS_CANVAS * Math.sin(gsAngle);

  // Advance debris + compute path proximity
  const newDebris = state.debris.map(d => {
    const advanced = tickDebris(d, dtS, speed);
    const pos = debrisCanvasPos(advanced);

    const pathStartX = state.linkType === 'sat_sat' ? sourceSat.canvasX : gsCanvasX;
    const pathStartY = state.linkType === 'sat_sat' ? sourceSat.canvasY : gsCanvasY;
    const pathEndX = state.linkType === 'sat_sat' ? (newSatellites.find(s => s.id === state.targetNodeId && s.id !== sourceSat?.id)?.canvasX ?? newSatellites.find(s => s.id !== sourceSat?.id)?.canvasX ?? primarySat.canvasX) : primarySat.canvasX;
    const pathEndY = state.linkType === 'sat_sat' ? (newSatellites.find(s => s.id === state.targetNodeId && s.id !== sourceSat?.id)?.canvasY ?? newSatellites.find(s => s.id !== sourceSat?.id)?.canvasY ?? primarySat.canvasY) : primarySat.canvasY;

    const pathDist = debrisToPathDistanceKm(
      advanced,
      pathStartX, pathStartY,
      pathEndX, pathEndY,
      SCALE_KM_PER_PX
    );

    const eta = predictDebrisEtaS(
      advanced,
      pathStartX, pathStartY,
      pathEndX, pathEndY,
      SCALE_KM_PER_PX,
      speed
    );

    return {
      ...advanced,
      canvasX: pos.x,
      canvasY: pos.y,
      distanceFromPathKm: pathDist,
      predictedIntersection: pathDist < DEBRIS_INTERFERENCE_KM || eta < 300,
      etaToIntersectionS: eta,
      intersectionDurationS: eta < 300 ? 25 : 0,
    };
  });

  // Closest debris to the currently configured direct path (used below to
  // decide whether it physically blocks the direct hop, and to feed the
  // corridor's auto debris-interference effect).
  const closestDebris = newDebris.reduce(
    (min, d) => d.distanceFromPathKm < min.distanceFromPathKm ? d : min,
    newDebris[0] ?? { distanceFromPathKm: 9999 }
  );

  // Compute D2 link using the selected left-sidebar mode. Ground↔Space uses
  // the ground station and primary satellite; Space↔Space uses SAT-A↔SAT-B.
  const satSource = newSatellites.find(s => s.id === state.sourceNodeId) ?? newSatellites[0];
  const satTarget = newSatellites.find(s => s.id === state.targetNodeId && s.id !== satSource?.id) ?? newSatellites.find(s => s.id !== satSource?.id);
  const nodeA = state.linkType === 'sat_sat' ? satSource : gs;
  const nodeB = state.linkType === 'sat_sat' ? satTarget : primarySat;
  const hasLOS = nodeA && nodeB
    ? state.linkType === 'sat_sat' ? true : hasGroundSatLOS(gs, primarySat)
    : false;
  const distKm = nodeA && nodeB
    ? state.linkType === 'sat_sat' ? satSatDistanceKm(satSource, satTarget!) : groundSatDistanceKm(gs, primarySat)
    : 0;
  const elevDeg = state.linkType === 'sat_sat' ? null : elevationAngleDeg(gs, primarySat);
  const losWindowS = state.linkType === 'sat_sat' ? 999 : predictLOSWindowS(gs, primarySat, speed);

  const compat = nodeA && nodeB ? wavelengthIntersection(nodeA.supportedWavelengths, nodeB.supportedWavelengths) : [];
  const wavelength = compat[compat.length - 1] ?? null;

  // Disturbances the operator injected target whichever hop(s) were carrying
  // traffic at injection time (see injectD2Disturbance) — usually the
  // configured direct pair, but a relay hop if already rerouted onto one.
  const literalD2Key = nodeB ? hopKey(nodeA.id, nodeB.id) : null;
  const corridorUserEffect = nodeB ? effectForHop(state.activeDisturbances, phase, simTimeS, nodeA.id, nodeB.id) : createNullEffect();

  // Ground-truth PAT for the corridor: driven by whatever targets it (plus
  // any nearby debris on this exact corridor), independent of whether
  // traffic is currently using this hop. Route-health checks and the direct
  // link's own budget (below) are evaluated against this, so rerouting can
  // never make the direct path *look* healthier than it really is.
  let corridorEffect = corridorUserEffect;
  if (closestDebris && closestDebris.distanceFromPathKm < 30) {
    const debrisIntensity = 1 - closestDebris.distanceFromPathKm / 30;
    const debrisEffect = computeDisturbanceEffect('DEBRIS_INTERFERENCE', debrisIntensity, phase, simTimeS);
    corridorEffect = combineEffects(corridorEffect, debrisEffect);
  }
  const corridorPAT = tickPAT(state.corridorPatState, corridorEffect, simTimeS, dtS, phase);

  // Displayed/telemetry PAT tracks whichever physical link is actually
  // carrying traffic right now — specifically the FIRST hop of the active
  // route, since the local terminal only ever points at its immediate
  // neighbor. Recovers once rerouted off a disturbed hop onto a healthy one;
  // picks the disturbance back up if a later injection targets the new
  // active hop instead (e.g. re-injected after a successful reroute).
  const directPathIds = nodeB ? [nodeA.id, nodeB.id] : [nodeA.id];
  const patActiveNodeIds = state.activeRoute?.nodeIds ?? directPathIds;
  const firstHopKeyD2 = patActiveNodeIds.length >= 2 ? hopKey(patActiveNodeIds[0], patActiveNodeIds[1]) : null;
  const patEffect = firstHopKeyD2 === literalD2Key
    ? corridorEffect
    : firstHopKeyD2
      ? effectForHop(state.activeDisturbances, phase, simTimeS, patActiveNodeIds[0], patActiveNodeIds[1])
      : createNullEffect();
  const newPAT = tickPAT(state.patState, patEffect, simTimeS, dtS, phase);
  const beaconJitter = computeBeaconJitter(
    state.prevBeaconX, state.prevBeaconY,
    newPAT.beaconX, newPAT.beaconY
  );

  // Debris is treated as a real physical obstruction of the corridor beam,
  // not just a gradual disturbance — this is what makes rerouting necessary.
  const debrisBlocksDirect = closestDebris.distanceFromPathKm < DEBRIS_BLOCK_KM;
  const beamClear = hasLOS && !debrisBlocksDirect;

  let newLink: Link | null = null;
  if (nodeA && nodeB && wavelength && hasLOS) {
    const atmLoss = state.linkType === 'sat_sat' ? 0.1 : 0.5 + corridorEffect.additionalAttenuationDb * 0.3;
    const budget = computeLinkBudget({
      distanceKm: Math.max(distKm, 1),
      wavelengthNm: wavelength,
      txPowerDbm: nodeA.txPowerDbm,
      txApertureDiamM: 0.3,
      rxApertureDiamM: 0.15,
      rxSensitivityDbm: nodeB.rxSensitivityDbm,
      atmosphericLossDb: atmLoss,
      pointingErrorUrad: corridorPAT.pointingErrorUrad,
      beamDivergenceUrad: nodeA.beamDivergenceUrad,
    });
    const status: LinkStatus =
      corridorEffect.losBlocked ? 'DISCONNECTED' :
      debrisBlocksDirect ? 'DISCONNECTED' :
      budget.linkMarginDb < 0 ? 'DISCONNECTED' :
      budget.snrDb < 8 ? 'CRITICAL' :
      budget.snrDb < 15 ? 'DEGRADED' : 'CONNECTED';
    newLink = {
      id: state.linkType === 'sat_sat' ? 'link_sat_sat' : 'link_gs_sat',
      nodeAId: nodeA.id,
      nodeBId: nodeB.id,
      selectedWavelength: wavelength,
      compatibleWavelengths: compat,
      status,
      distanceKm: distKm,
      hasLOS: beamClear,
      receivedPowerDbm: budget.receivedPowerDbm,
      snrDb: budget.snrDb,
      berLog10: budget.berLog10,
      linkMarginDb: budget.linkMarginDb,
      freeSpaceLossDb: budget.freeSpaceLossDb,
      atmosphericLossDb: atmLoss,
      pointingLossDb: budget.pointingLossDb,
      elevationDeg: elevDeg,
    };
  }

  // ── Adaptive routing: corridor-aware live path evaluation + relay search ──
  // Every hop is re-evaluated every tick against LIVE node positions and
  // debris positions, so a route can break (or heal) as objects move —
  // exactly like the D1 ground network's route engine.
  const idToNode = new Map<string, D2Node>();
  idToNode.set(gs.id, gs);
  newSatellites.forEach(s => idToNode.set(s.id, s));
  const resolveIds = (ids: string[]): D2Node[] | null => {
    const arr = ids.map(id => idToNode.get(id));
    return arr.every((n): n is D2Node => !!n) ? (arr as D2Node[]) : null;
  };

  const targetPairsD2 = new Map<string, [string, string]>();
  for (const dist of state.activeDisturbances) {
    for (const [a, b] of dist.targetHops) targetPairsD2.set(hopKey(a, b), [a, b]);
  }
  const corridor: D2CorridorContext = new Map();
  for (const [key, [a, b]] of targetPairsD2) {
    if (key === literalD2Key) {
      corridor.set(key, {
        extraAtmosphericLossDb: state.linkType === 'sat_sat' ? 0 : corridorEffect.additionalAttenuationDb * 0.3,
        forceLOSBlocked: corridorEffect.losBlocked,
        pointingErrorUrad: corridorPAT.pointingErrorUrad,
      });
    } else {
      const effect = effectForHop(state.activeDisturbances, phase, simTimeS, a, b);
      const pointingErrorUrad = 8 + effect.beaconJitterAmplitude * FOV_TO_URAD
        + Math.hypot(effect.cameraCenterOffsetX, effect.cameraCenterOffsetY) * FOV_TO_URAD;
      corridor.set(key, {
        extraAtmosphericLossDb: effect.additionalAttenuationDb * 0.3,
        forceLOSBlocked: effect.losBlocked,
        pointingErrorUrad,
      });
    }
  }

  const samePath = (x: string[], y: string[]) => x.length === y.length && x.every((id, i) => id === y[i]);

  let newAlternates: Route[] = [];
  if (nodeB) {
    const relayPool: D2Node[] = newSatellites.filter(s => s.id !== nodeA.id && s.id !== nodeB!.id);
    const candidatePaths = enumerateD2Paths(nodeA, nodeB, relayPool, newDebris, corridor, D2_MAX_RELAYS);
    newAlternates = candidatePaths
      .map(p => evaluateD2Path(p, newDebris, corridor))
      .sort((a, b) => b.analysis.score - a.analysis.score || a.hops.length - b.hops.length || a.totalDistanceKm - b.totalDistanceKm)
      .slice(0, 3);
  }

  let activeNodeIds = state.activeRoute?.nodeIds ?? directPathIds;
  let routeChange = state.lastRouteChange;
  let directHealthySinceS = state.directHealthySinceS;
  let isManual = state.activeRoute?.isManual ?? false;

  const noteChange = (reason: RouteChangeReason, toIds: string[]) => {
    routeChange = { id: ++d2RouteChangeCounter, atS: simTimeS, reason, from: activeNodeIds, to: toIds };
    activeNodeIds = toIds;
    directHealthySinceS = null;
  };

  const resolvedActive = resolveIds(activeNodeIds);
  let activeEval: Route | null = resolvedActive ? evaluateD2Path(resolvedActive, newDebris, corridor) : null;

  if (!activeEval && nodeB) {
    // A node on the active path no longer exists (satellite removed): fall back.
    const fallback = newAlternates.find(r => r.status !== 'UNAVAILABLE') ?? null;
    if (fallback) { noteChange('FALLBACK', fallback.nodeIds); activeEval = fallback; isManual = false; }
    else { noteChange('FALLBACK', directPathIds); activeEval = evaluateD2Path([nodeA, nodeB], newDebris, corridor); isManual = false; }
  }

  if (activeEval && opts.autoReroute) {
    const broken = activeEval.status === 'UNAVAILABLE';
    if (broken) {
      // Active path is failing (often: debris now crosses one of its hops).
      // Move to the best healthy alternative — direct or relay.
      const best = newAlternates.find(r => !samePath(r.nodeIds, activeEval!.nodeIds) && r.status !== 'UNAVAILABLE');
      if (best) { noteChange('AUTO', best.nodeIds); activeEval = best; isManual = false; }
      else directHealthySinceS = null;
    } else if (activeNodeIds.length > 2 && nodeB) {
      // On a relay: fail back to the direct path once it has been healthy for a while.
      const directEval = samePath(activeNodeIds, directPathIds) ? activeEval : evaluateD2Path([nodeA, nodeB], newDebris, corridor);
      const healthy = directEval.status === 'AVAILABLE' && directEval.worstSnrDb >= 15;
      if (healthy) {
        directHealthySinceS = directHealthySinceS ?? simTimeS;
        if (simTimeS - directHealthySinceS >= D2_REVERT_HOLD_S) { noteChange('REVERT', directPathIds); activeEval = directEval; isManual = false; }
      } else directHealthySinceS = null;
    } else directHealthySinceS = null;
  } else if (!opts.autoReroute) {
    directHealthySinceS = null;
  }

  const primaryRoute: Route = activeEval
    ? { ...activeEval, isPrimary: true, isManual, status: activeEval.status === 'AVAILABLE' ? 'ACTIVE' : activeEval.status }
    : (state.activeRoute ?? {
        id: 'primary', hops: [], nodeIds: directPathIds, status: 'UNAVAILABLE', totalDistanceKm: 0,
        worstSnrDb: -999, worstLinkMarginDb: -999, isPrimary: true,
        analysis: { wavelengthCompatible: false, hasLOS: false, snrAcceptable: false, linkMarginAcceptable: false, patStable: false, debrisFree: true, predictedStability: 'unstable', score: 0 },
      });

  const newManualPath = isManual ? activeNodeIds : null;

  // Build observable telemetry
  const obs: ObservableTelemetry = {
    timestamp: simTimeS,
    wallTime: Date.now(),
    beaconX: newPAT.beaconX,
    beaconY: newPAT.beaconY,
    cameraCenterX: newPAT.cameraCenterX,
    cameraCenterY: newPAT.cameraCenterY,
    pointingErrorUrad: newPAT.pointingErrorUrad,
    beaconJitterUrad: beaconJitter,
    detectionConfidence: newPAT.detectionConfidence,
    trackingStatus: newPAT.trackingStatus,
    receivedPowerDbm: newLink?.receivedPowerDbm ?? -999,
    snrDb: newLink?.snrDb ?? -999,
    berLog10: newLink?.berLog10 ?? 0,
    linkMarginDb: newLink?.linkMarginDb ?? -999,
    atmosphericLossDb: newLink?.atmosphericLossDb ?? 0,
    hasLOS: beamClear,
    linkStatusRaw: newLink?.status ?? 'DISCONNECTED',
    activeRouteNodeIds: primaryRoute.nodeIds,
    primaryRouteAvailable: primaryRoute.status !== 'UNAVAILABLE',
    alternateRouteAvailable: newAlternates.some(r => r.status !== 'UNAVAILABLE'),
    orbital: {
      distanceKm: distKm,
      elevationDeg: elevDeg,
      hasLOS: beamClear,
      losWindowRemainingS: losWindowS,
      relativeVelocityKms: 7.6, // LEO approx
    },
    debris: closestDebris ? {
      closestDebrisDistanceKm: closestDebris.distanceFromPathKm,
      predictedIntersection: closestDebris.predictedIntersection,
      etaToIntersectionS: closestDebris.etaToIntersectionS,
      intersectionDurationS: closestDebris.intersectionDurationS,
    } : undefined,
  };

  const gt: GroundTruth | null = state.activeDisturbances.length > 0
    ? {
        disturbanceType: state.activeDisturbances.map(d => d.type).join('+'),
        disturbanceIntensity: state.activeDisturbances[0].intensity,
        actualCause: state.activeDisturbances[0].type,
        predictedFutureStatus: (newLink?.snrDb ?? -999) < 10 ? 'critical' : (newLink?.snrDb ?? -999) < 18 ? 'degrading' : 'stable',
        estimatedTimeToCriticalS: newLink?.snrDb
          ? Math.max(0, (newLink.snrDb - 8) * 5)
          : 999,
      }
    : null;

  const sample: TelemetrySample = { observable: obs, groundTruth: gt };
  const newHistory = [...state.telemetryHistory, sample].slice(-1200);

  return {
    ...state,
    satellites: newSatellites,
    debris: newDebris,
    patState: newPAT,
    corridorPatState: corridorPAT,
    primaryLink: newLink,
    activeRoute: primaryRoute,
    alternateRoutes: newAlternates,
    manualPath: newManualPath,
    directHealthySinceS,
    lastRouteChange: routeChange,
    telemetryHistory: newHistory,
    phase,
    prevBeaconX: newPAT.beaconX,
    prevBeaconY: newPAT.beaconY,
  };
}

// ─── Initial States ───────────────────────────────────────────────────────────
export function createInitialD1State(): D1State {
  return {
    nodes: defaultD1Nodes(),
    sourceNodeId: D1_SOURCE_ID,
    destNodeId: D1_DEST_ID,
    primaryLink: null,
    activeLink: null,
    activeRoute: null,
    alternateRoutes: [],
    directHealthySinceS: null,
    lastRouteChange: null,
    patState: createInitialPATState(),
    corridorPatState: createInitialPATState(),
    activeDisturbances: [],
    telemetryHistory: [],
    phase: 0,
    prevBeaconX: 0,
    prevBeaconY: 0,
  };
}

export function createInitialD2State(): D2State {
  const defaults = defaultD2Config();
  const satsWithPos = defaults.satellites.map(s => {
    const pos = satCanvasPos(s);
    return { ...s, canvasX: pos.x, canvasY: pos.y };
  });
  return {
    ...defaults,
    satellites: satsWithPos,
    primaryLink: null,
    activeRoute: null,
    alternateRoutes: [],
    manualPath: null,
    directHealthySinceS: null,
    lastRouteChange: null,
    patState: createInitialPATState(),
    corridorPatState: createInitialPATState(),
    activeDisturbances: [],
    telemetryHistory: [],
    phase: 0,
    prevBeaconX: 0,
    prevBeaconY: 0,
  };
}
