import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSimStore } from '../../store/simulationStore';
import { GroundStation } from '../../types/nodes';
import { Link, LinkStatus, RouteChangeReason } from '../../types/links';
import { Navigation, Radio, Move3D } from 'lucide-react';
import { D1_SOURCE_ID, D1_DEST_ID } from '../../simulation/engine';
import { groundHopLink, groundGeo, routeLabel, shortNodeName } from '../../simulation/routing';

const SVG_W = 500;
const SVG_H = 350;
// The testbed maps normalised coordinates to 500 km × 400 km.
const KM_PER_PX_X = 500 / SVG_W;
const KM_PER_PX_Y = 400 / SVG_H;

interface LinkVisual {
  stroke: string;
  strokeDash: string;
  strokeWidth: number;
  opacity: number;
  animClass: string;
}

function linkVisual(status: LinkStatus): LinkVisual {
  switch (status) {
    case 'CONNECTED': return { stroke: '#06b6d4', strokeDash: '8 4', strokeWidth: 2, opacity: 0.9, animClass: 'link-active' };
    case 'DEGRADED': return { stroke: '#fbbf24', strokeDash: '6 4', strokeWidth: 2, opacity: 0.8, animClass: 'link-degraded' };
    case 'CRITICAL': return { stroke: '#ef4444', strokeDash: '4 3', strokeWidth: 2.5, opacity: 0.9, animClass: 'link-unavailable' };
    case 'DISCONNECTED': return { stroke: '#ef4444', strokeDash: '3 4', strokeWidth: 1.5, opacity: 0.45, animClass: 'link-unavailable' };
    default: return { stroke: '#334155', strokeDash: '4 4', strokeWidth: 1, opacity: 0.4, animClass: '' };
  }
}

const roleOf = (id: string, sourceId: string, destId: string) => (id === sourceId ? 'SOURCE' : id === destId ? 'DEST' : 'RELAY');

const BANNER_TITLE: Record<RouteChangeReason, string> = {
  AUTO: 'ADAPTIVE ROUTE SWITCH',
  MANUAL: 'ROUTE SWITCHED',
  FALLBACK: 'NODE REMOVED · REROUTED',
  REVERT: 'FAIL-BACK TO DIRECT',
  MITIGATION: 'MITIGATION APPLIED',
};

// ─── Node ─────────────────────────────────────────────────────────────────────

interface NodeCircleProps {
  node: GroundStation;
  isRouteNode: boolean;
  isHovered: boolean;
  simTime: number;
  sourceId: string;
  destId: string;
  onHover: (id: string | null) => void;
}

const NodeCircle: React.FC<NodeCircleProps> = ({ node, isRouteNode, isHovered, simTime, sourceId, destId, onHover }) => {
  const cx = node.x * SVG_W;
  const cy = node.y * SVG_H;
  const angle = Math.atan2(
    Math.cos(simTime * 0.18 + (node.motionPhase ?? 0)),
    Math.cos(simTime * 0.22 + (node.motionPhase ?? 0))
  );
  const arrowX = cx + Math.cos(angle) * 24;
  const arrowY = cy + Math.sin(angle) * 24;
  const role = roleOf(node.id, sourceId, destId);

  return (
    <g onMouseEnter={() => onHover(node.id)} onMouseLeave={() => onHover(null)} style={{ cursor: 'pointer' }}>
      {isRouteNode && <circle cx={cx} cy={cy} r={25} fill="rgba(6,182,212,0.07)" stroke="#06b6d4" strokeWidth={1} strokeDasharray="3 4" />}
      {isRouteNode && <circle cx={cx} cy={cy} r={20} fill="none" stroke="#69e6a6" strokeWidth={1} opacity={0.65} />}
      <circle cx={cx} cy={cy} r={16} fill={isRouteNode ? '#06b6d4' : '#1e293b'} fillOpacity={0.16} stroke={isRouteNode ? '#06b6d4' : '#475569'} strokeWidth={isHovered ? 2.5 : 1.5} />
      <circle cx={cx + 10} cy={cy - 10} r={4} fill={isRouteNode ? '#69e6a6' : '#64748b'} />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize={12} fill={isRouteNode ? '#06b6d4' : '#64748b'} fontFamily="monospace">⌖</text>
      <line x1={cx} y1={cy} x2={arrowX} y2={arrowY} stroke="#a78bfa" strokeWidth={1.4} markerEnd="url(#motionArrow)" opacity={0.8} />
      <text x={cx} y={cy + 30} textAnchor="middle" fontSize={10} fontFamily="monospace" fontWeight="600" fill={isRouteNode ? '#69e6a6' : '#94a3b8'}>
        {node.name}
      </text>
      <text x={cx} y={cy + 40} textAnchor="middle" fontSize={7} fontFamily="monospace" letterSpacing="1" fill={role === 'RELAY' ? '#a78bfa' : '#64748b'}>
        {role}
      </text>
    </g>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────

const NetworkCanvas: React.FC = () => {
  const d1State = useSimStore(s => s.d1);
  const nodes = d1State.nodes;
  const sourceId = d1State.sourceNodeId;
  const destId = d1State.destNodeId;
  const primaryLink = useSimStore(s => s.d1.primaryLink);
  const activeRoute = useSimStore(s => s.d1.activeRoute);
  const alternateRoutes = useSimStore(s => s.d1.alternateRoutes);
  const previewId = useSimStore(s => s.d1PreviewRouteId);
  const change = useSimStore(s => s.d1.lastRouteChange);
  const simTime = useSimStore(s => s.simTimeS);

  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ title: string; text: string } | null>(null);
  const seenChange = useRef<number | undefined>(change?.id);

  // Flash a banner whenever the active route changes (auto, manual, fallback…).
  useEffect(() => {
    if (!change || change.id === seenChange.current) return;
    seenChange.current = change.id;
    setBanner({ title: BANNER_TITLE[change.reason], text: routeLabel(change.to, nodes) });
    const t = window.setTimeout(() => setBanner(null), 2600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [change?.id]);

  const byId = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);
  const pairKey = (a: string, b: string) => [a, b].sort().join('|');
  const directKey = pairKey(sourceId, destId);

  const activeHops = useMemo(() => activeRoute?.hops ?? [], [activeRoute]);
  const activeKeys = useMemo(() => new Set(activeHops.map(h => pairKey(h.fromId, h.toId))), [activeHops]);
  const previewRoute = previewId ? alternateRoutes.find(r => r.id === previewId) : undefined;
  const previewKeys = useMemo(
    () => new Set((previewRoute?.hops ?? []).map(h => pairKey(h.fromId, h.toId))),
    [previewRoute]
  );
  const routeIds = useMemo(() => new Set(activeRoute?.nodeIds ?? [sourceId, destId]), [activeRoute]);

  // Every pair of nodes that could form a hop (in range + shared wavelength).
  const segments = useMemo(() => {
    const out: Array<{ key: string; a: GroundStation; b: GroundStation; kind: 'mesh' | 'direct' | 'preview' | 'active'; from: GroundStation; to: GroundStation }> = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const key = pairKey(a.id, b.id);
        const isActive = activeKeys.has(key);
        const isPreview = previewKeys.has(key);
        const isDirect = key === directKey;
        const feasible = groundHopLink(a, b).status !== 'DISCONNECTED' || groundHopLink(b, a).status !== 'DISCONNECTED';
        if (!(isActive || isPreview || isDirect || feasible)) continue;
        const hop = activeHops.find(h => pairKey(h.fromId, h.toId) === key);
        const from = hop ? byId.get(hop.fromId) ?? a : a;
        const to = hop ? byId.get(hop.toId) ?? b : b;
        out.push({ key, a, b, from, to, kind: isActive ? 'active' : isPreview ? 'preview' : isDirect ? 'direct' : 'mesh' });
      }
    }
    const weight = { mesh: 0, direct: 1, preview: 2, active: 3 } as const;
    return out.sort((x, y) => weight[x.kind] - weight[y.kind]);
  }, [nodes, activeKeys, previewKeys, activeHops, byId, directKey]);

  // Link tooltip data (live for the direct corridor / active hops, nominal otherwise).
  function linkInfo(seg: { key: string; a: GroundStation; b: GroundStation; from: GroundStation; to: GroundStation }): Link {
    if (seg.key === directKey && primaryLink) return primaryLink;
    const hop = activeRoute?.hopLinks?.find(l => pairKey(l.nodeAId, l.nodeBId) === seg.key);
    return hop ?? groundHopLink(seg.from, seg.to);
  }

  const throughRelay = (activeRoute?.nodeIds.length ?? 2) > 2;
  const primaryStatus = primaryLink?.status ?? 'DISCONNECTED';
  const activeLabel = activeRoute ? routeLabel(activeRoute.nodeIds, nodes) : 'A → B';
  const hoveredNodeObj = hoveredNode ? byId.get(hoveredNode) : undefined;
  const hoveredSeg = hoveredLink ? segments.find(s => s.key === hoveredLink) : undefined;

  return (
    <div className="bg-fsoc-panel border border-fsoc-border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-fsoc-cyan" />
          <span className="text-xs font-semibold text-fsoc-cyan uppercase tracking-widest">Network Topology</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="fsoc-chip px-2 py-1 text-[9px] text-fsoc-dim flex items-center gap-1"><Move3D className="w-3 h-3 text-violet-300" /> NODES MOVING</span>
          {banner && <span className="fsoc-chip px-2 py-1 text-[9px] text-fsoc-green border-fsoc-green/40 animate-pulse">REROUTING LINK...</span>}
        </div>
      </div>
      <div className="h-px bg-fsoc-border/60" />
      <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-[9px] font-mono text-fsoc-dim px-1">
        <span>DIRECT: <b className="text-fsoc-cyan">{shortNodeName(sourceId, nodes)} → {shortNodeName(destId, nodes)}</b></span>
        <span>ACTIVE: <b className="text-fsoc-green">{activeLabel}</b></span>
        <span>STATUS: <b className={primaryStatus === 'CONNECTED' ? 'text-fsoc-green' : 'text-fsoc-amber'}>{primaryStatus}</b></span>
      </div>
      <div className="overflow-hidden rounded border border-fsoc-border/30 bg-[#060a14] relative">
        <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full h-auto">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(6,182,212,0.05)" strokeWidth="0.5" /></pattern>
            <marker id="motionArrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 z" fill="#a78bfa" /></marker>
          </defs>
          <rect width={SVG_W} height={SVG_H} fill="url(#grid)" />

          {/* Range of the hovered node */}
          {hoveredNodeObj && (
            <ellipse
              cx={hoveredNodeObj.x * SVG_W} cy={hoveredNodeObj.y * SVG_H}
              rx={hoveredNodeObj.maxRangeKm / KM_PER_PX_X} ry={hoveredNodeObj.maxRangeKm / KM_PER_PX_Y}
              fill="rgba(167,139,250,0.04)" stroke="#a78bfa" strokeOpacity={0.35} strokeDasharray="4 5" strokeWidth={1}
            />
          )}

          {/* Links: possible (faint) → direct → previewed → active */}
          {segments.map(seg => {
            const x1 = seg.from.x * SVG_W, y1 = seg.from.y * SVG_H, x2 = seg.to.x * SVG_W, y2 = seg.to.y * SVG_H;
            const vis = linkVisual(primaryStatus);
            return (
              <g key={seg.key}>
                {seg.kind === 'mesh' && (
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#475569" strokeOpacity={0.35} strokeWidth={1} strokeDasharray="2 5" />
                )}
                {seg.kind === 'direct' && (
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={vis.stroke} strokeWidth={vis.strokeWidth} strokeDasharray={vis.strokeDash} strokeOpacity={vis.opacity} className={vis.animClass} />
                )}
                {seg.kind === 'preview' && (
                  <>
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#a78bfa" strokeWidth={7} strokeOpacity={0.14} />
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#a78bfa" strokeWidth={2.4} strokeDasharray="7 4" strokeOpacity={0.95} />
                  </>
                )}
                {seg.kind === 'active' && (
                  <>
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#69e6a6" strokeWidth={8} strokeOpacity={0.12} />
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#69e6a6" strokeWidth={3.2} strokeDasharray="10 4" strokeOpacity={0.95} className="link-route" />
                    <circle r="4" fill="#69e6a6" className="route-packet">
                      <animateMotion dur="1.4s" repeatCount="indefinite" path={`M ${x1} ${y1} L ${x2} ${y2}`} />
                    </circle>
                  </>
                )}
                {/* wide invisible hit-target for the hover tooltip */}
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={12}
                  onMouseEnter={() => setHoveredLink(seg.key)} onMouseLeave={() => setHoveredLink(null)}
                  style={{ cursor: 'pointer' }}
                />
              </g>
            );
          })}

          {nodes.map(node => (
            <NodeCircle key={node.id} node={node} isRouteNode={routeIds.has(node.id)} isHovered={hoveredNode === node.id} simTime={simTime} sourceId={sourceId} destId={destId} onHover={setHoveredNode} />
          ))}

          {/* Link tooltip */}
          {hoveredSeg && (() => {
            const l = linkInfo(hoveredSeg);
            const mx = (hoveredSeg.from.x + hoveredSeg.to.x) / 2 * SVG_W;
            const my = (hoveredSeg.from.y + hoveredSeg.to.y) / 2 * SVG_H;
            const ok = l.status !== 'DISCONNECTED';
            const w = 132;
            const x = Math.max(4, Math.min(SVG_W - w - 4, mx - w / 2));
            const y = Math.max(4, my - 34);
            return (
              <g pointerEvents="none">
                <rect x={x} y={y} width={w} height={28} rx={3} fill="#0f172a" fillOpacity={0.96} stroke="#334155" strokeWidth={0.5} />
                <text x={x + w / 2} y={y + 11} textAnchor="middle" fontSize={8} fontFamily="monospace" fill="#94a3b8">
                  {shortNodeName(hoveredSeg.from.id, nodes)} → {shortNodeName(hoveredSeg.to.id, nodes)} · {l.distanceKm.toFixed(1)} km
                </text>
                <text x={x + w / 2} y={y + 22} textAnchor="middle" fontSize={8} fontFamily="monospace" fill={ok ? '#67e8f9' : '#ef4444'}>
                  {ok ? `${l.snrDb.toFixed(1)} dB SNR · ${l.status}` : 'NOT USABLE (range / λ / LOS)'}
                </text>
              </g>
            );
          })()}

          {/* Node tooltip */}
          {hoveredNodeObj && (() => {
            const n = hoveredNodeObj;
            const cx = n.x * SVG_W, cy = n.y * SVG_H;
            const geo = groundGeo(n);
            const w = 158, h = 50;
            const x = Math.max(4, Math.min(SVG_W - w - 4, cx - w / 2));
            const y = cy < 90 ? cy + 46 : Math.max(4, cy - 26 - h);
            return (
              <g pointerEvents="none">
                <rect x={x} y={y} width={w} height={h} rx={4} fill="#0f172a" stroke="#06b6d4" strokeWidth={0.5} fillOpacity={0.97} />
                <text x={x + 8} y={y + 13} fontSize={9} fontFamily="monospace" fontWeight="600" fill="#e9eef8">{n.name} · {roleOf(n.id, sourceId, destId)}</text>
                <text x={x + 8} y={y + 25} fontSize={8} fontFamily="monospace" fill="#94a3b8">{geo.latDeg.toFixed(2)}°N {geo.lonDeg.toFixed(2)}°E</text>
                <text x={x + 8} y={y + 36} fontSize={8} fontFamily="monospace" fill="#a78bfa">λ {n.supportedWavelengths.join('/')} nm · {n.maxRangeKm} km</text>
                <text x={x + 8} y={y + 46} fontSize={8} fontFamily="monospace" fill={routeIds.has(n.id) ? '#69e6a6' : '#64748b'}>
                  TX {n.txPowerDbm} dBm · {routeIds.has(n.id) ? 'ON ACTIVE ROUTE' : 'idle'}
                </text>
              </g>
            );
          })()}

          {banner && (
            <g>
              <rect x="130" y="14" width="240" height="34" rx="7" fill="#07151a" stroke="#69e6a6" strokeWidth="1" opacity="0.96" />
              <text x="250" y="29" textAnchor="middle" fontSize="9" fontFamily="monospace" fill="#69e6a6">{banner.title}</text>
              <text x="250" y="41" textAnchor="middle" fontSize="8" fontFamily="monospace" fill="#94a3b8">Traffic now on {banner.text}</text>
            </g>
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[9px] font-mono text-fsoc-dim">
        <span><span className="text-fsoc-green">━</span> active route</span>
        <span><span className="text-fsoc-cyan">┅</span> direct A↔B</span>
        <span><span className="text-slate-500">┈</span> possible hop</span>
        <span><span className="text-violet-300">┅</span> route preview (hover a route)</span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-[9px] font-mono">
        <div className="rounded border border-fsoc-border/50 bg-fsoc-bg/30 px-2 py-1.5 min-w-0"><span className="text-fsoc-dim">NODE MOTION</span><div className="text-violet-300">LIVE · terrestrial mobility</div></div>
        <div className="rounded border border-fsoc-border/50 bg-fsoc-bg/30 px-2 py-1.5 min-w-0"><span className="text-fsoc-dim">DIRECT PATH</span><div className={primaryStatus === 'CONNECTED' ? 'text-fsoc-cyan' : 'text-fsoc-amber'}>{primaryStatus}</div></div>
        <div className="rounded border border-fsoc-border/50 bg-fsoc-bg/30 px-2 py-1.5 min-w-0"><span className="text-fsoc-dim">ROUTE FLOW</span><div className="text-fsoc-green flex items-center gap-1"><Radio className="w-3 h-3" /> {throughRelay ? `RELAY ACTIVE · ${activeRoute!.hops.length} hops` : 'DIRECT ACTIVE'}</div></div>
      </div>
    </div>
  );
};

export default NetworkCanvas;
