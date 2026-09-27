/**
 * FutureTimeline.tsx
 * Vertical event timeline showing predicted future events for D2.
 * Computes ETAs from debris and orbital LOS window data.
 */

import { useSimStore } from '../../store/simulationStore';
import { Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import clsx from 'clsx';

interface TimelineEvent {
  etaS: number;
  label: string;
  severity: 'safe' | 'warning' | 'critical';
  icon: React.ReactNode;
}

const SEV_STYLES = {
  safe:     'border-l-fsoc-green bg-fsoc-green/5 text-fsoc-green',
  warning:  'border-l-fsoc-amber bg-fsoc-amber/5 text-fsoc-amber',
  critical: 'border-l-fsoc-red   bg-fsoc-red/5   text-fsoc-red',
};

const SEV_DOT = {
  safe:     'bg-fsoc-green',
  warning:  'bg-fsoc-amber',
  critical: 'bg-fsoc-red animate-pulse',
};

function formatEta(s: number): string {
  if (s <= 0) return 'NOW';
  if (s >= 999) return '—';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m > 0 ? `T+${m}m${sec}s` : `T+${sec}s`;
}

export default function FutureTimeline() {
  const { d2 } = useSimStore();
  const latest = d2.telemetryHistory[d2.telemetryHistory.length - 1];
  const orbital = latest?.observable?.orbital;

  const events: TimelineEvent[] = [];

  // T+0 baseline
  events.push({
    etaS: 0,
    label: 'NOW — Current system state',
    severity: 'safe',
    icon: <CheckCircle size={10} />,
  });

  // Debris events
  for (const d of d2.debris) {
    if (d.predictedIntersection && d.etaToIntersectionS < 999) {
      const sev: TimelineEvent['severity'] =
        d.etaToIntersectionS < 60  ? 'critical' :
        d.etaToIntersectionS < 180 ? 'warning'  : 'warning';
      events.push({
        etaS: d.etaToIntersectionS,
        label: `${d.name} approaches optical path (${d.distanceFromPathKm.toFixed(0)} km)`,
        severity: sev,
        icon: <AlertTriangle size={10} />,
      });
      if (d.intersectionDurationS > 0) {
        events.push({
          etaS: d.etaToIntersectionS + d.intersectionDurationS,
          label: `${d.name} clears optical path`,
          severity: 'warning',
          icon: <CheckCircle size={10} />,
        });
      }
    } else if (d.distanceFromPathKm < 100) {
      events.push({
        etaS: 30,
        label: `${d.name} within warning zone (${d.distanceFromPathKm.toFixed(0)} km to path)`,
        severity: 'warning',
        icon: <AlertTriangle size={10} />,
      });
    }
  }

  // LOS window event
  const losWindow = orbital?.losWindowRemainingS ?? 999;
  if (losWindow < 999) {
    const sev: TimelineEvent['severity'] =
      losWindow < 60  ? 'critical' :
      losWindow < 120 ? 'warning'  : 'warning';
    events.push({
      etaS: losWindow,
      label: `LOS will be lost (satellite exits coverage)`,
      severity: sev,
      icon: <AlertTriangle size={10} />,
    });
    // Satellite return estimate: roughly half-orbit
    const reacquireEta = losWindow + 2700; // ~45min orbit gap estimate
    events.push({
      etaS: reacquireEta,
      label: 'Next LOS window (next pass estimate)',
      severity: 'safe',
      icon: <CheckCircle size={10} />,
    });
  } else if (orbital?.hasLOS) {
    events.push({
      etaS: 120,
      label: 'LOS stable — satellite in good pass',
      severity: 'safe',
      icon: <CheckCircle size={10} />,
    });
  }

  // Link quality warning
  const snr = d2.primaryLink?.snrDb ?? -999;
  if (snr > -900 && snr < 12) {
    const estTimeToCrit = Math.max(5, (snr - 8) * 8);
    events.push({
      etaS: estTimeToCrit,
      label: `Link SNR degrading — critical in ~${estTimeToCrit.toFixed(0)}s`,
      severity: snr < 8 ? 'critical' : 'warning',
      icon: <AlertTriangle size={10} />,
    });
  }

  // Sort by ETA
  events.sort((a, b) => a.etaS - b.etaS);

  return (
    <div className="panel flex flex-col overflow-hidden">
      <div className="panel-header">
        <span className="panel-title flex items-center gap-1.5">
          <Clock size={10} />
          Future Timeline
        </span>
        <span className="text-[9px] font-mono text-fsoc-dim">PREDICTED</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {events.length === 0 ? (
          <div className="text-center py-4">
            <CheckCircle size={16} className="text-fsoc-green mx-auto mb-1" />
            <p className="text-[10px] font-mono text-fsoc-dim">No events predicted.</p>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical timeline line */}
            <div className="absolute left-[18px] top-3 bottom-3 w-px bg-fsoc-border/50" />

            <div className="space-y-2">
              {events.map((evt, i) => (
                <div key={i} className="flex items-start gap-2">
                  {/* Timeline dot */}
                  <div className="flex-shrink-0 flex flex-col items-center" style={{ width: 38 }}>
                    <div className={clsx('w-2.5 h-2.5 rounded-full border-2 border-fsoc-panel z-10', SEV_DOT[evt.severity])} />
                    <span className="text-[8px] font-mono text-fsoc-dim mt-0.5 text-center leading-tight">
                      {evt.etaS === 0 ? 'NOW' : formatEta(evt.etaS)}
                    </span>
                  </div>

                  {/* Event card */}
                  <div className={clsx(
                    'flex-1 flex items-start gap-1.5 border-l-2 rounded-r pl-2 pr-1 py-1',
                    SEV_STYLES[evt.severity]
                  )}>
                    <span className="flex-shrink-0 mt-0.5">{evt.icon}</span>
                    <span className="text-[9px] font-mono leading-relaxed">{evt.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
