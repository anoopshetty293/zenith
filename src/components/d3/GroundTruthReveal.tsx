/**
 * GroundTruthReveal.tsx
 * Ground truth verification panel — HIDDEN until user explicitly reveals.
 * CRITICAL: Ground truth is NEVER shown during active diagnosis.
 * Only revealed after user clicks the REVEAL GROUND TRUTH button.
 */

import React, { useState } from 'react';
import { Lock, Eye, CheckCircle, XCircle, AlertTriangle, HelpCircle } from 'lucide-react';
import { useSimStore } from '../../store/simulationStore';
import { InfoToggle, InfoNote } from './PanelInfo';

const REVEAL_INFO = (
  <>
    Shows the actual injected disturbance and checks it against the model's diagnosis. Hidden by default so
    the model's inference is never contaminated by the real answer while you're still deciding whether to
    trust it — click Reveal Ground Truth to see how it actually did.
  </>
);

const GroundTruthReveal: React.FC = () => {
  const {
    d3GroundTruthRevealed,
    d3Verification,
    d3Diagnosis,
    revealGroundTruth,
  } = useSimStore();
  const [showInfo, setShowInfo] = useState(false);

  // ─── LOCKED STATE ─────────────────────────────────────────────────────────
  if (!d3GroundTruthRevealed) {
    return (
      <div className="panel p-0 overflow-hidden">
        <div className="flex items-stretch">
          {/* Lock icon section */}
          <div className="flex flex-col items-center justify-center px-6 py-4 bg-amber-950/20 border-r border-amber-900/40 shrink-0">
            <Lock size={28} className="text-amber-500" />
          </div>

          {/* Info section */}
          <div className="flex-1 flex items-center gap-4 px-5 py-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono font-bold text-amber-300 tracking-widest uppercase">
                  Ground Truth Locked
                </span>
                <InfoToggle open={showInfo} onToggle={() => setShowInfo(v => !v)} />
              </div>
              <p className="text-[10px] font-mono text-fsoc-dim leading-relaxed">
                Analysis locked. Ground truth is hidden during active diagnosis.
                The AI is working from observable telemetry only — revealing the
                actual cause would compromise the diagnostic integrity.
              </p>
            </div>
            <button
              onClick={revealGroundTruth}
              className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded border border-amber-600 bg-amber-900/50 text-amber-300 text-xs font-mono font-bold tracking-widest hover:bg-amber-800/60 transition-colors duration-150"
            >
              <Eye size={14} />
              REVEAL GROUND TRUTH
            </button>
          </div>
        </div>
        {showInfo && <InfoNote>{REVEAL_INFO}</InfoNote>}
      </div>
    );
  }

  // ─── REVEALED STATE ───────────────────────────────────────────────────────
  const verification = d3Verification;

  if (!verification) {
    return (
      <div className="panel p-4 text-xs font-mono text-fsoc-dim">
        No ground truth data available for the current session.
      </div>
    );
  }

  const { diagnosedCause, actualCause, match, diagnosisConfidence, explanation, missedSignals } = verification;
  const confidencePct = (diagnosisConfidence * 100).toFixed(0);

  // Build the "why did the model struggle" text from the model's own actual
  // hypothesis scores rather than a fixed sentence — it names the specific
  // rank/confidence the true cause got (or admits it isn't modeled at all).
  const allHyps = d3Diagnosis?.allHypotheses ?? [];
  const actualHyp = allHyps.find((h) => h.type === actualCause);
  const struggleText = (() => {
    if (!d3Diagnosis) return 'No diagnosis was made during this session, so there is nothing to compare against ground truth.';
    const winner = d3Diagnosis.mostLikelyCause;
    if (actualHyp) {
      const rank = allHyps.findIndex((h) => h.type === actualCause) + 1;
      const marginPts = ((winner.confidence - actualHyp.confidence) * 100).toFixed(0);
      const heldBack = actualHyp.contradictingEvidence[0] ?? 'it never accumulated enough supporting signal in this observation window';
      return `The model did generate a "${actualHyp.label}" hypothesis — ranked #${rank} of ${allHyps.length} at ${(actualHyp.confidence * 100).toFixed(0)}% confidence, ${marginPts} points behind the winning "${winner.label}" (${(winner.confidence * 100).toFixed(0)}%). It was held back because ${heldBack.toLowerCase()}.`;
    }
    return `The classifier doesn't score a dedicated hypothesis for "${actualCause}" at all — it isn't one of the ${allHyps.length} candidate patterns evaluated this window. Its closest match was "${winner.label}" at ${(winner.confidence * 100).toFixed(0)}% confidence.`;
  })();

  return (
    <div className="panel p-0 overflow-hidden">
      {/* Banner header */}
      <div className={`flex items-center gap-3 px-4 py-2.5 border-b ${
        match
          ? 'bg-emerald-950/40 border-emerald-800/50'
          : 'bg-red-950/30 border-red-800/50'
      }`}>
        <Eye className={match ? 'text-emerald-400' : 'text-red-400'} size={16} />
        <span className="text-xs font-mono font-bold tracking-widest uppercase text-white">
          Ground Truth Revealed
        </span>
        <InfoToggle open={showInfo} onToggle={() => setShowInfo(v => !v)} />
        {match ? (
          <span className="ml-auto flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-300">
            <CheckCircle size={13} />
            DIAGNOSIS MATCH ✓
          </span>
        ) : (
          <span className="ml-auto flex items-center gap-1.5 text-xs font-mono font-bold text-red-300">
            <XCircle size={13} />
            DIAGNOSIS MISMATCH ✕
          </span>
        )}
      </div>
      {showInfo && <InfoNote>{REVEAL_INFO}</InfoNote>}

      {/* Split: D3 diagnosis vs actual */}
      <div className="grid grid-cols-2 divide-x divide-fsoc-border">
        {/* LEFT: D3's diagnosis */}
        <div className="px-4 py-3">
          <div className="text-[9px] font-mono text-fsoc-cyan uppercase tracking-widest mb-2">
            D3 Diagnosis (AI Inference)
          </div>
          <div className="text-sm font-mono font-bold text-white mb-1">
            {diagnosedCause}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1.5 bg-fsoc-border rounded-full overflow-hidden">
              <div
                className={`h-1.5 rounded-full ${match ? 'bg-emerald-400' : 'bg-amber-400'}`}
                style={{ width: `${confidencePct}%` }}
              />
            </div>
            <span className="text-xs font-mono text-fsoc-dim shrink-0">{confidencePct}% confidence</span>
          </div>
          {!d3Diagnosis && (
            <div className="mt-2 text-[10px] font-mono text-amber-400 flex items-center gap-1">
              <AlertTriangle size={10} />
              No diagnosis was made during this session.
            </div>
          )}
        </div>

        {/* RIGHT: Actual ground truth */}
        <div className="px-4 py-3">
          <div className="text-[9px] font-mono text-amber-400 uppercase tracking-widest mb-2">
            Actual Ground Truth
          </div>
          <div className={`text-sm font-mono font-bold ${match ? 'text-emerald-300' : 'text-red-300'}`}>
            {actualCause}
          </div>
          <div className={`mt-2 text-[10px] font-mono leading-relaxed ${
            match ? 'text-emerald-400' : 'text-red-400'
          }`}>
            {match ? '✓ Correctly identified' : '✕ Model misidentified cause'}
          </div>
        </div>
      </div>

      {/* Bottom: Explanation + missed signals */}
      <div className="border-t border-fsoc-border px-4 py-3 space-y-2">
        {/* Explanation */}
        <div className="rounded border border-fsoc-border/50 bg-fsoc-bg/40 px-3 py-2">
          <div className="text-[9px] font-mono text-fsoc-dim uppercase tracking-widest mb-1">
            Analysis
          </div>
          <p className="text-[10px] font-mono text-slate-300 leading-relaxed">{explanation}</p>
        </div>

        {/* Missed signals */}
        {missedSignals && missedSignals.length > 0 && (
          <div className="rounded border border-amber-900/50 bg-amber-950/20 px-3 py-2">
            <div className="text-[9px] font-mono text-amber-400 uppercase tracking-widest mb-1">
              Missed Signals
            </div>
            <ul className="space-y-0.5">
              {missedSignals.map((sig, i) => (
                <li key={i} className="text-[10px] font-mono text-amber-200/80 flex items-start gap-1.5">
                  <span className="mt-0.5 shrink-0">•</span>
                  <span>{sig}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Why did model struggle — only on mismatch */}
        {!match && (
          <div className="rounded border border-blue-900/50 bg-blue-950/20 px-3 py-2">
            <div className="flex items-center gap-1.5 text-[9px] font-mono text-blue-400 uppercase tracking-widest mb-1">
              <HelpCircle size={9} />
              Why did the model struggle?
            </div>
            <p className="text-[10px] font-mono text-blue-200/70 leading-relaxed">
              {struggleText}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GroundTruthReveal;
