import React, { useEffect, useRef, useState } from 'react';
import { Radio, CheckCircle2, XCircle, AlertTriangle, RefreshCw, GitBranch, ToggleLeft, ToggleRight, Plus } from 'lucide-react';
import { useSimStore } from '../../store/simulationStore';
import { Route, RouteStatus } from '../../types/links';
import { GroundStation } from '../../types/nodes';
import { D1_SOURCE_ID, D1_DEST_ID, D1_MAX_NODES, D1_REVERT_HOLD_S } from '../../simulation/engine';
import { routeLabel, shortNodeName } from '../../simulation/routing';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function routeStatusColor(s: RouteStatus): string {
  switch (s) {
    case 'ACTIVE':      return 'text-fsoc-green border-fsoc-green bg-fsoc-green/10';
    case 'AVAILABLE':   return 'text-fsoc-cyan border-fsoc-cyan bg-fsoc-cyan/10';
    case 'DEGRADED':    return 'text-fsoc-amber border-fsoc-amber bg-fsoc-amber/10';
    case 'UNAVAILABLE': return 'text-fsoc-red border-fsoc-red bg-fsoc-red/10';
    default:            return 'text-fsoc-dim border-fsoc-border bg-transparent';
  }
}

function scoreColor(score: number): string {
  if (score >= 75) return 'text-fsoc-green';
  if (score >= 50) return 'text-fsoc-amber';
  return 'text-fsoc-red';
}

const isDirect = (r: Route) => r.nodeIds.length === 2;
const fmt = (v: number, unit: string) => (v <= -900 ? '—' : `${v.toFixed(1)} ${unit}`);

// ─── Analysis Checkmark ───────────────────────────────────────────────────────

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px]">
      {ok
        ? <CheckCircle2 className="w-3 h-3 text-fsoc-green flex-shrink-0" />
        : <XCircle className="w-3 h-3 text-fsoc-red flex-shrink-0" />}
      <span className={ok ? 'text-fsoc-dim' : 'text-fsoc-red/80'}>{label}</span>
    </div>
  );
}

// ─── Alternate Route Card ─────────────────────────────────────────────────────

interface AltRouteCardProps {
  route: Route;
  nodes: GroundStation[];
  onSwitch: () => void;
  onPreview: (on: boolean) => void;
  isSearching: boolean;
}

const AltRouteCard: React.FC<AltRouteCardProps> = ({ route, nodes, onSwitch, onPreview, isSearching }) => {
  const a = route.analysis;
  const score = Math.round(a.score * 100);
  const path = routeLabel(route.nodeIds, nodes);
  const direct = isDirect(route);
  const relays = route.nodeIds.slice(1, -1).map(id => shortNodeName(id, nodes));

  return (
    <div
      className="border border-fsoc-border/50 bg-fsoc-bg/30 rounded p-2 space-y-2"
      onMouseEnter={() => onPreview(true)}
      onMouseLeave={() => onPreview(false)}
    >
      {/* Path + Score */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <GitBranch className="w-3 h-3 text-fsoc-cyan flex-shrink-0" />
          <span className="truncate text-[10px] font-mono text-fsoc-cyan" title={route.nodeIds.join(' → ')}>{path}</span>
        </div>
        <span className={`shrink-0 text-[10px] font-mono font-bold ${scoreColor(score)}`}>{score}%</span>
      </div>

      <div className="flex flex-wrap items-center gap-1 text-[8px] font-mono">
        <span className={`rounded border px-1 py-0.5 ${routeStatusColor(route.status)}`}>{route.status}</span>
        <span className="rounded border border-fsoc-border/60 px-1 py-0.5 text-fsoc-dim">
          {direct ? 'DIRECT' : `VIA ${relays.join(' + ')}`}
        </span>
        <span className="rounded border border-fsoc-border/60 px-1 py-0.5 text-fsoc-dim">{route.hops.length} HOP{route.hops.length === 1 ? '' : 'S'}</span>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
        <div className="text-[9px] text-fsoc-dim">
          <span>Dist: </span>
          <span className="font-mono text-fsoc-cyan">{route.totalDistanceKm.toFixed(1)} km</span>
        </div>
        <div className="text-[9px] text-fsoc-dim">
          <span>SNR: </span>
          <span className="font-mono text-fsoc-cyan">{fmt(route.worstSnrDb, 'dB')}</span>
        </div>
        <div className="text-[9px] text-fsoc-dim">
          <span>Margin: </span>
          <span className="font-mono text-fsoc-cyan">{fmt(route.worstLinkMarginDb, 'dB')}</span>
        </div>
        <div className="text-[9px] text-fsoc-dim">
          <span>Stability: </span>
          <span className={`font-mono ${
            a.predictedStability === 'stable' ? 'text-fsoc-green'
            : a.predictedStability === 'degrading' ? 'text-fsoc-amber' : 'text-fsoc-red'
          }`}>{a.predictedStability}</span>
        </div>
      </div>

      {/* Analysis checks */}
      <div className="space-y-0.5">
        <Check ok={a.wavelengthCompatible}  label="Compatible wavelength" />
        <Check ok={a.hasLOS}                label="Line of sight" />
        <Check ok={a.snrAcceptable}         label="SNR acceptable (≥12 dB)" />
        <Check ok={a.linkMarginAcceptable}  label="Link margin acceptable" />
        <Check ok={a.patStable}             label="PAT stable" />
      </div>

      {/* Switch button */}
      <button
        onClick={onSwitch}
        disabled={route.status === 'UNAVAILABLE' || isSearching}
        className="w-full text-[10px] font-mono font-semibold py-1 px-2 rounded border border-fsoc-cyan/60 text-fsoc-cyan bg-fsoc-cyan/10 hover:bg-fsoc-cyan/20 active:scale-95 transition-all uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {route.status === 'UNAVAILABLE' ? 'Route unavailable' : direct ? 'Switch back to direct' : 'Switch to This Route'}
      </button>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const RoutingPanel: React.FC = () => {
  const d1State           = useSimStore(s => s.d1);
  const nodes             = d1State.nodes;
  const sourceId          = d1State.sourceNodeId;
  const destId            = d1State.destNodeId;
  const primaryLink       = useSimStore(s => s.d1.primaryLink);
  const activeRoute       = useSimStore(s => s.d1.activeRoute);
  const alternateRoutes   = useSimStore(s => s.d1.alternateRoutes);
  const healthySince      = useSimStore(s => s.d1.directHealthySinceS);
  const simTimeS          = useSimStore(s => s.simTimeS);
  const d1AutoReroute     = useSimStore(s => s.d1AutoReroute);
  const setD1AutoReroute  = useSimStore(s => s.setD1AutoReroute);
  const d1SwitchRoute     = useSimStore(s => s.d1SwitchRoute);
  const d1SearchRoutes    = useSimStore(s => s.d1SearchRoutes);
  const setPreview        = useSimStore(s => s.setD1PreviewRoute);
  const addD1Node         = useSimStore(s => s.addD1Node);

  const [isSearching, setIsSearching] = useState(false);
  const [foundCount, setFoundCount] = useState<number | null>(null);
  const timer = useRef<number | null>(null);

  // Never leave a stale preview highlight on the canvas.
  useEffect(() => () => {
    setPreview(null);
    if (timer.current) window.clearTimeout(timer.current);
  }, [setPreview]);

  const relayActive = !!activeRoute && activeRoute.nodeIds.length > 2;
  const path = activeRoute ? routeLabel(activeRoute.nodeIds, nodes) : `${shortNodeName(sourceId, nodes)} → ${shortNodeName(destId, nodes)}`;

  const snrDb    = activeRoute?.worstSnrDb ?? -999;
  const marginDb = activeRoute?.worstLinkMarginDb ?? -999;
  const routeStatus: RouteStatus = activeRoute?.status ?? 'ACTIVE';
  const isPrimaryAlert = routeStatus === 'DEGRADED' || routeStatus === 'UNAVAILABLE' || (snrDb > -900 && snrDb < 15);

  const usableAlternates = alternateRoutes.filter(r => r.status !== 'UNAVAILABLE');
  const directStatus = primaryLink?.status ?? 'DISCONNECTED';
  const failbackIn = d1AutoReroute && relayActive && healthySince !== null
    ? Math.max(0, Math.ceil(D1_REVERT_HOLD_S - (simTimeS - healthySince)))
    : null;
  const atMax = nodes.length >= D1_MAX_NODES;

  function handleSearch() {
    if (isSearching) return;
    setIsSearching(true);
    setFoundCount(d1SearchRoutes());
    timer.current = window.setTimeout(() => setIsSearching(false), 700);
  }

  return (
    <div className="min-w-0 bg-fsoc-panel border border-fsoc-border rounded-lg p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-fsoc-cyan" />
          <span className="text-xs font-semibold text-fsoc-cyan uppercase tracking-widest">Adaptive Routing</span>
        </div>
        {/* Auto-reroute toggle */}
        <button
          onClick={() => setD1AutoReroute(!d1AutoReroute)}
          className="flex items-center gap-1 text-[10px] text-fsoc-dim hover:text-fsoc-cyan transition-colors"
          title={d1AutoReroute ? 'Auto: reroutes when the active path fails, fails back when direct recovers' : 'Manual: you choose the route'}
        >
          {d1AutoReroute ? <ToggleRight className="w-4 h-4 text-fsoc-cyan" /> : <ToggleLeft className="w-4 h-4 text-fsoc-dim" />}
          <span className={d1AutoReroute ? 'text-fsoc-cyan' : 'text-fsoc-dim'}>AUTO</span>
        </button>
      </div>

      <div className="h-px bg-fsoc-border/60" />

      {/* Primary Route = the path traffic is on right now */}
      <div className={`rounded border p-2 space-y-1.5 transition-all ${
        isPrimaryAlert
          ? 'border-fsoc-amber/60 bg-fsoc-amber/5 shadow-[0_0_6px_rgba(251,191,36,0.15)]'
          : 'border-fsoc-border/50 bg-fsoc-bg/30'
      }`}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold text-fsoc-dim uppercase tracking-wider">Primary Route</span>
          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${routeStatusColor(routeStatus)}`}>{routeStatus}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Radio className="w-3 h-3 text-fsoc-cyan flex-shrink-0" />
          <span className="min-w-0 truncate text-[10px] font-mono text-fsoc-cyan" title={activeRoute?.nodeIds.join(' → ')}>{path}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px]">
          <div className="flex justify-between">
            <span className="text-fsoc-dim">SNR:</span>
            <span className={`font-mono ${snrDb < 12 ? 'text-fsoc-red' : snrDb < 18 ? 'text-fsoc-amber' : 'text-fsoc-green'}`}>{fmt(snrDb, 'dB')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-fsoc-dim">Margin:</span>
            <span className={`font-mono ${marginDb < 3 ? 'text-fsoc-red' : marginDb < 6 ? 'text-fsoc-amber' : 'text-fsoc-green'}`}>{fmt(marginDb, 'dB')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-fsoc-dim">Hops:</span>
            <span className="font-mono text-fsoc-cyan">{activeRoute?.hops.length ?? 1}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-fsoc-dim">Distance:</span>
            <span className="font-mono text-fsoc-cyan">{(activeRoute?.totalDistanceKm ?? 0).toFixed(0)} km</span>
          </div>
        </div>
        {isPrimaryAlert && (
          <div className="flex items-center gap-1 text-[9px] text-fsoc-amber">
            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
            <span>
              {usableAlternates.length > 0
                ? 'Active path degraded — consider alternate route'
                : 'Active path degraded — no usable alternate route'}
            </span>
          </div>
        )}
      </div>

      {/* Live route state */}
      <div className={`rounded border px-2 py-2 ${relayActive ? 'border-fsoc-green/40 bg-fsoc-green/5' : 'border-fsoc-border/50 bg-fsoc-bg/20'}`}>
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-semibold text-fsoc-dim uppercase tracking-wider">Live path</span>
          <span className={relayActive ? 'text-fsoc-green text-[9px] font-mono animate-pulse' : 'text-fsoc-cyan text-[9px] font-mono'}>
            {relayActive ? `RELAY ACTIVE · ${activeRoute!.hops.length} HOPS` : 'DIRECT ACTIVE'}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <GitBranch className="w-3 h-3 text-fsoc-green flex-shrink-0" />
          <span className="min-w-0 truncate text-[10px] font-mono text-fsoc-green">{path}</span>
        </div>

        {relayActive && (
          <>
            <div className="mt-2 space-y-0.5">
              {(activeRoute!.hopLinks ?? []).map(l => (
                <div key={l.id} className="flex items-center justify-between gap-2 text-[9px] font-mono">
                  <span className="text-fsoc-dim">{shortNodeName(l.nodeAId, nodes)} → {shortNodeName(l.nodeBId, nodes)}</span>
                  <span className="text-fsoc-cyan">{l.distanceKm.toFixed(0)} km · {fmt(l.snrDb, 'dB')} · {l.selectedWavelength ?? '—'} nm</span>
                </div>
              ))}
            </div>
            <div className="mt-1.5 text-[9px] text-fsoc-dim">
              Traffic moved off the direct {shortNodeName(sourceId, nodes)}↔{shortNodeName(destId, nodes)} link
              (now <span className={directStatus === 'CONNECTED' ? 'text-fsoc-green' : 'text-fsoc-amber'}>{directStatus}</span>).
              {failbackIn !== null && <span className="text-fsoc-cyan"> Direct path healthy — failing back in {failbackIn}s.</span>}
            </div>
          </>
        )}
      </div>

      {/* Alternate Routes */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-fsoc-dim uppercase tracking-wider">Alternate Routes</span>
          <span className="text-[9px] text-fsoc-dim font-mono">{usableAlternates.length} found</span>
        </div>

        {alternateRoutes.length === 0 ? (
          <div className="space-y-1.5 rounded border border-dashed border-fsoc-border/40 py-2 text-center">
            <div className="text-[10px] text-fsoc-dim">No alternate routes available</div>
            <button
              onClick={addD1Node}
              disabled={atMax}
              className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-fsoc-cyan hover:underline disabled:opacity-40"
            >
              <Plus className="w-3 h-3" /> Add a relay node
            </button>
          </div>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto overflow-x-hidden pr-0.5">
            {alternateRoutes.map(r => (
              <AltRouteCard
                key={r.id}
                route={r}
                nodes={nodes}
                onSwitch={() => d1SwitchRoute(r.id)}
                onPreview={on => setPreview(on ? r.id : null)}
                isSearching={isSearching}
              />
            ))}
          </div>
        )}
      </div>

      {/* Search button */}
      <div className="space-y-1">
        <button
          onClick={handleSearch}
          disabled={isSearching}
          className="w-full flex items-center justify-center gap-1.5 text-[10px] font-mono font-semibold py-1.5 px-2 rounded border border-fsoc-cyan/60 text-fsoc-cyan bg-fsoc-cyan/10 hover:bg-fsoc-cyan/20 active:scale-95 transition-all uppercase tracking-wider disabled:opacity-60"
        >
          <RefreshCw className={`w-3 h-3 ${isSearching ? 'animate-spin' : ''}`} />
          {isSearching ? 'Searching...' : 'Search Alternate Route'}
        </button>
        {foundCount !== null && !isSearching && (
          <div className="text-center text-[9px] font-mono text-fsoc-dim">
            Scan complete — {foundCount} usable alternate{foundCount === 1 ? '' : 's'} across {nodes.length} nodes
          </div>
        )}
      </div>
    </div>
  );
};

export default RoutingPanel;
