import clsx from 'clsx';

type StatusVariant = 'connected' | 'degraded' | 'critical' | 'disconnected' | 'locked' | 'acquiring' | 'lost' | 'normal' | 'anomaly' | 'online' | 'info';

const VARIANT_STYLES: Record<StatusVariant, string> = {
  connected: 'bg-fsoc-green/10 text-fsoc-green border-fsoc-green/30',
  degraded: 'bg-amber-900/20 text-fsoc-amber border-amber-700/30',
  critical: 'bg-red-900/20 text-fsoc-red border-red-700/40 anomaly-border',
  disconnected: 'bg-red-950/20 text-red-400 border-red-900/30',
  locked: 'bg-fsoc-green/10 text-fsoc-green border-fsoc-green/30',
  acquiring: 'bg-blue-900/20 text-blue-300 border-blue-700/30',
  lost: 'bg-red-900/20 text-fsoc-red border-red-700/40',
  normal: 'bg-fsoc-green/10 text-fsoc-green border-fsoc-green/30',
  anomaly: 'bg-red-900/30 text-fsoc-red border-fsoc-red/50 anomaly-border',
  online: 'bg-fsoc-green/10 text-fsoc-green border-fsoc-green/30',
  info: 'bg-fsoc-cyan/10 text-fsoc-cyan border-fsoc-cyan/30',
};

interface StatusBadgeProps {
  variant: StatusVariant;
  label: string;
  dot?: boolean;
  className?: string;
}

export default function StatusBadge({ variant, label, dot = true, className }: StatusBadgeProps) {
  return (
    <div className={clsx(
      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono tracking-widest uppercase',
      VARIANT_STYLES[variant],
      className
    )}>
      {dot && <div className={clsx('w-1 h-1 rounded-full', {
        'bg-fsoc-green': ['connected', 'locked', 'normal', 'online'].includes(variant),
        'bg-fsoc-amber': ['degraded', 'acquiring'].includes(variant),
        'bg-fsoc-red animate-pulse': ['critical', 'disconnected', 'lost', 'anomaly'].includes(variant),
        'bg-fsoc-cyan': variant === 'info',
        'bg-blue-300': variant === 'acquiring',
      })} />}
      {label}
    </div>
  );
}
