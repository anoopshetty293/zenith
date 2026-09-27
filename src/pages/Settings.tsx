import { useState } from 'react';
import { useSimStore } from '../store/simulationStore';
import { Settings, Monitor, Cpu, Sliders } from 'lucide-react';
import clsx from 'clsx';

const SPEEDS = [0.25, 0.5, 1, 2, 5, 10];

export default function SettingsPage() {
  const { speed, setSpeed } = useSimStore();
  const [demoMode, setDemoMode] = useState(false);

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div className="panel p-3">
        <div className="panel-header mb-0">
          <div className="flex items-center gap-2">
            <Settings size={14} className="text-fsoc-cyan" />
            <span className="panel-title">Settings</span>
          </div>
        </div>
      </div>

      {/* Simulation settings */}
      <div className="panel p-4">
        <div className="flex items-center gap-2 mb-4">
          <Cpu size={12} className="text-fsoc-cyan" />
          <span className="text-[10px] font-mono text-fsoc-cyan uppercase tracking-widest">Simulation</span>
        </div>
        <div className="space-y-4">
          <div>
            <div className="text-[9px] font-mono text-fsoc-dim uppercase tracking-wider mb-2">Simulation Speed</div>
            <div className="flex gap-2">
              {SPEEDS.map(s => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={clsx(
                    'px-3 py-1.5 text-xs font-mono rounded border transition-colors',
                    speed === s
                      ? 'bg-fsoc-cyan/10 border-fsoc-cyan text-fsoc-cyan'
                      : 'border-fsoc-border text-fsoc-dim hover:border-fsoc-cyan/30'
                  )}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Display settings */}
      <div className="panel p-4">
        <div className="flex items-center gap-2 mb-4">
          <Monitor size={12} className="text-fsoc-cyan" />
          <span className="text-[10px] font-mono text-fsoc-cyan uppercase tracking-widest">Display</span>
        </div>
        <div className="space-y-3">
          {[
            { label: 'Show telemetry tooltips', defaultVal: true },
            { label: 'Animate optical links', defaultVal: true },
            { label: 'Show LOS cone', defaultVal: true },
            { label: 'Show debris trajectories', defaultVal: true },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-fsoc-dim">{item.label}</span>
              <button className="w-8 h-4 bg-fsoc-cyan/20 border border-fsoc-cyan/30 rounded-full flex items-center px-0.5">
                <div className="w-3 h-3 bg-fsoc-cyan rounded-full ml-auto" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Demo mode */}
      <div className="panel p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sliders size={12} className="text-fsoc-amber" />
          <span className="text-[10px] font-mono text-fsoc-amber uppercase tracking-widest">Demo Mode</span>
        </div>
        <div className="text-[9px] font-mono text-fsoc-dim mb-3 leading-relaxed">
          Demo mode runs a guided scenario for judges and evaluators. The sequence is deterministic and repeatable:
          Normal operation → Disturbance injection → Anomaly detection → Diagnosis → Prediction → Route switch → Recovery → Ground truth reveal.
        </div>
        <button
          onClick={() => setDemoMode(!demoMode)}
          className={clsx(
            'px-4 py-2 text-xs font-mono rounded border transition-colors',
            demoMode
              ? 'bg-amber-900/30 border-fsoc-amber text-fsoc-amber'
              : 'border-fsoc-border text-fsoc-dim hover:border-fsoc-amber hover:text-fsoc-amber'
          )}
        >
          {demoMode ? '● DEMO MODE ACTIVE' : '○ ENABLE DEMO MODE'}
        </button>
      </div>

      {/* About */}
      <div className="panel p-4">
        <div className="text-[10px] font-mono text-fsoc-dim uppercase tracking-widest mb-2">About</div>
        <div className="text-[9px] font-mono text-fsoc-dim space-y-1 leading-relaxed">
          <div>FSOC Virtual Testbed v1.0 — Prototype / Demo</div>
          <div>Built with React 18 · TypeScript · Vite · Tailwind CSS · Recharts · Zustand</div>
          <div>Physics: Link budget (ITU-R P.1817), PAT (PID controller), Orbital (two-body circular)</div>
          <div>Intelligence: Signature-matching diagnosis, linear trend prediction, Bayesian-like confidence scoring</div>
        </div>
      </div>
    </div>
  );
}
