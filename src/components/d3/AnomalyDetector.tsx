/**
 * AnomalyDetector.tsx
 * Prominent anomaly status banner for D3 dashboard.
 * Shows NOMINAL state with live telemetry, or ANOMALY DETECTED with evidence.
 * NEVER reveals ground truth — only observable telemetry signatures.
 */

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, Activity, Radio, Eye, Wifi, TrendingDown } from 'lucide-react';
import { useSimStore, resolveD3History, type SimulationStore } from '../../store/simulationStore';
import { InfoToggle, InfoNote } from './PanelInfo';

type BadgeVariant = 'ok' | 'warn' | 'crit' | 'info' | 'dim';

const Badge: React.FC<{ label: string; variant: BadgeVariant }> = ({ label, variant }) => {
  const cls: Record<BadgeVariant, string> = {
    ok:   'bg-emerald-900/60 text-emerald-300 border-emerald-700',
    warn: 'bg-amber-900/60 text-amber-300 border-amber-700',
    crit: 'bg-red-900/60 text-red-300 border-red-700',
    info: 'bg-cyan-900/60 text-fsoc-cyan border-cyan-700',
    dim:  'bg-fsoc-panel text-fsoc-dim border-fsoc-border',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-widest border ${cls[variant]}`}>
      {label}
    </span>
  );
};

const severityVariant = (sev: string): BadgeVariant => {
  if (sev === 'CRITICAL') return 'crit';
  if (sev === 'HIGH') return 'crit';
  if (sev === 'MEDIUM') return 'warn';
  return 'info';
};

// Metrics shown in NOMINAL mode
interface NominalMetric {
  icon: React.ElementType;
  label: string;
  getValue: (obs: SimulationStore['d1']['telemetryHistory'][number]['observable'] | undefined) => string;
  unit: string;
  thresholdOk: (v: number) => boolean;
}

const NOMINAL_METRICS: NominalMetric[] = [
  {
    icon: Activity,
    label: 'SNR',
    getValue: (obs) => obs ? obs.snrDb.toFixed(1) : '--',
    unit: 'dB',
    thresholdOk: (v) => v > 10,
  },
  {
    icon: Radio,
    label: 'Pointing Error',
    getValue: (obs) => obs ? obs.pointingErrorUrad.toFixed(1) : '--',
    unit: 'µrad',
    thresholdOk: (v) => v < 50,
  },
  {
    icon: Eye,
    label: 'Detection Conf',
    getValue: (obs) => obs ? (obs.detectionConfidence * 100).toFixed(0) : '--',
    unit: '%',
    thresholdOk: (v) => v > 70,
  },
  {
    icon: TrendingDown,
    label: 'BER (log)',
    getValue: (obs) => obs ? obs.berLog10.toFixed(2) : '--',
    unit: '',
    thresholdOk: (v) => v < -6,
  },
  {
    icon: Wifi,
    label: 'Link Margin',
    getValue: (obs) => obs ? obs.linkMarginDb.toFixed(1) : '--',
    unit: 'dB',
    thresholdOk: (v) => v > 3,
  },
];

const ANOMALY_INFO = (
  <>
    Flags when telemetry drifts from nominal baselines (SNR, pointing error, detection confidence, beacon
    jitter, SNR trend) over a rolling 15-second window, using fixed statistical thresholds — not machine
    learning. Severity and the affected subsystem come from how far out of range the metrics are and how
    many are abnormal at once.
  </>
);

const AnomalyDetector: React.FC = () => {
  const { d3Anomaly, d3Source, d1, d2 } = useSimStore();
  const [showInfo, setShowInfo] = useState(false);

  // Get latest observable telemetry from correct source
  const history = resolveD3History(d3Source, d1, d2);
  const latestObs = history.length > 0 ? history[history.length - 1].observable : undefined;

  // ─── NOMINAL STATE ──────────────────────────────────────────────────────────
  if (!d3Anomaly) {
    return (
      <div className="panel p-0 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 bg-emerald-900/20 border-b border-emerald-800/50">
          <CheckCircle className="text-emerald-400" size={22} />
          <div>
            <div className="text-lg font-mono font-bold text-emerald-300 tracking-widest">
              SYSTEM STATUS: NOMINAL
            </div>
            <div className="text-xs text-fsoc-dim mt-0.5">
              All subsystems operating within normal parameters. Monitoring for anomalies.
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <InfoToggle open={showInfo} onToggle={() => setShowInfo(v => !v)} />
            <Badge label="NOMINAL" variant="ok" />
          </div>
        </div>
        {showInfo && <InfoNote>{ANOMALY_INFO}</InfoNote>}

        <div className="grid grid-cols-5 divide-x divide-fsoc-border">
          {NOMINAL_METRICS.map(({ icon: Icon, label, getValue, unit, thresholdOk }) => {
            const rawStr = getValue(latestObs);
            const rawNum = parseFloat(rawStr);
            const isOk = isNaN(rawNum) ? true : thresholdOk(rawNum);
            return (
              <div key={label} className="px-4 py-3 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-fsoc-dim">
                  <Icon size={11} />
                  <span className="text-[10px] font-mono tracking-widest uppercase">{label}</span>
                </div>
                <div className={`text-lg font-mono font-bold tabular-nums ${isOk ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {rawStr}
                  <span className="text-xs text-fsoc-dim ml-1">{unit}</span>
                </div>
                <Badge label={isOk ? 'NOMINAL' : 'WATCH'} variant={isOk ? 'ok' : 'warn'} />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── ANOMALY DETECTED STATE ────────────────────────────────────────────────
  const { severity, affectedSubsystem, evidence, detectedAtS, description } = d3Anomaly;

  return (
    <div className="panel p-0 overflow-hidden border-2 anomaly-border">
      {/* Banner */}
      <div className="flex items-center gap-3 px-4 py-3 bg-red-950/40 border-b border-red-800/60">
        <AlertTriangle className="text-red-400 animate-pulse" size={24} />
        <div className="flex-1 min-w-0">
          <div className="text-xl font-mono font-bold text-red-300 tracking-widest uppercase">
            ⚠ ANOMALY DETECTED
          </div>
          <div className="text-xs text-fsoc-dim mt-0.5 truncate">{description}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <InfoToggle open={showInfo} onToggle={() => setShowInfo(v => !v)} />
          <Badge label={severity} variant={severityVariant(severity)} />
          <Badge label={affectedSubsystem} variant="info" />
          <div className="text-xs font-mono text-fsoc-dim border border-fsoc-border rounded px-2 py-0.5">
            T+<span className="text-white">{detectedAtS.toFixed(1)}</span>s
          </div>
        </div>
      </div>
      {showInfo && <InfoNote>{ANOMALY_INFO}</InfoNote>}

      {/* Evidence rows */}
      {evidence.length > 0 && (
        <div className="px-4 py-2">
          <div className="text-[10px] font-mono tracking-widest text-fsoc-dim uppercase mb-2">
            Observable Evidence
          </div>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {evidence.map((ev, i) => {
              const isHigh = ev.deviation > 0;
              const arrow = isHigh ? '↑' : '↓';
              const deviationAbs = Math.abs(ev.deviation);
              const isAbnormal = deviationAbs > 0.15;
              return (
                <div
                  key={i}
                  className={`flex items-center justify-between rounded px-3 py-1.5 border text-xs ${
                    isAbnormal
                      ? 'bg-red-950/30 border-red-900/60'
                      : 'bg-fsoc-panel border-fsoc-border'
                  }`}
                >
                  <span className="font-mono text-fsoc-dim uppercase tracking-wide">{ev.metric}</span>
                  <div className="flex items-center gap-2 ml-2">
                    <span className="font-mono text-white tabular-nums">
                      {typeof ev.observedValue === 'number' ? ev.observedValue.toFixed(2) : ev.observedValue}
                    </span>
                    <span className="text-fsoc-dim">vs</span>
                    <span className="font-mono text-fsoc-dim tabular-nums">
                      {typeof ev.baselineValue === 'number' ? ev.baselineValue.toFixed(2) : ev.baselineValue}
                    </span>
                    {isAbnormal && (
                      <span className={`font-mono font-bold ${isHigh ? 'text-red-400' : 'text-amber-400'}`}>
                        {arrow}{(deviationAbs * 100).toFixed(0)}%
                      </span>
                    )}
                    <Badge
                      label={isAbnormal ? 'ABNORMAL' : 'NOMINAL'}
                      variant={isAbnormal ? 'crit' : 'ok'}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Subsystem indicator */}
      <div className="px-4 py-2 border-t border-fsoc-border bg-fsoc-bg/40 flex items-center gap-4">
        <span className="text-[10px] font-mono text-fsoc-dim uppercase tracking-widest">Affected:</span>
        <span className="text-xs font-mono text-red-300">
          {affectedSubsystem === 'MULTI' ? 'PAT + Optical Link' : affectedSubsystem.replace('_', ' ')}
        </span>
        <span className="text-[10px] font-mono text-fsoc-dim ml-auto">
          {evidence.length} signal{evidence.length !== 1 ? 's' : ''} flagged
        </span>
      </div>
    </div>
  );
};

export default AnomalyDetector;
