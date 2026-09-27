/**
 * MitigationPanel.tsx
 * Recommended mitigation actions for D3 dashboard.
 * Shows urgency, reason, route details (if SWITCH_ROUTE), and accept/reject buttons.
 */

import React, { useState } from 'react';
import { Wrench, CheckCircle, XCircle, ArrowRight, Zap, Clock } from 'lucide-react';
import { useSimStore } from '../../store/simulationStore';
import { InfoToggle, InfoNote } from './PanelInfo';

const MITIGATION_INFO = (
  <>
    Recommends one action from the current diagnosis, prediction, and available alternate routes. Accepting
    SWITCH_ROUTE actually reroutes traffic; REACQUIRE_BEACON resets the tracking loop to force a fresh
    acquisition; INCREASE_TRACKING_CORRECTION temporarily filters out more of the pointing disturbance.
    MAINTAIN_LINK, CONTINUE_TRACKING and PREPARE_FOR_INTERRUPTION are informational — there's nothing to
    actively change for those.
  </>
);

// Bar scale — matches PredictionPanel's own red/amber thresholds (<30s red).
const CRITICAL_BAR_MAX_S = 60;

const CountdownBar: React.FC<{ etaS: number | null }> = ({ etaS }) => {
  const stable = etaS === null;
  const pct = stable ? 1 : Math.max(0, Math.min(1, etaS / CRITICAL_BAR_MAX_S));
  const color = stable
    ? 'bg-emerald-400'
    : etaS < 30 ? 'bg-red-400' : etaS < 45 ? 'bg-amber-400' : 'bg-emerald-400';
  const textColor = stable
    ? 'text-emerald-300'
    : etaS < 30 ? 'text-red-300' : etaS < 45 ? 'text-amber-300' : 'text-emerald-300';

  return (
    <div className="rounded border border-fsoc-border/50 bg-fsoc-bg/40 px-3 py-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="flex items-center gap-1.5 text-[9px] font-mono text-fsoc-dim uppercase tracking-widest">
          <Clock size={10} /> Time to Critical
        </span>
        <span className={`text-sm font-mono font-bold tabular-nums ${textColor} ${!stable && etaS < 30 ? 'animate-pulse' : ''}`}>
          {stable ? 'STABLE' : `${etaS.toFixed(0)}s`}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-fsoc-border overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
};

type UrgencyLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'IMMEDIATE';

const URGENCY_STYLES: Record<UrgencyLevel, { badge: string; border: string }> = {
  LOW:       { badge: 'bg-emerald-900/60 text-emerald-300 border-emerald-700', border: 'border-emerald-800/30' },
  MEDIUM:    { badge: 'bg-amber-900/60 text-amber-300 border-amber-700',       border: 'border-amber-800/30'  },
  HIGH:      { badge: 'bg-red-900/60 text-red-300 border-red-700',             border: 'border-red-800/30'    },
  IMMEDIATE: { badge: 'bg-red-700/80 text-white border-red-500',               border: 'border-red-600/60 animate-pulse' },
};

// Human-readable action labels
const ACTION_LABELS: Record<string, string> = {
  CONTINUE_TRACKING:          'Continue Tracking',
  INCREASE_TRACKING_CORRECTION: 'Increase Tracking Correction',
  REACQUIRE_BEACON:           'Reacquire Beacon',
  MAINTAIN_LINK:              'Maintain Current Link',
  SWITCH_ROUTE:               'Switch Route',
  PREPARE_FOR_INTERRUPTION:   'Prepare for Interruption',
};

const MitigationPanel: React.FC = () => {
  const { d3Mitigation, d3Prediction, acceptMitigation, rejectMitigation } = useSimStore();
  const [showInfo, setShowInfo] = useState(false);

  if (!d3Mitigation) {
    return (
      <div className="panel flex flex-col h-full">
        <div className="panel-header">
          <div className="flex items-center gap-2">
            <Wrench size={13} className="text-fsoc-cyan" />
            <span className="panel-title">Mitigation</span>
            <InfoToggle open={showInfo} onToggle={() => setShowInfo(v => !v)} />
          </div>
        </div>
        {showInfo && <InfoNote>{MITIGATION_INFO}</InfoNote>}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 text-center gap-3">
          <Wrench size={28} className="text-fsoc-dim opacity-40" />
          <div className="text-xs font-mono text-fsoc-dim uppercase tracking-widest">
            No Recommendation
          </div>
          <div className="text-[10px] text-fsoc-dim leading-relaxed">
            Mitigation recommendations will appear once an anomaly is diagnosed and/or a prediction is available.
          </div>
        </div>
      </div>
    );
  }

  const {
    primaryAction,
    reason,
    urgency,
    recommendedRoute,
    predictedImprovementDb,
    acceptedAt,
    rejectedAt,
  } = d3Mitigation;

  const urgencyStyle = URGENCY_STYLES[urgency] ?? URGENCY_STYLES.MEDIUM;
  const isAccepted = acceptedAt !== null;
  const isRejected = rejectedAt !== null;
  const isActioned = isAccepted || isRejected;

  const currentRoute = recommendedRoute
    ? (recommendedRoute.nodeIds.slice(0, -1).join(' → ') || 'Primary')
    : null;
  const newRoute = recommendedRoute
    ? recommendedRoute.nodeIds.join(' → ')
    : null;

  return (
    <div className={`panel flex flex-col h-full overflow-hidden border ${urgencyStyle.border}`}>
      {/* Header */}
      <div className="panel-header shrink-0">
        <div className="flex items-center gap-2">
          <Wrench size={13} className="text-fsoc-cyan" />
          <span className="panel-title">Mitigation</span>
          <InfoToggle open={showInfo} onToggle={() => setShowInfo(v => !v)} />
        </div>
        {urgency === 'IMMEDIATE' && (
          <div className="flex items-center gap-1 text-red-400 animate-pulse">
            <Zap size={11} />
            <span className="text-[10px] font-mono">IMMEDIATE</span>
          </div>
        )}
      </div>
      {showInfo && <InfoNote>{MITIGATION_INFO}</InfoNote>}

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 min-h-0">
        {/* Action + urgency */}
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-[9px] font-mono text-fsoc-dim uppercase tracking-widest mb-1">
              Recommended Action
            </div>
            <div className="text-sm font-mono font-bold text-white">
              {ACTION_LABELS[primaryAction] ?? primaryAction}
            </div>
          </div>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-widest border shrink-0 ${urgencyStyle.badge}`}>
            {urgency}
          </span>
        </div>

        {/* Live countdown — the visual anchor for "predictive", not a static number */}
        {d3Prediction && !isActioned && (
          <CountdownBar etaS={d3Prediction.estimatedTimeToCriticalS} />
        )}

        {/* Reason */}
        <div className="rounded border border-fsoc-border/50 bg-fsoc-bg/40 px-3 py-2">
          <div className="text-[9px] font-mono text-fsoc-dim uppercase tracking-widest mb-1">Rationale</div>
          <p className="text-[10px] font-mono text-slate-300 leading-relaxed">{reason}</p>
        </div>

        {/* Route switch details */}
        {primaryAction === 'SWITCH_ROUTE' && recommendedRoute && (
          <div className="rounded border border-cyan-900/50 bg-cyan-950/20 px-3 py-2 space-y-2">
            <div className="text-[9px] font-mono text-fsoc-cyan uppercase tracking-widest mb-1">
              Route Details
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-fsoc-dim w-8 shrink-0">From:</span>
              <span className="text-slate-300 truncate">{currentRoute ?? '—'}</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <ArrowRight size={10} className="text-fsoc-cyan shrink-0 ml-1" />
              <span className="text-[9px] text-fsoc-dim w-6 shrink-0">To:</span>
              <span className="text-fsoc-cyan font-bold truncate">{newRoute}</span>
            </div>
            {predictedImprovementDb !== null && (
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-fsoc-dim w-14 shrink-0">Predicted:</span>
                <span className="text-emerald-300 font-bold">
                  +{predictedImprovementDb.toFixed(1)} dB
                </span>
              </div>
            )}
          </div>
        )}

        {/* Status badge (if already actioned) */}
        {isAccepted && (
          <div className="flex items-center gap-2 px-3 py-2 rounded border border-emerald-700 bg-emerald-900/30">
            <CheckCircle size={14} className="text-emerald-400 shrink-0" />
            <span className="text-xs font-mono font-bold text-emerald-300 tracking-widest">ACCEPTED</span>
            <span className="text-[10px] font-mono text-fsoc-dim ml-auto">
              T+{acceptedAt!.toFixed(1)}s
            </span>
          </div>
        )}
        {isRejected && (
          <div className="flex items-center gap-2 px-3 py-2 rounded border border-red-700/60 bg-red-900/20">
            <XCircle size={14} className="text-red-400 shrink-0" />
            <span className="text-xs font-mono font-bold text-red-300 tracking-widest">REJECTED</span>
            <span className="text-[10px] font-mono text-fsoc-dim ml-auto">
              T+{rejectedAt!.toFixed(1)}s
            </span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {!isActioned && (
        <div className="shrink-0 flex gap-2 px-3 py-3 border-t border-fsoc-border">
          <button
            onClick={acceptMitigation}
            className="flex-1 btn-green flex items-center justify-center gap-1.5"
          >
            <CheckCircle size={11} />
            ACCEPT
          </button>
          <button
            onClick={rejectMitigation}
            className="flex-1 btn-danger flex items-center justify-center gap-1.5"
          >
            <XCircle size={11} />
            REJECT
          </button>
        </div>
      )}
    </div>
  );
};

export default MitigationPanel;
