/**
 * GlossaryPanel.tsx
 * A single floating "?" button, always in the corner of every dashboard
 * page, that opens a searchable panel explaining every technical term
 * used anywhere in ZENITH in plain English. This is the one-click answer
 * for "I don't know what that means" for anyone watching a demo who
 * isn't an RF/optics specialist — no need to interrupt the presenter.
 */

import React, { useState, useMemo } from 'react';
import { HelpCircle, X, Search } from 'lucide-react';
import { GLOSSARY, GlossaryEntry } from '../../data/glossary';

const CATEGORY_ORDER: GlossaryEntry['category'][] = [
  'General',
  'Signal & Link Quality',
  'Pointing & Tracking',
  'Orbital & Geometry',
  'Intelligence Layer',
];

const GlossaryPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? GLOSSARY.filter(
          g => g.term.toLowerCase().includes(q) || g.short.toLowerCase().includes(q) || g.plain.toLowerCase().includes(q)
        )
      : GLOSSARY;

    const byCategory = new Map<GlossaryEntry['category'], GlossaryEntry[]>();
    for (const entry of filtered) {
      const list = byCategory.get(entry.category) ?? [];
      list.push(entry);
      byCategory.set(entry.category, list);
    }
    return byCategory;
  }, [query]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="What do these terms mean?"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-1.5 rounded-full border border-fsoc-cyan/60 bg-fsoc-bg/90 px-3 py-2 text-fsoc-cyan shadow-lg backdrop-blur-xl transition-colors hover:bg-fsoc-cyan/10"
      >
        <HelpCircle size={14} />
        <span className="text-[10px] font-mono uppercase tracking-widest">Glossary</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/40 backdrop-blur-sm sm:items-center sm:justify-center" onClick={() => setOpen(false)}>
          <div
            className="panel flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden sm:max-h-[70vh] sm:rounded-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="panel-header shrink-0">
              <span className="panel-title">Plain-English Glossary</span>
              <button type="button" onClick={() => setOpen(false)} className="text-fsoc-dim hover:text-fsoc-cyan">
                <X size={14} />
              </button>
            </div>

            <div className="shrink-0 border-b border-fsoc-border px-4 py-2">
              <div className="flex items-center gap-2 rounded border border-fsoc-border bg-fsoc-bg/60 px-2 py-1">
                <Search size={11} className="text-fsoc-dim" />
                <input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search a term (e.g. SNR, jitter, LOS)…"
                  className="w-full bg-transparent text-[11px] font-mono text-white placeholder:text-fsoc-dim focus:outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              {grouped.size === 0 && (
                <div className="py-6 text-center text-[10px] font-mono text-fsoc-dim">No matching terms.</div>
              )}
              {CATEGORY_ORDER.filter(cat => grouped.has(cat)).map(cat => (
                <div key={cat} className="mb-4 last:mb-0">
                  <div className="mb-1.5 text-[9px] font-mono font-bold uppercase tracking-widest text-fsoc-cyan">
                    {cat}
                  </div>
                  <div className="space-y-2.5">
                    {grouped.get(cat)!.map(entry => (
                      <div key={entry.term}>
                        <div className="text-[11px] font-mono font-semibold text-white">
                          {entry.term}
                          {entry.short !== entry.term && (
                            <span className="ml-1.5 font-normal text-fsoc-dim">— {entry.short}</span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono leading-relaxed text-slate-300">{entry.plain}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GlossaryPanel;
