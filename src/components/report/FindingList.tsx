import React, { useState, useMemo } from 'react';
import { Finding, FindingSeverity } from '../../types';
import { FindingCard } from '../FindingCard';
import { CheckCircle2, SearchX, ChevronsUpDown, ChevronDown, ChevronUp } from 'lucide-react';

interface FindingListProps {
  findings: Finding[];
  selectedFindingId?: string | null;
}

export const FindingList: React.FC<FindingListProps> = ({ findings, selectedFindingId }) => {
  const [expandAllOverride, setExpandAllOverride] = useState<boolean | null>(null);

  // Separate into groups: Critical, Important, Improvements, Passed
  const groups = useMemo(() => {
    const critical = findings.filter((f) => f.severity === 'critical');
    const important = findings.filter((f) => f.severity === 'important');
    const improvements = findings.filter((f) => f.severity === 'improvement');
    const passed = findings.filter((f) => f.severity === 'passed');

    return [
      {
        label: 'Critical Findings',
        count: critical.length,
        items: critical,
        badgeClass: 'bg-rose-950 text-rose-300 border-rose-800/60',
      },
      {
        label: 'Important Findings',
        count: important.length,
        items: important,
        badgeClass: 'bg-amber-950 text-amber-300 border-amber-800/60',
      },
      {
        label: 'Suggested Improvements',
        count: improvements.length,
        items: improvements,
        badgeClass: 'bg-sky-950 text-sky-300 border-sky-800/60',
      },
      {
        label: 'Passed Checks',
        count: passed.length,
        items: passed,
        badgeClass: 'bg-emerald-950 text-emerald-300 border-emerald-800/60',
      },
    ].filter((g) => g.items.length > 0);
  }, [findings]);

  if (findings.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-10 text-center space-y-3">
        <div className="h-10 w-10 mx-auto rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400">
          <SearchX className="h-5 w-5" aria-hidden="true" />
        </div>
        <h3 className="text-sm font-semibold text-neutral-200">No findings match your filters</h3>
        <p className="text-xs text-neutral-400 max-w-sm mx-auto">
          Try selecting another category, adjusting severity filters, or clearing the search query.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* List controls */}
      <div className="flex items-center justify-between text-xs font-mono text-neutral-400 pb-1">
        <span>Displaying {findings.length} findings across {groups.length} groups</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpandAllOverride(true)}
            className="hover:text-cyan-300 text-[11px] underline focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500 rounded px-1"
          >
            Expand All
          </button>
          <span>·</span>
          <button
            type="button"
            onClick={() => setExpandAllOverride(false)}
            className="hover:text-cyan-300 text-[11px] underline focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500 rounded px-1"
          >
            Collapse All
          </button>
        </div>
      </div>

      {groups.map((group) => (
        <section key={group.label} className="space-y-3" aria-label={group.label}>
          <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
            <h2 className="text-sm font-mono font-bold tracking-tight text-white flex items-center gap-2">
              <span>{group.label}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${group.badgeClass}`}>
                {group.count}
              </span>
            </h2>
          </div>

          <div className="space-y-2.5">
            {group.items.map((finding) => {
              const isDefaultExpanded =
                expandAllOverride !== null
                  ? expandAllOverride
                  : selectedFindingId === finding.id || finding.severity === 'critical';

              return (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                  defaultExpanded={isDefaultExpanded}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};
