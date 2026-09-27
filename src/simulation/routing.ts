/**
 * routing.ts
 * Alternate route search and scoring for both D1 (ground) and D2 (space).
 * Route selection is based on physical link quality, not just distance.
 */

import { GroundStation, Satellite, Debris, Wavelength, wavelengthIntersection } from '../types/nodes';
import { Link, LinkStatus, Route, RouteHop, RouteAnalysis } from '../types/links';
import { computeLinkBudget, distanceKm } from './physics';
import { hasGroundSatLOS, groundSatDistanceKm, satSatDistanceKm, nodeLogicalPos, closestDebrisToSegment, DEBRIS_BLOCK_KM } from './orbital';

const SNR_THRESHOLD_DB = 10;         // minimum acceptable SNR
const LINK_MARGIN_THRESHOLD_DB = 3;  // minimum acceptable link margin
const SNR_ACCEPTABLE_DB = 12;        // shown in the UI as 'SNR acceptable (≥12 dB)'

// Scoring weights
const W_SNR = 0.35;
const W_MARGIN = 0.25;
const W_DISTANCE = 0.15;
const W_PAT = 0.15;
const W_STABILITY = 0.10;

/**
 * Score a route based on link quality metrics.
 * Higher score = better route.
 */
export function scoreRoute(
  snrDb: number,
  linkMarginDb: number,
  distanceKm_: number,
  patLocked: boolean,
  predictedStability: 'stable' | 'degrading' | 'unstable'
): number {
  const snrScore = Math.max(0, Math.min(1, (snrDb - SNR_THRESHOLD_DB) / 20));
  const marginScore = Math.max(0, Math.min(1, (linkMarginDb - LINK_MARGIN_THRESHOLD_DB) / 15));
  const distScore = Math.max(0, 1 - distanceKm_ / 5000);
  const patScore = patLocked ? 1.0 : 0.3;
  const stabilityScore = { stable: 1.0, degrading: 0.5, unstable: 0.0 }[predictedStability];

  return (
    W_SNR * snrScore +
    W_MARGIN * marginScore +
    W_DISTANCE * distScore +
    W_PAT * patScore +
    W_STABILITY * stabilityScore
  );
}

/**
 * Build a route analysis summary
 */
export function buildRouteAnalysis(params: {
  wavelengthCompatible: boolean;
  hasLOS: boolean;
  snrDb: number;
  linkMarginDb: number;
  patLocked: boolean;
  debrisFree: boolean;
  predictedStability: 'stable' | 'degrading' | 'unstable';
  totalDistanceKm?: number;
  hopCount?: number;
}): RouteAnalysis {
  // Each extra hop adds a regeneration/latency cost, so a healthy direct path
  // is preferred over an equally healthy relay path.
  const hopPenalty = 0.04 * Math.max(0, (params.hopCount ?? 1) - 1);
  const score = params.wavelengthCompatible && params.hasLOS
    ? Math.max(0, scoreRoute(params.snrDb, params.linkMarginDb, params.totalDistanceKm ?? 0, params.patLocked, params.predictedStability) - hopPenalty)
    : 0;

  return {
    wavelengthCompatible: params.wavelengthCompatible,
    hasLOS: params.hasLOS,
    snrAcceptable: params.snrDb >= SNR_ACCEPTABLE_DB,
    linkMarginAcceptable: params.linkMarginDb >= LINK_MARGIN_THRESHOLD_DB,
    patStable: params.patLocked,
    debrisFree: params.debrisFree,
    predictedStability: params.predictedStability,
    score,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// Ground network (D1): per-hop link budgets + multi-hop route search
// ═════════════════════════════════════════════════════════════════════════════

/** Normalised node coordinates map to a 500 km × 400 km testbed area. */
export const GROUND_AREA_KM = { x: 500, y: 400 };

export function groundDistanceKm(a: GroundStation, b: GroundStation): number {
  return distanceKm(a.x * GROUND_AREA_KM.x, a.y * GROUND_AREA_KM.y, b.x * GROUND_AREA_KM.x, b.y * GROUND_AREA_KM.y);
}

/** Live conditions on a hop (disturbances, pointing). */
export interface HopConditions {
  atmosphericLossDb: number;
  pointingErrorUrad: number;
  losBlocked: boolean;
}

/** Nominal conditions for hops that are not on the disturbed corridor. */
export const NOMINAL_HOP: HopConditions = { atmosphericLossDb: 1.0, pointingErrorUrad: 5, losBlocked: false };

/**
 * Directed link budget for one ground hop.
 * DISCONNECTED (with -999 metrics) when there is no shared wavelength or the
 * nodes are farther apart than the shorter of their two max ranges.
 */
export function groundHopLink(
  from: GroundStation,
  to: GroundStation,
  cond: HopConditions = NOMINAL_HOP,
  preferredWavelength?: Wavelength | null,
): Link {
  const compat = wavelengthIntersection(from.supportedWavelengths, to.supportedWavelengths);
  const dist = groundDistanceKm(from, to);
  const wavelength =
    preferredWavelength && compat.includes(preferredWavelength)
      ? preferredWavelength
      : (compat[compat.length - 1] ?? null);
  const inRange = dist <= Math.min(from.maxRangeKm, to.maxRangeKm);

  const base = {
    id: `link_${from.id}_${to.id}`,
    nodeAId: from.id,
    nodeBId: to.id,
    selectedWavelength: wavelength,
    compatibleWavelengths: compat,
    distanceKm: dist,
    elevationDeg: null,
  };

  if (!wavelength || !inRange) {
    return {
      ...base,
      status: 'DISCONNECTED',
      hasLOS: false,
      receivedPowerDbm: -999,
      snrDb: -999,
      berLog10: 0,
      linkMarginDb: -999,
      freeSpaceLossDb: 0,
      atmosphericLossDb: 0,
      pointingLossDb: 0,
    };
  }

  const budget = computeLinkBudget({
    distanceKm: dist,
    wavelengthNm: wavelength,
    txPowerDbm: from.txPowerDbm,
    txApertureDiamM: 0.1,
    rxApertureDiamM: 0.1,
    rxSensitivityDbm: to.rxSensitivityDbm,
    atmosphericLossDb: cond.atmosphericLossDb,
    pointingErrorUrad: cond.pointingErrorUrad,
    beamDivergenceUrad: from.beamDivergenceUrad,
  });

  const status: LinkStatus =
    cond.losBlocked ? 'DISCONNECTED' :
    budget.linkMarginDb < 0 ? 'DISCONNECTED' :
    budget.snrDb < 8 ? 'CRITICAL' :
    budget.snrDb < 15 ? 'DEGRADED' : 'CONNECTED';

  return {
    ...base,
    status,
    hasLOS: !cond.losBlocked,
    receivedPowerDbm: budget.receivedPowerDbm,
    snrDb: budget.snrDb,
    berLog10: budget.berLog10,
    linkMarginDb: budget.linkMarginDb,
    freeSpaceLossDb: budget.freeSpaceLossDb,
    atmosphericLossDb: cond.atmosphericLossDb,
    pointingLossDb: budget.pointingLossDb,
  };
}

/** Unordered key for a hop between two node ids — order-independent so A→B and B→A share one entry. */
export function hopKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export interface GroundRouteContext {
  sourceId: string;
  destId: string;
  /**
   * Live conditions for specific hops, keyed by hopKey(a,b). A disturbance
   * targets whichever hop(s) were actually carrying traffic at the moment it
   * was injected (usually the source↔destination corridor, but a relay hop
   * once you've already rerouted) — hops with no entry here use NOMINAL_HOP.
   */
  hopConditions: Map<string, HopConditions & { patLocked: boolean }>;
  preferredWavelength?: Wavelength | null;
  maxHops?: number;
}

export function groundRouteId(nodeIds: string[]): string {
  return `route_${nodeIds.join('>')}`;
}

/**
 * Evaluate one specific path with live numbers. Returns null if any node on
 * the path no longer exists. Infeasible hops (out of range, no shared λ) are
 * kept so the route is reported as UNAVAILABLE rather than silently vanishing.
 */
export function evaluateGroundPath(nodeIds: string[], nodes: GroundStation[], ctx: GroundRouteContext): Route | null {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const resolved = nodeIds.map(id => byId.get(id));
  if (resolved.some(n => !n) || nodeIds.length < 2) return null;
  const chain = resolved as GroundStation[];

  const hopLinks: Link[] = [];
  for (let i = 0; i < chain.length - 1; i++) {
    const cond = ctx.hopConditions.get(hopKey(chain[i].id, chain[i + 1].id));
    const pref = cond ? ctx.preferredWavelength : null;
    hopLinks.push(groundHopLink(chain[i], chain[i + 1], cond ?? NOMINAL_HOP, pref));
  }

  const wavelengthCompatible = hopLinks.every(l => l.selectedWavelength !== null);
  const hasLOS = hopLinks.every(l => l.hasLOS);
  const usable = hopLinks.every(l => l.status !== 'DISCONNECTED');
  const worstSnr = Math.min(...hopLinks.map(l => l.snrDb));
  const worstMargin = Math.min(...hopLinks.map(l => l.linkMarginDb));
  const totalDistanceKm = hopLinks.reduce((sum, l) => sum + l.distanceKm, 0);
  const patLocked = chain.slice(0, -1).every((n, i) =>
    ctx.hopConditions.get(hopKey(n.id, chain[i + 1].id))?.patLocked ?? true
  );
  const predictedStability: RouteAnalysis['predictedStability'] =
    worstSnr >= 18 ? 'stable' : worstSnr >= SNR_ACCEPTABLE_DB ? 'degrading' : 'unstable';

  const analysis = buildRouteAnalysis({
    wavelengthCompatible,
    hasLOS,
    snrDb: worstSnr,
    linkMarginDb: worstMargin,
    patLocked,
    debrisFree: true,
    predictedStability,
    totalDistanceKm,
    hopCount: hopLinks.length,
  });

  const worstStatus: LinkStatus =
    !usable ? 'DISCONNECTED'
    : hopLinks.some(l => l.status === 'CRITICAL') ? 'CRITICAL'
    : hopLinks.some(l => l.status === 'DEGRADED') ? 'DEGRADED' : 'CONNECTED';

  return {
    id: groundRouteId(nodeIds),
    hops: hopLinks.map((l, i) => ({ fromId: chain[i].id, toId: chain[i + 1].id, linkId: l.id })),
    nodeIds: [...nodeIds],
    status: worstStatus === 'DISCONNECTED' ? 'UNAVAILABLE' : worstStatus === 'CONNECTED' ? 'AVAILABLE' : 'DEGRADED',
    totalDistanceKm,
    worstSnrDb: worstSnr,
    worstLinkMarginDb: worstMargin,
    analysis,
    isPrimary: false,
    hopLinks,
  };
}

/**
 * Every usable route from source to destination through any number of the
 * other ground nodes (up to `maxHops` hops, default 3 → at most two relays).
 * The direct route is always included so it can be switched back to.
 * Sorted best-first; unusable routes score 0 and land last.
 */
export function findGroundRoutes(nodes: GroundStation[], ctx: GroundRouteContext): Route[] {
  const src = nodes.find(n => n.id === ctx.sourceId);
  const dst = nodes.find(n => n.id === ctx.destId);
  if (!src || !dst) return [];
  const maxHops = ctx.maxHops ?? 3;
  const relays = nodes.filter(n => n.id !== src.id && n.id !== dst.id);

  // Nominal hop feasibility, computed once per directed pair.
  const feasible = new Map<string, boolean>();
  const key = (a: string, b: string) => `${a}>${b}`;
  const ok = (a: GroundStation, b: GroundStation) => {
    const k = key(a.id, b.id);
    if (!feasible.has(k)) {
      const l = groundHopLink(a, b, NOMINAL_HOP);
      feasible.set(k, l.status !== 'DISCONNECTED');
    }
    return feasible.get(k)!;
  };

  const paths: string[][] = [[src.id, dst.id]];
  const walk = (path: GroundStation[]) => {
    const last = path[path.length - 1];
    if (path.length - 1 >= maxHops) return;
    // finish at the destination
    if (path.length >= 2 && ok(last, dst)) paths.push([...path.map(n => n.id), dst.id]);
    if (path.length - 1 >= maxHops - 1) return;
    for (const r of relays) {
      if (path.includes(r) || !ok(last, r)) continue;
      walk([...path, r]);
    }
  };
  for (const r of relays) if (ok(src, r)) walk([src, r]);

  const routes = paths
    .map(p => evaluateGroundPath(p, nodes, ctx))
    .filter((r): r is Route => r !== null);

  return routes.sort((a, b) =>
    b.analysis.score - a.analysis.score ||
    a.nodeIds.length - b.nodeIds.length ||
    a.totalDistanceKm - b.totalDistanceKm
  );
}

/** Live lat/lon of a moving terminal (same mapping the default nodes follow). */
export function groundGeo(n: Pick<GroundStation, 'x' | 'y'>): { latDeg: number; lonDeg: number } {
  return { latDeg: 28.65 + (0.5 - n.y) * 1.2, lonDeg: 77.2 + (n.x - 0.2) };
}

/** "Ground C" → "C" — compact label for route strings. */
export function shortNodeName(id: string, nodes: Array<{ id: string; name: string }>): string {
  const n = nodes.find(x => x.id === id);
  return n ? n.name.replace(/^Ground\s+/i, '') : id;
}

export function routeLabel(nodeIds: string[], nodes: Array<{ id: string; name: string }>): string {
  return nodeIds.map(id => shortNodeName(id, nodes)).join(' → ');
}

// ═════════════════════════════════════════════════════════════════════════════
// Space network (D2): per-hop link evaluation + multi-hop route search across
// arbitrary ground/satellite nodes, with debris treated as a real physical
// obstruction (a hop crossed by debris is DISCONNECTED, not just "degraded").
// ═════════════════════════════════════════════════════════════════════════════

export type D2Node = GroundStation | Satellite;

/** Live conditions applied to a specific targeted hop. */
export interface D2HopConditions {
  extraAtmosphericLossDb?: number;
  forceLOSBlocked?: boolean;
  pointingErrorUrad?: number;
}

/**
 * Live conditions keyed by hopKey(a,b) — one entry per hop an active
 * disturbance targets (usually the configured source↔destination corridor,
 * but a relay hop once you've rerouted onto it). Hops with no entry are
 * nominal, exactly like the D1 ground network.
 */
export type D2CorridorContext = Map<string, D2HopConditions>;

export interface D2HopResult {
  fromId: string;
  toId: string;
  ok: boolean;
  distanceKm: number;
  wavelength: Wavelength | null;
  wavelengths: Wavelength[];
  snrDb: number;
  linkMarginDb: number;
  debrisBlocked: boolean;
  debrisName: string | null;
  debrisDistanceKm: number;
  reason: string;
}

function d2Distance(a: D2Node, b: D2Node): number {
  if (a.type === 'ground' && b.type === 'satellite') return groundSatDistanceKm(a, b);
  if (a.type === 'satellite' && b.type === 'ground') return groundSatDistanceKm(b, a);
  return satSatDistanceKm(a as Satellite, b as Satellite);
}

function d2LOS(a: D2Node, b: D2Node): boolean {
  if (a.type === 'ground' && b.type === 'satellite') return hasGroundSatLOS(a, b);
  if (a.type === 'satellite' && b.type === 'ground') return hasGroundSatLOS(b, a);
  return true; // sat↔sat: LOS handled by range/debris, not Earth occlusion in this model
}

/** Evaluate a single directed hop between any two D2 nodes, live. */
export function evalD2Hop(a: D2Node, b: D2Node, debris: Debris[], cond?: D2HopConditions): D2HopResult {
  const wavelengths = wavelengthIntersection(a.supportedWavelengths, b.supportedWavelengths);
  const dist = d2Distance(a, b);
  const los = d2LOS(a, b) && !cond?.forceLOSBlocked;
  const rangeLimit = Math.min(a.maxRangeKm, b.maxRangeKm);
  const wavelength = wavelengths[wavelengths.length - 1] ?? null;

  const posA = nodeLogicalPos(a);
  const posB = nodeLogicalPos(b);
  const { debris: blockingDebris, distanceKm: debrisDistanceKm } = closestDebrisToSegment(debris, posA, posB);
  const debrisBlocked = debrisDistanceKm < DEBRIS_BLOCK_KM;

  const base = {
    fromId: a.id, toId: b.id, distanceKm: dist, wavelength, wavelengths,
    debrisBlocked, debrisName: blockingDebris?.name ?? null, debrisDistanceKm,
  };

  if (!wavelengths.length) return { ...base, ok: false, snrDb: -999, linkMarginDb: -999, reason: `${a.name} ↔ ${b.name}: no shared wavelength` };
  if (!los) return { ...base, ok: false, snrDb: -999, linkMarginDb: -999, reason: `${a.name} ↔ ${b.name}: line of sight unavailable` };
  if (dist > rangeLimit) return { ...base, ok: false, snrDb: -999, linkMarginDb: -999, reason: `${a.name} ↔ ${b.name}: ${dist.toFixed(0)} km exceeds ${rangeLimit.toFixed(0)} km range` };
  if (debrisBlocked) return { ...base, ok: false, snrDb: -999, linkMarginDb: -999, reason: `${a.name} ↔ ${b.name}: beam obstructed by ${blockingDebris?.name ?? 'debris'} (${debrisDistanceKm.toFixed(0)} km clearance)` };

  const budget = computeLinkBudget({
    distanceKm: Math.max(dist, 1),
    wavelengthNm: wavelength!,
    txPowerDbm: a.txPowerDbm,
    txApertureDiamM: 0.3,
    rxApertureDiamM: 0.15,
    rxSensitivityDbm: b.rxSensitivityDbm,
    atmosphericLossDb: (a.type === 'ground' || b.type === 'ground' ? 0.5 : 0.1) + (cond?.extraAtmosphericLossDb ?? 0),
    pointingErrorUrad: cond?.pointingErrorUrad ?? 8,
    beamDivergenceUrad: Math.max(a.beamDivergenceUrad, 1),
  });
  if (budget.snrDb < 8 || budget.linkMarginDb < 0) {
    return { ...base, ok: false, snrDb: budget.snrDb, linkMarginDb: budget.linkMarginDb, reason: `${a.name} ↔ ${b.name}: link budget below threshold` };
  }
  return { ...base, ok: true, snrDb: budget.snrDb, linkMarginDb: budget.linkMarginDb, reason: '' };
}

function d2HopToLink(h: D2HopResult): Link {
  const status: LinkStatus = h.debrisBlocked || !h.ok ? 'DISCONNECTED' : h.snrDb < 15 ? 'DEGRADED' : 'CONNECTED';
  return {
    id: `d2link_${h.fromId}_${h.toId}`,
    nodeAId: h.fromId,
    nodeBId: h.toId,
    selectedWavelength: h.wavelength,
    compatibleWavelengths: h.wavelengths,
    status,
    distanceKm: h.distanceKm,
    hasLOS: !h.debrisBlocked && h.ok,
    receivedPowerDbm: -999,
    snrDb: h.snrDb,
    berLog10: 0,
    linkMarginDb: h.linkMarginDb,
    freeSpaceLossDb: 0,
    atmosphericLossDb: 0,
    pointingLossDb: 0,
    elevationDeg: null,
  };
}

/** Evaluate one specific ordered chain of D2 nodes, live, with full per-hop debris/LOS/range/SNR checks. */
export function evaluateD2Path(nodePath: D2Node[], debris: Debris[], corridor?: D2CorridorContext): Route {
  const hopEvals = nodePath.slice(0, -1).map((n, i) => {
    const b = nodePath[i + 1];
    const cond = corridor?.get(hopKey(n.id, b.id));
    return evalD2Hop(n, b, debris, cond);
  });
  const hopLinks = hopEvals.map(d2HopToLink);
  const nodeIds = nodePath.map(n => n.id);
  const usable = hopEvals.every(h => h.ok);
  const anyDebrisBlocked = hopEvals.some(h => h.debrisBlocked);
  const totalDistanceKm = hopEvals.reduce((sum, h) => sum + h.distanceKm, 0);
  const worstSnrDb = Math.min(...hopEvals.map(h => h.snrDb));
  const worstLinkMarginDb = Math.min(...hopEvals.map(h => h.linkMarginDb));
  const hopCount = hopEvals.length;
  const allPat = nodePath.every(n => n.hasPAT);
  const minRangeMargin = Math.min(...nodePath.slice(0, -1).map((n, i) => Math.min(n.maxRangeKm, nodePath[i + 1].maxRangeKm) - hopEvals[i].distanceKm));
  const score = usable ? Math.max(0, Math.min(1,
    0.42 * Math.max(0, Math.min(1, (worstSnrDb - 8) / 20)) +
    0.28 * Math.max(0, Math.min(1, worstLinkMarginDb / 20)) +
    0.20 * Math.max(0, Math.min(1, minRangeMargin / 1500)) +
    0.10 * Math.max(0, 1 - (hopCount - 2) * 0.18)
  )) : 0;
  const reasons = usable ? [
    `Wavelength compatibility: ${hopEvals.map(h => h.wavelengths.join('/')).join(' → ')} across every hop`,
    `Range check passed on all ${hopCount} hop${hopCount > 1 ? 's' : ''} (tightest margin ${minRangeMargin.toFixed(0)} km)`,
    `Estimated worst-hop SNR ${worstSnrDb.toFixed(1)} dB and link margin ${worstLinkMarginDb.toFixed(1)} dB`,
    allPat ? 'PAT available on every node in the route' : 'One or more nodes have limited PAT capability',
  ] : hopEvals.filter(h => !h.ok).map(h => h.reason);

  return {
    id: `d2path_${nodeIds.join('_')}`,
    hops: nodeIds.slice(0, -1).map((id, i) => ({
      fromId: id, toId: nodeIds[i + 1], linkId: hopLinks[i].id,
      blocked: hopEvals[i].debrisBlocked,
      blockReason: hopEvals[i].debrisBlocked ? hopEvals[i].reason : undefined,
    })),
    nodeIds,
    status: usable ? 'AVAILABLE' : 'UNAVAILABLE',
    totalDistanceKm,
    worstSnrDb,
    worstLinkMarginDb,
    analysis: {
      wavelengthCompatible: hopEvals.every(h => h.wavelengths.length > 0),
      hasLOS: !anyDebrisBlocked,
      snrAcceptable: worstSnrDb >= 8,
      linkMarginAcceptable: worstLinkMarginDb >= 0,
      patStable: allPat,
      debrisFree: !anyDebrisBlocked,
      predictedStability: worstSnrDb >= 18 ? 'stable' : worstSnrDb >= 10 ? 'degrading' : 'unstable',
      score,
      reasons,
    },
    isPrimary: false,
    hopLinks,
  };
}

/**
 * Enumerate every usable chain from `source` to `target` through up to
 * `maxRelays` of the other nodes in `relayPool`. Mirrors findGroundRoutes'
 * depth-first walk but for the heterogeneous ground/satellite D2 network.
 */
export function enumerateD2Paths(
  source: D2Node,
  target: D2Node,
  relayPool: D2Node[],
  debris: Debris[],
  corridor?: D2CorridorContext,
  maxRelays = 3
): D2Node[][] {
  const paths: D2Node[][] = [];
  const walk = (path: D2Node[], relaysUsed: number) => {
    const last = path[path.length - 1];
    const directCond = corridor?.get(hopKey(last.id, target.id));
    const direct = evalD2Hop(last, target, debris, directCond);
    if (direct.ok && path.length >= 2) paths.push([...path, target]);
    if (relaysUsed === maxRelays) return;
    for (const relay of relayPool) {
      if (path.some(n => n.id === relay.id)) continue;
      const cond = corridor?.get(hopKey(last.id, relay.id));
      const hop = evalD2Hop(last, relay, debris, cond);
      if (!hop.ok) continue;
      walk([...path, relay], relaysUsed + 1);
    }
  };
  walk([source], 0);
  return paths;
}
