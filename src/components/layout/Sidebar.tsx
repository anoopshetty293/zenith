import { NavLink, Link, useLocation } from 'react-router-dom';
import { Fragment, useState } from 'react';
import {
  LayoutDashboard, Radio, Satellite, Brain, PlaySquare,
  FlaskConical, Network, Settings, ArrowUpRight, RadioTower,
} from 'lucide-react';
import clsx from 'clsx';
import ZenithLogo from '../ZenithLogo';

const NAV_ITEMS = [
  { to: '/overview', icon: LayoutDashboard, label: 'Overview', group: 'main' },
  { to: '/d1', icon: Radio, label: 'Ground FSOC', sub: 'Dashboard 1', group: 'dashboards' },
  { to: '/d2', icon: Satellite, label: 'Space FSOC', sub: 'Dashboard 2', group: 'dashboards' },
  { to: '/d3', icon: Brain, label: 'Intelligence', sub: 'Dashboard 3', group: 'dashboards' },
  { to: '/runs', icon: PlaySquare, label: 'Simulation Runs', group: 'tools' },
  { to: '/testcases', icon: FlaskConical, label: 'Test Cases', group: 'tools' },
  { to: '/architecture', icon: Network, label: 'Architecture', group: 'tools' },
  { to: '/settings', icon: Settings, label: 'Settings', group: 'tools' },
];

export default function Sidebar() {
  const location = useLocation();
  const [d2Open, setD2Open] = useState(location.pathname === '/d2');
  return (
    <aside className="relative z-20 flex w-[250px] flex-shrink-0 flex-col border-r border-[var(--zen-line)] bg-[rgba(5,7,12,.72)] backdrop-blur-xl">
      <div className="border-b border-[var(--zen-line)] px-5 py-5">
        <Link to="/" className="block transition-opacity hover:opacity-90" title="Back to ZENITH">
          <ZenithLogo size={25} withWordmark withSubtitle />
        </Link>
        <div className="mt-4 flex items-center justify-between rounded-full border border-[var(--zen-line)] bg-white/[0.025] px-3 py-1.5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5"><span className="absolute h-full w-full animate-ping rounded-full bg-[var(--zen-cyan)] opacity-50" /><span className="relative h-1.5 w-1.5 rounded-full bg-[var(--zen-cyan)]" /></span>
            <span className="font-mono text-[9px] tracking-[0.16em] text-[var(--zen-mute)]">TESTBED ONLINE</span>
          </div>
          <span className="font-mono text-[8px] text-[var(--zen-mute-2)]">v1.0</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {['main', 'dashboards', 'tools'].map(group => (
          <div key={group} className="mb-4">
            <div className="px-2 pb-2 pt-1 font-mono text-[8px] uppercase tracking-[0.2em] text-[var(--zen-mute-2)]">
              {group === 'main' ? 'Workspace' : group === 'dashboards' ? 'Communication layers' : 'System'}
            </div>
            <div className="space-y-1">
              {NAV_ITEMS.filter(n => n.group === group).map(item => (
                <Fragment key={item.to}>
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => { if (item.to === '/d2') setD2Open(v => !v); }}
                  className={({ isActive }) => clsx(
                    'group relative flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all duration-200',
                    isActive
                      ? 'border-[rgba(92,216,240,.22)] bg-[rgba(92,216,240,.075)] text-white shadow-[inset_3px_0_0_var(--zen-cyan),0_8px_24px_rgba(0,0,0,.12)]'
                      : 'border-transparent text-[var(--zen-mute)] hover:border-[var(--zen-line)] hover:bg-white/[0.025] hover:text-white'
                  )}
                >
                  {({ isActive }) => (
                    <>
                      <item.icon size={15} className={isActive ? 'text-[var(--zen-cyan)]' : 'text-[var(--zen-mute)] group-hover:text-[var(--zen-ink)]'} />
                      <div className="min-w-0">
                        <div className="truncate font-mono text-[10px] tracking-wide">{item.label}</div>
                        {item.sub && <div className="mt-0.5 truncate font-mono text-[8px] tracking-wider text-[var(--zen-mute-2)]">{item.sub}</div>}
                      </div>
                    </>
                  )}
                </NavLink>
                {item.to === '/d2' && (d2Open || location.pathname === '/d2') && (
                  <div className="ml-7 mt-1 space-y-1 border-l border-[var(--zen-line)] pl-3">
                    <Link to="/d2?mode=ground-space" className={clsx('flex items-center gap-2 rounded-md px-2 py-2 font-mono text-[9px] transition-colors', location.search.includes('ground-space') || (!location.search && location.pathname === '/d2') ? 'bg-[rgba(92,216,240,.08)] text-[var(--zen-cyan)]' : 'text-[var(--zen-mute)] hover:text-white hover:bg-white/[0.03]')}>
                      <RadioTower size={11} /> Ground ↔ Space
                    </Link>
                    <Link to="/d2?mode=space-space" className={clsx('flex items-center gap-2 rounded-md px-2 py-2 font-mono text-[9px] transition-colors', location.search.includes('space-space') ? 'bg-[rgba(92,216,240,.08)] text-[var(--zen-cyan)]' : 'text-[var(--zen-mute)] hover:text-white hover:bg-white/[0.03]')}>
                      <Satellite size={11} /> Space ↔ Space
                    </Link>
                  </div>
                )}
                </Fragment>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--zen-line)] px-4 py-3">
        <Link to="/mode-select" className="flex items-center justify-between rounded-lg border border-[var(--zen-line)] bg-white/[0.02] px-3 py-2 text-[9px] font-mono uppercase tracking-wider text-[var(--zen-mute)] transition hover:border-[rgba(92,216,240,.3)] hover:text-[var(--zen-cyan)]">
          <span>Change link geometry</span><ArrowUpRight size={12} />
        </Link>
      </div>
    </aside>
  );
}
