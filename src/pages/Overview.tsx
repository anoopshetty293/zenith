import { useSimStore } from '../store/simulationStore';
import { useNavigate } from 'react-router-dom';
import { Radio, Satellite, Brain, Zap, Activity, Signal, Target, TrendingDown, AlertTriangle } from 'lucide-react';
import StatusBadge from '../components/shared/StatusBadge';
import TelemetryValue from '../components/shared/TelemetryValue';
import clsx from 'clsx';

function formatBER(log10: number): string {
  if (log10 <= -15) return '< 10⁻¹⁵';
  const exp = Math.round(log10);
  const mantissa = Math.pow(10, log10 - exp);
  return `${mantissa.toFixed(1)}×10${exp < 0 ? `⁻${Math.abs(exp)}` : exp}`;
}

function SystemDiagram({ d1, d2 }: { d1: any; d2: any }) {
  const d1Status = d1.primaryLink?.status ?? 'DISCONNECTED';
  const d2HasLOS = d2.primaryLink?.hasLOS ?? false;

  return (
    <div className="panel p-3">
      <div className="panel-header mb-3">
        <span className="panel-title">Live System Diagram</span>
      </div>
      <div className="flex items-center justify-center gap-0 py-2">
        {/* Ground A */}
        <div className="flex flex-col items-center gap-1">
          <div className={clsx('w-8 h-8 rounded-full border-2 flex items-center justify-center',
            d1Status === 'CONNECTED' ? 'border-fsoc-cyan bg-fsoc-cyan/10' : 'border-fsoc-dim bg-fsoc-border'
          )}>
            <Radio size={14} className={d1Status === 'CONNECTED' ? 'text-fsoc-cyan' : 'text-fsoc-dim'} />
          </div>
          <span className="text-[9px] font-mono text-fsoc-dim">GROUND A</span>
        </div>

        {/* D1 Link */}
        <div className="flex flex-col items-center px-2 w-24">
          <div className={clsx('h-0.5 w-full', d1Status === 'CONNECTED' ? 'bg-fsoc-cyan' : d1Status === 'DEGRADED' ? 'bg-fsoc-amber' : 'bg-fsoc-border')} />
          <span className="text-[8px] font-mono text-fsoc-dim mt-0.5">
            {d1.primaryLink?.distanceKm?.toFixed(1) ?? '—'} km
          </span>
          <span className="text-[8px] font-mono" style={{ color: d1Status === 'CONNECTED' ? '#00d4ff' : '#ff3333' }}>
            {d1.primaryLink?.selectedWavelength ?? '—'} nm
          </span>
        </div>

        {/* Ground B */}
        <div className="flex flex-col items-center gap-1">
          <div className={clsx('w-8 h-8 rounded-full border-2 flex items-center justify-center',
            d1Status === 'CONNECTED' ? 'border-fsoc-cyan bg-fsoc-cyan/10' : 'border-fsoc-dim bg-fsoc-border'
          )}>
            <Radio size={14} className={d1Status === 'CONNECTED' ? 'text-fsoc-cyan' : 'text-fsoc-dim'} />
          </div>
          <span className="text-[9px] font-mono text-fsoc-dim">GROUND B</span>
        </div>

        {/* Divider */}
        <div className="mx-4 h-12 w-px bg-fsoc-border" />

        {/* Space side */}
        <div className="flex flex-col items-center gap-1">
          <div className="w-8 h-8 rounded-full border-2 border-fsoc-dim bg-fsoc-border flex items-center justify-center">
            <Radio size={14} className="text-fsoc-dim" />
          </div>
          <span className="text-[9px] font-mono text-fsoc-dim">GS ALPHA</span>
        </div>

        <div className="flex flex-col items-center px-2 w-16">
          <div className={clsx('h-0.5 w-full', d2HasLOS ? 'bg-fsoc-cyan' : 'bg-fsoc-border')} />
          <span className="text-[8px] font-mono text-fsoc-dim mt-0.5">
            {d2.primaryLink?.distanceKm?.toFixed(0) ?? '—'} km
          </span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <div className={clsx('w-8 h-8 rounded-full border-2 flex items-center justify-center',
            d2HasLOS ? 'border-fsoc-cyan bg-fsoc-cyan/10' : 'border-fsoc-dim bg-fsoc-border'
          )}>
            <Satellite size={14} className={d2HasLOS ? 'text-fsoc-cyan' : 'text-fsoc-dim'} />
          </div>
          <span className="text-[9px] font-mono text-fsoc-dim">SAT-A</span>
        </div>
      </div>
    </div>
  );
}

export default function Overview() {
  const { isRunning, simTimeS, d1, d2, d3Anomaly, d3Diagnosis, startSimulation, pauseSimulation } = useSimStore();
  const navigate = useNavigate();

  const d1Link = d1.primaryLink;
  const d2Link = d2.primaryLink;
  const d1Status = d1Link?.status ?? 'DISCONNECTED';
  const d2Status = d2Link?.status ?? 'DISCONNECTED';

  const latestD1 = d1.telemetryHistory[d1.telemetryHistory.length - 1]?.observable;
  const latestD2 = d2.telemetryHistory[d2.telemetryHistory.length - 1]?.observable;

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      {/* Hero */}
      <div className="panel p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap size={20} className="text-fsoc-cyan" />
              <h1 className="text-base font-mono font-bold text-fsoc-cyan tracking-widest uppercase">
                FSOC Virtual Testbed
              </h1>
            </div>
            <p className="text-[10px] font-mono text-fsoc-dim">
              Free-Space Optical Communication · PAT · Adaptive Routing · Anomaly Intelligence
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[9px] font-mono text-fsoc-dim uppercase tracking-wider">System Status</div>
              <StatusBadge variant="online" label="ONLINE" />
            </div>
            <button
              onClick={isRunning ? pauseSimulation : startSimulation}
              className={clsx(
                'px-4 py-2 font-mono text-xs rounded border transition-colors',
                isRunning
                  ? 'border-amber-700 text-fsoc-amber hover:bg-amber-900/20'
                  : 'border-fsoc-green/50 text-fsoc-green hover:bg-fsoc-green/10'
              )}
            >
              {isRunning ? '⏸ PAUSE' : '▶ START SIMULATION'}
            </button>
          </div>
        </div>
      </div>

      {/* Key metrics row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'D1 SNR', value: d1Link?.snrDb?.toFixed(1) ?? '—', unit: 'dB', status: (d1Link?.snrDb ?? 0) > 20 ? 'ok' : (d1Link?.snrDb ?? 0) > 10 ? 'warn' : 'crit' },
          { label: 'D2 Distance', value: d2Link?.distanceKm?.toFixed(0) ?? '—', unit: 'km', status: 'info' },
          { label: 'D1 PAT', value: d1.patState.trackingStatus, unit: '', status: d1.patState.trackingStatus === 'LOCKED' ? 'ok' : d1.patState.trackingStatus === 'ACQUIRING' ? 'warn' : 'crit' },
          { label: 'D3 Status', value: d3Anomaly ? 'ANOMALY' : 'NOMINAL', unit: '', status: d3Anomaly ? 'crit' : 'ok' },
        ].map((m, i) => (
          <div key={i} className="panel p-3">
            <TelemetryValue label={m.label} value={m.value} unit={m.unit} status={m.status as any} />
          </div>
        ))}
      </div>

      {/* Three dashboard cards */}
      <div className="grid grid-cols-3 gap-4">
        {/* D1 Card */}
        <div
          onClick={() => navigate('/d1')}
          className="panel p-4 cursor-pointer hover:border-fsoc-cyan/30 transition-colors"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Radio size={16} className="text-fsoc-cyan" />
              <span className="text-xs font-mono text-white">Dashboard 1</span>
            </div>
            <StatusBadge
              variant={d1Status === 'CONNECTED' ? 'connected' : d1Status === 'DEGRADED' ? 'degraded' : 'disconnected'}
              label={d1Status}
            />
          </div>
          <div className="text-[9px] font-mono text-fsoc-dim mb-3">Ground-to-Ground FSOC · PAT · Routing</div>
          <div className="grid grid-cols-2 gap-2">
            <TelemetryValue label="SNR" value={d1Link?.snrDb?.toFixed(1) ?? '—'} unit="dB" status="info" />
            <TelemetryValue label="Pointing Error" value={latestD1?.pointingErrorUrad?.toFixed(0) ?? '—'} unit="μrad" status="info" />
            <TelemetryValue label="Link Margin" value={d1Link?.linkMarginDb?.toFixed(1) ?? '—'} unit="dB" status="info" />
            <TelemetryValue label="PAT" value={d1.patState.trackingStatus} status={d1.patState.trackingStatus === 'LOCKED' ? 'ok' : 'warn'} />
          </div>
          <div className="mt-3 text-[10px] font-mono text-fsoc-cyan">→ Open Dashboard 1</div>
        </div>

        {/* D2 Card */}
        <div
          onClick={() => navigate('/d2')}
          className="panel p-4 cursor-pointer hover:border-fsoc-cyan/30 transition-colors"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Satellite size={16} className="text-fsoc-cyan" />
              <span className="text-xs font-mono text-white">Dashboard 2</span>
            </div>
            <StatusBadge
              variant={d2Status === 'CONNECTED' ? 'connected' : d2Status === 'DEGRADED' ? 'degraded' : 'disconnected'}
              label={d2Link?.hasLOS ? d2Status : 'NO LOS'}
            />
          </div>
          <div className="text-[9px] font-mono text-fsoc-dim mb-3">Space FSOC · Orbital Mechanics · Debris</div>
          <div className="grid grid-cols-2 gap-2">
            <TelemetryValue label="Distance" value={d2Link?.distanceKm?.toFixed(0) ?? '—'} unit="km" status="info" />
            <TelemetryValue label="Elevation" value={d2Link?.elevationDeg?.toFixed(1) ?? '—'} unit="°" status="info" />
            <TelemetryValue label="SNR" value={d2Link?.snrDb?.toFixed(1) ?? '—'} unit="dB" status="info" />
            <TelemetryValue label="LOS" value={d2Link?.hasLOS ? 'YES' : 'NO'} status={d2Link?.hasLOS ? 'ok' : 'crit'} />
          </div>
          <div className="mt-3 text-[10px] font-mono text-fsoc-cyan">→ Open Dashboard 2</div>
        </div>

        {/* D3 Card */}
        <div
          onClick={() => navigate('/d3')}
          className={clsx('panel p-4 cursor-pointer transition-colors', d3Anomaly ? 'hover:border-fsoc-red/30 anomaly-border' : 'hover:border-fsoc-cyan/30')}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Brain size={16} className={d3Anomaly ? 'text-fsoc-red' : 'text-fsoc-cyan'} />
              <span className="text-xs font-mono text-white">Dashboard 3</span>
            </div>
            <StatusBadge
              variant={d3Anomaly ? 'anomaly' : 'normal'}
              label={d3Anomaly ? 'ANOMALY' : 'NOMINAL'}
            />
          </div>
          <div className="text-[9px] font-mono text-fsoc-dim mb-3">Anomaly Intelligence · Diagnosis · Prediction</div>
          {d3Anomaly ? (
            <div className="space-y-1">
              <div className="text-[9px] font-mono text-fsoc-red">Severity: {d3Anomaly.severity}</div>
              <div className="text-[9px] font-mono text-fsoc-red">Subsystem: {d3Anomaly.affectedSubsystem}</div>
              {d3Diagnosis && (
                <div className="text-[9px] font-mono text-fsoc-amber">
                  Diagnosis: {d3Diagnosis.mostLikelyCause.label} ({(d3Diagnosis.confidence * 100).toFixed(0)}%)
                </div>
              )}
            </div>
          ) : (
            <div className="text-[9px] font-mono text-fsoc-dim">All telemetry within nominal bounds. No anomalies detected.</div>
          )}
          <div className="mt-3 text-[10px] font-mono text-fsoc-cyan">→ Open Intelligence</div>
        </div>
      </div>

      {/* System diagram */}
      <SystemDiagram d1={d1} d2={d2} />

      {/* Recent events */}
      <div className="panel p-3">
        <div className="panel-header mb-2">
          <span className="panel-title">Recent Events</span>
        </div>
        <div className="space-y-1 max-h-32 overflow-auto">
          {d1.activeDisturbances.length > 0 && (
            <div className="flex items-center gap-2 text-[10px] font-mono">
              <AlertTriangle size={10} className="text-fsoc-amber" />
              <span className="text-fsoc-amber">D1 Active disturbance: {d1.activeDisturbances.map(d => d.type).join(', ')}</span>
            </div>
          )}
          {d3Anomaly && (
            <div className="flex items-center gap-2 text-[10px] font-mono">
              <AlertTriangle size={10} className="text-fsoc-red" />
              <span className="text-fsoc-red">Anomaly detected at T+{d3Anomaly.detectedAtS.toFixed(0)}s — {d3Anomaly.severity}</span>
            </div>
          )}
          {!d3Anomaly && !d1.activeDisturbances.length && (
            <div className="text-[10px] font-mono text-fsoc-dim">No recent events. System operating normally.</div>
          )}
        </div>
      </div>
    </div>
  );
}
