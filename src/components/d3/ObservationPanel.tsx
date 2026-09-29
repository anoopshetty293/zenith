/**
 * ObservationPanel.tsx
 * Live telemetry feed sidebar for D3 dashboard.
 * Shows real-time observable metrics from the selected source.
 * Never exposes ground truth — only observable telemetry values.
 */

import React, { useState } from 'react';
import { Activity, Radio, Eye, Wifi, Gauge, Signal, Navigation } from 'lucide-react';
import { useSimStore, resolveD3History, d3SourceLabel } from '../../store/simulationStore';
import { ObservableTelemetry } from '@/types/telemetry';
import { InfoToggle, InfoNote } from './PanelInfo';
import Term from '../shared/Term';

const OBSERVATION_INFO = (
  <>
    Raw telemetry values exactly as the intelligence engine sees them — the same observable-only feed that
    drives detection, diagnosis and prediction. Never the injected ground truth.
  </>
);

interface MetricDef {
  icon: React.ElementType;
  label: string;
  format: (obs: ObservableTelemetry) => string;
  unit: string;
  isNominal: (obs: ObservableTelemetry) => boolean;
  section?: string;
}

const METRICS: MetricDef[] = [
  // PAT section
  {
    icon: Radio,
    label: 'Pointing Error',
    format: (obs) => obs.pointingErrorUrad.toFixed(1),
    unit: 'µrad',
    isNominal: (obs) => obs.pointingErrorUrad < 50,
    section: 'PAT',
  },
  {
    icon: Navigation,
    label: 'Beacon Jitter',
    format: (obs) => obs.beaconJitterUrad.toFixed(2),
    unit: 'µrad',
    isNominal: (obs) => obs.beaconJitterUrad < 20,
    section: 'PAT',
  },
  {
    icon: Eye,
    label: 'Det. Confidence',
    format: (obs) => (obs.detectionConfidence * 100).toFixed(0),
    unit: '%',
    isNominal: (obs) => obs.detectionConfidence > 0.7,
    section: 'PAT',
  },
  // Link section
  {
    icon: Activity,
    label: 'SNR',
    format: (obs) => obs.snrDb.toFixed(1),
    unit: 'dB',
    isNominal: (obs) => obs.snrDb > 10,
    section: 'LINK',
  },
  {
    icon: Wifi,
    label: 'Link Margin',
    format: (obs) => obs.linkMarginDb.toFixed(1),
    unit: 'dB',
    isNominal: (obs) => obs.linkMarginDb > 3,
    section: 'LINK',
  },
  {
    icon: Gauge,
    label: 'Rx Power',
    format: (obs) => obs.receivedPowerDbm.toFixed(1),
    unit: 'dBm',
    isNominal: (obs) => obs.receivedPowerDbm > -40,
    section: 'LINK',
  },
  {
    icon: Signal,
    label: 'BER (log₁₀)',
    format: (obs) => obs.berLog10.toFixed(2),
    unit: '',
    isNominal: (obs) => obs.berLog10 < -6,
    section: 'LINK',
  },
  {
    icon: Activity,
    label: 'Atmos. Loss',
    format: (obs) => obs.atmosphericLossDb.toFixed(2),
    unit: 'dB',
    isNominal: (obs) => obs.atmosphericLossDb < 5,
    section: 'LINK',
  },
];

const StatusDot: React.FC<{ ok: boolean }> = ({ ok }) => (
  <span
    className={`inline-block w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`}
  />
);

const ObservationPanel: React.FC = () => {
  const { d3Source, d1, d2, simTimeS, isRunning } = useSimStore();
  const [showInfo, setShowInfo] = useState(false);

  const history = resolveD3History(d3Source, d1, d2);
  const latestSample = history.length > 0 ? history[history.length - 1] : null;
  const obs = latestSample?.observable;

  // Group metrics by section
  const sections = ['PAT', 'LINK'] as const;

  return (
    <div className="panel flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="panel-header shrink-0">
        <div className="flex items-center gap-2">
          <Activity size={13} className="text-fsoc-cyan" />
          <span className="panel-title">Live Observation</span>
          <InfoToggle open={showInfo} onToggle={() => setShowInfo(v => !v)} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-fsoc-dim'}`} />
          <span className="text-[9px] font-mono text-fsoc-dim">
            {isRunning ? 'LIVE' : 'PAUSED'}
          </span>
        </div>
      </div>
      {showInfo && <InfoNote>{OBSERVATION_INFO}</InfoNote>}

      {/* Source + time */}
      <div className="px-3 py-1.5 border-b border-fsoc-border bg-fsoc-bg/40 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono text-fsoc-dim uppercase tracking-widest">Source:</span>
          <span className="text-[9px] font-mono text-fsoc-cyan font-bold">{d3SourceLabel(d3Source)}</span>
        </div>
        <span className="text-[9px] font-mono text-fsoc-dim tabular-nums">
          T+{simTimeS.toFixed(1)}s
        </span>
      </div>

      {/* Telemetry feed */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {!obs ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center gap-2">
            <Activity size={20} className="text-fsoc-dim opacity-30" />
            <div className="text-[10px] font-mono text-fsoc-dim">
              Awaiting telemetry...
            </div>
          </div>
        ) : (
          <>
            {sections.map((section) => (
              <div key={section}>
                <div className="px-3 py-1 bg-fsoc-bg/60 border-b border-fsoc-border/40">
                  <span className="text-[9px] font-mono font-bold tracking-widest uppercase text-fsoc-dim">
                    {section} Telemetry
                  </span>
                </div>
                <div className="divide-y divide-fsoc-border/20">
                  {METRICS.filter((m) => m.section === section).map((metric) => {
                    const valueStr = metric.format(obs);
                    const nominal = metric.isNominal(obs);
                    return (
                      <div
                        key={metric.label}
                        className="flex items-center gap-2 px-3 py-1.5"
                      >
                        <metric.icon size={10} className="text-fsoc-dim shrink-0" />
                        <span className="text-[9px] font-mono text-fsoc-dim flex-1 truncate">
                          {metric.label}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`font-mono text-xs tabular-nums font-bold ${nominal ? 'text-white' : 'text-amber-300'}`}>
                            {valueStr}
                          </span>
                          {metric.unit && (
                            <span className="text-[9px] font-mono text-fsoc-dim">{metric.unit}</span>
                          )}
                          <StatusDot ok={nominal} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Tracking status */}
            <div>
              <div className="px-3 py-1 bg-fsoc-bg/60 border-b border-fsoc-border/40 border-t border-fsoc-border/40">
                <span className="text-[9px] font-mono font-bold tracking-widest uppercase text-fsoc-dim">
                  Status
                </span>
              </div>
              <div className="divide-y divide-fsoc-border/20">
                <div className="flex items-center gap-2 px-3 py-1.5">
                  <span className="text-[9px] font-mono text-fsoc-dim flex-1">Tracking</span>
                  <span className={`text-[9px] font-mono font-bold tabular-nums ${
                    obs.trackingStatus === 'LOCKED' ? 'text-emerald-300'
                    : obs.trackingStatus === 'ACQUIRING' ? 'text-amber-300'
                    : 'text-red-300'
                  }`}>{obs.trackingStatus}</span>
                  <StatusDot ok={obs.trackingStatus === 'LOCKED'} />
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5">
                  <span className="text-[9px] font-mono text-fsoc-dim flex-1"><Term>LOS</Term></span>
                  <span className={`text-[9px] font-mono font-bold ${obs.hasLOS ? 'text-emerald-300' : 'text-red-300'}`}>
                    {obs.hasLOS ? 'CLEAR' : 'BLOCKED'}
                  </span>
                  <StatusDot ok={obs.hasLOS} />
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5">
                  <span className="text-[9px] font-mono text-fsoc-dim flex-1">Route</span>
                  <span className={`text-[9px] font-mono font-bold ${obs.primaryRouteAvailable ? 'text-emerald-300' : 'text-amber-300'}`}>
                    {obs.primaryRouteAvailable ? 'PRIMARY' : 'ALTERNATE'}
                  </span>
                  <StatusDot ok={obs.primaryRouteAvailable} />
                </div>
              </div>
            </div>

            {/* Sample count */}
            <div className="px-3 py-1.5 border-t border-fsoc-border/40">
              <span className="text-[9px] font-mono text-fsoc-dim">
                Samples: <span className="text-white tabular-nums">{history.length}</span>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ObservationPanel;
