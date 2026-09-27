/**
 * DebrisPanel.tsx
 * Debris management panel for D2.
 * Shows all debris objects with risk levels, proximity to optical path,
 * predicted intersection ETA, and warning banners.
 */

import { useSimStore } from '../../store/simulationStore';
import type { Debris } from '../../types/nodes';
import { AlertTriangle, Trash2, Plus } from 'lucide-react';
import clsx from 'clsx';

const RISK_STYLES = {
  low:    'bg-fsoc-green/20 text-fsoc-green border-fsoc-green/40',
  medium: 'bg-fsoc-amber/20 text-fsoc-amber border-fsoc-amber/40',
  high:   'bg-fsoc-red/20   text-fsoc-red   border-fsoc-red/40',
};

const PATH_WARNING_KM = 100; // within this distance → show warning banner

function DebrisRow({ debris, onDelete }: { debris: Debris; onDelete: (id: string) => void }) {
  const isWarning  = debris.distanceFromPathKm < PATH_WARNING_KM;
  const isCritical = debris.predictedIntersection;

  return (
    <div className={clsx(
      'rounded border p-2 space-y-1.5 transition-colors',
      isCritical
        ? 'border-fsoc-red/60 bg-red-900/10'
        : isWarning
        ? 'border-fsoc-amber/50 bg-amber-900/10'
        : 'border-fsoc-border/40 bg-black/10'
    )}>
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className={clsx(
            'w-2 h-2 rounded-full',
            debris.riskLevel === 'high'   ? 'bg-fsoc-red animate-pulse' :
            debris.riskLevel === 'medium' ? 'bg-fsoc-amber' :
            'bg-fsoc-green'
          )} />
          <span className="text-[10px] font-mono text-white">{debris.name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={clsx(
            'text-[9px] font-mono px-1.5 py-0.5 rounded border uppercase',
            RISK_STYLES[debris.riskLevel]
          )}>
            {debris.riskLevel}
          </span>
          <button
            onClick={() => onDelete(debris.id)}
            className="text-fsoc-dim hover:text-fsoc-red transition-colors"
          >
            <Trash2 size={10} />
          </button>
        </div>
      </div>

      {/* Data rows */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        <DebrisDataItem label="Altitude" value={`${debris.altitudeKm.toFixed(0)} km`} />
        <DebrisDataItem label="Size"     value={`${debris.sizeM.toFixed(2)} m`} />
        <DebrisDataItem
          label="Dist to Path"
          value={`${debris.distanceFromPathKm.toFixed(1)} km`}
          accent={isWarning ? 'text-fsoc-amber' : debris.distanceFromPathKm < 30 ? 'text-fsoc-red' : undefined}
        />
        <DebrisDataItem
          label="Intersection"
          value={debris.predictedIntersection ? 'YES' : 'NO'}
          accent={debris.predictedIntersection ? 'text-fsoc-red' : 'text-fsoc-green'}
        />
        {debris.predictedIntersection && (
          <>
            <DebrisDataItem
              label="ETA"
              value={`${debris.etaToIntersectionS.toFixed(0)}s`}
              accent="text-fsoc-red"
            />
            <DebrisDataItem
              label="Duration"
              value={`~${debris.intersectionDurationS.toFixed(0)}s`}
              accent="text-fsoc-amber"
            />
          </>
        )}
      </div>
    </div>
  );
}

function DebrisDataItem({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div className="text-[8px] font-mono text-fsoc-dim uppercase">{label}</div>
      <div className={clsx('text-[10px] font-mono tabular-nums', accent ?? 'text-white')}>{value}</div>
    </div>
  );
}

export default function DebrisPanel() {
  const { d2, addD2Debris, removeD2Debris } = useSimStore();
  const debris = d2.debris;

  const hasWarning  = debris.some(d => d.distanceFromPathKm < PATH_WARNING_KM);
  const hasIntersect = debris.some(d => d.predictedIntersection);

  return (
    <div className="panel flex flex-col overflow-hidden">
      <div className="panel-header">
        <span className="panel-title flex items-center gap-1.5">
          <AlertTriangle size={10} />
          Debris Tracker
        </span>
        <button
          onClick={addD2Debris}
          className="flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded border border-fsoc-amber/50 text-fsoc-amber hover:bg-fsoc-amber/10 transition-colors"
        >
          <Plus size={9} />
          ADD DEBRIS
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {/* Warning banners */}
        {hasIntersect && (
          <div className="flex items-center gap-1.5 bg-red-900/30 border border-fsoc-red/50 rounded px-2 py-1.5 animate-pulse">
            <AlertTriangle size={10} className="text-fsoc-red flex-shrink-0" />
            <span className="text-[9px] font-mono text-fsoc-red uppercase tracking-wider">
              DEBRIS INTERSECTION PREDICTED
            </span>
          </div>
        )}
        {!hasIntersect && hasWarning && (
          <div className="flex items-center gap-1.5 bg-amber-900/20 border border-fsoc-amber/40 rounded px-2 py-1.5">
            <AlertTriangle size={10} className="text-fsoc-amber flex-shrink-0" />
            <span className="text-[9px] font-mono text-fsoc-amber uppercase tracking-wider">
              POTENTIAL OPTICAL LINK INTERFERENCE
            </span>
          </div>
        )}

        {/* Debris count header */}
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-mono text-fsoc-dim">
            {debris.length} object{debris.length !== 1 ? 's' : ''} tracked
          </span>
          {debris.length === 0 && (
            <span className="text-[9px] font-mono text-fsoc-green">CLEAR</span>
          )}
        </div>

        {/* Debris list */}
        {debris.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-[10px] font-mono text-fsoc-dim">No debris tracked.</p>
            <p className="text-[9px] font-mono text-fsoc-dim mt-1">Click ADD DEBRIS to introduce a new object.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {debris.map(d => (
              <DebrisRow
                key={d.id}
                debris={d}
                onDelete={removeD2Debris}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
