import React, { useState } from 'react';
import { Zap, Radio, Eye, AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { useSimStore } from '../../store/simulationStore';
import { DISTURBANCE_CATALOG, DisturbanceDefinition, DisturbanceCategory } from '../../types/disturbances';
import { DisturbanceType } from '../../types/disturbances';

// ─── Category config ─────────────────────────────────────────────────────────

interface CategoryConfig {
  label: string;
  icon: React.ReactNode;
  color: string;
}

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  atmospheric: {
    label: 'Atmospheric',
    icon: <Radio className="w-3 h-3" />,
    color: 'text-fsoc-blue border-fsoc-blue/60 bg-fsoc-blue/10',
  },
  mechanical: {
    label: 'Mechanical',
    icon: <Zap className="w-3 h-3" />,
    color: 'text-fsoc-amber border-fsoc-amber/60 bg-fsoc-amber/10',
  },
  optical: {
    label: 'Optical / Sensor',
    icon: <Eye className="w-3 h-3" />,
    color: 'text-fsoc-cyan border-fsoc-cyan/60 bg-fsoc-cyan/10',
  },
};

// ─── Disturbance filter ───────────────────────────────────────────────────────

const D1_DISTURBANCES = DISTURBANCE_CATALOG.filter(d => d.appliesToD1);

const D1_CATEGORIES: DisturbanceCategory[] = ['atmospheric', 'mechanical', 'optical'];

// ─── Individual Disturbance Row ───────────────────────────────────────────────

interface DisturbanceRowProps {
  def: DisturbanceDefinition;
  isActive: boolean;
  onInject: (type: DisturbanceType, intensity: number) => void;
}

const DisturbanceRow: React.FC<DisturbanceRowProps> = ({ def, isActive, onInject }) => {
  const [intensity, setIntensity] = useState(60);
  const [expanded, setExpanded] = useState(false);

  const handleInject = () => {
    onInject(def.type, intensity / 100);
  };

  return (
    <div className={`rounded border transition-all duration-200 ${
      isActive
        ? 'border-fsoc-amber/60 bg-fsoc-amber/5 shadow-[0_0_6px_rgba(251,191,36,0.2)]'
        : 'border-fsoc-border/40 bg-fsoc-bg/30'
    }`}>
      <div
        className="flex items-center justify-between p-2 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isActive
            ? <AlertCircle className="w-3 h-3 text-fsoc-amber flex-shrink-0" />
            : <div className="w-3 h-3 rounded-full border border-fsoc-border flex-shrink-0" />}
          <span className={`text-xs font-medium truncate ${isActive ? 'text-fsoc-amber' : 'text-fsoc-cyan'}`}>
            {def.label}
          </span>
          {isActive && (
            <span className="text-[9px] font-mono text-fsoc-amber border border-fsoc-amber/40 px-1 rounded flex-shrink-0">
              ACTIVE
            </span>
          )}
        </div>
        <div className="flex-shrink-0 ml-1">
          {expanded
            ? <ChevronUp className="w-3 h-3 text-fsoc-dim" />
            : <ChevronDown className="w-3 h-3 text-fsoc-dim" />}
        </div>
      </div>

      {expanded && (
        <div className="px-2 pb-2 space-y-2">
          <p className="text-[10px] text-fsoc-dim leading-relaxed">{def.description}</p>

          {def.hasIntensityControl && (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-fsoc-dim uppercase tracking-wider">Intensity</span>
                <span className="font-mono text-fsoc-cyan">{intensity}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={intensity}
                onChange={e => setIntensity(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-fsoc-cyan"
                style={{
                  background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${intensity}%, #1e293b ${intensity}%, #1e293b 100%)`
                }}
              />
            </div>
          )}

          <button
            onClick={handleInject}
            className="w-full text-[10px] font-mono font-semibold py-1.5 px-2 rounded border border-fsoc-amber/60 text-fsoc-amber bg-fsoc-amber/10 hover:bg-fsoc-amber/20 active:scale-95 transition-all uppercase tracking-wider"
          >
            ⚡ Introduce Disturbance
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Category Group ───────────────────────────────────────────────────────────

interface CategoryGroupProps {
  category: DisturbanceCategory;
  defs: DisturbanceDefinition[];
  activeTypes: Set<DisturbanceType>;
  onInject: (type: DisturbanceType, intensity: number) => void;
}

const CategoryGroup: React.FC<CategoryGroupProps> = ({ category, defs, activeTypes, onInject }) => {
  const cfg = CATEGORY_CONFIG[category];
  const [collapsed, setCollapsed] = useState(false);

  if (!cfg || defs.length === 0) return null;

  return (
    <div className="space-y-1">
      <button
        className={`w-full flex items-center gap-2 px-2 py-1 rounded border text-[10px] font-semibold uppercase tracking-wider ${cfg.color}`}
        onClick={() => setCollapsed(c => !c)}
      >
        {cfg.icon}
        {cfg.label}
        <span className="ml-auto">
          {collapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
        </span>
      </button>
      {!collapsed && (
        <div className="space-y-1 pl-1">
          {defs.map(def => (
            <DisturbanceRow
              key={def.type}
              def={def}
              isActive={activeTypes.has(def.type)}
              onInject={onInject}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const DisturbancePanel: React.FC = () => {
  const activeDisturbances  = useSimStore(s => s.d1.activeDisturbances);
  const injectD1Disturbance = useSimStore(s => s.injectD1Disturbance);
  const clearD1Disturbances = useSimStore(s => s.clearD1Disturbances);

  const activeTypes = new Set<DisturbanceType>(activeDisturbances.map(d => d.type));
  const hasActive   = activeDisturbances.length > 0;

  return (
    <div className="bg-fsoc-panel border border-fsoc-border rounded-lg p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-fsoc-amber" />
          <span className="text-xs font-semibold text-fsoc-cyan uppercase tracking-widest">
            Disturbance Control
          </span>
        </div>
        {hasActive && (
          <span className="text-[9px] font-mono bg-fsoc-amber/15 border border-fsoc-amber/50 text-fsoc-amber px-1.5 py-0.5 rounded">
            {activeDisturbances.length} ACTIVE
          </span>
        )}
      </div>

      <div className="h-px bg-fsoc-border/60" />

      {/* Active disturbances summary */}
      {hasActive && (
        <div className="space-y-1">
          {activeDisturbances.map(d => (
            <div
              key={d.id}
              className="flex items-center justify-between text-[10px] bg-fsoc-amber/5 border border-fsoc-amber/30 rounded px-2 py-1"
            >
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-fsoc-amber animate-pulse" />
                <span className="font-mono text-fsoc-amber">{d.type}</span>
              </div>
              <span className="font-mono text-fsoc-dim">{(d.intensity * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      )}

      {/* Category groups */}
      <div className="space-y-2 overflow-y-auto max-h-72 pr-0.5">
        {D1_CATEGORIES.map(cat => {
          const defs = D1_DISTURBANCES.filter(d => d.category === cat);
          return (
            <CategoryGroup
              key={cat}
              category={cat}
              defs={defs}
              activeTypes={activeTypes}
              onInject={injectD1Disturbance}
            />
          );
        })}
      </div>

      <div className="h-px bg-fsoc-border/60" />

      {/* Restore Normal */}
      <button
        onClick={clearD1Disturbances}
        disabled={!hasActive}
        className={`w-full text-[10px] font-mono font-semibold py-1.5 px-2 rounded border uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
          hasActive
            ? 'border-fsoc-green/60 text-fsoc-green bg-fsoc-green/10 hover:bg-fsoc-green/20'
            : 'border-fsoc-border/40 text-fsoc-dim cursor-not-allowed opacity-50'
        }`}
      >
        <CheckCircle2 className="w-3 h-3" />
        Restore Normal Conditions
      </button>
    </div>
  );
};

export default DisturbancePanel;
