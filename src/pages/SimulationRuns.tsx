import { useSimStore } from '../store/simulationStore';
import { useNavigate } from 'react-router-dom';
import { PlaySquare, CheckCircle, XCircle, Clock, Brain, ExternalLink } from 'lucide-react';
import StatusBadge from '../components/shared/StatusBadge';
import clsx from 'clsx';

function formatDuration(s: number): string {
  if (s < 60) return `${s.toFixed(0)}s`;
  return `${Math.floor(s / 60)}m ${(s % 60).toFixed(0)}s`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function SimulationRuns() {
  const { simulationRuns, openRunInD3 } = useSimStore();
  const navigate = useNavigate();

  const runs = [...simulationRuns].reverse(); // newest first

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div className="panel p-3">
        <div className="panel-header mb-0">
          <div className="flex items-center gap-2">
            <PlaySquare size={14} className="text-fsoc-cyan" />
            <span className="panel-title">Simulation Runs</span>
          </div>
          <span className="text-[9px] font-mono text-fsoc-dim">{simulationRuns.length} recorded</span>
        </div>
      </div>

      {runs.length === 0 ? (
        <div className="panel p-8 text-center">
          <PlaySquare size={32} className="text-fsoc-dim mx-auto mb-3" />
          <div className="text-sm font-mono text-fsoc-dim">No simulation runs recorded yet.</div>
          <div className="text-[10px] font-mono text-fsoc-dim mt-1">Complete test cases or run simulations to generate history.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map(run => (
            <div key={run.id} className="panel p-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-mono text-fsoc-dim">{run.id}</span>
                    <span className={clsx('text-[10px] font-mono px-1.5 py-0.5 rounded border',
                      run.dashboard === 'D1'
                        ? 'text-blue-300 border-blue-800 bg-blue-900/20'
                        : 'text-purple-300 border-purple-800 bg-purple-900/20'
                    )}>
                      {run.dashboard === 'D1' ? 'Ground FSOC' : 'Space FSOC'}
                    </span>
                    <span className="text-[9px] font-mono text-fsoc-dim">{formatDate(run.startTime)}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-3 text-[9px] font-mono">
                    <div>
                      <div className="text-fsoc-dim uppercase tracking-wider mb-0.5">Duration</div>
                      <div className="text-white flex items-center gap-1">
                        <Clock size={8} />
                        {formatDuration(run.durationS)}
                      </div>
                    </div>
                    <div>
                      <div className="text-fsoc-dim uppercase tracking-wider mb-0.5">Disturbance</div>
                      <div className={run.disturbanceType ? 'text-fsoc-amber' : 'text-fsoc-dim'}>
                        {run.disturbanceType ?? 'None'}
                      </div>
                    </div>
                    <div>
                      <div className="text-fsoc-dim uppercase tracking-wider mb-0.5">Diagnosis</div>
                      <div className="text-white">{run.diagnosis?.mostLikelyCause?.label ?? '—'}</div>
                    </div>
                    <div>
                      <div className="text-fsoc-dim uppercase tracking-wider mb-0.5">Result</div>
                      {run.verification ? (
                        <div className={clsx('flex items-center gap-1', run.verification.match ? 'text-fsoc-green' : 'text-fsoc-red')}>
                          {run.verification.match
                            ? <><CheckCircle size={10} /> MATCH</>
                            : <><XCircle size={10} /> MISMATCH</>
                          }
                        </div>
                      ) : (
                        <div className="text-fsoc-dim">Pending</div>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => { openRunInD3(run.id); navigate('/d3'); }}
                  className="btn-secondary flex items-center gap-1 flex-shrink-0"
                >
                  <Brain size={10} />
                  Open in D3
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
