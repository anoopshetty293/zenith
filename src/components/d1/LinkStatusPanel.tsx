import React from 'react';
import { Radio, Wifi, WifiOff, Signal, Activity } from 'lucide-react';
import { useSimStore } from '../../store/simulationStore';
import { LinkStatus } from '../../types/links';
import { routeLabel } from '../../simulation/routing';
import Term from '../shared/Term';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusColor(s: LinkStatus): string {
  switch (s) {
    case 'CONNECTED':    return 'text-fsoc-green border-fsoc-green bg-fsoc-green/10';
    case 'DEGRADED':     return 'text-fsoc-amber border-fsoc-amber bg-fsoc-amber/10';
    case 'CRITICAL':     return 'text-fsoc-red border-fsoc-red bg-fsoc-red/10';
    case 'DISCONNECTED': return 'text-fsoc-red border-fsoc-red bg-fsoc-red/10';
    case 'ESTABLISHING': return 'text-fsoc-cyan border-fsoc-cyan bg-fsoc-cyan/10';
    default:             return 'text-fsoc-dim border-fsoc-border bg-transparent';
  }
}

function statusGlow(s: LinkStatus): string {
  switch (s) {
    case 'CONNECTED':    return 'shadow-[0_0_8px_rgba(34,197,94,0.4)]';
    case 'DEGRADED':     return 'shadow-[0_0_8px_rgba(251,191,36,0.4)]';
    case 'CRITICAL':     return 'shadow-[0_0_8px_rgba(239,68,68,0.5)]';
    case 'DISCONNECTED': return 'shadow-[0_0_8px_rgba(239,68,68,0.5)]';
    default:             return '';
  }
}

function formatBer(berLog10: number): string {
  if (!isFinite(berLog10) || berLog10 === 0) return '< 1×10⁻¹²';
  const exp = Math.round(berLog10);
  const superscripts: Record<string, string> = {
    '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³',
    '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸',
    '9': '⁹',
  };
  const expStr = String(exp).split('').map(c => superscripts[c] ?? c).join('');
  return `1×10${expStr}`;
}

function trackingBadge(status: string): { cls: string; label: string } {
  switch (status) {
    case 'LOCKED':     return { cls: 'text-fsoc-green border-fsoc-green bg-fsoc-green/10', label: 'LOCKED' };
    case 'ACQUIRING':  return { cls: 'text-fsoc-cyan border-fsoc-cyan bg-fsoc-cyan/10',   label: 'ACQUIRING' };
    case 'DEGRADED':   return { cls: 'text-fsoc-amber border-fsoc-amber bg-fsoc-amber/10', label: 'DEGRADED' };
    case 'LOST':       return { cls: 'text-fsoc-red border-fsoc-red bg-fsoc-red/10',     label: 'LOST' };
    default:           return { cls: 'text-fsoc-dim border-fsoc-border',                  label: status };
  }
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function Row({ label, value, unit, mono = true, className = '' }: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between py-1 border-b border-fsoc-border/40 last:border-0 ${className}`}>
      <span className="text-xs text-fsoc-dim uppercase tracking-wider">{label}</span>
      <span className={`text-xs ${mono ? 'font-mono' : ''} text-fsoc-cyan`}>
        {value}
        {unit && <span className="text-fsoc-dim ml-1">{unit}</span>}
      </span>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

const LinkStatusPanel: React.FC = () => {
  const primaryLink = useSimStore(s => s.d1.primaryLink);
  const patState    = useSimStore(s => s.d1.patState);
  const activeRoute = useSimStore(s => s.d1.activeRoute);
  const nodes       = useSimStore(s => s.d1.nodes);
  const trafficPath = activeRoute ? routeLabel(activeRoute.nodeIds, nodes) : null;
  const onRelay     = !!activeRoute && activeRoute.nodeIds.length > 2;

  const disconnected = !primaryLink || primaryLink.status === 'DISCONNECTED';
  const status       = primaryLink?.status ?? 'DISCONNECTED';
  const dash         = '—';

  const pat = trackingBadge(patState.trackingStatus);

  return (
    <div className="bg-fsoc-panel border border-fsoc-border rounded-lg p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {disconnected
            ? <WifiOff className="w-4 h-4 text-fsoc-red" />
            : <Wifi className="w-4 h-4 text-fsoc-cyan" />}
          <span className="text-xs font-semibold text-fsoc-cyan uppercase tracking-widest">
            Link Status
          </span>
        </div>
        {/* Status badge */}
        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${statusColor(status)} ${statusGlow(status)}`}>
          {status}
        </span>
      </div>

      {/* Divider */}
      <div className="h-px bg-fsoc-border/60" />

      {/* Metrics */}
      <div className="space-y-0">
        <Row label="Link Type"        value="Ground-to-Ground" mono={false} />
        <Row
          label="Traffic Path"
          value={<span className={onRelay ? 'font-mono text-fsoc-green' : 'font-mono'}>{trafficPath ?? '—'}</span>}
          mono={false}
        />
        <Row
          label="λ Selected"
          value={primaryLink?.selectedWavelength
            ? <span className="font-mono">{primaryLink.selectedWavelength}</span>
            : <span className="text-fsoc-amber font-mono">NOT SET</span>}
          unit={primaryLink?.selectedWavelength ? 'nm' : undefined}
        />
        <Row
          label="Distance"
          value={disconnected ? dash : primaryLink!.distanceKm.toFixed(1)}
          unit={disconnected ? undefined : 'km'}
        />
        <Row
          label="LOS"
          value={
            disconnected
              ? <span className="text-fsoc-dim">{dash}</span>
              : primaryLink!.hasLOS
                ? <span className="text-fsoc-green font-mono">✓ Clear</span>
                : <span className="text-fsoc-red font-mono">✗ Blocked</span>
          }
          mono={false}
        />
        <Row
          label="Rx Power"
          value={disconnected ? dash : primaryLink!.receivedPowerDbm.toFixed(1)}
          unit={disconnected ? undefined : 'dBm'}
        />
        <Row
          label="SNR"
          value={disconnected ? dash : primaryLink!.snrDb.toFixed(1)}
          unit={disconnected ? undefined : 'dB'}
        />
        <Row
          label="BER"
          value={
            disconnected
              ? <span className="text-fsoc-dim">{dash}</span>
              : <span className="font-mono">{formatBer(primaryLink!.berLog10)}</span>
          }
          mono={false}
        />
        <Row
          label="Link Margin"
          value={disconnected ? dash : primaryLink!.linkMarginDb.toFixed(1)}
          unit={disconnected ? undefined : 'dB'}
        />
      </div>

      {/* PAT Section */}
      <div className="pt-1">
        <div className="flex items-center gap-1 mb-1">
          <Signal className="w-3 h-3 text-fsoc-dim" />
          <span className="text-[10px] uppercase tracking-widest text-fsoc-dim">PAT Tracking</span>
        </div>
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${pat.cls}`}>
            {pat.label}
          </span>
          <span className="text-[10px] font-mono text-fsoc-dim">
            {patState.pointingErrorUrad.toFixed(1)} <span className="text-fsoc-dim">μrad</span>
          </span>
        </div>
        <div className="mt-1">
          <div className="flex justify-between text-[9px] text-fsoc-dim mb-0.5">
            <span><Term glossaryKey="Confidence Score">Confidence</Term></span>
            <span className="font-mono">{(patState.detectionConfidence * 100).toFixed(0)}%</span>
          </div>
          <div className="h-1 bg-fsoc-bg rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${(patState.detectionConfidence * 100).toFixed(0)}%`,
                backgroundColor: patState.detectionConfidence > 0.7
                  ? '#22c55e'
                  : patState.detectionConfidence > 0.4
                    ? '#fbbf24'
                    : '#ef4444',
              }}
            />
          </div>
        </div>
      </div>

      {/* Disconnected overlay message */}
      {!primaryLink?.hasLOS && primaryLink && (
        <div className="text-[10px] text-fsoc-red font-mono bg-fsoc-red/10 border border-fsoc-red/30 rounded px-2 py-1 text-center">
          ✗ LINE OF SIGHT BLOCKED
        </div>
      )}
    </div>
  );
};

export default LinkStatusPanel;
