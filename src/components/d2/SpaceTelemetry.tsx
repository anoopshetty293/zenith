/**
 * SpaceTelemetry.tsx
 * Compact telemetry grid for D2 link.
 * 2-column grid of key metrics + mini Recharts SNR chart.
 */

import { useSimStore } from '../../store/simulationStore';
import { Activity } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import clsx from 'clsx';

const HISTORY_WINDOW = 150; // ~30s at 5Hz

function MetricCell({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-black/20 rounded px-2 py-1.5 border border-fsoc-border/30">
      <div className="text-[9px] font-mono text-fsoc-dim uppercase tracking-wider mb-0.5">{label}</div>
      <div className={clsx('text-xs font-mono tabular-nums', accent ?? 'text-white')}>{value}</div>
    </div>
  );
}

function statusColor(status: string): string {
  switch (status) {
    case 'LOCKED': return 'text-fsoc-green';
    case 'ACQUIRING': return 'text-fsoc-cyan';
    case 'DEGRADED': return 'text-fsoc-amber';
    case 'LOST': return 'text-fsoc-red';
    default: return 'text-fsoc-dim';
  }
}

function snrColor(snr: number): string {
  return snr > 15 ? 'text-fsoc-green' : snr > 8 ? 'text-fsoc-amber' : 'text-fsoc-red';
}

function marginColor(margin: number): string {
  return margin > 6 ? 'text-fsoc-green' : margin > 0 ? 'text-fsoc-amber' : 'text-fsoc-red';
}

function confidenceColor(conf: number): string {
  return conf > 0.8 ? 'text-fsoc-green' : conf > 0.5 ? 'text-fsoc-amber' : 'text-fsoc-red';
}

export default function SpaceTelemetry() {
  const { d2 } = useSimStore();
  const link = d2.primaryLink;
  const pat  = d2.patState;

  const rxPower   = link?.receivedPowerDbm ?? -999;
  const snr       = link?.snrDb ?? -999;
  const ber       = link?.berLog10 ?? 0;
  const margin    = link?.linkMarginDb ?? -999;
  const atmLoss   = link?.atmosphericLossDb ?? 0;
  const pError    = pat.pointingErrorUrad;
  const conf      = pat.detectionConfidence;
  const tracking  = pat.trackingStatus;

  // Build SNR chart data from last HISTORY_WINDOW samples
  const snrHistory = d2.telemetryHistory
    .slice(-HISTORY_WINDOW)
    .map((s, i) => ({
      t: i,
      snr: s.observable.snrDb > -900 ? s.observable.snrDb : 0,
    }));

  return (
    <div className="panel flex flex-col overflow-hidden">
      <div className="panel-header">
        <span className="panel-title flex items-center gap-1.5">
          <Activity size={10} />
          Space Telemetry
        </span>
        <span className={clsx('text-[9px] font-mono uppercase tracking-wider', statusColor(tracking))}>
          {tracking}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {/* 2-column metric grid */}
        <div className="grid grid-cols-2 gap-1.5">
          <MetricCell
            label="Rcvd Power"
            value={rxPower > -900 ? `${rxPower.toFixed(1)} dBm` : '-- dBm'}
            accent={rxPower > -45 ? 'text-fsoc-green' : rxPower > -55 ? 'text-fsoc-amber' : 'text-fsoc-red'}
          />
          <MetricCell
            label="SNR"
            value={snr > -900 ? `${snr.toFixed(1)} dB` : '-- dB'}
            accent={snrColor(snr)}
          />
          <MetricCell
            label="BER (log₁₀)"
            value={`${ber.toFixed(2)}`}
            accent={ber < -6 ? 'text-fsoc-green' : ber < -3 ? 'text-fsoc-amber' : 'text-fsoc-red'}
          />
          <MetricCell
            label="Link Margin"
            value={margin > -900 ? `${margin.toFixed(1)} dB` : '-- dB'}
            accent={marginColor(margin)}
          />
          <MetricCell
            label="Atm Loss"
            value={`${atmLoss.toFixed(2)} dB`}
            accent="text-fsoc-cyan"
          />
          <MetricCell
            label="Pointing Err"
            value={`${pError.toFixed(1)} μrad`}
            accent={pError < 50 ? 'text-fsoc-green' : pError < 150 ? 'text-fsoc-amber' : 'text-fsoc-red'}
          />
          <MetricCell
            label="Det. Conf."
            value={`${(conf * 100).toFixed(1)}%`}
            accent={confidenceColor(conf)}
          />
          <MetricCell
            label="Tracking"
            value={tracking}
            accent={statusColor(tracking)}
          />
        </div>

        {/* Mini SNR chart */}
        <div>
          <div className="text-[9px] font-mono text-fsoc-dim uppercase tracking-wider mb-1">
            SNR — Last 30s
          </div>
          <div className="h-16 w-full">
            {snrHistory.length > 2 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={snrHistory} margin={{ top: 2, right: 2, left: -28, bottom: 0 }}>
                  <YAxis
                    domain={['auto', 'auto']}
                    tick={{ fontSize: 8, fill: '#4a6a8a', fontFamily: 'monospace' }}
                    width={32}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#0a1628',
                      border: '1px solid #1a3a60',
                      borderRadius: 4,
                      fontSize: 9,
                      fontFamily: 'monospace',
                      color: '#00d4ff',
                    }}
                    formatter={(v: number) => [`${v.toFixed(1)} dB`, 'SNR']}
                    labelFormatter={() => ''}
                  />
                  <ReferenceLine y={15} stroke="#00ff8844" strokeDasharray="2 2" />
                  <ReferenceLine y={8}  stroke="#ffb30044" strokeDasharray="2 2" />
                  <Line
                    type="monotone"
                    dataKey="snr"
                    stroke="#00d4ff"
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <span className="text-[9px] font-mono text-fsoc-dim">Awaiting data…</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
