/**
 * DiagnosisPanel.tsx
 * Cause inference panel for D3 dashboard.
 * CRITICAL: Never reveals actual disturbance label/ground truth.
 * Shows AI-inferred hypotheses only. Ground truth hidden until user reveals.
 */

import React, { useState } from 'react';
import { Brain, AlertCircle, ChevronRight, ChevronDown } from 'lucide-react';
import { useSimStore, resolveD3History } from '../../store/simulationStore';
import { CauseHypothesis } from '@/types/intelligence';
import { InfoToggle, InfoNote } from './PanelInfo';

// Colors per hypothesis index (primary → fading alts)
const HYPOTHESIS_COLORS = [
  'bg-fsoc-cyan',
  'bg-blue-500',
  'bg-blue-700',
  'bg-blue-800',
  'bg-fsoc-border',
];

const ConfidenceBar: React.FC<{
  confidence: number; // 0–1
  colorClass?: string;
  height?: string;
}> = ({ confidence, colorClass = 'bg-fsoc-cyan', height = 'h-1.5' }) => (
  <div className={`w-full bg-fsoc-border rounded-full ${height} overflow-hidden`}>
    <div
      className={`${height} rounded-full transition-all duration-700 ${colorClass}`}
      style={{ width: `${Math.max(2, confidence * 100)}%` }}
    />
  </div>
);

const EvidenceList: React.FC<{
  items: string[];
  variant: 'supporting' | 'contradicting';
}> = ({ items, variant }) => {
  if (!items.length) return null;
  const isSupporting = variant === 'supporting';
  return (
    <div className="mt-1.5">
      <div className={`text-[9px] font-mono tracking-widest uppercase mb-1 ${isSupporting ? 'text-emerald-400' : 'text-fsoc-dim'}`}>
        {isSupporting ? '▲ Supporting' : '▼ Contradicting'}
      </div>
      <ul className="space-y-0.5">
        {items.map((item, i) => (
          <li key={i} className={`text-[10px] font-mono leading-relaxed flex items-start gap-1.5 ${isSupporting ? 'text-slate-300' : 'text-fsoc-dim'}`}>
            <ChevronRight size={9} className="mt-0.5 shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const AlternativeRow: React.FC<{
  hyp: CauseHypothesis;
  colorClass: string;
}> = ({ hyp, colorClass }) => {
  const [expanded, setExpanded] = useState(false);
  const hasEvidence = hyp.supportingEvidence.length > 0 || hyp.contradictingEvidence.length > 0;

  return (
    <div className="py-1.5 border-b border-fsoc-border/40 last:border-0">
      <button
        type="button"
        onClick={() => hasEvidence && setExpanded(v => !v)}
        className={`w-full text-left ${hasEvidence ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="flex items-center gap-1 text-[10px] font-mono text-fsoc-dim uppercase tracking-wide truncate">
            {hasEvidence && (
              expanded
                ? <ChevronDown size={9} className="shrink-0 text-fsoc-dim" />
                : <ChevronRight size={9} className="shrink-0 text-fsoc-dim" />
            )}
            {hyp.label}
          </span>
          <span className="text-[10px] font-mono text-fsoc-dim ml-2 shrink-0">
            {(hyp.confidence * 100).toFixed(0)}%
          </span>
        </div>
        <ConfidenceBar confidence={hyp.confidence} colorClass={colorClass} height="h-1" />
      </button>
      {expanded && (
        <div className="mt-1 pl-3 border-l border-fsoc-border/50">
          <EvidenceList items={hyp.supportingEvidence} variant="supporting" />
          <EvidenceList items={hyp.contradictingEvidence} variant="contradicting" />
        </div>
      )}
    </div>
  );
};

const DiagnosisPanel: React.FC = () => {
  const { d3Diagnosis, d3Source, d1, d2 } = useSimStore();
  const [showInfo, setShowInfo] = useState(false);

  // Need at least 8 telemetry samples for diagnosis
  const history = resolveD3History(d3Source, d1, d2);
  const hasEnoughData = history.length >= 8;

  // ─── INSUFFICIENT DATA ────────────────────────────────────────────────────
  if (!d3Diagnosis || !hasEnoughData) {
    return (
      <div className="panel flex flex-col h-full">
        <div className="panel-header">
          <div className="flex items-center gap-2">
            <Brain size={13} className="text-fsoc-cyan" />
            <span className="panel-title">Cause Diagnosis</span>
          </div>
          <InfoToggle open={showInfo} onToggle={() => setShowInfo(v => !v)} />
        </div>
        {showInfo && (
          <InfoNote>
            This is a scored rule-based classifier, not a trained ML model. Each candidate cause is a hand-written
            pattern over observable telemetry only (SNR, pointing error, jitter, detection confidence, etc.) — never
            the injected ground truth. Scores are normalized into the confidence percentages shown below.
          </InfoNote>
        )}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 text-center gap-3">
          <AlertCircle size={28} className="text-fsoc-dim opacity-50" />
          <div className="text-xs font-mono text-fsoc-dim uppercase tracking-widest">
            Insufficient Data
          </div>
          <div className="text-[10px] text-fsoc-dim leading-relaxed max-w-xs">
            Cause diagnosis requires a minimum of 8 telemetry samples and an active anomaly.
            {!hasEnoughData && (
              <span className="block mt-1 text-fsoc-cyan">
                Samples: {history.length} / 8
              </span>
            )}
          </div>
          {/* Simple progress bar */}
          {!hasEnoughData && (
            <div className="w-full max-w-xs">
              <ConfidenceBar
                confidence={Math.min(1, history.length / 8)}
                colorClass="bg-fsoc-cyan/60"
                height="h-1"
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  const { mostLikelyCause, alternatives, multiCause } = d3Diagnosis;

  const runnerUp = alternatives[0];

  return (
    <div className="panel flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="panel-header shrink-0">
        <div className="flex items-center gap-2">
          <Brain size={13} className="text-fsoc-cyan" />
          <span className="panel-title">Cause Diagnosis</span>
          <InfoToggle open={showInfo} onToggle={() => setShowInfo(v => !v)} />
        </div>
        <span className="text-[10px] font-mono text-fsoc-dim">
          {(d3Diagnosis.confidence * 100).toFixed(0)}% overall confidence
        </span>
      </div>
      {showInfo && (
        <InfoNote>
          This is a scored rule-based classifier, not a trained ML model. Each candidate cause is a hand-written
          pattern over observable telemetry only (SNR, pointing error, jitter, detection confidence, etc.) — never
          the injected ground truth. Scores are normalized into the confidence percentages shown below.
        </InfoNote>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 min-h-0">
        {/* Multi-cause banner — names the runner-up rather than just flagging ambiguity */}
        {multiCause && runnerUp && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded border border-amber-700/60 bg-amber-900/20 text-xs font-mono text-amber-300">
            <AlertCircle size={11} className="shrink-0" />
            <span>
              AMBIGUOUS: {mostLikelyCause.label} {(mostLikelyCause.confidence * 100).toFixed(0)}% vs.{' '}
              {runnerUp.label} {(runnerUp.confidence * 100).toFixed(0)}%
            </span>
          </div>
        )}

        {/* Most likely cause */}
        <div className="rounded border border-fsoc-cyan/30 bg-cyan-950/20 p-3">
          <div className="text-[9px] font-mono tracking-widest uppercase text-fsoc-cyan mb-1">
            Most Likely Cause
          </div>
          <div className="text-sm font-mono font-bold text-white mb-2">
            {mostLikelyCause.label}
          </div>
          <div className="flex items-center gap-2 mb-2">
            <ConfidenceBar
              confidence={mostLikelyCause.confidence}
              colorClass="bg-fsoc-cyan"
              height="h-2"
            />
            <span className="text-xs font-mono text-fsoc-cyan shrink-0 w-10 text-right">
              {(mostLikelyCause.confidence * 100).toFixed(0)}%
            </span>
          </div>

          <EvidenceList items={mostLikelyCause.supportingEvidence} variant="supporting" />
          <EvidenceList items={mostLikelyCause.contradictingEvidence} variant="contradicting" />
        </div>

        {/* Alternative hypotheses */}
        {alternatives.length > 0 && (
          <div>
            <div className="text-[9px] font-mono tracking-widest uppercase text-fsoc-dim mb-1.5">
              Alternative Hypotheses
            </div>
            <div className="rounded border border-fsoc-border bg-fsoc-bg/40 px-2 py-1">
              {alternatives.map((hyp, idx) => (
                <AlternativeRow
                  key={hyp.type}
                  hyp={hyp}
                  colorClass={HYPOTHESIS_COLORS[Math.min(idx + 1, HYPOTHESIS_COLORS.length - 1)]}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DiagnosisPanel;
