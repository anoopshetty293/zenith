import { useSimStore } from '../../store/simulationStore';
import { Play, Pause, RotateCcw, AlertTriangle, PlusCircle, Zap, ToggleLeft, ToggleRight } from 'lucide-react';
import NodeConfigPanel from './NodeConfigPanel';
import NetworkCanvas from './NetworkCanvas';
import PATCameraView from './PATCameraView';
import DisturbancePanel from './DisturbancePanel';
import LinkStatusPanel from './LinkStatusPanel';
import TelemetryCharts from './TelemetryCharts';
import RoutingPanel from './RoutingPanel';
import LinkHealthPanel from './LinkHealthPanel';
import clsx from 'clsx';
import { D1_MAX_NODES } from '../../simulation/engine';
import { routeLabel } from '../../simulation/routing';

export default function D1Dashboard() {
  const {
    isRunning, startSimulation, pauseSimulation, resetSimulation,
    clearD1Disturbances, addD1Node, d1AutoReroute, setD1AutoReroute,
    d1,
  } = useSimStore();

  const hasDisturbance = d1.activeDisturbances.length > 0;

  return (
    <div className="h-full overflow-auto fsoc-app-bg">
      {/* D1 Header */}
      <div className="flex items-center justify-between border-b border-[var(--zen-line)] bg-[rgba(5,7,12,.42)] px-5 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Zap size={14} className="text-fsoc-cyan" />
          <div>
            <div className="fsoc-title text-sm font-semibold text-[var(--zen-ink)] uppercase tracking-[0.08em]">
              Dashboard 1 — Ground FSOC
            </div>
            <div className="text-[9px] font-mono text-[var(--zen-mute)]">Ground-to-Ground · PAT · Adaptive Routing</div>
          </div>
          {hasDisturbance && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-900/30 border border-fsoc-amber/40 rounded">
              <AlertTriangle size={10} className="text-fsoc-amber" />
              <span className="text-[10px] font-mono text-fsoc-amber">
                {d1.activeDisturbances.map(d => d.type).join(' + ')}
              </span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={addD1Node}
            disabled={d1.nodes.length >= D1_MAX_NODES}
            title={d1.nodes.length >= D1_MAX_NODES ? `Node limit reached (${D1_MAX_NODES})` : 'Add a relay node'}
            className="btn-secondary flex items-center gap-1 text-[10px] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <PlusCircle size={10} /> ADD NODE
          </button>

          <button
            onClick={() => setD1AutoReroute(!d1AutoReroute)}
            className={clsx(
              'flex items-center gap-1 px-2 py-1 text-[10px] font-mono rounded border transition-colors',
              d1AutoReroute
                ? 'border-fsoc-green/50 text-fsoc-green bg-fsoc-green/10'
                : 'border-fsoc-border text-fsoc-dim hover:border-fsoc-green/30'
            )}
          >
            {d1AutoReroute ? <ToggleRight size={11} /> : <ToggleLeft size={11} />}
            AUTO-REROUTE
          </button>

          {hasDisturbance && (
            <button onClick={clearD1Disturbances} className="btn-amber flex items-center gap-1 text-[10px]">
              RESTORE NORMAL
            </button>
          )}

          <button
            onClick={isRunning ? pauseSimulation : startSimulation}
            className={clsx(
              'flex items-center gap-1 px-2 py-1 text-[10px] font-mono rounded border transition-colors',
              isRunning
                ? 'border-amber-700 text-fsoc-amber hover:bg-amber-900/20'
                : 'border-fsoc-green/50 text-fsoc-green hover:bg-fsoc-green/10'
            )}
          >
            {isRunning ? <><Pause size={10} /> PAUSE</> : <><Play size={10} /> START</>}
          </button>

          <button onClick={resetSimulation} className="btn-secondary flex items-center gap-1 text-[10px]">
            <RotateCcw size={10} /> RESET
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="p-3 grid grid-cols-12 gap-3" style={{ minHeight: 'calc(100% - 48px)' }}>

        {/* Left column */}
        <div className="col-span-3 min-w-0 space-y-3">
          <NodeConfigPanel />
          <LinkStatusPanel />
          <LinkHealthPanel />
        </div>

        {/* Center column */}
        <div className="col-span-6 min-w-0 space-y-3">
          {/* Network visualization */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Terrestrial Network</span>
              <span className="text-[9px] font-mono text-[var(--zen-mute)]">
                {d1.nodes.length} nodes · {d1.activeRoute ? `ROUTE ${routeLabel(d1.activeRoute.nodeIds, d1.nodes)}` : 'NO ROUTE'}
              </span>
            </div>
            <NetworkCanvas />
          </div>

          {/* PAT Camera */}
          <div className="panel">
            <div className="panel-header gap-3">
              <div className="min-w-0">
                <span className="panel-title">PAT — Point, Acquire, Track</span>
                <div className="text-[9px] font-mono text-[var(--zen-mute)] mt-0.5">Camera reorients to keep the remote beacon on the optical axis</div>
              </div>
              <span className={clsx(
                'shrink-0 text-[10px] font-mono px-2 py-1 rounded border',
                d1.patState.trackingStatus === 'LOCKED' ? 'text-fsoc-green border-fsoc-green/30 bg-fsoc-green/5' :
                d1.patState.trackingStatus === 'ACQUIRING' ? 'text-blue-300 border-blue-300/30 bg-blue-300/5' :
                d1.patState.trackingStatus === 'DEGRADED' ? 'text-fsoc-amber border-fsoc-amber/30 bg-fsoc-amber/5' : 'text-fsoc-red border-fsoc-red/30 bg-fsoc-red/5'
              )}>
                {d1.patState.trackingStatus}
              </span>
            </div>

            <div className="flex flex-wrap items-start gap-3 p-3">
              <div className="w-[306px] max-w-full shrink-0">
                <PATCameraView />
              </div>
              <div className="min-w-0 flex-1 basis-[260px] space-y-3">
                <div className="rounded-lg border border-fsoc-border bg-black/10 p-3">
                  <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-[var(--zen-mute)] mb-2">What PAT is doing</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {([
                      ['1', 'DETECT', d1.patState.detectionConfidence > 0.2],
                      ['2', 'COMPARE', d1.patState.pointingErrorUrad < 180],
                      ['3', 'REORIENT', d1.patState.gimbalRateDegS > 1 || d1.patState.pointingErrorUrad > 25],
                      ['4', 'LOCK', d1.patState.trackingStatus === 'LOCKED'],
                    ] as [string, string, boolean][]).map(([n, label, active]) => (
                      <div key={label} className={clsx('min-w-0 rounded-md border px-1 py-2 text-center transition-all', active ? 'border-fsoc-cyan/40 bg-fsoc-cyan/5' : 'border-fsoc-border/60 bg-black/10')}>
                        <div className={clsx('text-[10px] font-mono', active ? 'text-fsoc-cyan' : 'text-[var(--zen-mute)]')}>{n}</div>
                        <div className={clsx('text-[8px] font-mono mt-0.5', active ? 'text-[var(--zen-ink)]' : 'text-[var(--zen-mute)]')}>{label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-mono text-[var(--zen-mute)]">
                    <span className="inline-flex items-center gap-1 whitespace-nowrap"><span className="text-fsoc-cyan">●</span> Beacon position</span>
                    <span>→</span>
                    <span className="inline-flex items-center gap-1 whitespace-nowrap"><span className="text-fsoc-violet">↗</span> Gimbal rotates</span>
                    <span>→</span>
                    <span className="inline-flex items-center gap-1 whitespace-nowrap"><span className="text-fsoc-green">+</span> Optical axis aligns</span>
                  </div>
                </div>

                <div className="grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-2">
                  {[
                    { label: 'POINTING ERROR', value: d1.patState.pointingErrorUrad.toFixed(0), unit: 'μrad', hint: 'lower is better' },
                    { label: 'DETECTION', value: (d1.patState.detectionConfidence * 100).toFixed(0), unit: '%', hint: 'beacon confidence' },
                    { label: 'GIMBAL RATE', value: d1.patState.gimbalRateDegS.toFixed(1), unit: '°/s', hint: 'reorientation' },
                  ].map(item => (
                    <div key={item.label} className="min-w-0 rounded-lg border border-fsoc-border bg-black/10 p-2.5">
                      <div className="text-[8px] font-mono text-[var(--zen-mute)] tracking-wider">{item.label}</div>
                      <div className="mt-1 whitespace-nowrap font-mono text-fsoc-cyan tabular-nums">
                        <span className="text-sm">{item.value}</span>
                        <span className="ml-1 text-[10px]">{item.unit}</span>
                      </div>
                      <div className="text-[8px] text-[var(--zen-mute)] mt-0.5">{item.hint}</div>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-fsoc-border/70 bg-black/10 p-2.5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[8px] font-mono text-[var(--zen-mute)] uppercase tracking-wider">Current situation</div>
                    <div className="text-[11px] text-[var(--zen-ink)] mt-1">
                      {d1.patState.trackingStatus === 'LOCKED'
                        ? 'Beacon is centered in the optical axis. PAT is maintaining lock.'
                        : d1.patState.trackingStatus === 'LOST'
                        ? 'Beacon is outside reliable detection. PAT is searching for reacquisition.'
                        : d1.patState.acquisitionMode === 'MOVING_BEACON'
                        ? 'Beacon is moving; PAT is correcting gimbal orientation to follow it.'
                        : 'Beacon is detected off-axis; PAT is correcting the pointing direction.'}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[8px] font-mono text-[var(--zen-mute)]">BEACON</div>
                    <div className="text-[10px] font-mono text-fsoc-cyan">{d1.patState.acquisitionMode === 'MOVING_BEACON' ? 'MOVING' : 'STATIC'}</div>
                  </div>
                </div>

                <details className="rounded-lg border border-fsoc-border/60 bg-black/10">
                  <summary className="cursor-pointer px-3 py-2 text-[9px] font-mono text-[var(--zen-mute)] uppercase tracking-wider">Engineering telemetry</summary>
                  <div className="grid grid-cols-2 gap-x-5 gap-y-2 px-3 pb-3 pt-1">
                    {[
                      ['Beacon X', d1.patState.beaconX.toFixed(3)], ['Beacon Y', d1.patState.beaconY.toFixed(3)],
                      ['Cam Center X', d1.patState.cameraCenterX.toFixed(3)], ['Cam Center Y', d1.patState.cameraCenterY.toFixed(3)],
                      ['Beacon Motion', `${d1.patState.beaconVelocityUradS.toFixed(1)} μrad/s`], ['Gimbal Angle', `${d1.patState.cameraAngleDeg.toFixed(1)}°`],
                    ].map(([label, value]) => (
                      <div key={label as string}><div className="text-[8px] font-mono text-[var(--zen-mute)]">{label}</div><div className="text-[10px] font-mono text-fsoc-cyan">{value}</div></div>
                    ))}
                  </div>
                </details>
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="col-span-3 min-w-0 space-y-3">
          <DisturbancePanel />
          <RoutingPanel />
        </div>

        {/* Bottom row — telemetry charts */}
        <div className="col-span-12 min-w-0">
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Live Telemetry</span>
              <span className="text-[9px] font-mono text-[var(--zen-mute)]">
                {d1.telemetryHistory.length} samples
              </span>
            </div>
            <div className="p-3">
              <TelemetryCharts />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
