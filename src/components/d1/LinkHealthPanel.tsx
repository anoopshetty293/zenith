import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Clock, Shield, Activity, AlertTriangle } from 'lucide-react';
import { useSimStore } from '../../store/simulationStore';

// ─── Health level derivation ─────────────────────────────────────────────────

type HealthLevel = 'Healthy' | 'Degraded' | 'Critical';

function deriveHealthLevel(snrDb: number, linkMarginDb: number): HealthLevel {
  if (snrDb < 8 || linkMarginDb < 2)  return 'Critical';
  if (snrDb < 15 || linkMarginDb < 6) return 'Degraded';
  return 'Healthy';
}

function healthColor(h: HealthLevel): string {
  switch (h) {
    case 'Healthy':  return 'text-fsoc-green border-fsoc-green bg-fsoc-green/10 shadow-[0_0_8px_rgba(34,197,94,0.35)]';
    case 'Degraded': return 'text-fsoc-amber border-fsoc-amber bg-fsoc-amber/10 shadow-[0_0_8px_rgba(251,191,36,0.35)]';
    case 'Critical': return 'text-fsoc-red border-fsoc-red bg-fsoc-red/10 shadow-[0_0_8px_rgba(239,68,68,0.45)]';
  }
}

function healthIcon(h: HealthLevel) {
  switch (h) {
    case 'Healthy':  return <Shield className="w-3 h-3 text-fsoc-green" />;
    case 'Degraded': return <AlertTriangle className="w-3 h-3 text-fsoc-amber" />;
    case 'Critical': return <AlertTriangle className="w-3 h-3 text-fsoc-red" />;
  }
}

// ─── SNR trend derivation ─────────────────────────────────────────────────────
// Returns slope in dB/s using simple linear regression over last N samples

function computeSnrTrend(snrs: number[], dt: number): number {
  if (snrs.length < 3) return 0;
  const n = Math.min(snrs.length, 20);
  const xs = Array.from({ length: n }, (_, i) => i * dt);
  const ys = snrs.slice(-n);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((acc, x, i) => acc + (x - xMean) * (ys[i] - yMean), 0);
  const den = xs.reduce((acc, x) => acc + (x - xMean) ** 2, 0);
  return den === 0 ? 0 : num / den;
}

type Prediction = 'Stable' | 'Degrading' | 'Likely Interruption';

function derivePrediction(trend: number, snr: number): Prediction {
  if (trend < -0.5 || snr < 10) return 'Likely Interruption';
  if (trend < -0.1)             return 'Degrading';
  return 'Stable';
}

function predictionColor(p: Prediction): string {
  switch (p) {
    case 'Stable':              return 'text-fsoc-green';
    case 'Degrading':           return 'text-fsoc-amber';
    case 'Likely Interruption': return 'text-fsoc-red';
  }
}

function predictionIcon(p: Prediction) {
  switch (p) {
    case 'Stable':              return <TrendingUp className="w-3 h-3 text-fsoc-green" />;
    case 'Degrading':           return <TrendingDown className="w-3 h-3 text-fsoc-amber" />;
    case 'Likely Interruption': return <TrendingDown className="w-3 h-3 text-fsoc-red" />;
  }
}

// ─── Mini bar ────────────────────────────────────────────────────────────────

function MiniBar({
  label,
  value,        // 0–1
  color,
  displayValue,
}: {
  label: string;
  value: number;
  color: string;
  displayValue: string;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-fsoc-dim uppercase tracking-wider">{label}</span>
        <span className="text-[10px] font-mono text-fsoc-cyan">{displayValue}</span>
      </div>
      <div className="h-1.5 bg-fsoc-bg rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${(clamped * 100).toFixed(1)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

const LinkHealthPanel: React.FC = () => {
  const primaryLink     = useSimStore(s => s.d1.primaryLink);
  const telemetryHistory = useSimStore(s => s.d1.telemetryHistory);
  const patState        = useSimStore(s => s.d1.patState);

  const snrDb        = primaryLink?.snrDb        ?? 0;
  const linkMarginDb = primaryLink?.linkMarginDb  ?? 0;

  // Extract SNR time series
  const snrHistory = useMemo(() =>
    telemetryHistory.map(t => t.observable.snrDb),
    [telemetryHistory]
  );

  // 0.2 s per tick
  const trendPerS = useMemo(() => computeSnrTrend(snrHistory, 0.2), [snrHistory]);

  const health     = deriveHealthLevel(snrDb, linkMarginDb);
  const prediction = derivePrediction(trendPerS, snrDb);

  // Est time to critical: (currentSNR - 8) / |slope|
  const SNR_CRITICAL_THRESHOLD = 8;
  const timeToCriticalS: number | null = useMemo(() => {
    if (health === 'Critical') return 0;
    const absTrend = Math.abs(trendPerS);
    if (absTrend < 0.01) return null; // essentially flat
    if (trendPerS >= 0)  return null; // improving
    return Math.max(0, (snrDb - SNR_CRITICAL_THRESHOLD) / absTrend);
  }, [snrDb, trendPerS, health]);

  // Normalised values for bars (0–1)
  // SNR: 0 dB → 0, 30 dB → 1
  const snrNorm        = Math.max(0, Math.min(1, snrDb / 30));
  // Link margin: 0 dB → 0, 15 dB → 1
  const marginNorm     = Math.max(0, Math.min(1, linkMarginDb / 15));
  // PAT stability: detectionConfidence
  const patStability   = patState.detectionConfidence;

  const snrBarColor    = snrNorm > 0.6 ? '#22c55e' : snrNorm > 0.3 ? '#fbbf24' : '#ef4444';
  const marginBarColor = marginNorm > 0.5 ? '#22c55e' : marginNorm > 0.25 ? '#fbbf24' : '#ef4444';
  const patBarColor    = patStability > 0.7 ? '#22c55e' : patStability > 0.4 ? '#fbbf24' : '#ef4444';

  return (
    <div className="bg-fsoc-panel border border-fsoc-border rounded-lg p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-fsoc-cyan" />
        <span className="text-xs font-semibold text-fsoc-cyan uppercase tracking-widest">
          Link Health
        </span>
      </div>

      <div className="h-px bg-fsoc-border/60" />

      {/* Current Health */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {healthIcon(health)}
          <span className="text-[10px] uppercase tracking-wider text-fsoc-dim">Current Health</span>
        </div>
        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${healthColor(health)}`}>
          {health.toUpperCase()}
        </span>
      </div>

      {/* Prediction */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {predictionIcon(prediction)}
          <span className="text-[10px] uppercase tracking-wider text-fsoc-dim">Predicted</span>
        </div>
        <span className={`text-[10px] font-mono font-bold ${predictionColor(prediction)}`}>
          {prediction.toUpperCase()}
        </span>
      </div>

      {/* SNR Trend */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {trendPerS >= 0
            ? <TrendingUp className="w-3 h-3 text-fsoc-green" />
            : <TrendingDown className="w-3 h-3 text-fsoc-amber" />}
          <span className="text-[10px] uppercase tracking-wider text-fsoc-dim">SNR Trend</span>
        </div>
        <span className={`text-[10px] font-mono ${trendPerS >= 0 ? 'text-fsoc-green' : 'text-fsoc-amber'}`}>
          {trendPerS >= 0 ? '+' : ''}{trendPerS.toFixed(2)} dB/s
        </span>
      </div>

      {/* Time to Critical */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-fsoc-dim" />
          <span className="text-[10px] uppercase tracking-wider text-fsoc-dim">Est. Time to Critical</span>
        </div>
        <span className={`text-[10px] font-mono ${
          timeToCriticalS === null
            ? 'text-fsoc-green'
            : timeToCriticalS < 30
              ? 'text-fsoc-red'
              : 'text-fsoc-amber'
        }`}>
          {timeToCriticalS === null
            ? '—'
            : timeToCriticalS === 0
              ? 'NOW'
              : `${timeToCriticalS.toFixed(0)} s`}
        </span>
      </div>

      <div className="h-px bg-fsoc-border/60" />

      {/* Metric Bars */}
      <div className="space-y-2">
        <MiniBar
          label="SNR Health"
          value={snrNorm}
          color={snrBarColor}
          displayValue={`${snrDb.toFixed(1)} dB`}
        />
        <MiniBar
          label="Link Margin"
          value={marginNorm}
          color={marginBarColor}
          displayValue={`${linkMarginDb.toFixed(1)} dB`}
        />
        <MiniBar
          label="PAT Stability"
          value={patStability}
          color={patBarColor}
          displayValue={`${(patStability * 100).toFixed(0)}%`}
        />
      </div>
    </div>
  );
};

export default LinkHealthPanel;
