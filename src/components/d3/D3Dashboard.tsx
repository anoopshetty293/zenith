import { useSimStore } from '../../store/simulationStore';
import { Brain, Radio, Satellite } from 'lucide-react';
import AnomalyDetector from './AnomalyDetector';
import DiagnosisPanel from './DiagnosisPanel';
import PredictionPanel from './PredictionPanel';
import MitigationPanel from './MitigationPanel';
import ConfidenceGraph from './ConfidenceGraph';
import DecisionTimeline from './DecisionTimeline';
import GroundTruthReveal from './GroundTruthReveal';
import ObservationPanel from './ObservationPanel';
import PerformanceMetrics from './PerformanceMetrics';
import clsx from 'clsx';

export default function D3Dashboard() {
  const { d3Source, setD3Source, d3Anomaly } = useSimStore();

  return (
    <div className="h-full overflow-auto fsoc-app-bg">
      {/* D3 Header */}
      <div className="flex items-center justify-between border-b border-[var(--zen-line)] bg-[rgba(5,7,12,.42)] px-5 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Brain size={14} className={d3Anomaly ? 'text-fsoc-red' : 'text-fsoc-cyan'} />
          <div>
            <div className="fsoc-title text-sm font-semibold text-[var(--zen-ink)] uppercase tracking-[0.08em]">
              Dashboard 3 — FSOC Intelligence
            </div>
            <div className="text-[9px] font-mono text-[var(--zen-mute)]">
              Observe → Detect → Diagnose → Predict → Mitigate → Verify
            </div>
          </div>
        </div>

        {/* Source selector */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-[var(--zen-mute)] uppercase tracking-wider">Source:</span>
          <button
            onClick={() => setD3Source('D1')}
            className={clsx(
              'flex items-center gap-1 px-3 py-1 text-[10px] font-mono rounded border transition-colors',
              d3Source === 'D1'
                ? 'bg-blue-900/30 border-blue-600 text-blue-300'
                : 'border-fsoc-border text-fsoc-dim hover:border-blue-600/50'
            )}
          >
            <Radio size={10} /> D1 — Ground FSOC
          </button>
          <button
            onClick={() => setD3Source('D2')}
            className={clsx(
              'flex items-center gap-1 px-3 py-1 text-[10px] font-mono rounded border transition-colors',
              d3Source === 'D2'
                ? 'bg-purple-900/30 border-purple-600 text-purple-300'
                : 'border-fsoc-border text-fsoc-dim hover:border-purple-600/50'
            )}
          >
            <Satellite size={10} /> D2 — Space FSOC
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="p-3 space-y-3">

        {/* Row 1: Anomaly detector full width */}
        <AnomalyDetector />

        {/* Row 2: Diagnosis | Prediction | Mitigation */}
        <div className="grid grid-cols-3 gap-3">
          <DiagnosisPanel />
          <PredictionPanel />
          <MitigationPanel />
        </div>

        {/* Row 3: Confidence graph + timeline + observation */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-5">
            <ConfidenceGraph />
          </div>
          <div className="col-span-4">
            <DecisionTimeline />
          </div>
          <div className="col-span-3">
            <ObservationPanel />
          </div>
        </div>

        {/* Row 4: Performance metrics */}
        <PerformanceMetrics />

        {/* Row 5: Ground truth reveal — full width */}
        <GroundTruthReveal />

      </div>
    </div>
  );
}
