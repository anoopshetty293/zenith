import { useSimStore } from '../store/simulationStore';
import { useNavigate } from 'react-router-dom';
import { Radio, Satellite, Brain, Zap } from 'lucide-react';
import StatusBadge from '../components/shared/StatusBadge';
import TelemetryValue from '../components/shared/TelemetryValue';
import clsx from 'clsx';
import { Fragment } from 'react';

function formatBER(log10: number): string {
  if (log10 <= -15) return '< 10⁻¹⁵';
  const exp = Math.round(log10);
  const mantissa = Math.pow(10, log10 - exp);
  return `${mantissa.toFixed(1)}×10${exp < 0 ? `⁻${Math.abs(exp)}` : exp}`;
}

type ChainNodeInfo = { name: string; icon: typeof Radio };

function ChainNode({ info, active }: { info: ChainNodeInfo; active: boolean }) {
  const Icon = info.icon;
  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <div className={clsx('w-8 h-8 rounded-full border-2 flex items-center justify-center',
        active ? 'border-fsoc-cyan bg-fsoc-cyan/10' : 'border-fsoc-dim bg-fsoc-border'
      )}>
        <Icon size={14} className={active ? 'text-fsoc-cyan' : 'text-fsoc-dim'} />
      </div>
      <span className="max-w-[90px] truncate text-[9px] font-mono text-fsoc-dim" title={info.name}>{info.name}</span>
    </div>
  );
}

function ChainLink({ ok, broken, label }: { ok: boolean; broken?: boolean; label?: string }) {
  return (
    <div className="flex min-w-[56px] flex-col items-center px-2">
      <div className={clsx('h-0.5 w-full', broken ? 'bg-fsoc-red' : ok ? 'bg-fsoc-cyan' : 'bg-fsoc-border')} />
      <span className="mt-0.5 whitespace-nowrap text-[8px] font-mono text-fsoc-dim">{label ?? ' '}</span>
    </div>
  );
}

function ChainRow({
  title, ids, getNode, connected, hopBlocked, hopDistance, badgeVariant, badgeLabel,
}: {
  title: string;
  ids: string[];
  getNode: (id: string) => ChainNodeInfo;
  connected: boolean;
  hopBlocked: (i: number) => boolean;
  hopDistance: (i: number) => string | undefined;
  badgeVariant: Parameters<typeof StatusBadge>[0]['variant'];
  badgeLabel: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[9px] font-mono uppercase tracking-wider text-fsoc-dim">{title}</span>
        <StatusBadge variant={badgeVariant} label={badgeLabel} />
      </div>
      <div className="flex items-center gap-0 overflow-x-auto py-1">
        {ids.map((id, i) => (
          <Fragment key={`${id}-${i}`}>
            {i > 0 && <ChainLink ok={connected} broken={hopBlocked(i - 1)} label={hopDistance(i - 1)} />}
            <ChainNode info={getNode(id)} active={connected && !hopBlocked(i - 1)} />
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function SystemDiagram({ d1, d2 }: { d1: any; d2: any }) {
  const d1Status: string = d1.primaryLink?.status ?? 'DISCONNECTED';
  const d1Connected = d1Status === 'CONNECTED' || d1Status === 'DEGRADED';
  const d1ChainIds: string[] = d1.activeRoute?.nodeIds ?? [d1.sourceNodeId, d1.destNodeId];
  const d1Hops = d1.activeRoute?.hops as { blocked?: boolean }[] | undefined;
  const d1HopLinks = d1.activeRoute?.hopLinks as { distanceKm: number }[] | undefined;

  const isGroundSpaceActive = d2.linkType === 'ground_sat';
  const d2ActiveChainIds: string[] = d2.activeRoute?.nodeIds
    ?? (d2.primaryLink ? [d2.primaryLink.nodeAId, d2.primaryLink.nodeBId]
      : isGroundSpaceActive ? [d2.groundStations[0]?.id, d2.satellites[0]?.id].filter(Boolean)
      : [d2.satellites[0]?.id, d2.satellites[1]?.id].filter(Boolean));
  const d2Hops = d2.activeRoute?.hops as { blocked?: boolean }[] | undefined;
  const d2HopLinks = d2.activeRoute?.hopLinks as { distanceKm: number }[] | undefined;

  const groundSpaceIds: string[] = isGroundSpaceActive ? d2ActiveChainIds : [d2.groundStations[0]?.id, d2.satellites[0]?.id].filter(Boolean);
  const spaceSpaceIds: string[] = !isGroundSpaceActive ? d2ActiveChainIds : [d2.satellites[0]?.id, d2.satellites[1]?.id].filter(Boolean);

  // Ground↔Space and Space↔Space both run live simultaneously — `linkType`
  // only picks which one Dashboard 2's routing/PAT UI is currently driving.
  // The other pair's connectivity comes from its own free-running secondary link.
  const groundSpaceLink = isGroundSpaceActive ? d2.primaryLink : d2.secondaryLink;
  const spaceSpaceLink = !isGroundSpaceActive ? d2.primaryLink : d2.secondaryLink;
  const badgeForLink = (link: { status: string; hasLOS: boolean } | null): { variant: Parameters<typeof StatusBadge>[0]['variant']; label: string } =>
    !link || !link.hasLOS
      ? { variant: 'disconnected', label: 'NO LOS' }
      : { variant: link.status === 'CONNECTED' ? 'connected' : link.status === 'DEGRADED' ? 'degraded' : 'disconnected', label: link.status };

  const d1Node = (id: string): ChainNodeInfo => ({
    name: d1.nodes.find((n: any) => n.id === id)?.name ?? id,
    icon: Radio,
  });
  const d2Node = (id: string): ChainNodeInfo => {
    const ground = d2.groundStations.find((n: any) => n.id === id);
    if (ground) return { name: ground.name, icon: Radio };
    const sat = d2.satellites.find((n: any) => n.id === id);
    return { name: sat?.name ?? id, icon: Satellite };
  };

  return (
    <div className="panel space-y-4 p-3">
      <div className="panel-header">
        <span className="panel-title">Live System Diagram</span>
      </div>

      <ChainRow
        title="Ground Segment (Dashboard 1)"
        ids={d1ChainIds}
        getNode={d1Node}
        connected={d1Connected}
        hopBlocked={(i) => d1Hops?.[i]?.blocked ?? false}
        hopDistance={(i) => `${(d1ChainIds.length === 2 ? d1.primaryLink?.distanceKm?.toFixed(1) : d1HopLinks?.[i]?.distanceKm?.toFixed(1)) ?? '—'} km`}
        badgeVariant={d1Status === 'CONNECTED' ? 'connected' : d1Status === 'DEGRADED' ? 'degraded' : 'disconnected'}
        badgeLabel={d1Status}
      />

      <div className="border-t border-fsoc-border" />

      <ChainRow
        title="Space Segment (Dashboard 2) · Ground ↔ Space"
        ids={groundSpaceIds}
        getNode={d2Node}
        connected={groundSpaceLink?.hasLOS ?? false}
        hopBlocked={(i) => (isGroundSpaceActive ? d2Hops?.[i]?.blocked ?? false : false)}
        hopDistance={(i) => `${(isGroundSpaceActive && groundSpaceIds.length !== 2 ? d2HopLinks?.[i]?.distanceKm?.toFixed(0) : groundSpaceLink?.distanceKm?.toFixed(0)) ?? '—'} km`}
        badgeVariant={badgeForLink(groundSpaceLink).variant}
        badgeLabel={badgeForLink(groundSpaceLink).label}
      />

      <ChainRow
        title="Space Segment (Dashboard 2) · Space ↔ Space"
        ids={spaceSpaceIds}
        getNode={d2Node}
        connected={spaceSpaceLink?.hasLOS ?? false}
        hopBlocked={(i) => (!isGroundSpaceActive ? d2Hops?.[i]?.blocked ?? false : false)}
        hopDistance={(i) => `${(!isGroundSpaceActive && spaceSpaceIds.length !== 2 ? d2HopLinks?.[i]?.distanceKm?.toFixed(0) : spaceSpaceLink?.distanceKm?.toFixed(0)) ?? '—'} km`}
        badgeVariant={badgeForLink(spaceSpaceLink).variant}
        badgeLabel={badgeForLink(spaceSpaceLink).label}
      />
    </div>
  );
}

export default function Overview() {
  const { isRunning, simTimeS, d1, d2, d3Anomaly, d3Diagnosis, startSimulation, pauseSimulation } = useSimStore();
  const navigate = useNavigate();

  const d1Link = d1.primaryLink;
  const d2Link = d2.primaryLink;
  const d1Status = d1Link?.status ?? 'DISCONNECTED';
  const d2Status = d2Link?.status ?? 'DISCONNECTED';

  const latestD1 = d1.telemetryHistory[d1.telemetryHistory.length - 1]?.observable;
  const latestD2 = d2.telemetryHistory[d2.telemetryHistory.length - 1]?.observable;

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      {/* Hero */}
      <div className="panel p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap size={20} className="text-fsoc-cyan" />
              <h1 className="text-base font-mono font-bold text-fsoc-cyan tracking-widest uppercase">
                FSOC Virtual Testbed
              </h1>
            </div>
            <p className="text-[10px] font-mono text-fsoc-dim">
              Free-Space Optical Communication · PAT · Adaptive Routing · Anomaly Intelligence
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[9px] font-mono text-fsoc-dim uppercase tracking-wider">System Status</div>
              <StatusBadge variant="online" label="ONLINE" />
            </div>
            <button
              onClick={isRunning ? pauseSimulation : startSimulation}
              className={clsx(
                'px-4 py-2 font-mono text-xs rounded border transition-colors',
                isRunning
                  ? 'border-amber-700 text-fsoc-amber hover:bg-amber-900/20'
                  : 'border-fsoc-green/50 text-fsoc-green hover:bg-fsoc-green/10'
              )}
            >
              {isRunning ? '⏸ PAUSE' : '▶ START SIMULATION'}
            </button>
          </div>
        </div>
      </div>

      {/* Key metrics row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'D1 SNR', value: d1Link?.snrDb?.toFixed(1) ?? '—', unit: 'dB', status: (d1Link?.snrDb ?? 0) > 20 ? 'ok' : (d1Link?.snrDb ?? 0) > 10 ? 'warn' : 'crit' },
          { label: 'D2 Distance', value: d2Link?.distanceKm?.toFixed(0) ?? '—', unit: 'km', status: 'info' },
          { label: 'D1 PAT', value: d1.patState.trackingStatus, unit: '', status: d1.patState.trackingStatus === 'LOCKED' ? 'ok' : d1.patState.trackingStatus === 'ACQUIRING' ? 'warn' : 'crit' },
          { label: 'D3 Status', value: d3Anomaly ? 'ANOMALY' : 'NOMINAL', unit: '', status: d3Anomaly ? 'crit' : 'ok' },
        ].map((m, i) => (
          <div key={i} className="panel p-3">
            <TelemetryValue label={m.label} value={m.value} unit={m.unit} status={m.status as any} />
          </div>
        ))}
      </div>

      {/* Three dashboard cards */}
      <div className="grid grid-cols-3 gap-4">
        {/* D1 Card */}
        <div
          onClick={() => navigate('/d1')}
          className="panel p-4 cursor-pointer hover:border-fsoc-cyan/30 transition-colors"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Radio size={16} className="text-fsoc-cyan" />
              <span className="text-xs font-mono text-white">Dashboard 1</span>
            </div>
            <StatusBadge
              variant={d1Status === 'CONNECTED' ? 'connected' : d1Status === 'DEGRADED' ? 'degraded' : 'disconnected'}
              label={d1Status}
            />
          </div>
          <div className="text-[9px] font-mono text-fsoc-dim mb-3">Ground-to-Ground FSOC · PAT · Routing</div>
          <div className="grid grid-cols-2 gap-2">
            <TelemetryValue label="SNR" value={d1Link?.snrDb?.toFixed(1) ?? '—'} unit="dB" status="info" />
            <TelemetryValue label="Pointing Error" value={latestD1?.pointingErrorUrad?.toFixed(0) ?? '—'} unit="μrad" status="info" />
            <TelemetryValue label="Link Margin" value={d1Link?.linkMarginDb?.toFixed(1) ?? '—'} unit="dB" status="info" />
            <TelemetryValue label="PAT" value={d1.patState.trackingStatus} status={d1.patState.trackingStatus === 'LOCKED' ? 'ok' : 'warn'} />
          </div>
          <div className="mt-3 text-[10px] font-mono text-fsoc-cyan">→ Open Dashboard 1</div>
        </div>

        {/* D2 Card */}
        <div
          onClick={() => navigate('/d2')}
          className="panel p-4 cursor-pointer hover:border-fsoc-cyan/30 transition-colors"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Satellite size={16} className="text-fsoc-cyan" />
              <span className="text-xs font-mono text-white">Dashboard 2</span>
            </div>
            <StatusBadge
              variant={d2Status === 'CONNECTED' ? 'connected' : d2Status === 'DEGRADED' ? 'degraded' : 'disconnected'}
              label={d2Link?.hasLOS ? d2Status : 'NO LOS'}
            />
          </div>
          <div className="text-[9px] font-mono text-fsoc-dim mb-3">Space FSOC · Orbital Mechanics · Debris</div>
          <div className="grid grid-cols-2 gap-2">
            <TelemetryValue label="Distance" value={d2Link?.distanceKm?.toFixed(0) ?? '—'} unit="km" status="info" />
            <TelemetryValue label="Elevation" value={d2Link?.elevationDeg?.toFixed(1) ?? '—'} unit="°" status="info" />
            <TelemetryValue label="SNR" value={d2Link?.snrDb?.toFixed(1) ?? '—'} unit="dB" status="info" />
            <TelemetryValue label="LOS" value={d2Link?.hasLOS ? 'YES' : 'NO'} status={d2Link?.hasLOS ? 'ok' : 'crit'} />
          </div>
          <div className="mt-3 text-[10px] font-mono text-fsoc-cyan">→ Open Dashboard 2</div>
        </div>

        {/* D3 Card */}
        <div
          onClick={() => navigate('/d3')}
          className={clsx('panel p-4 cursor-pointer transition-colors', d3Anomaly ? 'hover:border-fsoc-red/30 anomaly-border' : 'hover:border-fsoc-cyan/30')}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Brain size={16} className={d3Anomaly ? 'text-fsoc-red' : 'text-fsoc-cyan'} />
              <span className="text-xs font-mono text-white">Dashboard 3</span>
            </div>
            <StatusBadge
              variant={d3Anomaly ? 'anomaly' : 'normal'}
              label={d3Anomaly ? 'ANOMALY' : 'NOMINAL'}
            />
          </div>
          <div className="text-[9px] font-mono text-fsoc-dim mb-3">Anomaly Intelligence · Diagnosis · Prediction</div>
          {d3Anomaly ? (
            <div className="space-y-1">
              <div className="text-[9px] font-mono text-fsoc-red">Severity: {d3Anomaly.severity}</div>
              <div className="text-[9px] font-mono text-fsoc-red">Subsystem: {d3Anomaly.affectedSubsystem}</div>
              {d3Diagnosis && (
                <div className="text-[9px] font-mono text-fsoc-amber">
                  Diagnosis: {d3Diagnosis.mostLikelyCause.label} ({(d3Diagnosis.confidence * 100).toFixed(0)}%)
                </div>
              )}
            </div>
          ) : (
            <div className="text-[9px] font-mono text-fsoc-dim">All telemetry within nominal bounds. No anomalies detected.</div>
          )}
          <div className="mt-3 text-[10px] font-mono text-fsoc-cyan">→ Open Intelligence</div>
        </div>
      </div>

      {/* System diagram */}
      <SystemDiagram d1={d1} d2={d2} />
    </div>
  );
}
