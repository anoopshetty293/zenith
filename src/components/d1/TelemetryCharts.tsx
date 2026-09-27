import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  ReferenceArea,
} from 'recharts';
import { Activity } from 'lucide-react';
import { useSimStore } from '../../store/simulationStore';
import { ObservableTelemetry } from '../../types/telemetry';

// ─── Chart config ─────────────────────────────────────────────────────────────

interface ChartConfig {
  title: string;
  dataKey: keyof ObservableTelemetry;
  unit: string;
  yMin: number;
  yMax: number;
  color: string;
  degradeMin?: number;
  degradeMax?: number;
  transform?: (v: number) => number;
  formatValue?: (v: number) => string;
}

const CHARTS: ChartConfig[] = [
  {
    title: 'Pointing Error',
    dataKey: 'pointingErrorUrad',
    unit: 'μrad',
    yMin: 0,
    yMax: 200,
    color: '#06b6d4',
    degradeMin: 80,
    degradeMax: 200,
  },
  {
    title: 'SNR',
    dataKey: 'snrDb',
    unit: 'dB',
    yMin: 0,
    yMax: 40,
    color: '#22c55e',
    degradeMin: 0,
    degradeMax: 15,
  },
  {
    title: 'Received Power',
    dataKey: 'receivedPowerDbm',
    unit: 'dBm',
    yMin: -60,
    yMax: 0,
    color: '#a78bfa',
    degradeMin: -60,
    degradeMax: -40,
  },
  {
    title: 'BER (log₁₀)',
    dataKey: 'berLog10',
    unit: 'log₁₀',
    yMin: -12,
    yMax: 0,
    color: '#fb923c',
    degradeMin: -6,
    degradeMax: 0,
    formatValue: v => `1e${v.toFixed(1)}`,
  },
];

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label, unit, formatValue }: any) => {
  if (!active || !payload?.length) return null;
  const val: number = payload[0]?.value ?? 0;
  return (
    <div className="bg-fsoc-bg border border-fsoc-border rounded px-2 py-1 text-[10px] font-mono shadow-lg">
      <div className="text-fsoc-dim mb-0.5">t+{Number(label).toFixed(0)}s</div>
      <div style={{ color: payload[0]?.color ?? '#06b6d4' }}>
        {formatValue ? formatValue(val) : val.toFixed(2)} {unit}
      </div>
    </div>
  );
};

// ─── Single Chart ─────────────────────────────────────────────────────────────

interface SingleChartProps {
  config: ChartConfig;
  data: Array<{ t: number } & Partial<ObservableTelemetry>>;
  disturbanceTime: number | null;
}

const SingleChart: React.FC<SingleChartProps> = ({ config, data, disturbanceTime }) => {
  const { title, dataKey, unit, yMin, yMax, color, degradeMin, degradeMax, formatValue } = config;

  return (
    <div className="bg-fsoc-panel border border-fsoc-border/60 rounded-lg p-2 space-y-1">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-semibold text-fsoc-cyan uppercase tracking-wider">{title}</span>
        <span className="text-[9px] text-fsoc-dim font-mono">{unit}</span>
      </div>
      <ResponsiveContainer width="100%" height={110}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="rgba(51,65,85,0.5)" />
          {/* Degradation zone */}
          {degradeMin !== undefined && degradeMax !== undefined && (
            <ReferenceArea
              y1={degradeMin}
              y2={degradeMax}
              fill="rgba(251,191,36,0.07)"
              stroke="rgba(251,191,36,0.15)"
              strokeDasharray="3 3"
            />
          )}
          <XAxis
            dataKey="t"
            tick={{ fill: '#475569', fontSize: 8, fontFamily: 'monospace' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `+${Number(v).toFixed(0)}s`}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fill: '#475569', fontSize: 8, fontFamily: 'monospace' }}
            tickLine={false}
            axisLine={false}
            tickCount={5}
          />
          <Tooltip
            content={
              <CustomTooltip unit={unit} formatValue={formatValue} />
            }
          />
          {/* Disturbance injection marker */}
          {disturbanceTime !== null && (
            <ReferenceLine
              x={disturbanceTime}
              stroke="#ef4444"
              strokeWidth={1.5}
              strokeDasharray="3 2"
              label={{ value: '⚡', position: 'top', fill: '#ef4444', fontSize: 9 }}
            />
          )}
          <Line
            type="monotone"
            dataKey={dataKey as string}
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            activeDot={{ r: 3, fill: color }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const TelemetryCharts: React.FC = () => {
  const telemetryHistory    = useSimStore(s => s.d1.telemetryHistory);
  const activeDisturbances  = useSimStore(s => s.d1.activeDisturbances);

  // Rolling 60-sample window, sampled every 3rd for performance
  const chartData = useMemo(() => {
    const window = telemetryHistory.slice(-60);
    return window
      .filter((_, i) => i % 3 === 0)
      .map(sample => {
        const obs = sample.observable;
        // Use relative timestamp offset
        return {
          t: obs.timestamp,
          pointingErrorUrad: obs.pointingErrorUrad,
          snrDb: obs.snrDb,
          receivedPowerDbm: obs.receivedPowerDbm,
          berLog10: obs.berLog10,
        };
      });
  }, [telemetryHistory]);

  // Disturbance injection time (first active disturbance start time)
  const disturbanceTime = useMemo(() => {
    if (activeDisturbances.length === 0) return null;
    const earliest = activeDisturbances.reduce(
      (min, d) => d.startTimeS < min ? d.startTimeS : min,
      activeDisturbances[0].startTimeS
    );
    return earliest;
  }, [activeDisturbances]);

  const hasData = chartData.length > 0;

  return (
    <div className="bg-fsoc-panel border border-fsoc-border rounded-lg p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-fsoc-cyan" />
          <span className="text-xs font-semibold text-fsoc-cyan uppercase tracking-widest">
            Telemetry Charts
          </span>
        </div>
        <div className="flex items-center gap-3 text-[9px] text-fsoc-dim">
          <span className="font-mono">{chartData.length * 3} samples</span>
          {disturbanceTime !== null && (
            <span className="flex items-center gap-1">
              <span className="text-fsoc-red">|</span>
              <span>Disturbance at t+{disturbanceTime.toFixed(0)}s</span>
            </span>
          )}
          <span>
            <span className="text-fsoc-amber">▓</span> Degradation zone
          </span>
        </div>
      </div>

      <div className="h-px bg-fsoc-border/60" />

      {!hasData ? (
        <div className="flex items-center justify-center h-24 text-[10px] text-fsoc-dim">
          Waiting for telemetry data — start the simulation
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {CHARTS.map(cfg => (
            <SingleChart
              key={cfg.dataKey}
              config={cfg}
              data={chartData}
              disturbanceTime={disturbanceTime}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TelemetryCharts;
