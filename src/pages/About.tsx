import { Info, Users, Github, ExternalLink, Radio, Satellite, Brain, Route, ShieldCheck } from 'lucide-react';

const TEAM_MEMBERS = [
  { name: 'Anoop Shetty', color: '#00d4ff' },
  { name: 'Kartik Sharma', color: '#7c3aed' },
  { name: 'Shyam Prasad', color: '#ff9900' },
  { name: 'Nikhil Zolekar', color: '#00ff88' },
  { name: 'Preeti Yadav', color: '#ff3d8f' },
  { name: 'Swara Pimprikar', color: '#0066ff' },
];

function initials(name: string): string {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

function TeamCard({ name, color }: { name: string; color: string }) {
  return (
    <div
      className="group relative flex flex-col items-center gap-3 overflow-hidden rounded-xl border border-fsoc-border/50 bg-gradient-to-b from-white/[0.03] to-black/20 px-4 py-6 text-center transition-all duration-300 hover:-translate-y-1 hover:border-transparent"
    >
      {/* Ambient glow that blooms in on hover */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-25"
        style={{ backgroundColor: color }}
      />
      {/* Faint corner scan-line accent */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-60" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />

      <div className="relative">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full border-2 font-mono text-base font-bold text-white transition-transform duration-300 group-hover:scale-110"
          style={{
            borderColor: `${color}aa`,
            background: `radial-gradient(circle at 35% 30%, ${color}33, rgba(0,0,0,.3))`,
            boxShadow: `0 0 22px ${color}55, inset 0 0 14px ${color}33`,
          }}
        >
          {initials(name)}
        </div>
        <span
          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-fsoc-bg animate-pulse"
          style={{ backgroundColor: color }}
        />
      </div>

      <div className="relative">
        <div className="text-[11px] font-mono font-semibold tracking-wide text-white">{name}</div>
      </div>
    </div>
  );
}

const GITHUB_URL = 'https://github.com/anoopshetty293/zenith';

function FeatureCard({ icon: Icon, title, items, color = '#00d4ff' }: { icon: typeof Radio; title: string; items: string[]; color?: string }) {
  return (
    <div className="rounded border p-3" style={{ borderColor: `${color}40`, backgroundColor: `${color}08` }}>
      <div className="mb-2 flex items-center gap-2">
        <Icon size={13} style={{ color }} />
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest" style={{ color }}>{title}</span>
      </div>
      <div className="space-y-0.5">
        {items.map((item, i) => (
          <div key={i} className="text-[9px] font-mono leading-relaxed text-fsoc-dim">• {item}</div>
        ))}
      </div>
    </div>
  );
}

export default function About() {
  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div className="panel p-3">
        <div className="panel-header mb-0">
          <div className="flex items-center gap-2">
            <Info size={14} className="text-fsoc-cyan" />
            <span className="panel-title">About</span>
          </div>
        </div>
      </div>

      {/* Project summary */}
      <div className="panel p-6">
        <h1 className="mb-1 text-sm font-mono font-bold uppercase tracking-widest text-fsoc-cyan">ZENITH — FSOC Virtual Testbed</h1>
        <p className="mb-6 text-[10px] font-mono leading-relaxed text-fsoc-dim">
          A simulated free-space optical communication (FSOC) environment for exploring link acquisition,
          adaptive routing, disturbances and AI-assisted fault diagnosis across ground and space links —
          all driven by live physics, not scripted demos.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <FeatureCard
            icon={Radio}
            title="Dashboard 1 — Ground FSOC"
            color="#0066ff"
            items={[
              'Multi-node ground network with live PAT (Point, Acquire & Track)',
              'Adaptive multi-hop routing: alternate paths scored and suggested automatically',
              'Injectable disturbances (turbulence, fog, vibration, sensor noise, beacon loss...)',
              'Disturbances follow whichever hop is actually carrying traffic, even after a reroute',
            ]}
          />
          <FeatureCard
            icon={Satellite}
            title="Dashboard 2 — Space FSOC"
            color="#7c3aed"
            items={[
              'Orbital mechanics with live elevation, LOS windows and debris conjunctions',
              'Ground ↔ Space and Space ↔ Space links run independently and simultaneously',
              'Manual hop-by-hop path builder plus automatic relay-path suggestions',
              'Debris treated as a hard physical obstruction, forcing real rerouting decisions',
            ]}
          />
          <FeatureCard
            icon={Brain}
            title="Dashboard 3 — Intelligence"
            color="#ff9900"
            items={[
              'Observe → Detect → Diagnose → Predict → Mitigate → Verify pipeline',
              'Independent sub-dashboards for D1, D2 Ground↔Space and D2 Space↔Space',
              'Rule-based cause diagnosis with confidence scoring — never sees ground truth while active',
              'User-actioned mitigation (reacquire beacon, boost tracking, switch route) with real effects',
            ]}
          />
          <FeatureCard
            icon={Route}
            title="Overview & Test Cases"
            color="#00ff88"
            items={[
              'Live system diagram showing every link — ground, ground↔space and space↔space — at once',
              '8 preset test scenarios with a hidden disturbance to diagnose blind',
              'Ground-truth reveal with match/mismatch explanation after diagnosis',
            ]}
          />
        </div>

        <div className="flex items-center gap-2 rounded border border-fsoc-cyan/20 bg-fsoc-cyan/5 p-3">
          <ShieldCheck size={13} className="shrink-0 text-fsoc-cyan" />
          <span className="text-[9px] font-mono leading-relaxed text-fsoc-dim">
            The intelligence engine only ever sees observable telemetry — never the injected disturbance
            or its parameters — so diagnosis behaves like a real fault-finding system, not a lookup.
          </span>
        </div>
      </div>

      {/* Team */}
      <div className="panel p-6">
        <div className="mb-4 flex items-center gap-2">
          <Users size={14} className="text-fsoc-cyan" />
          <span className="text-xs font-mono uppercase tracking-widest text-fsoc-cyan">Created by Team NovaVector</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {TEAM_MEMBERS.map(member => (
            <TeamCard key={member.name} name={member.name} color={member.color} />
          ))}
        </div>
      </div>

      {/* Repository link */}
      <div className="panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Github size={14} className="text-fsoc-cyan" />
            <span className="text-xs font-mono uppercase tracking-widest text-fsoc-cyan">Source Code</span>
          </div>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded border border-fsoc-cyan/40 bg-fsoc-cyan/10 px-3 py-1.5 text-[10px] font-mono text-fsoc-cyan transition-colors hover:bg-fsoc-cyan/20"
          >
            <Github size={12} /> {GITHUB_URL.replace('https://', '')} <ExternalLink size={11} />
          </a>
        </div>
      </div>
    </div>
  );
}
