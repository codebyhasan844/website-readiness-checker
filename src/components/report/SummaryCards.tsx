import React from 'react';
import { AlertOctagon, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { ReportSummaryCounts, FindingSeverity } from '../../types';

interface SummaryCardsProps {
  summary: ReportSummaryCounts;
  selectedSeverity: FindingSeverity | 'all';
  onSelectSeverity: (severity: FindingSeverity | 'all') => void;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  summary,
  selectedSeverity,
  onSelectSeverity,
}) => {
  const cards = [
    {
      key: 'critical' as FindingSeverity,
      title: 'Critical',
      count: summary.critical,
      desc: 'Blocking issues',
      icon: AlertOctagon,
      activeBorder: 'border-rose-500 bg-rose-950/40 text-rose-200 shadow-rose-950/40 shadow-lg',
      defaultBorder: 'border-rose-900/40 bg-neutral-900/60 hover:border-rose-800/60 text-rose-300',
      countColor: 'text-rose-200',
      iconColor: 'text-rose-400',
    },
    {
      key: 'important' as FindingSeverity,
      title: 'Important',
      count: summary.important,
      desc: 'Must address',
      icon: AlertTriangle,
      activeBorder: 'border-amber-500 bg-amber-950/40 text-amber-200 shadow-amber-950/40 shadow-lg',
      defaultBorder: 'border-amber-900/40 bg-neutral-900/60 hover:border-amber-800/60 text-amber-300',
      countColor: 'text-amber-200',
      iconColor: 'text-amber-400',
    },
    {
      key: 'improvement' as FindingSeverity,
      title: 'Improvements',
      count: summary.improvement,
      desc: 'Enhancements',
      icon: Info,
      activeBorder: 'border-sky-500 bg-sky-950/40 text-sky-200 shadow-sky-950/40 shadow-lg',
      defaultBorder: 'border-sky-900/40 bg-neutral-900/60 hover:border-sky-800/60 text-sky-300',
      countColor: 'text-sky-200',
      iconColor: 'text-sky-400',
    },
    {
      key: 'passed' as FindingSeverity,
      title: 'Passed',
      count: summary.passed,
      desc: 'Healthy checks',
      icon: CheckCircle2,
      activeBorder: 'border-emerald-500 bg-emerald-950/40 text-emerald-200 shadow-emerald-950/40 shadow-lg',
      defaultBorder: 'border-emerald-900/40 bg-neutral-900/60 hover:border-emerald-800/60 text-emerald-300',
      countColor: 'text-emerald-200',
      iconColor: 'text-emerald-400',
    },
  ];

  return (
    <div id="summary-cards-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((card) => {
        const isSelected = selectedSeverity === card.key;
        const Icon = card.icon;

        return (
          <button
            key={card.key}
            type="button"
            onClick={() => onSelectSeverity(isSelected ? 'all' : card.key)}
            className={`rounded-xl border p-4 text-left transition-all duration-150 relative group focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
              isSelected ? card.activeBorder : card.defaultBorder
            }`}
            aria-pressed={isSelected}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider">{card.title}</span>
              <Icon className={`h-4 w-4 ${card.iconColor}`} />
            </div>

            <div className="mt-2 flex items-baseline gap-2">
              <span className={`text-3xl font-extrabold font-mono ${card.countColor}`}>
                {card.count}
              </span>
              <span className="text-[11px] text-neutral-400">{card.desc}</span>
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] text-neutral-400 font-mono pt-2 border-t border-neutral-800/60">
              <span>{isSelected ? 'Filtering results' : 'Click to filter'}</span>
              <span className="group-hover:text-cyan-400 transition-colors">→</span>
            </div>
          </button>
        );
      })}
    </div>
  );
};
