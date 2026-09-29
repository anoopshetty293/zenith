import { useMemo } from 'react';
import { Activity } from 'lucide-react';
import { useSimStore } from '../../store/simulationStore';
import { disturbanceBelongsToD2Mode } from '../../simulation/disturbances';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import Term from '../shared/Term';

const SERIES = [
  { key: 'pointingErrorUrad', title: 'Pointing Error', unit: 'μrad', color: '#06b6d4' },
  { key: 'snrDb', title: 'SNR', unit: 'dB', color: '#22c55e' },
  { key: 'receivedPowerDbm', title: 'Received Power', unit: 'dBm', color: '#a78bfa' },
  { key: 'berLog10', title: 'BER (log₁₀)', unit: 'log₁₀', color: '#fb923c' },
] as const;

export default function SpaceTelemetryCharts() {
  const history = useSimStore(s => s.d2.telemetryHistory);
  const allActive = useSimStore(s => s.d2.activeDisturbances);
  const groundStations = useSimStore(s => s.d2.groundStations);
  const linkType = useSimStore(s => s.d2.linkType);
  // This chart plots the currently-selected link's own history — only mark
  // disturbances that actually target it, not the other (independent) link.
  const groundIds = new Set(groundStations.map(g => g.id));
  const active = allActive.filter(d => disturbanceBelongsToD2Mode(d, groundIds, linkType));
  const data = useMemo(() => history.slice(-60).filter((_, i) => i % 2 === 0).map(sample => ({
    t: sample.observable.timestamp,
    pointingErrorUrad: sample.observable.pointingErrorUrad,
    snrDb: sample.observable.snrDb,
    receivedPowerDbm: sample.observable.receivedPowerDbm,
    berLog10: sample.observable.berLog10,
  })), [history]);
  const disturbanceTime = active.length ? Math.min(...active.map(d => d.startTimeS)) : null;
  return <section className="rounded-lg border border-fsoc-border bg-fsoc-panel p-3 space-y-3">
    <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-fsoc-cyan" /><span className="text-xs font-semibold uppercase tracking-widest text-fsoc-cyan">Telemetry Charts</span></div><span className="text-[9px] font-mono text-fsoc-dim">{data.length} samples · rolling window</span></div>
    <div className="h-px bg-fsoc-border/60" />
    {!data.length ? <div className="flex h-24 items-center justify-center text-[10px] text-fsoc-dim">Waiting for telemetry data — start the simulation.</div> : <div className="grid grid-cols-2 gap-3">{SERIES.map(s => <div key={s.key} className="rounded-lg border border-fsoc-border/60 bg-black/10 p-2"><div className="mb-1 flex items-center justify-between px-1"><span className="text-[10px] font-semibold uppercase tracking-wider text-fsoc-cyan">{s.title === 'BER (log₁₀)' ? <><Term glossaryKey="BER">BER</Term> (log₁₀)</> : <Term glossaryKey={s.title}>{s.title}</Term>}</span><span className="text-[9px] font-mono text-fsoc-dim">{s.unit}</span></div><ResponsiveContainer width="100%" height={150}><LineChart data={data} margin={{ top: 6, right: 8, bottom: 2, left: -14 }}><CartesianGrid strokeDasharray="2 4" stroke="rgba(51,65,85,.5)" /><XAxis dataKey="t" tick={{ fill: '#64748b', fontSize: 8 }} tickLine={false} axisLine={false} tickFormatter={v => `+${Number(v).toFixed(0)}s`} /><YAxis tick={{ fill: '#64748b', fontSize: 8 }} tickLine={false} axisLine={false} width={38} /><Tooltip contentStyle={{ background: '#0a1628', border: '1px solid #1a3a60', borderRadius: 4, fontSize: 10, fontFamily: 'monospace' }} formatter={(v: number) => [`${Number(v).toFixed(2)} ${s.unit}`, s.title]} /><Line type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={1.8} dot={false} isAnimationActive={false} activeDot={{ r: 3 }} />{disturbanceTime !== null && <ReferenceLine x={disturbanceTime} stroke="#ef4444" strokeDasharray="3 2" />}</LineChart></ResponsiveContainer></div>)}</div>}
  </section>;
}
