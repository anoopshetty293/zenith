import { useSimStore } from '../store/simulationStore';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, Play, CheckCircle, XCircle, Clock } from 'lucide-react';
import clsx from 'clsx';

const DASHBOARD_COLORS: Record<string, string> = {
  D1: 'text-blue-300 border-blue-800 bg-blue-900/20',
  D2: 'text-purple-300 border-purple-800 bg-purple-900/20',
};

const DISTURBANCE_COLORS: Record<string, string> = {
  TURBULENCE: 'text-blue-300',
  FOG: 'text-gray-400',
  CAMERA_VIBRATION: 'text-amber-300',
  BEACON_LOSS: 'text-red-400',
  ATTITUDE_JITTER: 'text-purple-300',
  DEBRIS_INTERFERENCE: 'text-orange-300',
  SENSOR_NOISE: 'text-green-300',
  MULTI_DISTURBANCE: 'text-pink-300',
};

export default function TestCases() {
  const { testCases, loadTestCase, resetTestCase, activeTestCaseId, isRunning } = useSimStore();
  const navigate = useNavigate();

  function handleLoad(id: string) {
    loadTestCase(id);
    navigate('/d3');
  }

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div className="panel p-3">
        <div className="panel-header mb-0">
          <div className="flex items-center gap-2">
            <FlaskConical size={14} className="text-fsoc-cyan" />
            <span className="panel-title">Test Case Library</span>
          </div>
          <span className="text-[9px] font-mono text-fsoc-dim">{testCases.length} scenarios</span>
        </div>
      </div>

      <div className="text-[10px] font-mono text-fsoc-dim panel p-2">
        ⚠ Each test case loads a hidden disturbance scenario. D3 must diagnose the cause from telemetry only.
        The actual disturbance is revealed only after REVEAL GROUND TRUTH is clicked.
      </div>

      <div className="grid grid-cols-2 gap-3">
        {testCases.map(tc => {
          const isActive = tc.id === activeTestCaseId;
          const hasResult = tc.result != null;

          return (
            <div
              key={tc.id}
              className={clsx('panel p-3 transition-colors', isActive && 'border-fsoc-cyan/30')}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={clsx('text-[10px] font-mono px-1.5 py-0.5 rounded border', DASHBOARD_COLORS[tc.dashboard])}>
                      {tc.dashboard === 'D1' ? 'GROUND' : 'SPACE'}
                    </span>
                    {isActive && (
                      <span className="text-[10px] font-mono text-fsoc-green border border-fsoc-green/30 px-1.5 py-0.5 rounded">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-mono text-white">{tc.name}</div>
                </div>
                {hasResult && (
                  tc.result!.diagnosisMatch
                    ? <CheckCircle size={14} className="text-fsoc-green flex-shrink-0" />
                    : <XCircle size={14} className="text-fsoc-red flex-shrink-0" />
                )}
              </div>

              <div className="text-[9px] font-mono text-fsoc-dim mb-2 leading-relaxed">
                {tc.description}
              </div>

              <div className="flex items-center gap-3 text-[9px] font-mono mb-2">
                <div className="flex items-center gap-1">
                  <Clock size={8} className="text-fsoc-dim" />
                  <span className="text-fsoc-dim">{tc.durationS}s</span>
                </div>
                <div>
                  <span className="text-fsoc-dim">Hidden: </span>
                  <span className={DISTURBANCE_COLORS[tc.hiddenDisturbance] ?? 'text-fsoc-amber'}>
                    [CLASSIFIED]
                  </span>
                </div>
                <div>
                  <span className="text-fsoc-dim">Intensity: </span>
                  <span className="text-white">{(tc.disturbanceIntensity * 100).toFixed(0)}%</span>
                </div>
              </div>

              {/* Result summary if completed */}
              {hasResult && (
                <div className="border-t border-fsoc-border pt-2 mb-2 text-[9px] font-mono space-y-0.5">
                  <div className="text-fsoc-dim uppercase tracking-wider">Previous result:</div>
                  <div className={tc.result!.anomalyDetected ? 'text-fsoc-green' : 'text-fsoc-red'}>
                    Anomaly detected: {tc.result!.anomalyDetected ? `✓ at T+${tc.result!.detectionTimeS?.toFixed(0)}s` : '✗'}
                  </div>
                  {tc.result!.diagnosedCause && (
                    <div className="text-fsoc-dim">Diagnosed: {tc.result!.diagnosedCause}</div>
                  )}
                  {tc.result!.diagnosisMatch !== null && (
                    <div className={tc.result!.diagnosisMatch ? 'text-fsoc-green' : 'text-fsoc-red'}>
                      {tc.result!.diagnosisMatch ? '✓ MATCH' : '✗ MISMATCH'}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => handleLoad(tc.id)}
                  disabled={isActive && isRunning}
                  className="btn-primary flex items-center gap-1 text-[10px] flex-1"
                >
                  <Play size={10} />
                  {isActive && isRunning ? 'RUNNING...' : 'LOAD & RUN'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
