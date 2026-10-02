import React from 'react';
import { ArrowRight, CheckCircle2, Wrench, ShieldAlert } from 'lucide-react';
import { FixFirstItem } from '../../report/types';
import { Finding } from '../../types';

interface FixFirstSectionProps {
  items: (FixFirstItem | Finding)[];
  onSelectFinding: (findingId: string) => void;
}

export const FixFirstSection: React.FC<FixFirstSectionProps> = ({
  items,
  onSelectFinding,
}) => {
  if (!items || items.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 p-5 flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-white">No Critical Launch Blockers</h3>
          <p className="text-xs text-neutral-300">
            All primary infrastructure and technical checks passed without blocking defects.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section
      id="fix-first-section"
      className="rounded-xl border border-rose-900/40 bg-neutral-900/80 p-5 sm:p-6 relative overflow-hidden"
      aria-label="High Priority Launch Blockers"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-rose-950/80 border border-rose-800/60">
            <Wrench className="h-4 w-4 text-rose-400" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <span>Fix First Priority List</span>
              <span className="rounded-full bg-rose-950 border border-rose-800 px-2 py-0.5 text-[10px] font-mono text-rose-300">
                {items.length} Action Items
              </span>
            </h2>
            <p className="text-xs text-neutral-400">
              Deterministic priority ordered by severity, impact, and affected scope.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        {items.map((item, idx) => {
          const rank = (item as FixFirstItem).rank ?? idx + 1;
          const affectedCount = (item as FixFirstItem).affectedCount;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectFinding(item.id)}
              className="w-full text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-neutral-800 bg-neutral-950/70 hover:border-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 transition-colors group cursor-pointer"
            >
              <div className="flex items-start gap-3 min-w-0">
                <span className="font-mono text-xs font-bold text-rose-400 pt-0.5 shrink-0">
                  #{rank < 10 ? `0${rank}` : rank}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border font-semibold ${
                        item.severity === 'critical'
                          ? 'bg-rose-950/50 text-rose-300 border-rose-800/60'
                          : 'bg-amber-950/50 text-amber-300 border-amber-800/60'
                      }`}
                    >
                      {item.severity}
                    </span>
                    <span className="text-[11px] font-medium text-neutral-400 uppercase font-mono">
                      {item.category}
                    </span>
                    {typeof affectedCount === 'number' && affectedCount > 1 && (
                      <span className="text-[11px] font-mono text-neutral-400">
                        • {affectedCount} affected
                      </span>
                    )}
                  </div>
                  <h3 className="text-xs sm:text-sm font-semibold text-neutral-100 group-hover:text-cyan-300 transition-colors">
                    {item.title}
                  </h3>
                  {item.recommendation && (
                    <p className="text-xs text-neutral-400 mt-1 line-clamp-1">
                      Action: {item.recommendation}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 text-xs text-cyan-400 font-mono shrink-0 self-end sm:self-center">
                <span>View details</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
