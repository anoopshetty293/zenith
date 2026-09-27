/**
 * ConfidenceGraph.tsx
 * Recharts LineChart showing confidence % for each hypothesis over simulation time.
 * Shows only top 4 hypotheses to keep chart readable.
 * Never labels lines with ground truth — only hypothesis type names.
 */

import React, { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { useSimStore } from '../../store/simulationStore';
import { ConfidenceHistoryPoint } from '@/types/intelligence';
import { InfoToggle, InfoNote } from './PanelInfo';

const CONFIDENCE_GRAPH_INFO = (
  <>
    Plots each candidate cause's confidence score over time, straight from the diagnosis engine — never the
    true disturbance label. Watching lines cross shows the model changing its mind as more telemetry arrives,
    not just its final answer.
  </>
);

// Colors keyed by known disturbance types
const HYPOTHESIS_COLORS: Record<string, string> = {
  TURBULENCE:              '#00d4ff', // cyan
  FOG:                     '#3b82f6', // blue
  CAMERA_VIBRATION:        '#ffb300', // amber
  SENSOR_NOISE:            '#22c55e', // green
  BEACON_LOSS:             '#ef4444', // red
  ATTITUDE_JITTER:         '#a855f7', // purple
  DEBRIS_INTERFERENCE:     '#f97316', // orange
  POINTING_OFFSET:         '#06b6d4', // teal
  BEACON_INTENSITY_REDUCTION: '#8b5cf6', // violet
  SCINTILLATION:           '#10b981', // emerald
  CLOUD_OBSTRUCTION:       '#64748b', // slate
  TERMINAL_JITTER:         '#f59e0b', // yellow
  SUDDEN_POINTING_OFFSET:  '#ec4899', // pink
  SPACECRAFT_VIBRATION:    '#14b8a6', // teal2
  BEACON_OCCLUSION:        '#84cc16', // lime
  MULTI_DISTURBANCE:       '#fb923c', // orange2
};

// Fallback colors for unlisted types
const FALLBACK_COLORS = ['#00d4ff', '#3b82f6', '#22c55e', '#f97316', '#a855f7'];

// Human-readable labels
const HYPOTHESIS_LABELS: Record<string, string> = {
  TURBULENCE:              'Atmospheric Turbulence',
  FOG:                     'Fog / Mist',
  CAMERA_VIBRATION:        'Camera Vibration',
  SENSOR_NOISE:            'Sensor Noise',
  BEACON_LOSS:             'Beacon Loss',
  ATTITUDE_JITTER:         'Attitude Jitter',
  DEBRIS_INTERFERENCE:     'Debris Interference',
  POINTING_OFFSET:         'Pointing Offset',
  BEACON_INTENSITY_REDUCTION: 'Beacon Reduction',
  SCINTILLATION:           'Scintillation',
  CLOUD_OBSTRUCTION:       'Cloud Obstruction',
  TERMINAL_JITTER:         'Terminal Jitter',
  SUDDEN_POINTING_OFFSET:  'Sudden Offset',
  SPACECRAFT_VIBRATION:    'Spacecraft Vib.',
  BEACON_OCCLUSION:        'Beacon Occlusion',
  MULTI_DISTURBANCE:       'Multi-Disturbance',
};

// Custom tooltip
const CustomTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: number;
}> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-fsoc-panel border border-fsoc-border rounded px-3 py-2 shadow-lg">
      <div className="text-[10px] font-mono text-fsoc-dim mb-1.5">T+{label?.toFixed(1)}s</div>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-[10px] font-mono">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-fsoc-dim">{HYPOTHESIS_LABELS[entry.name] ?? entry.name}:</span>
          <span className="font-bold tabular-nums" style={{ color: entry.color }}>
            {entry.value.toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  );
};

// Custom legend
const CustomLegend: React.FC<{
  topKeys: string[];
  colorMap: Record<string, string>;
}> = ({ topKeys, colorMap }) => (
  <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-4 pb-2 mt-1">
    {topKeys.map((key) => (
      <div key={key} className="flex items-center gap-1.5">
        <span className="w-6 h-0.5 rounded inline-block" style={{ backgroundColor: colorMap[key] }} />
        <span className="text-[9px] font-mono text-fsoc-dim uppercase tracking-wide">
          {HYPOTHESIS_LABELS[key] ?? key}
        </span>
      </div>
    ))}
  </div>
);

const ConfidenceGraph: React.FC = () => {
  const { d3ConfidenceHistory } = useSimStore();
  const [showInfo, setShowInfo] = useState(false);

  // ─── Determine top-4 hypotheses by last observed confidence ────────────────
  const { chartData, topKeys, colorMap } = useMemo(() => {
    if (!d3ConfidenceHistory.length) return { chartData: [], topKeys: [], colorMap: {} };

    // Collect all unique hypothesis keys
    const allKeys = new Set<string>();
    d3ConfidenceHistory.forEach((pt) => {
      Object.keys(pt.hypotheses).forEach((k) => allKeys.add(k));
    });

    // Score by last-seen confidence to pick top 4
    const lastPoint = d3ConfidenceHistory[d3ConfidenceHistory.length - 1];
    const scored = [...allKeys].map((key) => ({
      key,
      score: lastPoint.hypotheses[key] ?? 0,
    })).sort((a, b) => b.score - a.score);

    const topKeys = scored.slice(0, 4).map((s) => s.key);

    // Build Recharts-compatible data (confidence in %)
    const chartData = d3ConfidenceHistory.map((pt: ConfidenceHistoryPoint) => {
      const row: Record<string, number> = { timeS: pt.timeS };
      topKeys.forEach((k) => {
        row[k] = (pt.hypotheses[k] ?? 0) * 100;
      });
      return row;
    });

    // Build color map
    const colorMap: Record<string, string> = {};
    topKeys.forEach((key, i) => {
      colorMap[key] = HYPOTHESIS_COLORS[key] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length];
    });

    return { chartData, topKeys, colorMap };
  }, [d3ConfidenceHistory]);

  // ─── EMPTY STATE ────────────────────────────────────────────────────────────
  if (!chartData.length) {
    return (
      <div className="panel flex flex-col h-full">
        <div className="panel-header shrink-0">
          <div className="flex items-center gap-2">
            <TrendingUp size={13} className="text-fsoc-cyan" />
            <span className="panel-title">Hypothesis Confidence</span>
            <InfoToggle open={showInfo} onToggle={() => setShowInfo(v => !v)} />
          </div>
        </div>
        {showInfo && <InfoNote>{CONFIDENCE_GRAPH_INFO}</InfoNote>}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center gap-3">
          <TrendingUp size={32} className="text-fsoc-dim opacity-30" />
          <div className="text-xs font-mono text-fsoc-dim uppercase tracking-widest">
            Awaiting Telemetry
          </div>
          <div className="text-[10px] font-mono text-fsoc-dim leading-relaxed max-w-xs">
            Confidence graph will populate once an anomaly is detected and diagnosis begins.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel flex flex-col h-full">
      {/* Header */}
      <div className="panel-header shrink-0">
        <div className="flex items-center gap-2">
          <TrendingUp size={13} className="text-fsoc-cyan" />
          <span className="panel-title">Hypothesis Confidence</span>
          <InfoToggle open={showInfo} onToggle={() => setShowInfo(v => !v)} />
        </div>
        <span className="text-[10px] font-mono text-fsoc-dim">
          Top {topKeys.length} hypotheses · {chartData.length} samples
        </span>
      </div>
      {showInfo && <InfoNote>{CONFIDENCE_GRAPH_INFO}</InfoNote>}

      {/* Chart */}
      <div className="flex-1 min-h-0 px-1 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 16, left: -8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a3a60" vertical={false} />
            <XAxis
              dataKey="timeS"
              tickFormatter={(v: number) => `${v.toFixed(0)}s`}
              tick={{ fill: '#4a6080', fontSize: 9, fontFamily: 'monospace' }}
              axisLine={{ stroke: '#1a3a60' }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v: number) => `${v}%`}
              tick={{ fill: '#4a6080', fontSize: 9, fontFamily: 'monospace' }}
              axisLine={{ stroke: '#1a3a60' }}
              tickLine={false}
              width={36}
            />
            <Tooltip content={<CustomTooltip />} />
            {topKeys.map((key) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colorMap[key]}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <CustomLegend topKeys={topKeys} colorMap={colorMap} />
    </div>
  );
};

export default ConfidenceGraph;
