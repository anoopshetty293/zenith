import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSimStore } from '../../store/simulationStore';
import { RotateCcw, AlertTriangle, PlusCircle, Satellite, ToggleLeft, ToggleRight } from 'lucide-react';
import SpaceNodeConfig from './SpaceNodeConfig';
import OrbitalCanvas from './OrbitalCanvas';
import SpacePATView from './SpacePATView';
import DebrisPanel from './DebrisPanel';
import OrbitalGeometry from './OrbitalGeometry';
import SpaceDisturbances from './SpaceDisturbances';
import FutureTimeline from './FutureTimeline';
import SpaceTelemetry from './SpaceTelemetry';
import SpaceTelemetryCharts from './SpaceTelemetryCharts';
import ManualRoutePlanner from './ManualRoutePlanner';
import { disturbanceBelongsToD2Mode } from '../../simulation/disturbances';
import clsx from 'clsx';

export default function D2Dashboard() {
  const location = useLocation();
  const { resetSimulation, clearD2Disturbances,
    addD2Satellite, addD2Debris, d2AutoReroute, setD2AutoReroute, d2, setD2LinkType, d2Reroute, d2SelectRoute,
 } = useSimStore();

  useEffect(() => {
    const mode = new URLSearchParams(location.search).get('mode') || (location.state as { mode?: string } | null)?.mode;
    if (mode === 'space-space') setD2LinkType('sat_sat');
    else if (mode === 'ground-space') setD2LinkType('ground_sat');
  }, [location.state, location.search, setD2LinkType]);

  const isGroundSpace = d2.linkType === 'ground_sat';
  // Ground↔Space and Space↔Space are independent, simultaneously-live links
  // — the toolbar only ever reflects a disturbance that actually targets
  // whichever one is currently selected.
  const groundIds = new Set(d2.groundStations.map(g => g.id));
  const modeDisturbances = d2.activeDisturbances.filter(d => disturbanceBelongsToD2Mode(d, groundIds, d2.linkType));
  const hasDisturbance = modeDisturbances.length > 0;
  const latestObs = d2.telemetryHistory[d2.telemetryHistory.length - 1]?.observable;
  const pat = d2.patState;

  return (
    <div className="h-full overflow-auto fsoc-app-bg">
    <div className="min-w-[1400px]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--zen-line)] bg-[rgba(5,7,12,.42)] px-5 py-4 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3">
          <Satellite size={15} className="text-fsoc-cyan" />
          <div>
            <div className="fsoc-title text-sm font-semibold text-[var(--zen-ink)] uppercase tracking-[0.08em]">Dashboard 2 — Orbital FSOC</div>
            <div className="text-[9px] font-mono text-[var(--zen-mute)]">Optical links · Orbital dynamics · Point, Acquire & Track</div>
          </div>
          {hasDisturbance && <div className="flex items-center gap-1 rounded border border-fsoc-amber/40 bg-amber-900/30 px-2 py-1"><AlertTriangle size={10} className="text-fsoc-amber" /><span className="text-[10px] font-mono text-fsoc-amber">{modeDisturbances.map(d => d.type).join(' + ')}</span></div>}
          {latestObs?.orbital && !latestObs.orbital.hasLOS && <span className="rounded border border-fsoc-red/40 bg-red-900/30 px-2 py-1 text-[10px] font-mono text-fsoc-red">LINE OF SIGHT LOST</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={addD2Satellite} className="btn-secondary flex items-center gap-1 text-[10px]"><PlusCircle size={10} /> ADD SAT</button>
          <button onClick={addD2Debris} className="btn-secondary flex items-center gap-1 text-[10px]"><PlusCircle size={10} /> ADD DEBRIS</button>
          <button onClick={d2Reroute} disabled={d2.alternateRoutes.length === 0} className="btn-secondary flex items-center gap-1 text-[10px] disabled:cursor-not-allowed disabled:opacity-40" title={d2.alternateRoutes.length ? 'Switch to the highest-scoring compatible relay route' : 'Add compatible relay satellites to create a route'}>REROUTE</button>
          <button onClick={() => setD2AutoReroute(!d2AutoReroute)} className={clsx('flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-mono', d2AutoReroute ? 'border-fsoc-green/50 bg-fsoc-green/10 text-fsoc-green' : 'border-fsoc-border text-fsoc-dim')}>
            {d2AutoReroute ? <ToggleRight size={11} /> : <ToggleLeft size={11} />} AUTO-REROUTE
          </button>
          {hasDisturbance && <button onClick={clearD2Disturbances} className="btn-amber text-[10px]">RESTORE NORMAL</button>}
          <button onClick={resetSimulation} className="btn-secondary flex items-center gap-1 text-[10px]"><RotateCcw size={10} /> RESET</button>
        </div>
      </div>


      <div className="p-3 grid grid-cols-12 gap-3">
        <div className="min-w-0 space-y-3 col-span-3">
          <SpaceNodeConfig />
          <OrbitalGeometry />
          <SpaceTelemetry />
        </div>
        <div className="min-w-0 space-y-3 col-span-6">
          <section className="panel">
            <div className="panel-header"><span className="panel-title">Orbital Environment</span><span className="text-[9px] font-mono text-[var(--zen-mute)]">{d2.satellites.length} satellites · {d2.debris.length} debris</span></div>
            <div className="border-b border-fsoc-border/60 px-3 py-2 text-[10px] leading-relaxed text-[var(--zen-mute)]">{isGroundSpace ? 'Ground-to-satellite geometry: monitor the station-to-orbit link, elevation angle and visibility window.' : 'Inter-satellite geometry: monitor relative orbital positions, inter-satellite line of sight and link visibility.'}</div>
            <OrbitalCanvas />
          </section>
          <section className="panel">
            <div className="panel-header gap-3"><div><span className="panel-title">PAT — Point, Acquire & Track</span><div className="mt-1 text-[9px] font-mono text-[var(--zen-mute)]">Beacon detection → pointing correction → stable optical lock</div></div>
              <span className={clsx('shrink-0 rounded border px-2 py-1 text-[10px] font-mono', pat.trackingStatus === 'LOCKED' ? 'border-fsoc-green/30 bg-fsoc-green/5 text-fsoc-green' : pat.trackingStatus === 'ACQUIRING' ? 'border-blue-300/30 bg-blue-300/5 text-blue-300' : pat.trackingStatus === 'DEGRADED' ? 'border-fsoc-amber/30 bg-fsoc-amber/5 text-fsoc-amber' : 'border-fsoc-red/30 bg-fsoc-red/5 text-fsoc-red')}>{pat.trackingStatus}</span>
            </div>
            <div className="flex flex-wrap items-start gap-3 p-3">
              <div className="w-[306px] max-w-full shrink-0"><SpacePATView /></div>
              <div className="min-w-0 flex-1 space-y-3">
                <div className="rounded-lg border border-fsoc-border bg-black/10 p-3">
                  <div className="mb-2 text-[9px] font-mono uppercase tracking-[0.18em] text-[var(--zen-mute)]">PAT operating sequence</div>
                  <div className="grid grid-cols-4 gap-1.5">{[['1','ACQUIRE',pat.detectionConfidence > 0.2],['2','MEASURE',pat.pointingErrorUrad < 180],['3','CORRECT',pat.pointingErrorUrad > 25 || pat.gimbalRateDegS > 1],['4','TRACK',pat.trackingStatus === 'LOCKED']].map(([n,label,active]) => <div key={String(label)} className={clsx('rounded-md border px-1 py-2 text-center', active ? 'border-fsoc-cyan/40 bg-fsoc-cyan/5' : 'border-fsoc-border/60 bg-black/10')}><div className="text-[10px] font-mono text-fsoc-cyan">{n}</div><div className="mt-1 text-[8px] font-mono text-[var(--zen-ink)]">{label}</div></div>)}</div>
                  <p className="mt-3 text-[10px] leading-relaxed text-[var(--zen-mute)]">PAT finds the remote optical beacon, estimates its offset from the camera center, moves the pointing mechanism to reduce error, and maintains lock as the link geometry changes.</p>
                </div>
                <div className="grid grid-cols-3 gap-2">{[
                  ['POINTING ERROR', `${pat.pointingErrorUrad.toFixed(1)} μrad`, 'Lower is better'],
                  ['BEACON CONFIDENCE', `${(pat.detectionConfidence * 100).toFixed(1)}%`, 'Detection certainty'],
                  ['GIMBAL RATE', `${pat.gimbalRateDegS.toFixed(2)}°/s`, 'Pointing correction'],
                  ['BEACON X', pat.beaconX.toFixed(3), 'Normalized position'],
                  ['BEACON Y', pat.beaconY.toFixed(3), 'Normalized position'],
                  ['LINK VISIBILITY', latestObs?.orbital ? `${latestObs.orbital.losWindowRemainingS.toFixed(0)} s` : '—', 'LOS window remaining'],
                ].map(([label,value,hint]) => <div key={label} className="min-w-0 rounded-lg border border-fsoc-border bg-black/10 p-2.5"><div className="whitespace-nowrap text-[8px] font-mono tracking-wider text-[var(--zen-mute)]">{label}</div><div className="mt-1 whitespace-nowrap font-mono text-sm tabular-nums text-fsoc-cyan">{value}</div><div className="mt-0.5 whitespace-nowrap text-[8px] text-[var(--zen-mute)]">{hint}</div></div>)}</div>
                <div className="rounded-lg border border-fsoc-border/70 bg-black/10 p-3"><div className="text-[8px] font-mono uppercase tracking-wider text-[var(--zen-mute)]">Current PAT state</div><div className="mt-1 text-[11px] leading-relaxed text-[var(--zen-ink)]">{pat.trackingStatus === 'LOCKED' ? 'Beacon is aligned with the optical axis. PAT is maintaining lock.' : pat.trackingStatus === 'LOST' ? 'Beacon is outside reliable detection. PAT is searching for reacquisition.' : pat.trackingStatus === 'DEGRADED' ? 'Tracking quality is degraded. Pointing corrections may be needed to recover stable lock.' : 'Beacon acquisition is in progress; PAT is estimating and correcting the pointing offset.'}</div></div>
                <details className="rounded-lg border border-fsoc-border/60 bg-black/10"><summary className="cursor-pointer px-3 py-2 text-[9px] font-mono uppercase tracking-wider text-[var(--zen-mute)]">Engineering telemetry</summary><div className="grid grid-cols-2 gap-x-5 gap-y-2 px-3 pb-3 pt-1">{[['Camera center X',pat.cameraCenterX.toFixed(3)],['Camera center Y',pat.cameraCenterY.toFixed(3)],['Beacon motion',`${pat.beaconVelocityUradS.toFixed(1)} μrad/s`],['Gimbal angle',`${pat.cameraAngleDeg.toFixed(1)}°`],['Elevation',d2.primaryLink?.elevationDeg != null ? `${d2.primaryLink.elevationDeg.toFixed(1)}°` : '—'],['LOS status',latestObs?.orbital?.hasLOS ? 'AVAILABLE' : 'CHECK LINK']].map(([label,value]) => <div key={label}><div className="text-[8px] font-mono text-[var(--zen-mute)]">{label}</div><div className="text-[10px] font-mono text-fsoc-cyan">{value}</div></div>)}</div></details>
              </div>
            </div>
          </section>
        </div>
        <div className="min-w-0 space-y-3 col-span-3">
          <section className="panel">
            <div className="panel-header"><span className="panel-title">Adaptive Routing</span><span className="text-[9px] font-mono text-[var(--zen-mute)]">{d2.alternateRoutes.length} relay paths</span></div>
            <div className="space-y-2 p-3">
              <p className="text-[10px] leading-relaxed text-[var(--zen-mute)]">Every hop — direct or relayed — is re-checked live each tick: shared wavelength, line-of-sight, range, link-budget margin and debris obstruction. A hop crossed by debris is treated as physically broken, not just degraded, so the engine finds the best surviving optical pathway automatically when auto-reroute is on.</p>
              {d2.activeRoute && (
                <div className={clsx('rounded border p-2', d2.activeRoute.status === 'UNAVAILABLE' ? 'border-fsoc-red/40 bg-fsoc-red/5' : 'border-fsoc-green/30 bg-fsoc-green/5')}>
                  <div className="flex items-center justify-between">
                    <span className={clsx('text-[8px] font-mono', d2.activeRoute.status === 'UNAVAILABLE' ? 'text-fsoc-red' : 'text-fsoc-green')}>{d2.activeRoute.status === 'UNAVAILABLE' ? 'ACTIVE PATH — BROKEN' : 'ACTIVE PATH'}</span>
                    {d2.activeRoute.isManual && <span className="rounded border border-fsoc-cyan/40 bg-fsoc-cyan/10 px-1.5 py-0.5 text-[8px] font-mono text-fsoc-cyan">MANUAL</span>}
                  </div>
                  <div className="mt-1 break-words text-[10px] font-mono text-[var(--zen-ink)]">{d2.activeRoute.nodeIds.map(id => d2.groundStations.find(n => n.id === id)?.name || d2.satellites.find(n => n.id === id)?.name || id).join('  →  ')}</div>
                  <div className="mt-1 text-[9px] font-mono text-[var(--zen-mute)]">{d2.activeRoute.hops.length} hops · {d2.activeRoute.totalDistanceKm.toFixed(0)} km total</div>
                  {d2.activeRoute.hops.some(h => h.blocked) && (
                    <div className="mt-1.5 flex items-center gap-1 rounded border border-fsoc-red/40 bg-fsoc-red/10 px-1.5 py-1 text-[9px] font-mono text-fsoc-red">
                      ⚠ {d2.activeRoute.hops.filter(h => h.blocked).map(h => h.blockReason).join(' · ')}
                    </div>
                  )}
                  {d2.activeRoute.status === 'UNAVAILABLE' && !d2AutoReroute && (
                    <div className="mt-1.5 text-[9px] font-mono text-fsoc-amber">Auto-reroute is off — pick a new path below or in the Manual Path Builder.</div>
                  )}
                </div>
              )}
              {d2.alternateRoutes.length === 0 ? <div className="rounded border border-fsoc-border/60 p-3 text-[10px] leading-relaxed text-[var(--zen-mute)]">No compatible relay path found yet. Add relay satellites; each candidate is checked for wavelength, LOS, range, link budget, debris clearance and PAT before it is shown.</div> : d2.alternateRoutes.slice(0, 3).map((route, index) => <div key={route.id} className={clsx('rounded border p-2.5', d2.activeRoute?.id === route.id ? 'border-fsoc-green/50 bg-fsoc-green/5' : 'border-fsoc-border/70 bg-black/10')}><div className="mb-1 flex items-center justify-between"><span className="text-[8px] font-mono text-fsoc-amber">SUGGESTION {index + 1}</span><span className="text-[8px] font-mono text-fsoc-green">SCORE {(route.analysis.score * 100).toFixed(0)}</span></div><div className="break-words text-[10px] font-mono text-fsoc-cyan">{route.nodeIds.map(id => d2.groundStations.find(n => n.id === id)?.name || d2.satellites.find(n => n.id === id)?.name || id).join(' → ')}</div><div className="mt-1 flex items-center justify-between gap-2 text-[9px] font-mono text-[var(--zen-mute)]"><span>{route.hops.length} hops · {route.totalDistanceKm.toFixed(0)} km</span><span>{route.status}</span></div><div className="mt-2 space-y-1 text-[9px] leading-relaxed text-[var(--zen-mute)]">{(route.analysis.reasons ?? []).map(reason => <div key={reason}>• {reason}</div>)}<div>Route quality: {route.analysis.predictedStability.toUpperCase()}</div></div><div className="mt-2 flex justify-between gap-2"><span className="text-[8px] font-mono text-[var(--zen-mute)]">SNR {route.worstSnrDb.toFixed(1)} dB · margin {route.worstLinkMarginDb.toFixed(1)} dB</span><button onClick={() => d2SelectRoute(route.id)} className="rounded border border-fsoc-cyan/40 px-2.5 py-1 text-[9px] font-mono text-fsoc-cyan hover:bg-fsoc-cyan/10">{d2.activeRoute?.id === route.id ? 'ACTIVE PATH' : 'USE PATH'}</button></div></div>)}
            </div>
          </section>
          <ManualRoutePlanner />
          <SpaceDisturbances /><DebrisPanel /><FutureTimeline />
        </div>
      </div>
      <div className="px-3 pb-3">
        <SpaceTelemetryCharts />
      </div>
    </div>
    </div>
  );
}
