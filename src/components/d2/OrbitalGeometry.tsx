/**
 * OrbitalGeometry.tsx
 * Orbital geometry telemetry panel for D2.
 * Shows distance, elevation, LOS status, LOS window, relative velocity,
 * predicted LOS loss time, and a depleting progress bar for the LOS window.
 */

import { useSimStore } from '../../store/simulationStore';
import { CheckCircle, XCircle, Clock, Radio } from 'lucide-react';
import clsx from 'clsx';

function ProgressBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const color =
    pct > 0.6 ? 'bg-fsoc-green' :
    pct > 0.3 ? 'bg-fsoc-amber' :
    'bg-fsoc-red';
  return (
    <div className={clsx('h-1.5 w-full rounded-full bg-fsoc-border overflow-hidden', className)}>
      <div
        className={clsx('h-full rounded-full transition-all duration-500', color)}
        style={{ width: `${pct * 100}%` }}
      />
    </div>
  );
}

function GeoRow({ label, value, unit, accent }: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-fsoc-border/40 last:border-0">
      <span className="text-[10px] font-mono text-fsoc-dim uppercase tracking-wider">{label}</span>
      <span className={clsx('text-xs font-mono tabular-nums', accent ?? 'text-white')}>
        {value}{unit && <span className="text-fsoc-dim ml-0.5">{unit}</span>}
      </span>
    </div>
  );
}

export default function OrbitalGeometry() {
  const { d2 } = useSimStore();
  const link = d2.primaryLink;
  const latest = d2.telemetryHistory[d2.telemetryHistory.length - 1];
  const orbital = latest?.observable?.orbital;

  const distanceKm  = orbital?.distanceKm  ?? link?.distanceKm  ?? 0;
  const elevationDeg = orbital?.elevationDeg ?? link?.elevationDeg ?? 0;
  const hasLOS       = orbital?.hasLOS       ?? link?.hasLOS       ?? false;
  const losWindowS   = orbital?.losWindowRemainingS ?? 999;
  const relVelKms    = orbital?.relativeVelocityKms ?? 7.6;

  // LOS window progress: cap at 300s for display purposes
  const LOS_MAX_S = 300;
  const losDisplay = losWindowS >= 999 ? '∞' : `${losWindowS.toFixed(0)}`;
  const losPct = losWindowS >= 999 ? 1 : losWindowS / LOS_MAX_S;
  const losColor =
    losWindowS >= 999 ? 'text-fsoc-green' :
    losWindowS > 90   ? 'text-fsoc-amber' :
    'text-fsoc-red';

  // Predicted LOS loss wall time
  const predictedLossText = losWindowS >= 999
    ? 'STABLE'
    : `T+${losWindowS.toFixed(0)}s`;

  const elevColor =
    (elevationDeg ?? 0) > 30 ? 'text-fsoc-green' :
    (elevationDeg ?? 0) > 10 ? 'text-fsoc-amber' :
    'text-fsoc-red';

  return (
    <div className="panel flex flex-col overflow-hidden">
      <div className="panel-header">
        <span className="panel-title flex items-center gap-1.5">
          <Radio size={10} />
          Orbital Geometry
        </span>
        <div className={clsx(
          'text-[9px] font-mono px-1.5 py-0.5 rounded uppercase tracking-wider border',
          hasLOS
            ? 'text-fsoc-green border-fsoc-green/30 bg-fsoc-green/10'
            : 'text-fsoc-red border-fsoc-red/30 bg-fsoc-red/10'
        )}>
          {hasLOS ? 'LOS ✓' : 'NO LOS ✗'}
        </div>
      </div>

      <div className="flex-1 px-3 py-2 space-y-0">
        <GeoRow
          label="Distance"
          value={distanceKm.toFixed(1)}
          unit=" km"
          accent="text-fsoc-cyan"
        />
        <GeoRow
          label="Elevation"
          value={(elevationDeg ?? 0).toFixed(1)}
          unit="°"
          accent={elevColor}
        />
        <GeoRow
          label="Rel. Velocity"
          value={relVelKms.toFixed(2)}
          unit=" km/s"
        />
        <GeoRow
          label="Pred. LOS Loss"
          value={predictedLossText}
          accent={losColor}
        />

        {/* LOS Window Row with progress bar */}
        <div className="pt-1.5 pb-0.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono text-fsoc-dim uppercase tracking-wider flex items-center gap-1">
              <Clock size={9} />
              LOS Window
            </span>
            <span className={clsx('text-xs font-mono tabular-nums', losColor)}>
              {losDisplay}
              <span className="text-fsoc-dim ml-0.5">s</span>
            </span>
          </div>
          <ProgressBar
            value={losPct * LOS_MAX_S}
            max={LOS_MAX_S}
          />
          {losWindowS < 90 && losWindowS < 999 && (
            <p className="text-[9px] font-mono text-fsoc-red mt-1 animate-pulse">
              ⚠ LOS WINDOW DEPLETING
            </p>
          )}
        </div>

        {/* LOS indicator */}
        <div className="flex items-center gap-2 pt-1">
          {hasLOS ? (
            <CheckCircle size={11} className="text-fsoc-green flex-shrink-0" />
          ) : (
            <XCircle size={11} className="text-fsoc-red flex-shrink-0" />
          )}
          <span className={clsx('text-[10px] font-mono', hasLOS ? 'text-fsoc-green' : 'text-fsoc-red')}>
            {hasLOS ? 'LINE OF SIGHT ESTABLISHED' : 'LINE OF SIGHT LOST'}
          </span>
        </div>
      </div>
    </div>
  );
}
