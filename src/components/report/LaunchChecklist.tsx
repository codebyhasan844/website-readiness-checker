/**
 * Before You Launch Checklist Component (Phase 4)
 *
 * Dynamically rendered interactive pre-launch checklist based on verified audit findings.
 */

import React, { useState } from 'react';
import { CheckSquare, Square, CheckCircle2, AlertTriangle, ShieldCheck, ChevronRight } from 'lucide-react';
import { LaunchChecklistItem } from '../../report/types';

interface LaunchChecklistProps {
  items: LaunchChecklistItem[];
  onSelectCategory?: (category: string) => void;
}

export const LaunchChecklist: React.FC<LaunchChecklistProps> = ({ items, onSelectCategory }) => {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const toggleCheck = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCheckedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const resolvedCount = items.filter(
    (i) => i.status === 'resolved' || checkedItems[i.id]
  ).length;

  return (
    <section
      id="launch-checklist-section"
      className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5 sm:p-6 space-y-5"
      aria-label="Before You Launch Checklist"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>Before You Launch — Readiness Checklist</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-300">
                {resolvedCount} of {items.length} Cleared
              </span>
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Verify each launch prerequisite before public marketing or client handoff.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        {items.map((item) => {
          const isMarked = item.status === 'resolved' || checkedItems[item.id];
          const isCritical = item.severity === 'critical';

          return (
            <div
              key={item.id}
              className={`p-3.5 rounded-lg border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group ${
                isMarked
                  ? 'border-emerald-900/40 bg-emerald-950/10 hover:border-emerald-800/60'
                  : isCritical
                  ? 'border-rose-900/50 bg-rose-950/20 hover:border-rose-800/70'
                  : 'border-neutral-800 bg-neutral-950/60 hover:border-neutral-700'
              }`}
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={(e) => toggleCheck(item.id, e)}
                  className="mt-0.5 shrink-0 text-neutral-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded p-0.5 -m-0.5"
                  aria-label={isMarked ? `Mark "${item.title}" as pending` : `Mark "${item.title}" as resolved`}
                  aria-pressed={isMarked}
                >
                  {isMarked ? (
                    <CheckSquare className="h-5 w-5 text-emerald-400" aria-hidden="true" />
                  ) : (
                    <Square className={`h-5 w-5 ${isCritical ? 'text-rose-400' : 'text-neutral-500'}`} aria-hidden="true" />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-mono uppercase px-1.5 py-0.2 rounded border font-semibold ${
                        isMarked
                          ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                          : isCritical
                          ? 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                          : 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                      }`}
                    >
                      {isMarked ? 'CLEARED' : item.severity.toUpperCase()}
                    </span>
                    <span className="text-[11px] font-mono text-neutral-400 uppercase">
                      {item.category}
                    </span>
                    {item.affectedCount > 0 && !isMarked && (
                      <span className="text-[11px] font-mono text-neutral-400">
                        • {item.affectedCount} affected
                      </span>
                    )}
                  </div>

                  <h3
                    className={`text-xs sm:text-sm font-semibold transition-colors ${
                      isMarked
                        ? 'text-neutral-300 line-through decoration-neutral-600'
                        : 'text-neutral-100 group-hover:text-cyan-300'
                    }`}
                  >
                    {item.title}
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5 line-clamp-1">
                    {item.recommendation}
                  </p>
                </div>
              </div>

              {onSelectCategory && (
                <button
                  type="button"
                  onClick={() => onSelectCategory(item.category)}
                  className="inline-flex items-center gap-1 text-xs font-mono text-cyan-400 hover:text-cyan-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded px-2 py-1 shrink-0 self-end sm:self-center transition-colors"
                  aria-label={`Filter findings list by ${item.category} category`}
                >
                  <span>Filter view</span>
                  <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
