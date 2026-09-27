/**
 * PerformanceMetrics.tsx
 * Live "is the intelligence engine any good?" scorecard, computed continuously
 * from this session's decision timeline — no formal test case required.
 * Detection/mitigation stats never touch ground truth; diagnosis accuracy only
 * ever populates once the operator has revealed ground truth at least once
 * this session.
 */

import React, { useMemo, useState } from 'react';
import { BarChart2, CheckCircle, Clock, Target, Zap } from 'lucide-react';
import { useSimStore } from '../../store/simulationStore';
import { TimelineEvent } from '@/types/intelligence';
import { InfoToggle, InfoNote } from './PanelInfo';

const METRICS_INFO = (
  <>
    These stats come straight from the decision timeline: detection rate and mitigation acceptance never
    touch ground truth, so they're always live. Diagnosis accuracy only unlocks once you reveal ground truth
    at least once this session — before that, showing it would spoil the reveal for whatever's currently
    being diagnosed.
  </>
);

interface MetricCard {
  icon: React.ElementType;
  label: string;
  value: string | null;
  subtext: string;
  color: string;
}

function computeLiveMetrics(timeline: TimelineEvent[], groundTruthRevealed: boolean) {
  const injections = timeline.filter((e) => e.type === 'DISTURBANCE_INJECTED');
  const anomalies = timeline.filter((e) => e.type === 'ANOMALY_DETECTED');
  const recommended = timeline.filter((e) => e.type === 'MITIGATION_RECOMMENDED');
  const accepted = timeline.filter((e) => e.type === 'MITIGATION_ACCEPTED');
  const verified = timeline.filter((e) => e.type === 'DIAGNOSIS_UPDATED' && e.verifiedMatch !== undefined);
  const verifiedMatches = verified.filter((e) => e.verifiedMatch === true).length;

  const detectionRate = injections.length > 0 ? Math.min(1, anomalies.length / injections.length) : null;

  // Pair each injection with the next anomaly detected after it, for an avg lag.
  const lags: number[] = [];
  for (const inj of injections) {
    const next = anomalies.find((a) => a.timeS >= inj.timeS);
    if (next) lags.push(next.timeS - inj.timeS);
  }
  const avgDetectionTime = lags.length > 0 ? lags.reduce((a, b) => a + b, 0) / lags.length : null;

  const mitigationRate = recommended.length > 0 ? accepted.length / recommended.length : null;

  const diagnosisAccuracy = groundTruthRevealed && verified.length > 0 ? verifiedMatches / verified.length : null;

  return {
    hasActivity: injections.length > 0 || anomalies.length > 0,
    detectionRate,
    detectionCount: anomalies.length,
    injectionCount: injections.length,
    avgDetectionTime,
    mitigationRate,
    acceptedCount: accepted.length,
    recommendedCount: recommended.length,
    diagnosisAccuracy,
    verifiedCount: verified.length,
    verifiedMatches,
  };
}

function pct(v: number | null): string {
  if (v === null) return '—';
  return `${(v * 100).toFixed(0)}%`;
}

function secs(v: number | null): string {
  if (v === null) return '—';
  return `${v.toFixed(1)} s`;
}

const MetricCardView: React.FC<MetricCard> = ({ icon: Icon, label, value, subtext, color }) => (
  <div className="rounded border border-fsoc-border bg-fsoc-bg/60 px-4 py-3 flex flex-col gap-1">
    <div className="flex items-center gap-1.5">
      <Icon size={11} className={color} />
      <span className="text-[9px] font-mono uppercase tracking-widest text-fsoc-dim">{label}</span>
    </div>
    <div className={`text-2xl font-mono font-bold tabular-nums ${value === null || value === '—' ? 'text-fsoc-dim' : color}`}>
      {value ?? '—'}
    </div>
    <div className="text-[9px] font-mono text-fsoc-dim">{subtext}</div>
  </div>
);

const PerformanceMetrics: React.FC = () => {
  const { d3Timeline, d3GroundTruthRevealed } = useSimStore();
  const [showInfo, setShowInfo] = useState(false);

  const live = useMemo(
    () => computeLiveMetrics(d3Timeline, d3GroundTruthRevealed),
    [d3Timeline, d3GroundTruthRevealed]
  );

  const cards: MetricCard[] = [
    {
      icon: Target,
      label: 'Detection Rate',
      value: pct(live.detectionRate),
      subtext: `${live.detectionCount} anomal${live.detectionCount === 1 ? 'y' : 'ies'} / ${live.injectionCount} disturbance${live.injectionCount === 1 ? '' : 's'}`,
      color: live.detectionRate === null ? 'text-fsoc-dim'
        : live.detectionRate >= 0.8 ? 'text-emerald-400' : live.detectionRate >= 0.5 ? 'text-amber-400' : 'text-red-400',
    },
    {
      icon: CheckCircle,
      label: 'Diagnosis Accuracy',
      value: d3GroundTruthRevealed ? pct(live.diagnosisAccuracy) : '—',
      subtext: d3GroundTruthRevealed
        ? `${live.verifiedMatches} / ${live.verifiedCount} verified correct`
        : 'Reveal ground truth to unlock',
      color: !d3GroundTruthRevealed || live.diagnosisAccuracy === null ? 'text-fsoc-dim'
        : live.diagnosisAccuracy >= 0.7 ? 'text-emerald-400' : 'text-amber-400',
    },
    {
      icon: Clock,
      label: 'Avg Detection Time',
      value: secs(live.avgDetectionTime),
      subtext: 'From disturbance onset to alert',
      color: live.avgDetectionTime === null ? 'text-fsoc-dim' : live.avgDetectionTime < 15 ? 'text-emerald-400' : 'text-amber-400',
    },
    {
      icon: Zap,
      label: 'Mitigation Rate',
      value: pct(live.mitigationRate),
      subtext: `${live.acceptedCount} / ${live.recommendedCount} recommendations accepted`,
      color: live.mitigationRate === null ? 'text-fsoc-dim' : live.mitigationRate >= 0.5 ? 'text-emerald-400' : 'text-amber-400',
    },
  ];

  return (
    <div className="panel flex flex-col h-full">
      {/* Header */}
      <div className="panel-header shrink-0">
        <div className="flex items-center gap-2">
          <BarChart2 size={13} className="text-fsoc-cyan" />
          <span className="panel-title">Performance Metrics</span>
          <InfoToggle open={showInfo} onToggle={() => setShowInfo(v => !v)} />
        </div>
      </div>
      {showInfo && <InfoNote>{METRICS_INFO}</InfoNote>}

      <div className="flex-1 overflow-y-auto px-3 py-3 min-h-0">
        {!live.hasActivity ? (
          <div className="rounded border border-fsoc-border/60 bg-fsoc-bg/30 px-4 py-5 text-center">
            <div className="text-[10px] font-mono text-fsoc-dim leading-relaxed">
              Inject a disturbance to start building live diagnostic performance stats.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {cards.map((card) => (
              <MetricCardView key={card.label} {...card} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PerformanceMetrics;
