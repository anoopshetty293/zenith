/**
 * PanelInfo.tsx
 * Shared "(i)" info affordance used across every D3 panel: a small toggle
 * button that reveals a short inline explanation box directly beneath the
 * panel header. Deliberately not a hover tooltip — click-to-toggle reads as
 * more deliberate and works the same on touch as on desktop.
 */
import React from 'react';
import { Info } from 'lucide-react';

export const InfoToggle: React.FC<{ open: boolean; onToggle: () => void; label?: string }> = ({
  open,
  onToggle,
  label = 'How this works',
}) => (
  <button
    type="button"
    onClick={onToggle}
    title={label}
    aria-label={label}
    aria-pressed={open}
    className={`flex items-center justify-center w-5 h-5 rounded border shrink-0 transition-colors ${
      open
        ? 'border-fsoc-cyan/60 text-fsoc-cyan bg-fsoc-cyan/10'
        : 'border-fsoc-border text-fsoc-dim hover:text-fsoc-cyan hover:border-fsoc-cyan/40'
    }`}
  >
    <Info size={11} />
  </button>
);

export const InfoNote: React.FC<{ title?: string; children: React.ReactNode }> = ({
  title = 'How this works',
  children,
}) => (
  <div className="mx-3 mt-2 rounded border border-fsoc-border/50 bg-fsoc-bg/40 px-3 py-2">
    <div className="text-[9px] font-mono text-fsoc-dim uppercase tracking-widest mb-1">{title}</div>
    <p className="text-[10px] font-mono text-slate-300 leading-relaxed">{children}</p>
  </div>
);
