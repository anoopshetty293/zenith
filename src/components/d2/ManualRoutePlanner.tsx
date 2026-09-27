/**
 * ManualRoutePlanner.tsx
 * Node-by-node path builder for D2. The operator picks the ground station
 * and any sequence of satellites to hop through — not just accept the top
 * auto-suggested relay — and sees each hop validated live (wavelength, line
 * of sight, range, debris obstruction) before activating the path.
 */
import { useMemo, useState } from 'react';
import { useSimStore } from '../../store/simulationStore';
import { evaluateD2Path, type D2Node } from '../../simulation/routing';
import { Route as RouteIcon, X, Satellite, Radio, Check, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

export default function ManualRoutePlanner() {
  const { d2, d2ActivateManualPath, d2ClearManualPath } = useSimStore();
  const [path, setPath] = useState<string[]>([]);

  const allNodes: D2Node[] = useMemo(() => [...d2.groundStations, ...d2.satellites], [d2.groundStations, d2.satellites]);
  const byId = useMemo(() => new Map(allNodes.map(n => [n.id, n])), [allNodes]);

  const preview = useMemo(() => {
    if (path.length < 2) return null;
    const nodes = path.map(id => byId.get(id)).filter((n): n is D2Node => !!n);
    if (nodes.length !== path.length) return null;
    return evaluateD2Path(nodes, d2.debris);
  }, [path, byId, d2.debris]);

  const isManualActive = !!d2.activeRoute?.isManual;

  const toggleNode = (id: string) => {
    setPath(p => {
      if (p[p.length - 1] === id) return p.slice(0, -1); // tap the last node again to undo
      if (p.includes(id)) return p; // already used earlier in the chain
      return [...p, id];
    });
  };

  const activate = () => {
    if (path.length < 2) return;
    d2ActivateManualPath(path);
  };

  const clear = () => {
    setPath([]);
    if (isManualActive) d2ClearManualPath();
  };

  return (
    <div className="panel flex flex-col overflow-hidden">
      <div className="panel-header">
        <span className="panel-title flex items-center gap-1.5"><RouteIcon size={10} /> Manual Path Builder</span>
        {isManualActive && <span className="rounded border border-fsoc-cyan/40 bg-fsoc-cyan/10 px-1.5 py-0.5 text-[9px] font-mono text-fsoc-cyan">MANUAL ACTIVE</span>}
      </div>
      <div className="space-y-2.5 p-3">
        <p className="text-[10px] leading-relaxed text-[var(--zen-mute)]">
          Click nodes in order to build the exact hop-by-hop path traffic should take — ground station first, then any satellites to relay through, ending at the destination. Tap a node again to undo the last hop.
        </p>

        {/* Node picker */}
        <div className="flex flex-wrap gap-1.5">
          {allNodes.map(n => {
            const idx = path.indexOf(n.id);
            const selected = idx >= 0;
            return (
              <button
                key={n.id}
                onClick={() => toggleNode(n.id)}
                className={clsx(
                  'flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-mono transition-colors',
                  selected ? 'border-fsoc-cyan/60 bg-fsoc-cyan/10 text-fsoc-cyan' : 'border-fsoc-border/60 text-[var(--zen-mute)] hover:border-fsoc-cyan/30 hover:text-fsoc-cyan'
                )}
              >
                {n.type === 'ground' ? <Radio size={9} /> : <Satellite size={9} />}
                {n.name}
                {selected && <span className="ml-0.5 rounded-full bg-fsoc-cyan/20 px-1 text-[8px]">{idx + 1}</span>}
              </button>
            );
          })}
        </div>

        {/* Current chain */}
        <div className="rounded border border-fsoc-border/50 bg-black/20 px-2 py-1.5">
          {path.length === 0 ? (
            <span className="text-[9px] font-mono text-[var(--zen-mute)]">No nodes selected yet.</span>
          ) : (
            <span className="break-words text-[10px] font-mono text-white">
              {path.map(id => byId.get(id)?.name ?? id).join('  →  ')}
            </span>
          )}
        </div>

        {/* Per-hop live validation */}
        {preview && (
          <div className={clsx('space-y-1 rounded border p-2', preview.status === 'AVAILABLE' ? 'border-fsoc-green/40 bg-fsoc-green/5' : 'border-fsoc-red/40 bg-fsoc-red/5')}>
            {preview.hops.map((hop, i) => {
              const link = preview.hopLinks?.[i];
              const ok = link ? link.status !== 'DISCONNECTED' : false;
              return (
                <div key={`${hop.fromId}-${hop.toId}`} className="flex items-center gap-1.5 text-[9px] font-mono">
                  {ok ? <Check size={10} className="shrink-0 text-fsoc-green" /> : <AlertTriangle size={10} className="shrink-0 text-fsoc-red" />}
                  <span className={ok ? 'text-fsoc-dim' : 'text-fsoc-red'}>
                    {byId.get(hop.fromId)?.name ?? hop.fromId} → {byId.get(hop.toId)?.name ?? hop.toId}
                    {hop.blocked
                      ? ` — blocked by debris (${hop.blockReason?.match(/\((.*?)\)/)?.[1] ?? 'obstructed'})`
                      : !ok ? ' — unavailable' : ` — SNR ${link?.snrDb.toFixed(1)} dB`}
                  </span>
                </div>
              );
            })}
            <div className="pt-1 text-[9px] font-mono uppercase tracking-wider text-[var(--zen-mute)]">
              {preview.status === 'AVAILABLE' ? `Path viable · score ${(preview.analysis.score * 100).toFixed(0)}` : 'Path not currently viable — pick a different chain'}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={activate}
            disabled={path.length < 2 || preview?.status !== 'AVAILABLE'}
            className="flex-1 rounded border border-fsoc-cyan/50 px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider text-fsoc-cyan transition-colors hover:bg-fsoc-cyan/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Activate Path
          </button>
          <button
            onClick={clear}
            disabled={path.length === 0 && !isManualActive}
            className="flex items-center gap-1 rounded border border-fsoc-border/60 px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider text-[var(--zen-mute)] transition-colors hover:text-fsoc-red disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X size={10} /> Clear
          </button>
        </div>
      </div>
    </div>
  );
}
