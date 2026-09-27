/**
 * DecisionTimeline.tsx
 * Chronological event log for D3 dashboard.
 * Color-coded by event type. Auto-scrolls to bottom.
 * DISTURBANCE_INJECTED events are only shown after ground truth is revealed.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { List, Check, X } from 'lucide-react';
import { useSimStore } from '../../store/simulationStore';
import { TimelineEvent, TimelineEventType } from '@/types/intelligence';
import { InfoToggle, InfoNote } from './PanelInfo';

const TIMELINE_INFO = (
  <>
    A chronological log of every detection, diagnosis, prediction, mitigation, and route change this
    session. Once you reveal ground truth, past diagnoses get retroactively tagged verified/missed here so
    you can see the model's real track record, not just its current answer.
  </>
);

// ─── Event Type Styling ────────────────────────────────────────────────────────

interface EventStyle {
  dot: string;
  text: string;
  label: string;
}

const EVENT_STYLES: Record<TimelineEventType, EventStyle> = {
  NORMAL:                { dot: 'bg-fsoc-dim',    text: 'text-fsoc-dim',    label: 'NORMAL'    },
  ANOMALY_DETECTED:      { dot: 'bg-red-400',     text: 'text-red-300',     label: 'ANOMALY'   },
  DIAGNOSIS_UPDATED:     { dot: 'bg-fsoc-cyan',   text: 'text-fsoc-cyan',   label: 'DIAGNOSIS' },
  PREDICTION_UPDATED:    { dot: 'bg-blue-400',    text: 'text-blue-300',    label: 'PREDICT'   },
  MITIGATION_RECOMMENDED:{ dot: 'bg-amber-400',   text: 'text-amber-300',   label: 'MITIGATE'  },
  MITIGATION_ACCEPTED:   { dot: 'bg-emerald-400', text: 'text-emerald-300', label: 'ACCEPTED'  },
  MITIGATION_REJECTED:   { dot: 'bg-red-600',     text: 'text-red-400',     label: 'REJECTED'  },
  ROUTE_SWITCHED:        { dot: 'bg-emerald-400', text: 'text-emerald-300', label: 'ROUTE'     },
  RECOVERY:              { dot: 'bg-emerald-500', text: 'text-emerald-300', label: 'RECOVERY'  },
  GROUND_TRUTH_REVEALED: { dot: 'bg-purple-400',  text: 'text-purple-300',  label: 'GT REVEAL' },
  DISTURBANCE_INJECTED:  { dot: 'bg-red-600',     text: 'text-red-400',     label: 'DISTURBANCE'},
};

// ─── Single Event Row ─────────────────────────────────────────────────────────

const EventRow: React.FC<{ event: TimelineEvent; isLast: boolean }> = ({ event, isLast }) => {
  const style = EVENT_STYLES[event.type] ?? EVENT_STYLES.NORMAL;

  return (
    <div className={`flex items-start gap-2 py-1 ${!isLast ? 'border-b border-fsoc-border/20' : ''}`}>
      {/* Timeline connector */}
      <div className="flex flex-col items-center shrink-0 mt-1" style={{ width: 14 }}>
        <div className={`w-2 h-2 rounded-full ${style.dot} shrink-0`} />
        {!isLast && <div className="w-px flex-1 bg-fsoc-border/30 mt-0.5" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-[9px] font-mono text-fsoc-dim shrink-0 tabular-nums">
            T+{event.timeS.toFixed(1)}s
          </span>
          <span className={`text-[9px] font-mono font-bold uppercase tracking-widest shrink-0 ${style.text}`}>
            [{style.label}]
          </span>
          {event.verifiedMatch === true && (
            <span title="Confirmed correct against revealed ground truth" className="flex items-center gap-0.5 text-[9px] font-mono font-bold text-emerald-400 shrink-0">
              <Check size={9} /> VERIFIED
            </span>
          )}
          {event.verifiedMatch === false && (
            <span title="Did not match revealed ground truth" className="flex items-center gap-0.5 text-[9px] font-mono font-bold text-red-400 shrink-0">
              <X size={9} /> MISSED
            </span>
          )}
        </div>
        <div className={`text-[10px] font-mono leading-relaxed mt-0.5 ${style.text} opacity-90`}>
          {event.description}
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const DecisionTimeline: React.FC = () => {
  const { d3Timeline, d3GroundTruthRevealed } = useSimStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showInfo, setShowInfo] = useState(false);

  // Filter: hide DISTURBANCE_INJECTED until ground truth is revealed
  const visibleEvents = d3Timeline.filter((ev) => {
    if (ev.type === 'DISTURBANCE_INJECTED' && !d3GroundTruthRevealed) return false;
    return true;
  });

  // Confusion-matrix tally over every verified diagnosis this session.
  const verified = useMemo(
    () => visibleEvents.filter((ev) => ev.verifiedMatch !== undefined),
    [visibleEvents]
  );
  const verifiedMatches = verified.filter((ev) => ev.verifiedMatch === true).length;

  // Auto-scroll to bottom when events update
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [visibleEvents.length]);

  return (
    <div className="panel flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="panel-header shrink-0">
        <div className="flex items-center gap-2">
          <List size={13} className="text-fsoc-cyan" />
          <span className="panel-title">Decision Timeline</span>
          <InfoToggle open={showInfo} onToggle={() => setShowInfo(v => !v)} />
        </div>
        <span className="text-[10px] font-mono text-fsoc-dim">
          {visibleEvents.length} event{visibleEvents.length !== 1 ? 's' : ''}
        </span>
      </div>
      {showInfo && <InfoNote>{TIMELINE_INFO}</InfoNote>}

      {/* Confusion-matrix summary — only exists once ground truth has been
          revealed at least once this session; nothing before that. */}
      {verified.length > 0 && (
        <div className="shrink-0 flex items-center gap-3 px-3 py-1.5 border-b border-fsoc-border bg-fsoc-bg/40">
          <span className="text-[9px] font-mono text-fsoc-dim uppercase tracking-widest">Diagnosis record</span>
          <span className="flex items-center gap-1 text-[9px] font-mono text-emerald-400">
            <Check size={9} /> {verifiedMatches} verified
          </span>
          <span className="flex items-center gap-1 text-[9px] font-mono text-red-400">
            <X size={9} /> {verified.length - verifiedMatches} missed
          </span>
          <span className="text-[9px] font-mono text-fsoc-cyan ml-auto">
            {((verifiedMatches / verified.length) * 100).toFixed(0)}% accuracy
          </span>
        </div>
      )}

      {/* Scrollable event list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-2 min-h-0"
        style={{ maxHeight: 300 }}
      >
        {visibleEvents.length === 0 ? (
          <div className="text-[10px] font-mono text-fsoc-dim py-4 text-center">
            No events yet.
          </div>
        ) : (
          <div>
            {visibleEvents.map((ev, idx) => (
              <EventRow
                key={ev.id}
                event={ev}
                isLast={idx === visibleEvents.length - 1}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer hint if disturbance events hidden */}
      {!d3GroundTruthRevealed && d3Timeline.some((ev) => ev.type === 'DISTURBANCE_INJECTED') && (
        <div className="shrink-0 px-3 py-1.5 border-t border-fsoc-border bg-fsoc-bg/40">
          <span className="text-[9px] font-mono text-amber-500/70">
            ⚠ Some events hidden — reveal ground truth to see all.
          </span>
        </div>
      )}
    </div>
  );
};

export default DecisionTimeline;
