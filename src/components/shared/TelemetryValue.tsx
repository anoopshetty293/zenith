import clsx from 'clsx';

interface TelemetryValueProps {
  label: string;
  value: string | number | null;
  unit?: string;
  status?: 'ok' | 'warn' | 'crit' | 'info' | 'dim';
  className?: string;
  trend?: 'up' | 'down' | 'stable';
}

export default function TelemetryValue({ label, value, unit, status = 'info', className, trend }: TelemetryValueProps) {
  const statusClass = {
    ok: 'text-fsoc-green',
    warn: 'text-fsoc-amber',
    crit: 'text-fsoc-red',
    info: 'text-fsoc-cyan',
    dim: 'text-fsoc-dim',
  }[status];

  return (
    <div className={clsx('flex flex-col gap-0.5', className)}>
      <span className="text-[9px] font-mono text-fsoc-dim tracking-widest uppercase">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className={clsx('font-mono text-sm tabular-nums', statusClass)}>
          {value === null || value === undefined ? '—' : value}
        </span>
        {unit && <span className="text-[9px] font-mono text-fsoc-dim">{unit}</span>}
        {trend && (
          <span className={clsx('text-[10px]', trend === 'up' ? 'text-fsoc-green' : trend === 'down' ? 'text-fsoc-red' : 'text-fsoc-dim')}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
          </span>
        )}
      </div>
    </div>
  );
}
