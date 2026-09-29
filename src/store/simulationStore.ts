/**
 * simulationStore.ts
 * Central Zustand store for all simulation state.
 * The tick loop runs in a setInterval outside React,
 * writes to the store, and React components subscribe.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { D1State, D2State, tickD1, tickD2, createInitialD1State, createInitialD2State, D1_SOURCE_ID, D1_DEST_ID, D1_MAX_NODES, buildD1HopConditions } from '../simulation/engine';
import { RouteChange, RouteChangeReason, Route, PATState } from '../types/links';
import { routeLabel, evaluateGroundPath, findGroundRoutes, evaluateD2Path, enumerateD2Paths, type D2Node, GroundRouteContext, hopKey } from '../simulation/routing';
import { detectAnomaly, diagnose, predict, recommendMitigation } from '../simulation/intelligence';
import { computeDisturbanceEffect, createActiveDisturbance, disturbanceBelongsToD2Mode } from '../simulation/disturbances';
import {
  AnomalyEvent,
  Diagnosis,
  Prediction,
  Mitigation,
  TimelineEvent,
  TimelineEventType,
  TestCase,
  GroundTruthVerification,
  ConfidenceHistoryPoint,
} from '../types/intelligence';
import { DisturbanceType } from '../types/disturbances';
import { ObservableTelemetry, TelemetrySample } from '../types/telemetry';
import { PRESET_TEST_CASES } from './testCases';
import { Wavelength, type GroundStation } from '../types/nodes';
import { orbitalAngularVelocityRadS } from '../simulation/physics';

/** Consecutive node-id pairs along a path — the hops a disturbance targeting "the active route" should hit. */
function pairwise(ids: string[]): Array<[string, string]> {
  return ids.slice(0, -1).map((id, i) => [id, ids[i + 1]] as [string, string]);
}

/** Resolve an ordered id chain to live D2 nodes (ground station + satellites), or null if any id no longer exists. */
function resolveD2Path(d2: D2State, nodeIds: string[]): D2Node[] | null {
  const byId = new Map<string, D2Node>();
  d2.groundStations.forEach(n => byId.set(n.id, n));
  d2.satellites.forEach(n => byId.set(n.id, n));
  const nodes = nodeIds.map(id => byId.get(id));
  return nodes.every((n): n is D2Node => !!n) ? nodes : null;
}

/**
 * Optimistic, nominal-conditions relay-route suggestions for instant UI
 * feedback right after adding a satellite/debris or changing endpoints —
 * the running tick loop immediately supersedes this with disturbance-aware,
 * live-refreshed routes (see tickD2 in engine.ts).
 */
function computeD2Alternates(d2: D2State): Route[] {
  const gs = d2.groundStations[0];
  const sats = d2.satellites;
  const source: D2Node | undefined = d2.linkType === 'ground_sat' ? gs : (sats.find(n => n.id === d2.sourceNodeId) ?? sats[0]);
  const target: D2Node | undefined = d2.linkType === 'ground_sat'
    ? (sats.find(n => n.id === d2.targetNodeId) ?? sats[0])
    : (sats.find(n => n.id === d2.targetNodeId && n.id !== source?.id) ?? sats.find(n => n.id !== source?.id));
  if (!source || !target) return [];
  const relayPool: D2Node[] = sats.filter(s => s.id !== target!.id && s.id !== source!.id);
  const paths = enumerateD2Paths(source, target, relayPool, d2.debris);
  return paths
    .map(p => evaluateD2Path(p, d2.debris))
    .sort((a, b) => b.analysis.score - a.analysis.score || a.hops.length - b.hops.length || a.totalDistanceKm - b.totalDistanceKm)
    .slice(0, 3);
}

/**
 * D2's Ground↔Space and Space↔Space links are independent, simultaneously-live
 * simulations (see D2State.secondaryLink/secondaryPatState/secondaryTelemetryHistory
 * in engine.ts) — D3 can independently observe/diagnose/predict/mitigate either
 * one, as its own sub-dashboard, regardless of which one Dashboard 2 itself is
 * currently driving (`d2.linkType`).
 */
export type D3Source = 'D1' | 'D2_GROUND_SPACE' | 'D2_SPACE_SPACE';

/** Whether the given D3 D2-sub-source is the one D2 is CURRENTLY actively driving (`d2.linkType`), vs. its free-running secondary link. */
export function isD2SourcePrimary(source: D3Source, d2: D2State): boolean {
  if (source === 'D1') return false;
  const wantGroundSpace = source === 'D2_GROUND_SPACE';
  return (d2.linkType === 'ground_sat') === wantGroundSpace;
}

/** Resolve the telemetry history a given D3 source should analyze. */
export function resolveD3History(source: D3Source, d1: D1State, d2: D2State) {
  if (source === 'D1') return d1.telemetryHistory;
  return isD2SourcePrimary(source, d2) ? d2.telemetryHistory : d2.secondaryTelemetryHistory;
}

/** Resolve the alternate routes available for mitigation's SWITCH_ROUTE suggestion — only the D2 link Dashboard 2 is actively routing has any (the secondary link never runs relay search). */
export function resolveD3AltRoutes(source: D3Source, d1: D1State, d2: D2State): Route[] {
  if (source === 'D1') return d1.alternateRoutes;
  return isD2SourcePrimary(source, d2) ? d2.alternateRoutes : [];
}

/** Short display label for a D3 source, for panel headers. */
export function d3SourceLabel(source: D3Source): string {
  if (source === 'D1') return 'Ground FSOC';
  return source === 'D2_GROUND_SPACE' ? 'Space FSOC — Ground ↔ Space' : 'Space FSOC — Space ↔ Space';
}

export interface SimulationStore {
  // ── Simulation Control ────────────────────────────────────────────────────
  isRunning: boolean;
  speed: number;       // 1× 2× 5× etc.
  simTimeS: number;
  tickRef: ReturnType<typeof setInterval> | null;

  // ── Dashboard 1 ───────────────────────────────────────────────────────────
  d1: D1State;
  d1AutoReroute: boolean;
  /** Route currently hovered in the routing panel — previewed on the topology canvas. */
  d1PreviewRouteId: string | null;

  // ── Dashboard 2 ───────────────────────────────────────────────────────────
  d2: D2State;
  d2AutoReroute: boolean;
  d1Paused: boolean;
  d2Paused: boolean;
  d3Paused: boolean;

  // ── Dashboard 3 ───────────────────────────────────────────────────────────
  d3Source: D3Source;
  d3Anomaly: AnomalyEvent | null;
  d3Diagnosis: Diagnosis | null;
  d3Prediction: Prediction | null;
  d3Mitigation: Mitigation | null;
  d3GroundTruthRevealed: boolean;
  d3Verification: GroundTruthVerification | null;
  d3Timeline: TimelineEvent[];
  d3ConfidenceHistory: ConfidenceHistoryPoint[];
  d3LastAnalysisTimeS: number;

  // ── Test Cases ─────────────────────────────────────────────────────────────
  testCases: TestCase[];
  activeTestCaseId: string | null;

  // ── Actions ───────────────────────────────────────────────────────────────
  startSimulation: () => void;
  pauseSimulation: () => void;
  resetSimulation: () => void;
  setSpeed: (speed: number) => void;

  // D1 actions
  addD1Node: () => void;
  removeD1Node: (id: string) => void;
  setD1NodeParams: (id: string, params: Partial<Pick<GroundStation, 'maxRangeKm' | 'txPowerDbm'>>) => void;
  setD1Endpoints: (sourceId: string, destId: string) => void;
  d1SwitchRoute: (routeId: string) => void;
  d1SearchRoutes: () => number;
  setD1PreviewRoute: (routeId: string | null) => void;
  setD1NodeWavelengths: (id: string, wavelengths: Wavelength[]) => void;
  setD1SelectedWavelength: (wavelength: Wavelength) => void;
  injectD1Disturbance: (type: DisturbanceType, intensity: number) => void;
  clearD1Disturbances: () => void;
  setD1AutoReroute: (enabled: boolean) => void;
  d1Reroute: () => void;
  _applyD1Route: (path: string[], reason: RouteChangeReason) => void;

  // D2 actions
  addD2Satellite: () => void;
  addD2Debris: () => void;
  removeD2Debris: (id: string) => void;
  injectD2Disturbance: (type: DisturbanceType, intensity: number) => void;
  clearD2Disturbances: () => void;
  setD2AutoReroute: (enabled: boolean) => void;
  toggleDashboardPause: (dashboard: 'D1' | 'D2' | 'D3') => void;
  setOtherDashboardsPaused: (paused: boolean) => void;
  d2Reroute: () => void;
  d2SelectRoute: (routeId: string) => void;
  /** Explicit node-by-node path the operator builds (ground station + any sequence of satellites). */
  d2ActivateManualPath: (nodeIds: string[]) => void;
  d2ClearManualPath: () => void;
  setD2LinkType: (type: 'ground_sat' | 'sat_sat') => void;
  setD2Endpoints: (sourceId: string, targetId: string) => void;

  // D3 actions
  setD3Source: (source: D3Source) => void;
  revealGroundTruth: () => void;
  acceptMitigation: () => void;
  rejectMitigation: () => void;

  // Test cases
  loadTestCase: (id: string) => void;
  resetTestCase: () => void;
}

let tickInterval: ReturnType<typeof setInterval> | null = null;
const TICK_INTERVAL_MS = 200; // 5 Hz render
const DT_S = 0.2;

const REASON_TEXT: Record<RouteChangeReason, string> = {
  AUTO: 'Adaptive reroute',
  MANUAL: 'Route switched',
  FALLBACK: 'Route node removed — fell back',
  REVERT: 'Direct path recovered — reverted',
  MITIGATION: 'Mitigation applied',
};
function describeRouteChange(c: RouteChange, nodes: Array<{ id: string; name: string }>): string {
  return `${REASON_TEXT[c.reason]}: ${routeLabel(c.from, nodes)}  ⇒  ${routeLabel(c.to, nodes)}`;
}

let eventCounter = 0;
function makeTimelineEvent(
  type: TimelineEventType,
  description: string,
  simTimeS: number,
  severity?: string,
  extra?: Partial<Pick<TimelineEvent, 'diagnosedType' | 'verifiedMatch'>>
): TimelineEvent {
  return {
    id: `evt_${eventCounter++}`,
    timeS: simTimeS,
    wallTime: Date.now(),
    type,
    description,
    severity: severity as any,
    ...extra,
  };
}

/**
 * Retroactively (and going forward) mark every DIAGNOSIS_UPDATED event against
 * what was really happening at that moment, turning the timeline into a
 * confusion matrix. Only ever called once the user has revealed ground truth
 * for this session — nothing here runs, or is visible, before that.
 */
function tagTimelineWithVerification(timeline: TimelineEvent[], history: TelemetrySample[]): TimelineEvent[] {
  if (!history.length) return timeline;
  return timeline.map(ev => {
    if (ev.type !== 'DIAGNOSIS_UPDATED' || !ev.diagnosedType || ev.verifiedMatch !== undefined) return ev;
    // Ground truth as it stood at (or just before) this diagnosis was made.
    let sample: TelemetrySample | undefined;
    for (const s of history) {
      if (s.observable.timestamp <= ev.timeS) sample = s;
      else break;
    }
    const gt = sample?.groundTruth;
    return { ...ev, verifiedMatch: gt ? gt.actualCause === ev.diagnosedType : false };
  });
}


export const useSimStore = create<SimulationStore>()(
  persist(
    (set, get) => ({
      isRunning: false,
      speed: 1,
      simTimeS: 0,
      tickRef: null,

      d1: createInitialD1State(),
      d1AutoReroute: false,
      d1PreviewRouteId: null,

      d2: createInitialD2State(),
      d2AutoReroute: false,
      d1Paused: false,
      d2Paused: false,
      d3Paused: false,

      d3Source: 'D1',
      d3Anomaly: null,
      d3Diagnosis: null,
      d3Prediction: null,
      d3Mitigation: null,
      d3GroundTruthRevealed: false,
      d3Verification: null,
      d3Timeline: [makeTimelineEvent('NORMAL', 'System initialized. All subsystems nominal.', 0)],
      d3ConfidenceHistory: [],
      d3LastAnalysisTimeS: 0,

      testCases: PRESET_TEST_CASES,
      activeTestCaseId: null,

      // ── Control ─────────────────────────────────────────────────────────
      startSimulation: () => {
        if (tickInterval) return;
        set({ isRunning: true });

        tickInterval = setInterval(() => {
          const s = get();
          if (!s.isRunning) return;

          const newSimTime = s.simTimeS + DT_S * s.speed;
          const newD1 = s.d1Paused ? s.d1 : tickD1(s.d1, newSimTime, DT_S, s.speed, { autoReroute: s.d1AutoReroute });
          const newD2 = s.d2Paused ? s.d2 : tickD2(s.d2, newSimTime, DT_S, s.speed, { autoReroute: s.d2AutoReroute });

          // D3 intelligence — runs on telemetry from selected source, no ground truth
          const sourceHistory = resolveD3History(s.d3Source, newD1, newD2).map(t => t.observable);

          let updates: Partial<SimulationStore> = {
            simTimeS: newSimTime,
            d1: newD1,
            d2: newD2,
          };

          // The engine reports every route change it makes itself (auto reroute,
          // fail-back, removed-node fallback); log each exactly once.
          if (newD1.lastRouteChange && newD1.lastRouteChange !== s.d1.lastRouteChange) {
            updates.d3Timeline = [
              ...s.d3Timeline,
              makeTimelineEvent('ROUTE_SWITCHED', describeRouteChange(newD1.lastRouteChange, newD1.nodes), newSimTime),
            ].slice(-100);
          }
          if (newD2.lastRouteChange && newD2.lastRouteChange !== s.d2.lastRouteChange) {
            const d2Nodes = [...newD2.groundStations, ...newD2.satellites];
            updates.d3Timeline = [
              ...(updates.d3Timeline ?? s.d3Timeline),
              makeTimelineEvent('ROUTE_SWITCHED', `[D2] ${describeRouteChange(newD2.lastRouteChange, d2Nodes)}`, newSimTime),
            ].slice(-100);
          }

          // Run intelligence analysis every 2s sim time
          if (!s.d3Paused && newSimTime - s.d3LastAnalysisTimeS >= 2) {
            const anomaly = detectAnomaly(sourceHistory);
            const diagnosis = anomaly ? diagnose(sourceHistory) : s.d3Diagnosis;
            const prediction = sourceHistory.length > 6 ? predict(sourceHistory) : s.d3Prediction;
            const altRoutes = resolveD3AltRoutes(s.d3Source, newD1, newD2);
            const rawMitigation = (diagnosis || prediction) ? recommendMitigation(prediction, diagnosis, altRoutes) : null;

            // Every analysis cycle recomputes a brand-new object even when
            // nothing meaningfully changed, so comparisons below are by VALUE
            // (the actual cause/status/action), not by reference — otherwise
            // the timeline spams a fresh entry every 2s for the same ongoing
            // situation, and an already-accepted/rejected mitigation would
            // silently flip back to a pending one on the very next cycle.
            const prevMitigation = s.d3Mitigation;
            const sameAction = !!prevMitigation && !!rawMitigation && prevMitigation.primaryAction === rawMitigation.primaryAction;
            const prevActioned = !!prevMitigation && (prevMitigation.acceptedAt !== null || prevMitigation.rejectedAt !== null);
            const mitigation: Mitigation | null = !rawMitigation
              ? prevMitigation
              : sameAction && prevActioned
                ? prevMitigation // keep the accepted/rejected state visible instead of reverting to pending
                : sameAction
                  ? { ...rawMitigation, acceptedAt: prevMitigation!.acceptedAt, rejectedAt: prevMitigation!.rejectedAt }
                  : rawMitigation; // genuinely new recommendation

            // Build confidence history point
            const confPoint: ConfidenceHistoryPoint | null = diagnosis ? {
              timeS: newSimTime,
              hypotheses: Object.fromEntries(
                diagnosis.allHypotheses.map(h => [h.type, h.confidence])
              ),
            } : null;

            // Build timeline events
            const newTimeline = [...s.d3Timeline];
            if (anomaly && !s.d3Anomaly) {
              newTimeline.push(makeTimelineEvent(
                'ANOMALY_DETECTED',
                `Anomaly detected — Severity: ${anomaly.severity} — ${anomaly.affectedSubsystem}`,
                newSimTime,
                anomaly.severity
              ));
            }
            if (diagnosis && diagnosis.mostLikelyCause.type !== s.d3Diagnosis?.mostLikelyCause?.type) {
              // If ground truth has already been revealed this session, keep the
              // confusion matrix live from here on; otherwise tag nothing —
              // tagTimelineWithVerification() fills every past event in one
              // shot the moment the user actually reveals it.
              const rawHistory = resolveD3History(s.d3Source, newD1, newD2);
              const liveGt = s.d3GroundTruthRevealed ? rawHistory[rawHistory.length - 1]?.groundTruth : undefined;
              newTimeline.push(makeTimelineEvent(
                'DIAGNOSIS_UPDATED',
                `Diagnosis: ${diagnosis.mostLikelyCause.label} (${(diagnosis.mostLikelyCause.confidence * 100).toFixed(0)}% confidence)`,
                newSimTime,
                undefined,
                {
                  diagnosedType: diagnosis.mostLikelyCause.type,
                  verifiedMatch: s.d3GroundTruthRevealed ? (liveGt ? liveGt.actualCause === diagnosis.mostLikelyCause.type : false) : undefined,
                }
              ));
            }
            if (prediction && prediction.predictedLinkStatus !== s.d3Prediction?.predictedLinkStatus && prediction.predictedLinkStatus !== 'stable') {
              newTimeline.push(makeTimelineEvent(
                'PREDICTION_UPDATED',
                `Link predicted: ${prediction.predictedLinkStatus}${prediction.estimatedTimeToCriticalS ? ` — Critical in ~${prediction.estimatedTimeToCriticalS.toFixed(0)}s` : ''}`,
                newSimTime
              ));
            }
            if (rawMitigation && !sameAction) {
              newTimeline.push(makeTimelineEvent(
                'MITIGATION_RECOMMENDED',
                `Mitigation: ${rawMitigation.primaryAction} — ${rawMitigation.urgency} urgency`,
                newSimTime
              ));
            }

            updates = {
              ...updates,
              d3Anomaly: anomaly ?? s.d3Anomaly,
              d3Diagnosis: diagnosis ?? s.d3Diagnosis,
              d3Prediction: prediction ?? s.d3Prediction,
              d3Mitigation: mitigation ?? s.d3Mitigation,
              d3LastAnalysisTimeS: newSimTime,
              d3Timeline: newTimeline.slice(-100),
              d3ConfidenceHistory: confPoint
                ? [...s.d3ConfidenceHistory, confPoint].slice(-60)
                : s.d3ConfidenceHistory,
            };
          }

          set(updates);
        }, TICK_INTERVAL_MS);
      },

      pauseSimulation: () => {
        if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }
        set({ isRunning: false });
      },

      resetSimulation: () => {
        if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }
        set({
          isRunning: false,
          d1Paused: false, d2Paused: false, d3Paused: false,
          simTimeS: 0,
          d1: createInitialD1State(),
          d2: createInitialD2State(),
          d3Anomaly: null,
          d3Diagnosis: null,
          d3Prediction: null,
          d3Mitigation: null,
          d3GroundTruthRevealed: false,
          d3Verification: null,
          d3Timeline: [makeTimelineEvent('NORMAL', 'Simulation reset. All subsystems nominal.', 0)],
          d3ConfidenceHistory: [],
          d3LastAnalysisTimeS: 0,
          activeTestCaseId: null,
        });
      },

      setSpeed: (speed) => set({ speed }),

      // ── D1 Actions ──────────────────────────────────────────────────────
      addD1Node: () => {
        const s = get();
        const nodes = s.d1.nodes;
        if (nodes.length >= D1_MAX_NODES) return;

        // First free letter → Ground D, E, F… (ids never collide after removals).
        let letter = 'A';
        for (let i = 0; i < 26; i++) {
          const l = String.fromCharCode(65 + i);
          if (!nodes.some(n => n.id === `gs_${l.toLowerCase()}`)) { letter = l; break; }
        }

        // Best-candidate sampling: the free spot farthest from every existing node.
        let best = { x: 0.5, y: 0.75, score: -1 };
        for (let i = 0; i < 80; i++) {
          const x = 0.12 + Math.random() * 0.76;
          const y = 0.16 + Math.random() * 0.68;
          const score = Math.min(...nodes.map(n => Math.hypot((n.x - x) * 500, (n.y - y) * 400)));
          if (score > best.score) best = { x, y, score };
        }

        const newNode: GroundStation = {
          id: `gs_${letter.toLowerCase()}`,
          name: `Ground ${letter}`,
          type: 'ground',
          x: best.x,
          y: best.y,
          homeX: best.x,
          homeY: best.y,
          // Same coordinate mapping the default nodes follow.
          latDeg: 28.65 + (0.5 - best.y) * 1.2,
          lonDeg: 77.2 + (best.x - 0.2),
          supportedWavelengths: [1064, 1550] as Wavelength[],
          txPowerDbm: 20,
          rxSensitivityDbm: -42,
          maxRangeKm: 260,
          hasPAT: true,
          beamDivergenceUrad: 120,
          motionPhase: nodes.length * 1.3 + 0.7,
        };
        set(st => ({
          d1: { ...st.d1, nodes: [...st.d1.nodes, newNode] },
          d3Timeline: [...st.d3Timeline, makeTimelineEvent('NORMAL', `Node added: ${newNode.name}`, st.simTimeS)].slice(-100),
        }));
      },

      removeD1Node: (id) => {
        // The source/destination pair defines the network; only relays can go.
        if (id === get().d1.sourceNodeId || id === get().d1.destNodeId) return;
        set(st => ({
          d1: {
            ...st.d1,
            nodes: st.d1.nodes.filter(n => n.id !== id),
            alternateRoutes: st.d1.alternateRoutes.filter(r => !r.nodeIds.includes(id)),
          },
          d1PreviewRouteId: null,
          d3Timeline: [...st.d3Timeline, makeTimelineEvent('NORMAL', `Node removed: ${st.d1.nodes.find(n => n.id === id)?.name ?? id}`, st.simTimeS)].slice(-100),
        }));
        // If traffic was on a path through the removed node, the next tick
        // falls back automatically (see tickD1).
      },

      setD1NodeParams: (id, params) => {
        set(st => ({
          d1: {
            ...st.d1,
            nodes: st.d1.nodes.map(n => n.id === id ? {
              ...n,
              ...(params.maxRangeKm !== undefined ? { maxRangeKm: Math.max(20, Math.min(600, params.maxRangeKm)) } : {}),
              ...(params.txPowerDbm !== undefined ? { txPowerDbm: Math.max(0, Math.min(40, params.txPowerDbm)) } : {}),
            } : n),
          }
        }));
      },

      setD1PreviewRoute: (routeId) => set({ d1PreviewRouteId: routeId }),
      setD1Endpoints: (sourceId, destId) => {
        if (!sourceId || !destId || sourceId === destId) return;
        set(st => ({ d1: { ...st.d1, sourceNodeId: sourceId, destNodeId: destId, activeRoute: null, alternateRoutes: [], primaryLink: null, activeLink: null, directHealthySinceS: null } }));
      },

      setD1NodeWavelengths: (id, wavelengths) => {
        set(st => ({
          d1: {
            ...st.d1,
            nodes: st.d1.nodes.map(n => n.id === id ? { ...n, supportedWavelengths: wavelengths } : n),
          }
        }));
      },

      setD1SelectedWavelength: (wavelength) => {
        set(st => ({
          d1: {
            ...st.d1,
            primaryLink: st.d1.primaryLink
              ? { ...st.d1.primaryLink, selectedWavelength: wavelength }
              : null,
          }
        }));
      },

      injectD1Disturbance: (type, intensity) => {
        const s = get();
        // Target whichever path is carrying traffic right now — usually the
        // configured source↔destination corridor, but the active relay hops
        // if you've already rerouted, so re-introducing a disturbance after a
        // successful reroute has something real to hit again.
        const targetHops = pairwise(s.d1.activeRoute?.nodeIds ?? [s.d1.sourceNodeId, s.d1.destNodeId]);
        const newDist = createActiveDisturbance(type, intensity, s.simTimeS, s.d1.phase, s.simTimeS, targetHops);
        set(st => ({
          d1: {
            ...st.d1,
            activeDisturbances: [...st.d1.activeDisturbances.filter(d => d.type !== type), newDist],
          },
          d3Timeline: [
            ...st.d3Timeline,
            makeTimelineEvent('DISTURBANCE_INJECTED', `Disturbance injected: ${type} (intensity: ${(intensity * 100).toFixed(0)}%)`, st.simTimeS),
          ],
        }));
      },

      clearD1Disturbances: () => {
        set(st => ({
          d1: { ...st.d1, activeDisturbances: [] },
        }));
      },

      setD1AutoReroute: (enabled) => set({ d1AutoReroute: enabled }),

      // Switch traffic to a specific route (from the routing panel, or the best one).
      d1SwitchRoute: (routeId) => {
        const s = get();
        const target = s.d1.alternateRoutes.find(r => r.id === routeId);
        if (!target || target.status === 'UNAVAILABLE') return;
        get()._applyD1Route(target.nodeIds, 'MANUAL');
      },

      d1Reroute: () => {
        const best = get().d1.alternateRoutes.find(r => r.status !== 'UNAVAILABLE');
        if (!best) return;
        get()._applyD1Route(best.nodeIds, 'MANUAL');
      },

      // Recompute routes right now with live numbers (rather than waiting for the next tick).
      d1SearchRoutes: () => {
        const s = get();
        const nodes = s.d1.nodes;
        const link = s.d1.primaryLink;
        const hopConditions = buildD1HopConditions(
          s.d1.activeDisturbances, s.d1.sourceNodeId, s.d1.destNodeId,
          s.d1.corridorPatState.pointingErrorUrad, s.d1.corridorPatState.trackingStatus === 'LOCKED',
          s.d1.phase, s.simTimeS
        );
        const ctx: GroundRouteContext = {
          sourceId: s.d1.sourceNodeId,
          destId: s.d1.destNodeId,
          hopConditions,
          preferredWavelength: link?.selectedWavelength ?? null,
        };
        const found = findGroundRoutes(nodes, ctx);
        const activeId = s.d1.activeRoute?.id;
        const alternates = found.filter(r => r.id !== activeId).slice(0, 6);
        set(st => ({ d1: { ...st.d1, alternateRoutes: alternates } }));
        return alternates.filter(r => r.status !== 'UNAVAILABLE').length;
      },

      // Internal: make `path` the active route and record why.
      _applyD1Route: (path: string[], reason: RouteChangeReason) => {
        const s = get();
        const link = s.d1.primaryLink;
        const hopConditions = buildD1HopConditions(
          s.d1.activeDisturbances, s.d1.sourceNodeId, s.d1.destNodeId,
          s.d1.corridorPatState.pointingErrorUrad, s.d1.corridorPatState.trackingStatus === 'LOCKED',
          s.d1.phase, s.simTimeS
        );
        const ctx: GroundRouteContext = {
          sourceId: s.d1.sourceNodeId,
          destId: s.d1.destNodeId,
          hopConditions,
          preferredWavelength: link?.selectedWavelength ?? null,
        };
        const route = evaluateGroundPath(path, s.d1.nodes, ctx);
        if (!route) return;
        const from = s.d1.activeRoute?.nodeIds ?? [s.d1.sourceNodeId, s.d1.destNodeId];
        if (from.join('>') === path.join('>')) return;
        const change: RouteChange = { id: Date.now(), atS: s.simTimeS, reason, from, to: path };
        set(st => ({
          d1: {
            ...st.d1,
            activeRoute: { ...route, isPrimary: true, status: route.status === 'AVAILABLE' ? 'ACTIVE' : route.status },
            alternateRoutes: [
              ...(st.d1.activeRoute ? [{ ...st.d1.activeRoute, isPrimary: false, status: 'AVAILABLE' as const }] : []),
              ...st.d1.alternateRoutes,
            ].filter((r, i, arr) => r.id !== route.id && arr.findIndex(x => x.id === r.id) === i),
            lastRouteChange: change,
            directHealthySinceS: null,
          },
          d3Timeline: [
            ...st.d3Timeline,
            makeTimelineEvent('ROUTE_SWITCHED', describeRouteChange(change, st.d1.nodes), st.simTimeS),
          ].slice(-100),
        }));
      },

      // ── D2 Actions ──────────────────────────────────────────────────────
      addD2Satellite: () => {
        const s = get();
        const count = s.d2.satellites.length;
        const newSat = {
          id: `sat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: `FSOC-SAT-${String.fromCharCode(65 + count)}${count >= 26 ? `-${count + 1}` : ''}`, 
          type: 'satellite' as const,
          altitudeKm: 600,
          inclinationDeg: 45,
          // Place the new satellite in the largest open orbital gap. This
          // distributes added satellites around the full orbit instead of
          // stacking them near the ground station on the right side.
          trueAnomalyRad: (() => {
            const existing = s.d2.satellites
              .map(item => ((item.trueAnomalyRad % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI))
              .sort((a, b) => a - b);
            if (existing.length === 0) return 0;
            let bestStart = existing[0], largestGap = -1;
            existing.forEach((angle, i) => {
              const next = i === existing.length - 1 ? existing[0] + 2 * Math.PI : existing[i + 1];
              const gap = next - angle;
              if (gap > largestGap) { largestGap = gap; bestStart = angle; }
            });
            return (bestStart + largestGap / 2) % (2 * Math.PI);
          })(),
          raanDeg: (count * 137.508 + Math.random() * 22) % 360,
          supportedWavelengths: [1550] as Wavelength[],
          txPowerDbm: 28,
          rxSensitivityDbm: -55,
          maxRangeKm: 8000,
          hasPAT: true,
          beamDivergenceUrad: 40,
          canvasX: 0,
          canvasY: 0,
        };
        set(st => {
          const next = { ...st.d2, satellites: [...st.d2.satellites, newSat] };
          return { d2: { ...next, alternateRoutes: computeD2Alternates(next) } };
        });
      },

      addD2Debris: () => {
        const s = get();
        const count = s.d2.debris.length;
        const newDebris = {
          id: `debris_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: `Debris ${String.fromCharCode(65 + count)}${count >= 26 ? `-${count + 1}` : ''}`, 
          altitudeKm: 520 + Math.random() * 60,
          trueAnomalyRad: Math.random() * Math.PI * 2,
          angularVelocityRadS: orbitalAngularVelocityRadS(540) * (0.9 + Math.random() * 0.3),
          sizeM: 0.05 + Math.random() * 0.3,
          riskLevel: (['low', 'medium', 'high'] as const)[Math.floor(Math.random() * 3)],
          canvasX: 0,
          canvasY: 0,
          distanceFromPathKm: 999,
          predictedIntersection: false,
          etaToIntersectionS: 999,
          intersectionDurationS: 0,
        };
        set(st => ({
          d2: { ...st.d2, debris: [...st.d2.debris, newDebris] }
        }));
      },

      removeD2Debris: (id) => {
        set(st => ({ d2: { ...st.d2, debris: st.d2.debris.filter(item => item.id !== id) } }));
      },

      injectD2Disturbance: (type, intensity) => {
        const s = get();
        // Same "hit whatever's currently active" targeting as D1 — see
        // injectD1Disturbance for why this matters after a successful reroute.
        const defaultPair = s.d2.linkType === 'ground_sat'
          ? [s.d2.groundStations[0]?.id, s.d2.targetNodeId]
          : [s.d2.sourceNodeId, s.d2.targetNodeId];
        const targetHops = pairwise(s.d2.activeRoute?.nodeIds ?? (defaultPair.filter(Boolean) as string[]));
        const newDist = createActiveDisturbance(type, intensity, s.simTimeS, s.d2.phase, s.simTimeS, targetHops);
        set(st => ({
          d2: {
            ...st.d2,
            activeDisturbances: [...st.d2.activeDisturbances.filter(d => d.type !== type), newDist],
          },
          d3Timeline: [
            ...st.d3Timeline,
            makeTimelineEvent('DISTURBANCE_INJECTED', `[D2] Disturbance injected: ${type} (intensity: ${(intensity * 100).toFixed(0)}%)`, st.simTimeS),
          ],
        }));
      },

      clearD2Disturbances: () => {
        // Ground↔Space and Space↔Space are independent, simultaneously-live
        // links — "restore normal" only clears whichever one is currently
        // selected, leaving any disturbance on the other link untouched.
        set(st => {
          const groundIds = new Set(st.d2.groundStations.map(g => g.id));
          return {
            d2: {
              ...st.d2,
              activeDisturbances: st.d2.activeDisturbances.filter(
                d => !disturbanceBelongsToD2Mode(d, groundIds, st.d2.linkType)
              ),
            },
          };
        });
      },

      setD2AutoReroute: (enabled) => set({ d2AutoReroute: enabled }),
      toggleDashboardPause: (dashboard) => set(st => ({ [`${dashboard.toLowerCase()}Paused`]: !st[`${dashboard.toLowerCase()}Paused` as 'd1Paused' | 'd2Paused' | 'd3Paused'] } as Pick<SimulationStore, 'd1Paused' | 'd2Paused' | 'd3Paused'>)),
      setOtherDashboardsPaused: (paused) => set({ d1Paused: paused, d3Paused: paused }),

      d2Reroute: () => {
        const s = get();
        const best = s.d2.alternateRoutes.find(r => r.status !== 'UNAVAILABLE');
        if (!best) return;
        get().d2SelectRoute(best.id);
      },

      d2SelectRoute: (routeId) => {
        const s = get();
        const chosen = s.d2.alternateRoutes.find(r => r.id === routeId);
        if (!chosen || chosen.status === 'UNAVAILABLE') return;
        const d2Nodes = [...s.d2.groundStations, ...s.d2.satellites];
        set(st => ({
          d2: { ...st.d2, activeRoute: { ...chosen, status: 'ACTIVE', isPrimary: true, isManual: true }, manualPath: chosen.nodeIds, directHealthySinceS: null },
          d3Timeline: [...st.d3Timeline, makeTimelineEvent('ROUTE_SWITCHED', `[D2] Route switched: ${routeLabel(chosen.nodeIds, d2Nodes)}`, st.simTimeS)],
        }));
      },

      d2ActivateManualPath: (nodeIds) => {
        const s = get();
        if (nodeIds.length < 2) return;
        const nodes = resolveD2Path(s.d2, nodeIds);
        if (!nodes) return;
        const route = evaluateD2Path(nodes, s.d2.debris);
        const d2Nodes = [...s.d2.groundStations, ...s.d2.satellites];
        set(st => ({
          d2: {
            ...st.d2,
            activeRoute: { ...route, isPrimary: true, isManual: true, status: route.status === 'AVAILABLE' ? 'ACTIVE' : route.status },
            manualPath: nodeIds,
            directHealthySinceS: null,
          },
          d3Timeline: [...st.d3Timeline, makeTimelineEvent('ROUTE_SWITCHED', `[D2] Manual path: ${routeLabel(nodeIds, d2Nodes)}`, st.simTimeS)],
        }));
      },

      d2ClearManualPath: () => {
        set(st => ({ d2: { ...st.d2, activeRoute: null, manualPath: null, directHealthySinceS: null } }));
      },

      setD2LinkType: (type) => {
        set(st => {
          const next = { ...st.d2, linkType: type, activeRoute: null, manualPath: null, directHealthySinceS: null };
          return { d2: { ...next, alternateRoutes: computeD2Alternates(next) } };
        });
      },
      setD2Endpoints: (sourceId, targetId) => {
        set(st => {
          const next = { ...st.d2, sourceNodeId: sourceId, targetNodeId: targetId, activeRoute: null, manualPath: null, directHealthySinceS: null };
          return { d2: { ...next, alternateRoutes: computeD2Alternates(next) } };
        });
      },

      // ── D3 Actions ──────────────────────────────────────────────────────
      setD3Source: (source) => {
        set({
          d3Source: source,
          d3Anomaly: null,
          d3Diagnosis: null,
          d3Prediction: null,
          d3Mitigation: null,
          d3GroundTruthRevealed: false,
          d3Verification: null,
          d3ConfidenceHistory: [],
        });
      },

      revealGroundTruth: () => {
        const s = get();
        const sourceHistory = resolveD3History(s.d3Source, s.d1, s.d2);

        const latestSample = sourceHistory[sourceHistory.length - 1];
        const gt = latestSample?.groundTruth;
        const diag = s.d3Diagnosis;

        if (!gt) {
          set({
            d3GroundTruthRevealed: true,
            d3Verification: {
              diagnosedCause: diag?.mostLikelyCause?.label ?? 'No diagnosis',
              actualCause: 'No disturbance active',
              match: diag === null,
              diagnosisConfidence: diag?.confidence ?? 0,
              explanation: 'No active disturbance was present during this analysis window.',
            },
            d3Timeline: tagTimelineWithVerification(s.d3Timeline, sourceHistory),
          });
          return;
        }

        const actualCause = gt.actualCause;
        const diagnosedCause = diag?.mostLikelyCause?.label ?? 'No diagnosis made';
        const diagnosedType = diag?.mostLikelyCause?.type;
        const match = diagnosedType === actualCause || diagnosedCause.toLowerCase().includes(actualCause.toLowerCase().replace(/_/g, ' '));

        let explanation = '';
        let missedSignals: string[] = [];

        if (match) {
          explanation = `The intelligence engine correctly identified ${diagnosedCause} as the cause. The telemetry signature was sufficiently distinct for confident diagnosis.`;
        } else {
          explanation = `The intelligence engine diagnosed ${diagnosedCause}, but the actual cause was ${gt.disturbanceType}. `;
          if (gt.disturbanceType === 'TURBULENCE' && diagnosedType === 'FOG') {
            explanation += 'Turbulence and fog share overlapping SNR degradation signatures. The distinguishing factor is beacon jitter (high for turbulence, low for fog).';
            missedSignals = ['Beacon jitter was not sufficiently elevated to discriminate turbulence from fog.'];
          } else if (gt.disturbanceType === 'SENSOR_NOISE' && diagnosedType === 'CAMERA_VIBRATION') {
            explanation += 'Sensor noise and camera vibration both degrade detection confidence. Camera vibration creates a periodic pointing pattern which sensor noise does not.';
            missedSignals = ['Periodic pointing pattern was not clearly established in the observation window.'];
          } else {
            explanation += 'The observation window may have been insufficient for reliable disambiguation. Additional telemetry would have improved diagnosis accuracy.';
            missedSignals = ['Extended observation window would improve confidence.'];
          }
        }

        const newTimeline = tagTimelineWithVerification([
          ...s.d3Timeline,
          makeTimelineEvent('GROUND_TRUTH_REVEALED', `Ground truth: ${gt.disturbanceType} — Diagnosis ${match ? 'MATCH ✓' : 'MISMATCH ✕'}`, s.simTimeS),
        ], sourceHistory);

        set({
          d3GroundTruthRevealed: true,
          d3Verification: {
            diagnosedCause,
            actualCause: gt.disturbanceType,
            match,
            diagnosisConfidence: diag?.confidence ?? 0,
            explanation,
            missedSignals,
          },
          d3Timeline: newTimeline,
        });
      },

      acceptMitigation: () => {
        const s = get();
        if (!s.d3Mitigation) return;
        const timeline = [...s.d3Timeline, makeTimelineEvent('MITIGATION_ACCEPTED', `Mitigation accepted: ${s.d3Mitigation.primaryAction}`, s.simTimeS)];

        if (s.d3Mitigation.primaryAction === 'SWITCH_ROUTE' && s.d3Mitigation.recommendedRoute) {
          // Only the D2 link Dashboard 2 is actively routing (`isD2SourcePrimary`)
          // ever has alternate routes to recommend — resolveD3AltRoutes returns
          // [] for the secondary link, so this action is never reachable there.
          if (s.d3Source === 'D1') {
            get()._applyD1Route(s.d3Mitigation.recommendedRoute.nodeIds, 'MITIGATION');
            set(st => ({
              d3Mitigation: { ...st.d3Mitigation!, acceptedAt: st.simTimeS },
              d3Timeline: [...st.d3Timeline, timeline[timeline.length - 1]].slice(-100),
            }));
          } else {
            set(st => ({
              d2: { ...st.d2, activeRoute: { ...st.d3Mitigation!.recommendedRoute!, status: 'ACTIVE', isPrimary: true, isManual: true }, manualPath: st.d3Mitigation!.recommendedRoute!.nodeIds, directHealthySinceS: null },
              d3Mitigation: { ...st.d3Mitigation!, acceptedAt: st.simTimeS },
              d3Timeline: timeline,
            }));
          }
        } else if (s.d3Mitigation.primaryAction === 'REACQUIRE_BEACON') {
          // Force a real re-acquisition: send the gimbal back to its search
          // position, clear the PID's accumulated error, and give it a head
          // start so the recovery is visible in the PAT view within seconds.
          const reacquire = (pat: PATState): PATState => ({
            ...pat,
            cameraCenterX: -0.34,
            cameraCenterY: 0.22,
            _integralX: 0,
            _integralY: 0,
            _prevErrorX: 0,
            _prevErrorY: 0,
            acquisitionTimeS: 0,
            trackingStatus: 'ACQUIRING',
            correctionBoost: Math.max(pat.correctionBoost, 0.6),
          });
          set(st => ({
            ...(s.d3Source === 'D1'
              ? { d1: { ...st.d1, patState: reacquire(st.d1.patState) } }
              : isD2SourcePrimary(s.d3Source, st.d2)
                ? { d2: { ...st.d2, patState: reacquire(st.d2.patState) } }
                : { d2: { ...st.d2, secondaryPatState: reacquire(st.d2.secondaryPatState) } }),
            d3Mitigation: { ...st.d3Mitigation!, acceptedAt: st.simTimeS },
            d3Timeline: timeline,
          }));
        } else if (s.d3Mitigation.primaryAction === 'INCREASE_TRACKING_CORRECTION') {
          // Real, temporary pointing-gain boost — tickPAT consumes this to
          // correct faster, then it fades back to normal on its own.
          const boost = (pat: PATState): PATState => ({ ...pat, correctionBoost: 1.6 });
          set(st => ({
            ...(s.d3Source === 'D1'
              ? { d1: { ...st.d1, patState: boost(st.d1.patState) } }
              : isD2SourcePrimary(s.d3Source, st.d2)
                ? { d2: { ...st.d2, patState: boost(st.d2.patState) } }
                : { d2: { ...st.d2, secondaryPatState: boost(st.d2.secondaryPatState) } }),
            d3Mitigation: { ...st.d3Mitigation!, acceptedAt: st.simTimeS },
            d3Timeline: timeline,
          }));
        } else {
          set(st => ({
            d3Mitigation: { ...st.d3Mitigation!, acceptedAt: st.simTimeS },
            d3Timeline: timeline,
          }));
        }
      },

      rejectMitigation: () => {
        const s = get();
        const timeline = [...s.d3Timeline, makeTimelineEvent('MITIGATION_REJECTED' as any, `Mitigation rejected: ${s.d3Mitigation?.primaryAction}`, s.simTimeS)];
        set(st => ({
          d3Mitigation: st.d3Mitigation ? { ...st.d3Mitigation, rejectedAt: st.simTimeS } : null,
          d3Timeline: timeline,
        }));
      },

      // ── Test Cases ──────────────────────────────────────────────────────
      loadTestCase: (id) => {
        const s = get();
        const tc = s.testCases.find(t => t.id === id);
        if (!tc) return;

        // Reset sim first
        s.resetSimulation();

        set({ activeTestCaseId: id });

        // Auto-inject the disturbance after 10 seconds (done by startSimulation + watch)
        // The hidden disturbance is injected by the store, NOT shown to D3
        const { injectD1Disturbance, injectD2Disturbance, startSimulation, setD2LinkType } = get();

        // Set source — D2 test cases also carry which sub-link they exercise,
        // so keep Dashboard 2's actual selection and D3's sub-dashboard in sync.
        if (tc.dashboard === 'D2') {
          setD2LinkType(tc.linkType === 'SAT_SAT' ? 'sat_sat' : 'ground_sat');
          set({ d3Source: tc.linkType === 'SAT_SAT' ? 'D2_SPACE_SPACE' : 'D2_GROUND_SPACE' });
        } else {
          set({ d3Source: 'D1' });
        }

        // Schedule disturbance injection after 10s
        setTimeout(() => {
          if (tc.dashboard === 'D1') {
            injectD1Disturbance(tc.hiddenDisturbance, tc.disturbanceIntensity);
          } else {
            injectD2Disturbance(tc.hiddenDisturbance, tc.disturbanceIntensity);
          }
        }, 10000);

        startSimulation();
      },

      resetTestCase: () => {
        get().resetSimulation();
        set({ activeTestCaseId: null });
      },

    }),
    {
      name: 'fsoc-testbed-storage',
      partialize: (state) => ({
        testCases: state.testCases,
        speed: state.speed,
      }),
    }
  )
);
