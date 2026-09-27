import { Network, ArrowRight, ArrowDown, Shield } from 'lucide-react';

function Box({ title, items, color = '#00d4ff' }: { title: string; items: string[]; color?: string }) {
  return (
    <div className="border rounded p-3" style={{ borderColor: `${color}40`, backgroundColor: `${color}08` }}>
      <div className="text-[10px] font-mono font-bold tracking-widest uppercase mb-2" style={{ color }}>
        {title}
      </div>
      <div className="space-y-0.5">
        {items.map((item, i) => (
          <div key={i} className="text-[9px] font-mono text-fsoc-dim">• {item}</div>
        ))}
      </div>
    </div>
  );
}

function Arrow({ horizontal = false, label }: { horizontal?: boolean; label?: string }) {
  return (
    <div className={`flex ${horizontal ? 'flex-row' : 'flex-col'} items-center justify-center`}>
      <div className="text-[9px] font-mono text-fsoc-dim">{label}</div>
      {horizontal
        ? <ArrowRight size={16} className="text-fsoc-dim" />
        : <ArrowDown size={16} className="text-fsoc-dim" />
      }
    </div>
  );
}

export default function SystemArchitecture() {
  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div className="panel p-3">
        <div className="panel-header mb-0">
          <div className="flex items-center gap-2">
            <Network size={14} className="text-fsoc-cyan" />
            <span className="panel-title">System Architecture</span>
          </div>
        </div>
      </div>

      {/* Main architecture diagram */}
      <div className="panel p-6">
        <h2 className="text-xs font-mono text-fsoc-cyan tracking-widest uppercase mb-6">Data Flow Architecture</h2>

        {/* Top row: D1 and D2 */}
        <div className="grid grid-cols-2 gap-8 mb-4">
          <Box
            title="Dashboard 1 — Ground FSOC"
            color="#0066ff"
            items={[
              'Node configuration & wavelength negotiation',
              'Physical link simulation (FSL, SNR, BER)',
              'PAT tracking loop (PID controller)',
              'Disturbance engine (8 types)',
              'Adaptive routing (multi-hop)',
              'Telemetry generation at 5 Hz',
            ]}
          />
          <Box
            title="Dashboard 2 — Space FSOC"
            color="#7c3aed"
            items={[
              'Orbital mechanics (circular orbit model)',
              'Satellite position & elevation angle',
              'LOS window prediction',
              'Debris proximity & path intersection',
              'Space PAT tracking',
              'Ground↔Sat + Sat↔Sat link modes',
            ]}
          />
        </div>

        <div className="flex justify-center gap-8 mb-4">
          <Arrow label="Observable telemetry" />
          <Arrow label="Observable telemetry" />
        </div>

        {/* Telemetry layer */}
        <div className="max-w-lg mx-auto mb-4">
          <Box
            title="Observable Telemetry Stream (sanitized)"
            color="#00d4ff"
            items={[
              'timestamp, beaconX/Y, cameraCenterX/Y',
              'pointingErrorUrad, beaconJitterUrad, detectionConfidence',
              'receivedPowerDbm, snrDb, berLog10, linkMarginDb',
              'atmosphericLossDb, hasLOS, trackingStatus',
              'orbital data (if D2), debris data (if D2)',
              '⚠ NO disturbance type or ground truth included',
            ]}
          />
        </div>

        <div className="flex justify-center mb-4">
          <Arrow label="Telemetry fed to intelligence engine (ground truth withheld)" />
        </div>

        {/* D3 pipeline */}
        <div className="max-w-2xl mx-auto">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Box
              title="1. Anomaly Detection"
              color="#ff9900"
              items={[
                'Rolling window statistics',
                'SNR drop threshold: 4 dB',
                'Pointing error threshold: +15 μrad',
                'Confidence drop threshold: -20%',
                'Beacon jitter increase: 2.5×',
                'Trend slope analysis',
              ]}
            />
            <Box
              title="2. Cause Diagnosis"
              color="#ff6600"
              items={[
                'Signature-matching per cause type',
                'Scores: jitter, attenuation, periodicity',
                'Turbulence vs Fog discriminator',
                'Periodic signal detection (autocorrelation)',
                'Normalize to confidence %',
                'Multi-cause detection',
              ]}
            />
            <Box
              title="3. Prediction"
              color="#ff3333"
              items={[
                'Linear trend extrapolation',
                'SNR/margin/pointing/confidence',
                'Predict +10s, +30s values',
                'Estimate time to critical',
                'Tracking loss risk assessment',
                'Link status classification',
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Box
              title="4. Mitigation Recommendation"
              color="#00ff88"
              items={[
                'Route scoring: SNR, margin, distance, PAT, stability',
                'CONTINUE_TRACKING / INCREASE_CORRECTION',
                'REACQUIRE_BEACON / SWITCH_ROUTE',
                'User must explicitly ACCEPT or REJECT',
                'No silent rerouting',
              ]}
            />
            <Box
              title="5. Ground Truth Verification"
              color="#a855f7"
              items={[
                'Ground truth HIDDEN during active diagnosis',
                'Revealed only on user request',
                'Match / mismatch with explanation',
                'Why did model struggle? analysis',
                'Ambiguating factors identified',
                'Performance metrics updated',
              ]}
            />
          </div>
        </div>
      </div>

      {/* Separation principle */}
      <div className="panel p-4 border-fsoc-cyan/20">
        <div className="flex items-center gap-2 mb-3">
          <Shield size={14} className="text-fsoc-cyan" />
          <span className="text-xs font-mono text-fsoc-cyan uppercase tracking-widest">Critical Separation Principle</span>
        </div>
        <div className="grid grid-cols-3 gap-4 text-[9px] font-mono">
          <div>
            <div className="text-fsoc-dim uppercase tracking-wider mb-1">Physical Simulation</div>
            <div className="text-white leading-relaxed">
              D1/D2 engines know the ground truth: which disturbance is active, its intensity, exact parameters. This is stored in GroundTruth struct.
            </div>
          </div>
          <div>
            <div className="text-fsoc-dim uppercase tracking-wider mb-1">Observable Telemetry</div>
            <div className="text-white leading-relaxed">
              Only ObservableTelemetry (no disturbance label) is fed to the intelligence engine. The intelligence module never imports GroundTruth.
            </div>
          </div>
          <div>
            <div className="text-fsoc-dim uppercase tracking-wider mb-1">Intelligence Engine</div>
            <div className="text-white leading-relaxed">
              D3 infers cause from telemetry patterns alone — exactly like a real diagnostic system operating without knowledge of the physical test setup.
            </div>
          </div>
        </div>
      </div>

      {/* Disturbance signature table */}
      <div className="panel p-4">
        <div className="text-xs font-mono text-fsoc-cyan uppercase tracking-widest mb-3">Disturbance Signature Matrix</div>
        <div className="overflow-x-auto">
          <table className="w-full text-[9px] font-mono">
            <thead>
              <tr className="border-b border-fsoc-border">
                {['Disturbance', 'Beacon Jitter', 'Atm. Attenuation', 'Pointing Error', 'Det. Confidence', 'Power Stability', 'Periodicity'].map(h => (
                  <th key={h} className="text-left py-1 px-2 text-fsoc-dim uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-fsoc-border/30">
              {[
                ['Turbulence', '↑↑ oscillating', 'moderate, fluctuating', '↑ moderate', 'stable', 'fluctuating', 'no'],
                ['Fog', 'stable', '↑↑ steady', 'stable', 'stable', '↓ steady', 'no'],
                ['Camera Vibration', 'stable', 'none', '↑↑ oscillating', 'stable', 'stable', 'YES ←'],
                ['Sensor Noise', '↑ coordinate noise', 'none', '↑ moderate', '↓ moderate', 'stable', 'no'],
                ['Beacon Loss', '↑↑ random', 'none', '↑↑↑', '↓↓→0', '↓↓', 'no'],
                ['Attitude Jitter', 'stable', 'none', '↑↑ oscillating', 'stable', 'stable', 'YES ←'],
                ['Debris', 'stable', 'none', 'stable', 'stable', '↓ sudden', 'no'],
              ].map(([name, ...cols]) => (
                <tr key={name} className="hover:bg-fsoc-border/20">
                  <td className="py-1 px-2 text-white font-semibold">{name}</td>
                  {cols.map((c, i) => (
                    <td key={i} className={`py-1 px-2 ${c.includes('↑') ? 'text-fsoc-red' : c.includes('↓') ? 'text-fsoc-amber' : c === 'stable' ? 'text-fsoc-dim' : c.includes('YES') ? 'text-fsoc-green font-bold' : 'text-white'}`}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
