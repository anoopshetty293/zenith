/**
 * SpaceNodeConfig.tsx
 * Node configuration panel for the D2 space link.
 * Shows two selectable node types (Ground Station / Satellite),
 * wavelength intersection, link type selector, and node capabilities.
 */

import { useEffect, useState } from 'react';
import { useSimStore } from '../../store/simulationStore';
import { Satellite, Radio, ChevronDown } from 'lucide-react';
import { wavelengthIntersection, ALL_WAVELENGTHS, type Wavelength } from '../../types/nodes';
import clsx from 'clsx';

const WL_COLORS: Record<Wavelength, string> = {
  850:  'bg-violet-600 text-violet-100',
  1064: 'bg-blue-600 text-blue-100',
  1550: 'bg-cyan-700 text-cyan-100',
};

function WavelengthBadge({ wl, active }: { wl: Wavelength; active: boolean }) {
  return (
    <span className={clsx(
      'text-[9px] font-mono px-1.5 py-0.5 rounded border',
      active
        ? WL_COLORS[wl] + ' border-transparent'
        : 'bg-transparent text-fsoc-dim border-fsoc-border'
    )}>
      {wl}nm
    </span>
  );
}

export default function SpaceNodeConfig() {
  const { d2, setD2Endpoints } = useSimStore();

  const gs  = d2.groundStations[0];
  const sat = d2.satellites.find(item => item.id === d2.targetNodeId) ?? d2.satellites[0];
  const sourceSat = d2.satellites.find(item => item.id === d2.sourceNodeId) ?? d2.satellites[0];
  const targetSat = d2.linkType === 'sat_sat'
    ? (d2.satellites.find(item => item.id === d2.targetNodeId && item.id !== sourceSat?.id) ?? d2.satellites.find(item => item.id !== sourceSat?.id) ?? d2.satellites[0])
    : (d2.satellites.find(item => item.id === d2.targetNodeId) ?? d2.satellites[0]);

  // Wavelength intersection between GS and primary satellite
  const compat: Wavelength[] = gs && sat
    ? wavelengthIntersection(gs.supportedWavelengths, sat.supportedWavelengths)
    : [];

  const noCompatible = compat.length === 0;

  const [gsExpanded,  setGsExpanded]  = useState(false);
  const [expandedSats, setExpandedSats] = useState<string[]>(sat ? [sat.id] : []);
  useEffect(() => {
    setExpandedSats(ids => {
      const missing = d2.satellites.map(item => item.id).filter(id => !ids.includes(id));
      return missing.length ? [...ids, ...missing] : ids;
    });
  }, [d2.satellites]);

  return (
    <div className="panel flex flex-col overflow-hidden">
      <div className="panel-header">
        <span className="panel-title flex items-center gap-1.5">
          <Satellite size={10} />
          Node Config
        </span>


      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        <div className="rounded border border-fsoc-border/40 bg-black/20 p-2 space-y-2">
          <div className="text-[9px] font-mono uppercase tracking-wider text-fsoc-dim">Link endpoints · choose nodes</div>
          {d2.linkType === 'ground_sat' ? (
            <div className="space-y-1"><label className="block text-[9px] font-mono text-fsoc-dim">GROUND STATION</label><div className="rounded bg-black/20 px-2 py-1.5 text-[10px] font-mono text-fsoc-cyan">{gs?.name ?? 'No ground station'}</div></div>
          ) : (
            <div className="space-y-1"><label className="block text-[9px] font-mono text-fsoc-dim">SOURCE SATELLITE</label><select value={sourceSat?.id ?? ''} onChange={e => setD2Endpoints(e.target.value, targetSat?.id === e.target.value ? (d2.satellites.find(x => x.id !== e.target.value)?.id ?? '') : (targetSat?.id ?? ''))} className="w-full rounded border border-fsoc-border bg-[#080d18] px-2 py-1.5 text-[10px] font-mono text-white">{d2.satellites.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}</select></div>
          )}
          <div className="space-y-1"><label className="block text-[9px] font-mono text-fsoc-dim">{d2.linkType === 'ground_sat' ? 'TARGET SATELLITE' : 'DESTINATION SATELLITE'}</label><select value={targetSat?.id ?? ''} onChange={e => setD2Endpoints(sourceSat?.id ?? '', e.target.value)} className="w-full rounded border border-fsoc-border bg-[#080d18] px-2 py-1.5 text-[10px] font-mono text-white">{d2.satellites.filter(n => d2.linkType !== 'sat_sat' || n.id !== sourceSat?.id).map(n => <option key={n.id} value={n.id}>{n.name}</option>)}</select></div>
        </div>
        {/* Wavelength compatibility */}
        <div className="bg-black/20 rounded p-2 border border-fsoc-border/30">
          <div className="text-[9px] font-mono text-fsoc-dim uppercase tracking-wider mb-1.5">
            Wavelength Compatibility
          </div>
          {noCompatible ? (
            <div className="flex items-center gap-1.5 bg-red-900/20 border border-fsoc-red/40 rounded px-2 py-1">
              <span className="text-[10px] font-mono text-fsoc-red uppercase tracking-wider">
                ⊗ NO COMPATIBLE WAVELENGTH
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {compat.map(w => (
                <WavelengthBadge key={w} wl={w} active />
              ))}
              <span className="text-[9px] font-mono text-fsoc-dim self-center">
                {compat.length} shared
              </span>
            </div>
          )}
        </div>

        {/* Ground Station Node */}
        {gs && (
          <div className="bg-black/20 rounded border border-fsoc-border/30">
            <button
              className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-white/5 transition-colors"
              onClick={() => setGsExpanded(e => !e)}
            >
              <div className="flex items-center gap-1.5">
                <Radio size={10} className="text-fsoc-cyan" />
                <span className="text-[10px] font-mono text-white">{gs.name}</span>
                <span className="text-[9px] font-mono text-fsoc-dim">Ground Station</span>
              </div>
              <ChevronDown
                size={10}
                className={clsx('text-fsoc-dim transition-transform', gsExpanded && 'rotate-180')}
              />
            </button>

            {gsExpanded && (
              <div className="px-2 pb-2 space-y-1 border-t border-fsoc-border/30 pt-1.5">
                <div className="flex flex-wrap gap-1 mb-1">
                  {ALL_WAVELENGTHS.map(w => (
                    <WavelengthBadge
                      key={w}
                      wl={w}
                      active={gs.supportedWavelengths.includes(w)}
                    />
                  ))}
                </div>
                <NodeCapRow label="TX Power"     value={`${gs.txPowerDbm} dBm`} />
                <NodeCapRow label="RX Sens."     value={`${gs.rxSensitivityDbm} dBm`} />
                <NodeCapRow label="Beam Div."    value={`${gs.beamDivergenceUrad} μrad`} />
                <NodeCapRow label="Max Range"    value={`${gs.maxRangeKm} km`} />
                <NodeCapRow label="PAT"          value={gs.hasPAT ? 'YES' : 'NO'} accent={gs.hasPAT ? 'text-fsoc-green' : 'text-fsoc-red'} />
                <NodeCapRow label="Lat / Lon"    value={`${gs.latDeg.toFixed(1)}° / ${gs.lonDeg.toFixed(1)}°`} />
              </div>
            )}
          </div>
        )}

        {/* Satellite Nodes */}
        {d2.satellites.map((sat, idx) => (
          <div key={sat.id} className="bg-black/20 rounded border border-fsoc-border/30">
            <button
              className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-white/5 transition-colors"
              onClick={() => setExpandedSats(ids => ids.includes(sat.id) ? ids.filter(id => id !== sat.id) : [...ids, sat.id])}
            >
              <div className="flex items-center gap-1.5">
                <Satellite size={10} className={idx === 0 ? 'text-fsoc-cyan' : 'text-fsoc-dim'} />
                <span className="text-[10px] font-mono text-white">{sat.name}</span>
                <span className="text-[9px] font-mono text-fsoc-dim">
                  {sat.altitudeKm} km LEO
                </span>
              </div>
              <ChevronDown size={10} className={clsx('text-fsoc-dim transition-transform', expandedSats.includes(sat.id) && 'rotate-180')} />
            </button>

            {expandedSats.includes(sat.id) && (
              <div className="px-2 pb-2 space-y-1 border-t border-fsoc-border/30 pt-1.5">
                <div className="flex flex-wrap gap-1 mb-1">
                  {ALL_WAVELENGTHS.map(w => (
                    <WavelengthBadge
                      key={w}
                      wl={w}
                      active={sat.supportedWavelengths.includes(w)}
                    />
                  ))}
                </div>
                <NodeCapRow label="TX Power"  value={`${sat.txPowerDbm} dBm`} />
                <NodeCapRow label="RX Sens."  value={`${sat.rxSensitivityDbm} dBm`} />
                <NodeCapRow label="Beam Div." value={`${sat.beamDivergenceUrad} μrad`} />
                <NodeCapRow label="Max Range" value={`${sat.maxRangeKm} km`} />
                <NodeCapRow label="PAT"       value={sat.hasPAT ? 'YES' : 'NO'} accent={sat.hasPAT ? 'text-fsoc-green' : 'text-fsoc-red'} />
                <NodeCapRow label="Altitude"  value={`${sat.altitudeKm} km`} />
                <NodeCapRow label="Inclination" value={`${sat.inclinationDeg}°`} />
                <NodeCapRow label="RAAN" value={`${sat.raanDeg.toFixed(1)}°`} />
                <NodeCapRow label="True anomaly" value={`${(sat.trueAnomalyRad * 180 / Math.PI).toFixed(1)}°`} />
                <NodeCapRow label="Orbit period" value={`${(2 * Math.PI / (Math.sqrt(3.986004418e5 / Math.pow(6371 + sat.altitudeKm, 3)) ) / 60).toFixed(1)} min`} />
              </div>
            )}
          </div>
        ))}


      </div>
    </div>
  );
}

function NodeCapRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[9px] font-mono text-fsoc-dim">{label}</span>
      <span className={clsx('text-[10px] font-mono tabular-nums', accent ?? 'text-white')}>
        {value}
      </span>
    </div>
  );
}
