/**
 * Term.tsx
 * Wraps a jargon word/abbreviation (SNR, BER, µrad, PAT...) with a dotted
 * underline. Tapping or hovering shows its plain-English definition from
 * the shared glossary, right where the term appears — so a first-time
 * viewer never has to go hunting for an explanation.
 *
 * Usage: <Term>SNR</Term>  — looks up "SNR" in GLOSSARY automatically.
 *        <Term glossaryKey="Link Margin">Margin</Term> — for a label that
 *        doesn't match the glossary term exactly.
 */

import React, { useState, useRef, useEffect } from 'react';
import { findGlossaryEntry } from '../../data/glossary';

interface TermProps {
  children: string;
  glossaryKey?: string;
  className?: string;
}

const Term: React.FC<TermProps> = ({ children, glossaryKey, className }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const entry = findGlossaryEntry(glossaryKey ?? children);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  // If the term isn't in the glossary, render it plainly — fail quiet,
  // never show a broken/empty tooltip.
  if (!entry) return <span className={className}>{children}</span>;

  return (
    <span ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className={`border-b border-dotted border-fsoc-dim/70 hover:border-fsoc-cyan hover:text-fsoc-cyan transition-colors cursor-help ${className ?? ''}`}
      >
        {children}
      </button>

      {open && (
        <div
          role="tooltip"
          className="panel absolute left-1/2 top-full z-50 mt-2 w-56 -translate-x-1/2 p-2.5 text-left shadow-xl"
        >
          <div className="text-[9px] font-mono font-bold uppercase tracking-widest text-fsoc-cyan mb-1">
            {entry.short}
          </div>
          <div className="text-[10px] font-mono leading-relaxed text-slate-300">
            {entry.plain}
          </div>
        </div>
      )}
    </span>
  );
};

export default Term;
