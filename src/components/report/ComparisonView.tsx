/**
 * Scan Comparison View Component (Phase 4)
 *
 * Displays transparent diff between previous and current scans:
 * - Resolved findings (fixed)
 * - Still Open findings (still failing)
 * - New findings (regressions)
 * - Changed findings (severity or affected page count shifted)
 */

import React, { useState } from 'react';
import {
  GitCompare,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Minus
} from 'lucide-react';
import { AuditComparisonResult } from '../../report/types';
import { FindingCategory, FindingSeverity } from '../../audit/types';

interface ComparisonViewProps {
  comparison: AuditComparisonResult;
  onSelectFinding?: (checkId: string) => void;
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  comparison,
  onSelectFinding,
}) => {
  const [activeTab, setActiveTab] = useState<'resolved' | 'stillOpen' | 'new' | 'changed'>(
    'resolved'
  );

  if (!comparison.hasPrevious) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-8 text-center space-y-3">
        <div className="h-10 w-10 mx-auto rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400">
          <GitCompare className="h-5 w-5" />
        </div>
        <h4 className="text-sm font-semibold text-neutral-200">
          No previous scan available for comparison
        </h4>
        <p className="text-xs text-neutral-400 max-w-md mx-auto">
          Scan this website again using the <strong>Re-scan Website</strong> button above to track resolved issues, identify regressions, and verify fixes.
        </p>
      </div>
    );
  }

  const prevCritical = comparison.previousCounts?.critical ?? 0;
  const currCritical = comparison.currentCounts.critical;
  const criticalDiff = prevCritical - currCritical;

  const prevImportant = comparison.previousCounts?.important ?? 0;
  const currImportant = comparison.currentCounts.important;
  const importantDiff = prevImportant - currImportant;

  return (
    <section
      id="scan-comparison-section"
      className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-5 sm:p-6 space-y-6"
      aria-label="Scan Comparison Results"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-cyan-400" aria-hidden="true" />
            <span>Scan Progression &amp; Fix Verification</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5 font-mono">
            Comparing scan <span className="text-neutral-300">{comparison.previousScanId?.slice(0, 16)}</span> → current <span className="text-cyan-300">{comparison.currentScanId.slice(0, 16)}</span>
          </p>
        </div>

        {/* Delta Pills */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-1.5 text-xs font-mono">
            <span className="text-neutral-400">Critical:</span>
            <span className="text-neutral-200">{prevCritical} → {currCritical}</span>
            {criticalDiff > 0 ? (
              <span className="text-emerald-400 flex items-center gap-0.5">
                <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" /> -{criticalDiff}
              </span>
            ) : criticalDiff < 0 ? (
              <span className="text-rose-400 flex items-center gap-0.5">
                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" /> +{Math.abs(criticalDiff)}
              </span>
            ) : (
              <span className="text-neutral-400 flex items-center">
                <Minus className="h-3 w-3" aria-hidden="true" /> 0
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-1.5 text-xs font-mono">
            <span className="text-neutral-400">Important:</span>
            <span className="text-neutral-200">{prevImportant} → {currImportant}</span>
            {importantDiff > 0 ? (
              <span className="text-emerald-400 flex items-center gap-0.5">
                <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" /> -{importantDiff}
              </span>
            ) : importantDiff < 0 ? (
              <span className="text-amber-400 flex items-center gap-0.5">
                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" /> +{Math.abs(importantDiff)}
              </span>
            ) : (
              <span className="text-neutral-400 flex items-center">
                <Minus className="h-3 w-3" aria-hidden="true" /> 0
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 4 Classification Filter Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="tablist" aria-label="Comparison Categories">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'resolved'}
          onClick={() => setActiveTab('resolved')}
          className={`p-3 rounded-lg border text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
            activeTab === 'resolved'
              ? 'border-emerald-500 bg-emerald-950/40 text-emerald-200 shadow-sm'
              : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold uppercase">
            <span>Resolved</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          </div>
          <div className="mt-2 text-2xl font-mono font-bold text-emerald-300">
            {comparison.resolved.length}
          </div>
          <span className="text-[10px] text-neutral-400">Fixed since last scan</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'stillOpen'}
          onClick={() => setActiveTab('stillOpen')}
          className={`p-3 rounded-lg border text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
            activeTab === 'stillOpen'
              ? 'border-amber-500 bg-amber-950/40 text-amber-200 shadow-sm'
              : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold uppercase">
            <span>Still Open</span>
            <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden="true" />
          </div>
          <div className="mt-2 text-2xl font-mono font-bold text-amber-300">
            {comparison.stillOpen.length}
          </div>
          <span className="text-[10px] text-neutral-400">Persistent issues</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'new'}
          onClick={() => setActiveTab('new')}
          className={`p-3 rounded-lg border text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
            activeTab === 'new'
              ? 'border-rose-500 bg-rose-950/40 text-rose-200 shadow-sm'
              : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold uppercase">
            <span>New Issues</span>
            <AlertOctagon className="h-4 w-4 text-rose-400" aria-hidden="true" />
          </div>
          <div className="mt-2 text-2xl font-mono font-bold text-rose-300">
            {comparison.newFindings.length}
          </div>
          <span className="text-[10px] text-neutral-400">Newly detected</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'changed'}
          onClick={() => setActiveTab('changed')}
          className={`p-3 rounded-lg border text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
            activeTab === 'changed'
              ? 'border-sky-500 bg-sky-950/40 text-sky-200 shadow-sm'
              : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold uppercase">
            <span>Changed</span>
            <GitCompare className="h-4 w-4 text-sky-400" aria-hidden="true" />
          </div>
          <div className="mt-2 text-2xl font-mono font-bold text-sky-300">
            {comparison.changed.length}
          </div>
          <span className="text-[10px] text-neutral-400">Shifted in volume or severity</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="space-y-3">
        {activeTab === 'resolved' && (
          <div className="space-y-2">
            {comparison.resolved.length === 0 ? (
              <p className="text-xs text-neutral-400 p-4 rounded-lg bg-neutral-950 text-center">
                No resolved findings between these two scans yet.
              </p>
            ) : (
              comparison.resolved.map((f) => (
                <div
                  key={f.id}
                  className="p-3.5 rounded-lg border border-emerald-950 bg-emerald-950/20 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" aria-hidden="true" />
                    <div>
                      <span className="font-semibold text-emerald-200">{f.title}</span>
                      <span className="ml-2 font-mono text-[10px] uppercase text-neutral-400">
                        {f.category}
                      </span>
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        Issue resolved in current scan.
                      </p>
                    </div>
                  </div>
                  <span className="rounded bg-emerald-950 border border-emerald-800 px-2 py-0.5 text-[10px] font-mono text-emerald-300 shrink-0">
                    RESOLVED
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'stillOpen' && (
          <div className="space-y-2">
            {comparison.stillOpen.length === 0 ? (
              <p className="text-xs text-neutral-400 p-4 rounded-lg bg-neutral-950 text-center">
                Zero persistent open issues!
              </p>
            ) : (
              comparison.stillOpen.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onSelectFinding?.(f.checkId)}
                  className="w-full text-left p-3.5 rounded-lg border border-neutral-800 bg-neutral-950/70 hover:border-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 flex items-center justify-between gap-3 text-xs cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" aria-hidden="true" />
                    <div>
                      <span className="font-semibold text-neutral-200 group-hover:text-cyan-300 transition-colors">
                        {f.title}
                      </span>
                      <span className="ml-2 font-mono text-[10px] uppercase text-neutral-400">
                        {f.category}
                      </span>
                      <p className="text-[11px] text-neutral-400 mt-0.5 line-clamp-1">
                        {f.evidence.summary}
                      </p>
                    </div>
                  </div>
                  <span className="rounded bg-amber-950 border border-amber-800 px-2 py-0.5 text-[10px] font-mono text-amber-300 shrink-0">
                    STILL OPEN
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {activeTab === 'new' && (
          <div className="space-y-2">
            {comparison.newFindings.length === 0 ? (
              <p className="text-xs text-neutral-400 p-4 rounded-lg bg-neutral-950 text-center">
                Zero new regressions detected!
              </p>
            ) : (
              comparison.newFindings.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onSelectFinding?.(f.checkId)}
                  className="w-full text-left p-3.5 rounded-lg border border-rose-950 bg-rose-950/20 hover:border-rose-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 flex items-center justify-between gap-3 text-xs cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <AlertOctagon className="h-4 w-4 text-rose-400 shrink-0" aria-hidden="true" />
                    <div>
                      <span className="font-semibold text-rose-200 group-hover:text-rose-100 transition-colors">
                        {f.title}
                      </span>
                      <span className="ml-2 font-mono text-[10px] uppercase text-neutral-400">
                        {f.category}
                      </span>
                      <p className="text-[11px] text-neutral-400 mt-0.5 line-clamp-1">
                        {f.evidence.summary}
                      </p>
                    </div>
                  </div>
                  <span className="rounded bg-rose-950 border border-rose-800 px-2 py-0.5 text-[10px] font-mono text-rose-300 shrink-0">
                    NEW REGRESSION
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {activeTab === 'changed' && (
          <div className="space-y-2">
            {comparison.changed.length === 0 ? (
              <p className="text-xs text-neutral-400 p-4 rounded-lg bg-neutral-950 text-center">
                No altered findings between these two scans.
              </p>
            ) : (
              comparison.changed.map((c) => (
                <button
                  key={c.checkId}
                  type="button"
                  onClick={() => onSelectFinding?.(c.checkId)}
                  className="w-full text-left p-3.5 rounded-lg border border-sky-950 bg-sky-950/20 hover:border-sky-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 flex items-center justify-between gap-3 text-xs cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <GitCompare className="h-4 w-4 text-sky-400 shrink-0" aria-hidden="true" />
                    <div>
                      <span className="font-semibold text-neutral-200 group-hover:text-cyan-300 transition-colors">
                        {c.title}
                      </span>
                      <span className="ml-2 font-mono text-[10px] uppercase text-neutral-400">
                        {c.category}
                      </span>
                      <p className="text-[11px] text-sky-300 mt-0.5">
                        {c.summaryChange}
                      </p>
                    </div>
                  </div>
                  <span className="rounded bg-sky-950 border border-sky-800 px-2 py-0.5 text-[10px] font-mono text-sky-300 shrink-0">
                    CHANGED
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </section>
  );
};
