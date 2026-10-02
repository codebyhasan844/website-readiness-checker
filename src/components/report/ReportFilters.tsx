import React from 'react';
import { Search, Filter, X } from 'lucide-react';
import { FindingCategory, FindingSeverity } from '../../types';

interface ReportFiltersProps {
  selectedCategory: FindingCategory | 'all';
  onSelectCategory: (category: FindingCategory | 'all') => void;
  selectedSeverity: FindingSeverity | 'all';
  onSelectSeverity: (severity: FindingSeverity | 'all') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalFindingsCount: number;
  filteredFindingsCount: number;
}

export const ReportFilters: React.FC<ReportFiltersProps> = ({
  selectedCategory,
  onSelectCategory,
  selectedSeverity,
  onSelectSeverity,
  searchQuery,
  onSearchChange,
  totalFindingsCount,
  filteredFindingsCount,
}) => {
  const categories: Array<{ id: FindingCategory | 'all'; label: string }> = [
    { id: 'all', label: 'All Categories' },
    { id: 'technical', label: 'Technical QA' },
    { id: 'seo', label: 'SEO' },
    { id: 'security', label: 'Security' },
    { id: 'performance', label: 'Performance' },
    { id: 'accessibility', label: 'Accessibility' },
    { id: 'crawlability', label: 'Crawlability' },
    { id: 'assets', label: 'Assets & Media' },
  ];

  const severities: Array<{ id: FindingSeverity | 'all'; label: string }> = [
    { id: 'all', label: 'All Severities' },
    { id: 'critical', label: 'Critical' },
    { id: 'important', label: 'Important' },
    { id: 'improvement', label: 'Improvements' },
    { id: 'passed', label: 'Passed' },
  ];

  const hasActiveFilters =
    selectedCategory !== 'all' || selectedSeverity !== 'all' || searchQuery.trim().length > 0;

  const handleResetFilters = () => {
    onSelectCategory('all');
    onSelectSeverity('all');
    onSearchChange('');
  };

  return (
    <div
      id="report-filters-panel"
      className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-4"
    >
      {/* Search and summary line */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search box */}
        <div className="relative flex-1 max-w-md">
          <label htmlFor="findings-search-input" className="sr-only">
            Search audit findings
          </label>
          <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center text-neutral-400">
            <Search className="h-4 w-4" aria-hidden="true" />
          </div>
          <input
            id="findings-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search findings (e.g. sitemap, TLS, meta)..."
            aria-label="Search audit findings"
            className="w-full rounded-lg border border-neutral-800 bg-neutral-950 py-2 pl-9 pr-8 text-xs font-mono text-neutral-100 placeholder:text-neutral-400 focus:border-cyan-500/80 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear search query"
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-neutral-400 hover:text-white"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Count & clear filters */}
        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs font-mono">
          <span className="text-neutral-400">
            Showing <strong className="text-cyan-400">{filteredFindingsCount}</strong> of {totalFindingsCount}
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-cyan-400 hover:text-cyan-300 underline text-xs"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Filter Category Pills */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-400 uppercase tracking-wider">
          <Filter className="h-3 w-3 text-neutral-400" aria-hidden="true" />
          <span>Filter by Category:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              aria-pressed={selectedCategory === cat.id}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-cyan-950/70 border border-cyan-500/60 text-cyan-200'
                  : 'bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filter Severity Pills */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-400 uppercase tracking-wider">
          <Filter className="h-3 w-3 text-neutral-400" aria-hidden="true" />
          <span>Filter by Severity:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {severities.map((sev) => (
            <button
              key={sev.id}
              type="button"
              onClick={() => onSelectSeverity(sev.id)}
              aria-pressed={selectedSeverity === sev.id}
              className={`rounded-lg px-2.5 py-1 text-xs font-mono uppercase transition-colors ${
                selectedSeverity === sev.id
                  ? 'bg-neutral-800 border border-neutral-600 text-white font-bold'
                  : 'bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
              }`}
            >
              {sev.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
