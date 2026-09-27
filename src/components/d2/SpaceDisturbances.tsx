/** D2 disturbance controls using Dashboard 1's category/accordion layout, with D2-specific options. */
import { useState } from 'react';
import { useSimStore } from '../../store/simulationStore';
import { DISTURBANCE_CATALOG, type DisturbanceType, type DisturbanceCategory, type DisturbanceDefinition } from '../../types/disturbances';
import { Zap, Radio, Eye, AlertCircle, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';

const CATEGORY_CONFIG: Record<string, { label: string; icon: JSX.Element; color: string }> = {
  atmospheric: { label: 'Atmospheric', icon: <Radio className="w-3 h-3" />, color: 'text-fsoc-blue border-fsoc-blue/60 bg-fsoc-blue/10' },
  mechanical: { label: 'Mechanical', icon: <Zap className="w-3 h-3" />, color: 'text-fsoc-amber border-fsoc-amber/60 bg-fsoc-amber/10' },
  optical: { label: 'Optical / Sensor', icon: <Eye className="w-3 h-3" />, color: 'text-fsoc-cyan border-fsoc-cyan/60 bg-fsoc-cyan/10' },
  space: { label: 'Spacecraft / Orbital', icon: <Zap className="w-3 h-3" />, color: 'text-fsoc-amber border-fsoc-amber/60 bg-fsoc-amber/10' },
  debris: { label: 'Debris / Occlusion', icon: <AlertCircle className="w-3 h-3" />, color: 'text-fsoc-red border-fsoc-red/60 bg-fsoc-red/10' },
};

function DisturbanceRow({ def, active, onInject }: { def: DisturbanceDefinition; active: boolean; onInject: (t: DisturbanceType, i: number) => void }) {
  const [intensity, setIntensity] = useState(60);
  const [expanded, setExpanded] = useState(false);
  return <div className={clsx('rounded border transition-all duration-200', active ? 'border-fsoc-amber/60 bg-fsoc-amber/5 shadow-[0_0_6px_rgba(251,191,36,.15)]' : 'border-fsoc-border/40 bg-fsoc-bg/30')}>
    <div className="flex items-center justify-between p-2 cursor-pointer" onClick={() => setExpanded(v => !v)}>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {active ? <AlertCircle className="h-3 w-3 shrink-0 text-fsoc-amber" /> : <span className="h-3 w-3 shrink-0 rounded-full border border-fsoc-border" />}
        <span className={clsx('truncate text-xs font-medium', active ? 'text-fsoc-amber' : 'text-fsoc-cyan')}>{def.label}</span>
        {active && <span className="shrink-0 rounded border border-fsoc-amber/40 px-1 text-[9px] font-mono text-fsoc-amber">ACTIVE</span>}
      </div>
      {expanded ? <ChevronUp className="ml-1 h-3 w-3 text-fsoc-dim" /> : <ChevronDown className="ml-1 h-3 w-3 text-fsoc-dim" />}
    </div>
    {expanded && <div className="space-y-2 px-2 pb-2">
      <p className="text-[10px] leading-relaxed text-fsoc-dim">{def.description}</p>
      {def.hasIntensityControl && <div className="space-y-1">
        <div className="flex justify-between text-[10px]"><span className="uppercase tracking-wider text-fsoc-dim">Intensity</span><span className="font-mono text-fsoc-cyan">{intensity}%</span></div>
        <input aria-label={`${def.label} intensity`} type="range" min={10} max={100} step={5} value={intensity} onChange={e => setIntensity(Number(e.target.value))} className="h-1.5 w-full cursor-pointer accent-fsoc-cyan" />
      </div>}
      <button onClick={e => { e.stopPropagation(); onInject(def.type, def.hasIntensityControl ? intensity / 100 : 1); }} className="w-full rounded border border-fsoc-amber/60 bg-fsoc-amber/10 px-2 py-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-fsoc-amber transition-all hover:bg-fsoc-amber/20">⚡ {active ? 'Re-introduce disturbance' : 'Introduce disturbance'}</button>
    </div>}
  </div>;
}

function CategoryGroup({ category, defs, activeTypes, onInject }: { category: DisturbanceCategory; defs: DisturbanceDefinition[]; activeTypes: Set<DisturbanceType>; onInject: (t: DisturbanceType, i: number) => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const cfg = CATEGORY_CONFIG[category];
  if (!cfg || !defs.length) return null;
  return <div className="space-y-1">
    <button className={clsx('flex w-full items-center gap-2 rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider', cfg.color)} onClick={() => setCollapsed(v => !v)}>{cfg.icon}{cfg.label}<span className="ml-auto">{collapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}</span></button>
    {!collapsed && <div className="space-y-1 pl-1">{defs.map(def => <DisturbanceRow key={def.type} def={def} active={activeTypes.has(def.type)} onInject={onInject} />)}</div>}
  </div>;
}

export default function SpaceDisturbances() {
  const activeDisturbances = useSimStore(s => s.d2.activeDisturbances);
  const injectD2Disturbance = useSimStore(s => s.injectD2Disturbance);
  const clearD2Disturbances = useSimStore(s => s.clearD2Disturbances);
  const isGroundSat = useSimStore(s => s.d2.linkType === 'ground_sat');
  const activeTypes = new Set<DisturbanceType>(activeDisturbances.map(d => d.type));
  const categories: DisturbanceCategory[] = ['atmospheric', 'mechanical', 'optical', 'space', 'debris'];
  const defs = DISTURBANCE_CATALOG.filter(d => d.appliesToD2 && (isGroundSat || d.category !== 'atmospheric'));
  return <div className="rounded-lg border border-fsoc-border bg-fsoc-panel p-3 space-y-3">
    <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Zap className="h-4 w-4 text-fsoc-amber" /><span className="text-xs font-semibold uppercase tracking-widest text-fsoc-cyan">Disturbance Control</span></div>{activeDisturbances.length > 0 && <span className="rounded border border-fsoc-amber/50 bg-fsoc-amber/15 px-1.5 py-0.5 text-[9px] font-mono text-fsoc-amber">{activeDisturbances.length} ACTIVE</span>}</div>
    <div className="h-px bg-fsoc-border/60" />
    {activeDisturbances.length > 0 && <div className="space-y-1">{activeDisturbances.map(d => <div key={d.id} className="flex items-center justify-between rounded border border-fsoc-amber/30 bg-fsoc-amber/5 px-2 py-1 text-[10px]"><span className="flex items-center gap-1.5 font-mono text-fsoc-amber"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fsoc-amber" />{d.type}</span><span className="font-mono text-fsoc-dim">{(d.intensity * 100).toFixed(0)}%</span></div>)}</div>}
    <div className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">{categories.map(cat => <CategoryGroup key={cat} category={cat} defs={defs.filter(d => d.category === cat)} activeTypes={activeTypes} onInject={injectD2Disturbance} />)}</div>
    <button disabled={!activeDisturbances.length} onClick={clearD2Disturbances} className="flex w-full items-center justify-center gap-2 rounded border border-fsoc-border px-2 py-2 text-[9px] font-mono uppercase tracking-wider text-fsoc-dim transition hover:border-fsoc-green/40 hover:text-fsoc-green disabled:cursor-not-allowed disabled:opacity-40"><CheckCircle2 className="h-3 w-3" /> Restore normal conditions</button>
  </div>;
}
