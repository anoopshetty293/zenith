/**
 * PredictionPanel.tsx
 * Future state prediction panel for D3 dashboard.
 * Shows predicted link status, metric trends, and risk assessments
 * based only on observable telemetry patterns — no ground truth.
 */

import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Clock } from 'lucide-react';
import { useSimStore } from '../../store/simulationStore';
import { TrendDirection, MetricPrediction } from '@/types/intelligence';
import { InfoToggle, InfoNote } from './PanelInfo';

const PREDICTION_INFO = (
  <>
    Extrapolates each metric's recent trend — a linear fit over the last 20 seconds — 10s and 30s forward to
    flag a degrading trajectory before it becomes critical. It's a projection from recent history, not a
    guarantee: a sudden new disturbance isn't foreseen.
  </>
);

// ─── Trend Arrow ──────────────────────────────────────────────────────────────

interface TrendConfig {
  icon: React.ElementType;
  label: string;
  color: string;
  symbol: string;
}

const TREND_MAP: Record<TrendDirection, TrendConfig> = {
  improving: { icon: TrendingUp,   label: '↑',  color: 'text-emerald-400', symbol: '↑'  },
  stable:    { icon: Minus,        label: '→',  color: 'text-fsoc-dim',    symbol: '→'  },
  degrading: { icon: TrendingDown, label: '↘',  color: 'text-amber-400',   symbol: '↘'  },
  critical:  { icon: TrendingDown, label: '↓↓', color: 'text-red-400',     symbol: '↓↓' },
};

const TrendArrow: React.FC<{ trend: TrendDirection }> = ({ trend }) => {
  const cfg = TREND_MAP[trend];
  return (
    <span className={`font-mono font-bold text-sm ${cfg.color}`} title={trend}>
      {cfg.symbol}
    </span>
  );
};

// ─── Risk Badge ───────────────────────────────────────────────────────────────

const RiskBadge: React.FC<{ level: 'LOW' | 'MEDIUM' | 'HIGH' }> = ({ level }) => {
  const cls = {
    LOW:    'bg-emerald-900/60 text-emerald-300 border-emerald-700',
    MEDIUM: 'bg-amber-900/60 text-amber-300 border-amber-700',
    HIGH:   'bg-red-900/60 text-red-300 border-red-700',
  }[level];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-widest border ${cls}`}>
      {level}
    </span>
  );
};

// ─── Link Status Badge ────────────────────────────────────────────────────────

const LinkStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  if (status === 'stable') {
    return (
      <span className="px-3 py-1 rounded text-sm font-mono font-bold bg-emerald-900/60 text-emerald-300 border border-emerald-700 tracking-widest">
        STABLE
      </span>
    );
  }
  if (status === 'degrading') {
    return (
      <span className="px-3 py-1 rounded text-sm font-mono font-bold bg-amber-900/60 text-amber-300 border border-amber-700 tracking-widest animate-pulse">
        DEGRADING
      </span>
    );
  }
  return (
    <span className="px-3 py-1 rounded text-sm font-mono font-bold bg-red-900/60 text-red-300 border border-red-700 tracking-widest animate-pulse">
      LIKELY INTERRUPTION
    </span>
  );
};

// ─── Metric Row ───────────────────────────────────────────────────────────────

const MetricRow: React.FC<{
  label: string;
  unit: string;
  pred: MetricPrediction;
}> = ({ label, unit, pred }) => (
  <div className="flex items-center gap-2 py-1.5 border-b border-fsoc-border/40 last:border-0">
    <div className="w-24 shrink-0">
      <span className="text-[10px] font-mono uppercase tracking-wide text-fsoc-dim">{label}</span>
    </div>
    <TrendArrow trend={pred.trend} />
    <div className="flex items-baseline gap-1.5 flex-wrap min-w-0">
      <span className="font-mono text-xs text-white tabular-nums">
        {pred.currentValue.toFixed(1)}<span className="text-fsoc-dim text-[9px] ml-0.5">{unit}</span>
      </span>
      <span className="text-[9px] text-fsoc-dim">→ 10s:</span>
      <span className={`font-mono text-xs tabular-nums ${
        pred.trend === 'improving' ? 'text-emerald-300'
        : pred.trend === 'degrading' ? 'text-amber-300'
        : pred.trend === 'critical' ? 'text-red-300'
        : 'text-fsoc-dim'
      }`}>
        {pred.predictedValueIn10s.toFixed(1)}<span className="text-[9px] ml-0.5">{unit}</span>
      </span>
      <span className="text-[9px] text-fsoc-dim">→ 30s:</span>
      <span className={`font-mono text-xs tabular-nums ${
        pred.trend === 'improving' ? 'text-emerald-400'
        : pred.trend === 'degrading' ? 'text-red-300'
        : pred.trend === 'critical' ? 'text-red-500'
        : 'text-fsoc-dim'
      }`}>
        {pred.predictedValueIn30s.toFixed(1)}<span className="text-[9px] ml-0.5">{unit}</span>
      </span>
    </div>
    <div className="ml-auto shrink-0">
      <span className="text-[9px] font-mono text-fsoc-dim">
        {(pred.confidence * 100).toFixed(0)}%
      </span>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const PredictionPanel: React.FC = () => {
  const { d3Prediction } = useSimStore();
  const [showInfo, setShowInfo] = useState(false);

  if (!d3Prediction) {
    return (
      <div className="panel flex flex-col h-full">
        <div className="panel-header">
          <div className="flex items-center gap-2">
            <Clock size={13} className="text-fsoc-cyan" />
            <span className="panel-title">State Prediction</span>
            <InfoToggle open={showInfo} onToggle={() => setShowInfo(v => !v)} />
          </div>
        </div>
        {showInfo && <InfoNote>{PREDICTION_INFO}</InfoNote>}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 text-center gap-3">
          <AlertTriangle size={28} className="text-fsoc-dim opacity-40" />
          <div className="text-xs font-mono text-fsoc-dim uppercase tracking-widest">
            Awaiting Telemetry
          </div>
          <div className="text-[10px] text-fsoc-dim leading-relaxed">
            Predictive modelling activates after sufficient telemetry history is established.
          </div>
        </div>
      </div>
    );
  }

  const {
    predictedLinkStatus,
    estimatedTimeToCriticalS,
    trackingLossRisk,
    snr,
    linkMargin,
    pointingError,
    detectionConfidence,
  } = d3Prediction;

  // Describe trajectory in plain language
  const trajectoryDescription =
    predictedLinkStatus === 'stable'
      ? 'Link parameters are projected to remain within acceptable bounds. No corrective action required.'
      : predictedLinkStatus === 'degrading'
      ? 'Progressive parameter degradation detected. Monitor closely; preemptive mitigation may prevent interruption.'
      : 'Telemetry trajectory indicates high probability of link loss. Immediate mitigation recommended.';

  return (
    <div className="panel flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="panel-header shrink-0">
        <div className="flex items-center gap-2">
          <Clock size={13} className="text-fsoc-cyan" />
          <span className="panel-title">State Prediction</span>
          <InfoToggle open={showInfo} onToggle={() => setShowInfo(v => !v)} />
        </div>
      </div>
      {showInfo && <InfoNote>{PREDICTION_INFO}</InfoNote>}

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 min-h-0">
        {/* Predicted link status */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-fsoc-dim uppercase tracking-widest">Predicted Link</span>
          <LinkStatusBadge status={predictedLinkStatus} />
        </div>

        {/* Time to critical + tracking loss risk */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded border border-fsoc-border bg-fsoc-bg/40 px-3 py-2">
            <div className="text-[9px] font-mono text-fsoc-dim uppercase tracking-widest mb-1">
              Time to Critical
            </div>
            <div className={`text-lg font-mono font-bold tabular-nums ${
              estimatedTimeToCriticalS !== null && estimatedTimeToCriticalS < 30
                ? 'text-red-300'
                : 'text-emerald-300'
            }`}>
              {estimatedTimeToCriticalS !== null
                ? `${estimatedTimeToCriticalS.toFixed(0)} s`
                : 'STABLE'}
            </div>
          </div>
          <div className="rounded border border-fsoc-border bg-fsoc-bg/40 px-3 py-2">
            <div className="text-[9px] font-mono text-fsoc-dim uppercase tracking-widest mb-1">
              Tracking Loss Risk
            </div>
            <RiskBadge level={trackingLossRisk} />
          </div>
        </div>

        {/* Metric predictions */}
        <div>
          <div className="text-[9px] font-mono tracking-widest uppercase text-fsoc-dim mb-1.5">
            Metric Trajectory
          </div>
          <div className="rounded border border-fsoc-border bg-fsoc-bg/40 px-2 py-1">
            <MetricRow label="SNR"         unit="dB"  pred={snr} />
            <MetricRow label="Link Margin" unit="dB"  pred={linkMargin} />
            <MetricRow label="Point Err"  unit="µrad" pred={pointingError} />
            <MetricRow label="Det. Conf"  unit="%"    pred={detectionConfidence} />
          </div>
        </div>

        {/* Trajectory description */}
        <div className="rounded border border-fsoc-border/50 bg-fsoc-panel/60 px-3 py-2">
          <div className="text-[9px] font-mono text-fsoc-dim uppercase tracking-widest mb-1">
            Analysis
          </div>
          <p className="text-[10px] font-mono text-slate-300 leading-relaxed">
            {trajectoryDescription}
          </p>
        </div>
      </div>
    </div>
  );
};

export default PredictionPanel;
