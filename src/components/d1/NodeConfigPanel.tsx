import React, { useMemo, useState } from 'react';
import { Cpu, Radio, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Plus, Minus, Trash2, GitBranch } from 'lucide-react';
import { useSimStore } from '../../store/simulationStore';
import { GroundStation, Wavelength, wavelengthIntersection, ALL_WAVELENGTHS } from '../../types/nodes';
import { Link, LinkStatus } from '../../types/links';
import Term from '../shared/Term';
import { D1_SOURCE_ID, D1_DEST_ID, D1_MAX_NODES } from '../../simulation/engine';
import { groundHopLink, groundGeo, shortNodeName } from '../../simulation/routing';

// ─── Wavelength badge colors ──────────────────────────────────────────────────

function wlColor(selected: boolean, compatible: boolean): string {
  if (selected)    return 'bg-fsoc-cyan/20 border-fsoc-cyan text-fsoc-cyan shadow-[0_0_6px_rgba(6,182,212,0.4)]';
  if (compatible)  return 'bg-fsoc-green/10 border-fsoc-green/60 text-fsoc-green hover:bg-fsoc-green/20';
  return 'bg-fsoc-bg border-fsoc-border/60 text-fsoc-dim hover:border-fsoc-cyan/40 hover:text-fsoc-cyan';
}

function wlLabel(wl: Wavelength): string {
  return `${wl} nm`;
}

type Role = 'SOURCE' | 'DESTINATION' | 'RELAY';

function roleOf(id: string, sourceId = D1_SOURCE_ID, destId = D1_DEST_ID): Role {
  return id === sourceId ? 'SOURCE' : id === destId ? 'DESTINATION' : 'RELAY';
}

function roleChip(role: Role): string {
  switch (role) {
    case 'SOURCE':      return 'text-fsoc-cyan border-fsoc-cyan/40 bg-fsoc-cyan/10';
    case 'DESTINATION': return 'text-fsoc-blue border-fsoc-blue/40 bg-fsoc-blue/10';
    default:            return 'text-violet-300 border-violet-300/40 bg-violet-300/10';
  }
}

function statusTone(s: LinkStatus): string {
  switch (s) {
    case 'CONNECTED': return 'text-fsoc-green';
    case 'DEGRADED':  return 'text-fsoc-amber';
    default:          return 'text-fsoc-red';
  }
}

/** Plain-English reason a hop is (not) usable, plus the numbers when it is. */
function describeHop(from: GroundStation, to: GroundStation, link: Link) {
  const range = Math.min(from.maxRangeKm, to.maxRangeKm);
  if (link.compatibleWavelengths.length === 0) {
    return { ok: false, text: 'No common wavelength', tone: 'text-fsoc-red' };
  }
  if (link.distanceKm > range) {
    return { ok: false, text: `Out of range · ${link.distanceKm.toFixed(0)} km > ${range} km`, tone: 'text-fsoc-red' };
  }
  return {
    ok: true,
    text: `${link.distanceKm.toFixed(0)} km · ${link.snrDb.toFixed(1)} dB SNR · ${link.linkMarginDb.toFixed(1)} dB margin`,
    tone: statusTone(link.status),
  };
}

// ─── Small +/- stepper ────────────────────────────────────────────────────────

const Stepper: React.FC<{ label: string; value: string; onDec: () => void; onInc: () => void }> = ({ label, value, onDec, onInc }) => (
  <div className="flex items-center justify-between gap-1 text-[9px]">
    <span className="text-fsoc-dim">{label}</span>
    <span className="flex items-center gap-1">
      <button onClick={onDec} className="rounded border border-fsoc-border/60 p-0.5 text-fsoc-dim hover:border-fsoc-cyan/50 hover:text-fsoc-cyan" aria-label={`Decrease ${label}`}><Minus className="h-2.5 w-2.5" /></button>
      <span className="min-w-[52px] text-center font-mono text-fsoc-cyan">{value}</span>
      <button onClick={onInc} className="rounded border border-fsoc-border/60 p-0.5 text-fsoc-dim hover:border-fsoc-cyan/50 hover:text-fsoc-cyan" aria-label={`Increase ${label}`}><Plus className="h-2.5 w-2.5" /></button>
    </span>
  </div>
);

// ─── Node Card ────────────────────────────────────────────────────────────────

interface NodeCardProps {
  node: GroundStation;
  allNodes: GroundStation[];
  sourceId: string;
  destId: string;
  role: Role;
  onActiveRoute: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Live direct-link (A↔B) — shown on the two endpoint cards. */
  directLink: Link | null;
  selectedWavelength: Wavelength | null;
  compatibleWavelengths: Wavelength[];
  onWavelengthSelect: (wl: Wavelength) => void;
  onWavelengthsChange: (id: string, wls: Wavelength[]) => void;
  onParams: (id: string, p: { maxRangeKm?: number; txPowerDbm?: number }) => void;
  onRemove: (id: string) => void;
}

const NodeCard: React.FC<NodeCardProps> = ({
  node, allNodes, sourceId, destId, role, onActiveRoute, collapsed, onToggleCollapsed, directLink,
  selectedWavelength, compatibleWavelengths, onWavelengthSelect, onWavelengthsChange, onParams, onRemove,
}) => {
  const source = allNodes.find(n => n.id === sourceId);
  const dest = allNodes.find(n => n.id === destId);
  const isRelay = role === 'RELAY';
  const geo = groundGeo(node);

  function toggleWavelength(wl: Wavelength) {
    const current = node.supportedWavelengths;
    if (current.includes(wl)) {
      if (current.length === 1) return; // keep at least one
      onWavelengthsChange(node.id, current.filter(w => w !== wl));
    } else {
      onWavelengthsChange(node.id, [...current, wl].sort((a, b) => a - b) as Wavelength[]);
    }
  }

  // Relays: how well this node connects to each endpoint (nominal conditions).
  const toEndpoints = useMemo(() => {
    if (!isRelay || !source || !dest) return [];
    return [source, dest].map(ep => ({
      ep,
      link: groundHopLink(node, ep),
    }));
  }, [isRelay, node, source, dest]);

  // Endpoints: which relays can currently reach this node.
  const reachableRelays = useMemo(() => {
    if (isRelay) return [];
    return allNodes
      .filter(n => n.id !== node.id && n.id !== sourceId && n.id !== destId)
      .filter(n => groundHopLink(n, node).status !== 'DISCONNECTED')
      .map(n => shortNodeName(n.id, allNodes));
  }, [isRelay, allNodes, node]);

  const bothReachable = toEndpoints.length === 2 && toEndpoints.every(t => describeHop(node, t.ep, t.link).ok);

  return (
    <div className={`rounded-lg border bg-fsoc-bg/40 p-2.5 space-y-2 ${onActiveRoute ? 'border-fsoc-green/40' : 'border-fsoc-border/60'}`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <button onClick={onToggleCollapsed} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={!collapsed}>
          {collapsed ? <ChevronRight className="h-3 w-3 shrink-0 text-fsoc-dim" /> : <ChevronDown className="h-3 w-3 shrink-0 text-fsoc-dim" />}
          <Radio className="h-3.5 w-3.5 shrink-0 text-fsoc-cyan" />
          <span className="truncate text-xs font-semibold text-fsoc-cyan">{node.name}</span>
        </button>
        <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[8px] font-mono tracking-wider ${roleChip(role)}`}>{role}</span>
        {onActiveRoute && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-fsoc-green" title="On the active route" />}
      </div>

      {!collapsed && (
        <>
          {/* Position */}
          <div className="text-[9px] font-mono text-fsoc-dim">
            {geo.latDeg.toFixed(2)}°N {geo.lonDeg.toFixed(2)}°E · <span className="text-violet-300">moving</span>
          </div>

          {/* Specs */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px]">
            <div className="flex justify-between"><span className="text-fsoc-dim">Max Range</span><span className="font-mono text-fsoc-cyan">{node.maxRangeKm} km</span></div>
            <div className="flex justify-between"><span className="text-fsoc-dim">TX Power</span><span className="font-mono text-fsoc-cyan">{node.txPowerDbm} dBm</span></div>
            <div className="flex justify-between"><span className="text-fsoc-dim">RX Sens.</span><span className="font-mono text-fsoc-cyan">{node.rxSensitivityDbm} dBm</span></div>
            <div className="flex justify-between">
              <span className="text-fsoc-dim"><Term>PAT</Term></span>
              <span className={`font-mono ${node.hasPAT ? 'text-fsoc-green' : 'text-fsoc-red'}`}>{node.hasPAT ? '✓ YES' : '✗ NO'}</span>
            </div>
            <div className="col-span-2 flex justify-between"><span className="text-fsoc-dim">Beam Div.</span><span className="font-mono text-fsoc-cyan">{node.beamDivergenceUrad} μrad</span></div>
          </div>

          {/* Live connectivity */}
          <div className="space-y-1 rounded border border-fsoc-border/40 bg-black/10 p-1.5">
            <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-fsoc-dim">
              <GitBranch className="h-3 w-3" /> {isRelay ? 'Relay connectivity' : 'Connectivity'}
            </div>

            {isRelay && toEndpoints.map(({ ep, link }) => {
              const d = describeHop(node, ep, link);
              return (
                <div key={ep.id} className="flex items-start justify-between gap-2 text-[9px]">
                  <span className="shrink-0 text-fsoc-dim">↔ {shortNodeName(ep.id, allNodes)}</span>
                  <span className={`text-right font-mono ${d.tone}`}>{d.text}</span>
                </div>
              );
            })}
            {isRelay && (
              <div className={`text-[9px] ${bothReachable ? 'text-fsoc-green' : 'text-fsoc-amber'}`}>
                {bothReachable
                  ? `Can relay ${shortNodeName(sourceId, allNodes)} → ${shortNodeName(node.id, allNodes)} → ${shortNodeName(destId, allNodes)} directly`
                  : 'Cannot bridge both endpoints alone — may still work in a multi-hop chain'}
              </div>
            )}

            {!isRelay && directLink && (
              <div className="flex items-start justify-between gap-2 text-[9px]">
                <span className="shrink-0 text-fsoc-dim">Direct A↔B</span>
                <span className={`text-right font-mono ${statusTone(directLink.status)}`}>{directLink.status}</span>
              </div>
            )}
            {!isRelay && (
              <div className="flex items-start justify-between gap-2 text-[9px]">
                <span className="shrink-0 text-fsoc-dim">Reachable relays</span>
                <span className="text-right font-mono text-fsoc-cyan">{reachableRelays.length ? reachableRelays.join(', ') : 'none'}</span>
              </div>
            )}
          </div>

          {/* Wavelength badges */}
          <div className="space-y-1">
            <span className="text-[9px] uppercase tracking-wider text-fsoc-dim">Supported λ</span>
            <div className="flex flex-wrap gap-1">
              {ALL_WAVELENGTHS.map(wl => {
                const supported = node.supportedWavelengths.includes(wl);
                const isSelected = !isRelay && selectedWavelength === wl && supported;
                const isCompat = !isRelay && compatibleWavelengths.includes(wl);
                return (
                  <button
                    key={wl}
                    onClick={() => {
                      if (!isRelay && supported && isCompat) onWavelengthSelect(wl);
                      else toggleWavelength(wl);
                    }}
                    title={
                      isRelay ? (supported ? 'Supported — click to remove' : 'Not supported — click to add')
                      : isSelected ? 'Active wavelength'
                      : isCompat ? 'Compatible — click to select'
                      : supported ? 'Supported but not compatible with other node'
                      : 'Not supported — click to add'
                    }
                    className={`rounded border px-1.5 py-0.5 text-[9px] font-mono transition-all duration-150 active:scale-95 ${
                      !supported
                        ? 'border-fsoc-border/40 bg-fsoc-bg text-fsoc-dim opacity-30 hover:opacity-60'
                        : isRelay
                          ? 'border-fsoc-cyan/40 bg-fsoc-cyan/5 text-fsoc-cyan hover:bg-fsoc-cyan/15'
                          : wlColor(isSelected, isCompat)
                    }`}
                  >
                    {wlLabel(wl)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tuning — lets you push a node out of range / weaken it to test rerouting */}
          <div className="space-y-1 border-t border-fsoc-border/40 pt-1.5">
            <Stepper label="Range" value={`${node.maxRangeKm} km`} onDec={() => onParams(node.id, { maxRangeKm: node.maxRangeKm - 20 })} onInc={() => onParams(node.id, { maxRangeKm: node.maxRangeKm + 20 })} />
            <Stepper label="TX power" value={`${node.txPowerDbm} dBm`} onDec={() => onParams(node.id, { txPowerDbm: node.txPowerDbm - 1 })} onInc={() => onParams(node.id, { txPowerDbm: node.txPowerDbm + 1 })} />
          </div>

          {isRelay && (
            <button
              onClick={() => onRemove(node.id)}
              className="flex w-full items-center justify-center gap-1 rounded border border-fsoc-red/30 py-1 text-[9px] font-mono uppercase tracking-wider text-fsoc-red/80 transition-colors hover:bg-fsoc-red/10"
            >
              <Trash2 className="h-3 w-3" /> Remove {node.name}
            </button>
          )}
        </>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const NodeConfigPanel: React.FC = () => {
  const d1State               = useSimStore(s => s.d1);
  const nodes                 = d1State.nodes;
  const sourceId              = d1State.sourceNodeId;
  const destId                = d1State.destNodeId;
  const setD1Endpoints        = useSimStore(s => s.setD1Endpoints);
  const primaryLink           = useSimStore(s => s.d1.primaryLink);
  const activeRoute           = useSimStore(s => s.d1.activeRoute);
  const setD1SelectedWL       = useSimStore(s => s.setD1SelectedWavelength);
  const setD1NodeWavelengths  = useSimStore(s => s.setD1NodeWavelengths);
  const setD1NodeParams       = useSimStore(s => s.setD1NodeParams);
  const removeD1Node          = useSimStore(s => s.removeD1Node);
  const addD1Node             = useSimStore(s => s.addD1Node);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const nodeA = nodes.find(n => n.id === sourceId);
  const nodeB = nodes.find(n => n.id === destId);
  const relays = nodes.filter(n => n.id !== sourceId && n.id !== destId);
  const routeIds = new Set(activeRoute?.nodeIds ?? []);

  const selectedWavelength = primaryLink?.selectedWavelength ?? null;
  const intersection: Wavelength[] = nodeA && nodeB
    ? wavelengthIntersection(nodeA.supportedWavelengths, nodeB.supportedWavelengths)
    : [];
  const noCompatible = intersection.length === 0;
  const atMax = nodes.length >= D1_MAX_NODES;

  const ordered = [nodeA, nodeB, ...relays].filter((n): n is GroundStation => !!n);

  return (
    <div className="min-w-0 space-y-3 rounded-lg border border-fsoc-border bg-fsoc-panel p-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-fsoc-cyan" />
          <span className="text-xs font-semibold uppercase tracking-widest text-fsoc-cyan">Node Configuration</span>
        </div>
        <span className="fsoc-chip px-2 py-0.5 text-[9px] font-mono text-fsoc-dim">{nodes.length} nodes · {relays.length} relay{relays.length === 1 ? '' : 's'}</span>
      </div>

      <div className="h-px bg-fsoc-border/60" />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[9px] font-mono text-fsoc-dim">SOURCE NODE<select value={sourceId} onChange={e => setD1Endpoints(e.target.value, destId)} className="mt-1 w-full rounded border border-fsoc-border bg-[#080d18] px-2 py-1.5 text-[10px] text-white">{nodes.filter(n => n.id !== destId).map(n => <option key={n.id} value={n.id}>{n.name}</option>)}</select></label>
        <label className="text-[9px] font-mono text-fsoc-dim">DESTINATION NODE<select value={destId} onChange={e => setD1Endpoints(sourceId, e.target.value)} className="mt-1 w-full rounded border border-fsoc-border bg-[#080d18] px-2 py-1.5 text-[10px] text-white">{nodes.filter(n => n.id !== sourceId).map(n => <option key={n.id} value={n.id}>{n.name}</option>)}</select></label>
      </div>

      {/* Node cards — selected endpoints, then relays */}
      <div className="space-y-2">
        {ordered.map(node => (
          <NodeCard
            key={node.id}
            node={node}
            allNodes={nodes}
            sourceId={sourceId}
            destId={destId}
            role={roleOf(node.id, sourceId, destId)}
            onActiveRoute={routeIds.has(node.id)}
            collapsed={!!collapsed[node.id]}
            onToggleCollapsed={() => setCollapsed(c => ({ ...c, [node.id]: !c[node.id] }))}
            directLink={primaryLink}
            selectedWavelength={selectedWavelength}
            compatibleWavelengths={intersection}
            onWavelengthSelect={setD1SelectedWL}
            onWavelengthsChange={setD1NodeWavelengths}
            onParams={setD1NodeParams}
            onRemove={removeD1Node}
          />
        ))}
      </div>

      <button
        onClick={addD1Node}
        disabled={atMax}
        className="flex w-full items-center justify-center gap-1.5 rounded border border-dashed border-fsoc-cyan/40 py-1.5 text-[10px] font-mono uppercase tracking-wider text-fsoc-cyan transition-colors hover:bg-fsoc-cyan/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="h-3 w-3" /> {atMax ? `Node limit reached (${D1_MAX_NODES})` : 'Add relay node'}
      </button>

      <div className="h-px bg-fsoc-border/60" />

      {/* Wavelength Intersection (source ↔ destination) */}
      <div className="space-y-2">
        <span className="text-[9px] uppercase tracking-wider text-fsoc-dim">Wavelength Intersection</span>

        {noCompatible ? (
          <div className="flex items-start gap-2 rounded border border-fsoc-red/50 bg-fsoc-red/10 p-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-fsoc-red" />
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-fsoc-red">NO COMPATIBLE WAVELENGTH</p>
              <p className="text-[9px] text-fsoc-red/80">LINK CANNOT BE ESTABLISHED — nodes share no common wavelength.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-1">
              {intersection.map(wl => (
                <button
                  key={wl}
                  onClick={() => setD1SelectedWL(wl)}
                  className={`rounded border px-2 py-0.5 text-[9px] font-mono transition-all active:scale-95 ${
                    selectedWavelength === wl
                      ? 'border-fsoc-cyan bg-fsoc-cyan/20 text-fsoc-cyan shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                      : 'border-fsoc-cyan/40 bg-fsoc-cyan/5 text-fsoc-cyan/80 hover:border-fsoc-cyan hover:bg-fsoc-cyan/15'
                  }`}
                >
                  {wlLabel(wl)}
                  {selectedWavelength === wl && <span className="ml-1 text-fsoc-cyan/70">●</span>}
                </button>
              ))}
            </div>
            {selectedWavelength && intersection.includes(selectedWavelength) && (
              <div className="flex items-center gap-1 text-[9px] text-fsoc-green">
                <CheckCircle2 className="h-3 w-3" />
                <span>Active: <span className="font-mono">{wlLabel(selectedWavelength)}</span></span>
              </div>
            )}
            {!selectedWavelength && <p className="text-[9px] text-fsoc-amber">Click a wavelength above to select for this link.</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default NodeConfigPanel;
