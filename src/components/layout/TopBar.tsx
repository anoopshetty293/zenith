import { useSimStore } from '../../store/simulationStore';
import { Play, Pause, RotateCcw, ChevronDown, Radio } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';

const SPEEDS = [0.25, 0.5, 1, 2, 5, 10];
function formatSimTime(s: number): string { const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`; }

export default function TopBar() {
  const { isRunning, speed, simTimeS, startSimulation, pauseSimulation, resetSimulation, setSpeed, d3Anomaly, activeTestCaseId, testCases } = useSimStore();
  const [speedOpen, setSpeedOpen] = useState(false);
  const activeTC = testCases.find(t => t.id === activeTestCaseId);

  return (
    <header className="relative z-10 flex h-14 flex-shrink-0 items-center justify-between border-b border-[var(--zen-line)] bg-[rgba(5,7,12,.66)] px-5 backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-2 md:flex">
          <Radio size={13} className="text-[var(--zen-cyan)]" />
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--zen-mute)]">Virtual FSOC Testbed</span>
        </div>
        <div className="h-4 w-px bg-[var(--zen-line)]" />
        <div className="flex items-center gap-2">
          <span className={clsx('h-1.5 w-1.5 rounded-full', isRunning ? 'animate-pulse bg-[var(--zen-green)] shadow-[0_0_9px_var(--zen-green)]' : 'bg-[var(--zen-mute)]')} />
          <span className={clsx('font-mono text-[9px] uppercase tracking-[0.18em]', isRunning ? 'text-[var(--zen-green)]' : 'text-[var(--zen-mute)]')}>{isRunning ? 'Running' : 'Paused'}</span>
        </div>
        {d3Anomaly && <div className="fsoc-chip px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.16em] text-[var(--zen-red)]">Anomaly detected</div>}
        {activeTC && <div className="fsoc-chip px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-[var(--zen-cyan)]">{activeTC.name}</div>}
      </div>

      <div className="absolute left-1/2 hidden -translate-x-1/2 items-baseline gap-1 sm:flex">
        <span className="font-mono text-[8px] tracking-[0.18em] text-[var(--zen-mute-2)]">T+</span>
        <span className="font-mono text-sm tabular-nums text-[var(--zen-ink)]">{formatSimTime(simTimeS)}</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <button onClick={() => setSpeedOpen(o => !o)} className="flex items-center gap-1 rounded-lg border border-[var(--zen-line)] px-2.5 py-1.5 font-mono text-[9px] text-[var(--zen-mute)] transition hover:border-[rgba(92,216,240,.35)] hover:text-[var(--zen-cyan)]">{speed}× <ChevronDown size={10} /></button>
          {speedOpen && <div className="panel absolute right-0 top-full z-50 mt-2 w-20 overflow-hidden py-1">{SPEEDS.map(s => <button key={s} onClick={() => { setSpeed(s); setSpeedOpen(false); }} className={clsx('w-full px-2 py-1 text-left font-mono text-[9px] transition hover:bg-white/[0.04]', s === speed ? 'text-[var(--zen-cyan)]' : 'text-[var(--zen-mute)]')}>{s}×</button>)}</div>}
        </div>
        <button onClick={isRunning ? pauseSimulation : startSimulation} className={clsx('flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[9px] transition', isRunning ? 'border-[rgba(240,180,92,.4)] text-[var(--zen-amber)] hover:bg-[rgba(240,180,92,.06)]' : 'border-[rgba(105,230,166,.35)] text-[var(--zen-green)] hover:bg-[rgba(105,230,166,.06)]')}>
          {isRunning ? <Pause size={10} /> : <Play size={10} />}<span className="hidden sm:inline">{isRunning ? 'PAUSE' : 'START'}</span>
        </button>
        <button onClick={resetSimulation} className="flex items-center gap-1.5 rounded-lg border border-[var(--zen-line)] px-2.5 py-1.5 font-mono text-[9px] text-[var(--zen-mute)] transition hover:border-[rgba(255,107,122,.35)] hover:text-[var(--zen-red)]"><RotateCcw size={10} /><span className="hidden sm:inline">RESET</span></button>
      </div>
    </header>
  );
}
