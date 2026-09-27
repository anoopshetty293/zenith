import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface DataPoint {
  t: number;
  value: number;
}

interface LiveChartProps {
  data: DataPoint[];
  color?: string;
  yMin?: number;
  yMax?: number;
  yLabel?: string;
  height?: number;
  disturbanceT?: number;
  warnZoneY?: [number, number];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="panel px-2 py-1">
        <p className="text-[9px] font-mono text-fsoc-dim">T+{label?.toFixed(1)}s</p>
        <p className="text-xs font-mono text-fsoc-cyan">{payload[0].value?.toFixed(2)}</p>
      </div>
    );
  }
  return null;
};

export default function LiveChart({
  data,
  color = '#00d4ff',
  yMin,
  yMax,
  yLabel,
  height = 100,
  disturbanceT,
  warnZoneY,
}: LiveChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="#1a2a44" vertical={false} />
        <XAxis
          dataKey="t"
          tick={{ fontSize: 8, fill: '#8899aa', fontFamily: 'monospace' }}
          tickFormatter={v => `${v.toFixed(0)}s`}
          stroke="#1a2a44"
        />
        <YAxis
          domain={[yMin ?? 'auto', yMax ?? 'auto']}
          tick={{ fontSize: 8, fill: '#8899aa', fontFamily: 'monospace' }}
          stroke="#1a2a44"
          width={32}
          label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', fill: '#8899aa', fontSize: 8 } : undefined}
        />
        <Tooltip content={<CustomTooltip />} />
        {disturbanceT !== undefined && (
          <ReferenceLine x={disturbanceT} stroke="#ff3333" strokeDasharray="4 2" strokeWidth={1} label={{ value: 'DISTURB', fill: '#ff3333', fontSize: 8 }} />
        )}
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          dot={false}
          strokeWidth={1.5}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
