import React from 'react';
import {
  ArrowLeft,
  RefreshCw,
  Globe,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Copy,
  Check,
  FileDown,
  GitCompare,
  Layers,
  ShieldCheck,
  Info,
  ChevronRight
} from 'lucide-react';
import { ReadinessState, ScanReport } from '../../types';
import { AuditCoverage } from '../../report/types';
import { formatCoveragePercentage } from '../../report/session';

interface ReadinessHeaderProps {
  report: ScanReport;
  onBack: () => void;
  onSelectReportVariant?: (variant: 'REVIEW REQUIRED' | 'READY' | 'NOT READY') => void;
  onOpenReScan?: () => void;
  onContinueAudit?: () => void;
  onExportPdf?: () => void;
  hasComparison?: boolean;
  isComparing?: boolean;
  onToggleCompare?: () => void;
  isPartial?: boolean;
  partialReason?: string;
  coverage?: AuditCoverage;
  batchCount?: number;
}

export const ReadinessHeader: React.FC<ReadinessHeaderProps> = ({
  report,
  onBack,
  onSelectReportVariant,
  onOpenReScan,
  onContinueAudit,
  onExportPdf,
  hasComparison = false,
  isComparing = false,
  onToggleCompare,
  isPartial = false,
  partialReason,
  coverage,
  batchCount = 1,
}) => {
  const [copied, setCopied] = React.useState(false);
  const [isExportingPdf, setIsExportingPdf] = React.useState(false);

  const handleExport = async () => {
    if (!onExportPdf || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      await new Promise((r) => setTimeout(r, 60));
      onExportPdf();
    } finally {
      setIsExportingPdf(false);
    }
  };

  const getVerdictStyle = (readiness: ReadinessState) => {
    switch (readiness) {
      case 'READY':
        return {
          icon: CheckCircle2,
          border: 'border-emerald-500/50',
          bg: 'bg-emerald-950/40',
          text: 'text-emerald-200',
          badgeText: 'text-emerald-400',
          headline: 'READY TO SHIP',
          sub: 'No blocking issues detected across primary audit categories',
        };
      case 'REVIEW REQUIRED':
        return {
          icon: AlertTriangle,
          border: 'border-amber-500/50',
          bg: 'bg-amber-950/40',
          text: 'text-amber-200',
          badgeText: 'text-amber-400',
          headline: 'REVIEW REQUIRED',
          sub: 'Important technical items require attention before launch',
        };
      case 'NOT READY':
        return {
          icon: AlertOctagon,
          border: 'border-rose-500/50',
          bg: 'bg-rose-950/40',
          text: 'text-rose-200',
          badgeText: 'text-rose-400',
          headline: 'NOT READY TO SHIP',
          sub: 'Critical blockers detected that will cause launch failures',
        };
    }
  };

  const verdict = getVerdictStyle(report.readiness);
  const VerdictIcon = verdict.icon;

  const handleCopyUrl = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="readiness-header-wrapper" className="space-y-6">
      {/* Top action navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          id="back-to-home-btn"
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-mono text-neutral-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Return to Scanner</span>
        </button>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Comparison Toggle Button if previous scan exists */}
          {hasComparison && onToggleCompare && (
            <button
              type="button"
              onClick={onToggleCompare}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-mono transition-colors ${
                isComparing
                  ? 'border-cyan-500 bg-cyan-950/60 text-cyan-200'
                  : 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              <GitCompare className="h-3.5 w-3.5" />
              <span>{isComparing ? 'Close Comparison' : 'Compare vs Previous'}</span>
            </button>
          )}

          {/* Incremental Audit: Continue Audit Button */}
          {onContinueAudit && coverage && coverage.status !== 'FULL COVERAGE' && (
            <button
              type="button"
              onClick={onContinueAudit}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/80 bg-cyan-950/80 px-3.5 py-1.5 text-xs font-mono font-bold text-cyan-200 hover:bg-cyan-900 transition-colors shadow-md shadow-cyan-950/50"
              title="Audit next batch of up to 50 pages without rescanning completed pages"
            >
              <Layers className="h-3.5 w-3.5 text-cyan-400" />
              <span>Continue Audit (+{Math.min(50, coverage.remainingCount)} Pages)</span>
            </button>
          )}

          {/* Re-scan Website button (Fresh Scan) */}
          {onOpenReScan && (
            <button
              type="button"
              onClick={onOpenReScan}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700/80 bg-neutral-900 px-3 py-1.5 text-xs font-mono text-neutral-300 hover:bg-neutral-800 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>New Scan</span>
            </button>
          )}

          {/* PDF Export button */}
          {onExportPdf && (
            <button
              type="button"
              disabled={isExportingPdf}
              onClick={handleExport}
              aria-busy={isExportingPdf}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs font-mono text-neutral-200 hover:bg-neutral-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              <FileDown className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
              <span>{isExportingPdf ? 'Generating PDF...' : 'Export PDF Report'}</span>
            </button>
          )}

          {/* Share Report */}
          <button
            type="button"
            onClick={handleCopyUrl}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 transition-colors"
            title="Share report URL"
            aria-label="Share report URL to clipboard"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
            <span>{copied ? 'Copied' : 'Share'}</span>
          </button>
        </div>
      </div>

      {/* Audit Coverage Indicator Banner */}
      {coverage && (
        <div
          className={`rounded-xl border p-4 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            coverage.status === 'FULL COVERAGE'
              ? 'border-emerald-800/80 bg-emerald-950/40 text-emerald-200'
              : coverage.status === 'PARTIAL COVERAGE'
              ? 'border-amber-800/80 bg-amber-950/50 text-amber-200'
              : 'border-sky-800/80 bg-sky-950/40 text-sky-200'
          }`}
        >
          <div className="flex items-start gap-3">
            {coverage.status === 'FULL COVERAGE' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <Layers className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 font-mono font-bold tracking-wide">
                <span>{coverage.status}</span>
                <span className="text-neutral-400 font-normal">|</span>
                <span className="font-normal">
                  {coverage.analyzedCount} of {coverage.discoveredCount} pages analyzed ({coverage.percentageText || formatCoveragePercentage(coverage.analyzedCount, coverage.discoveredCount)})
                </span>
                {batchCount > 1 && (
                  <span className="px-1.5 py-0.2 rounded bg-neutral-900/60 border border-neutral-700/60 text-[10px]">
                    {batchCount} Batches
                  </span>
                )}
              </div>
              <p className="text-neutral-300 text-xs">
                {coverage.message}
              </p>
            </div>
          </div>

          {onContinueAudit && coverage.status !== 'FULL COVERAGE' && (
            <button
              type="button"
              onClick={onContinueAudit}
              className="inline-flex items-center gap-1 font-mono text-xs font-bold text-amber-300 hover:text-white px-3 py-1.5 rounded-lg border border-amber-600/70 bg-amber-900/50 hover:bg-amber-800/70 self-start sm:self-auto transition-colors"
            >
              <span>Continue Audit</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Partial Scan Warning Banner (if no coverage banner rendered) */}
      {!coverage && isPartial && (
        <div className="rounded-xl border border-amber-800 bg-amber-950/50 p-4 text-xs flex items-start gap-3 text-amber-200">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold tracking-wide uppercase font-mono">
              PARTIAL SCAN: INCOMPLETE COVERAGE
            </span>
            <p className="text-amber-300/90 text-xs">
              {partialReason || 'Some pages or subresources could not be fully analyzed. Results represent observable same-origin pages within crawler limits.'}
            </p>
          </div>
        </div>
      )}

      {/* Demo watermark banner (only when isDemo is true) */}
      {report.isDemo && onSelectReportVariant && (
        <div className="rounded-xl border border-amber-900/60 bg-amber-950/30 p-3.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-200">
          <div className="flex items-center gap-2.5">
            <Info className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              <strong>STATIC DEMO REPORT:</strong> Previewing the interactive QA architecture with synthetic test fixtures.
            </span>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-[11px] self-end sm:self-auto">
            <span className="text-neutral-400">Preview State:</span>
            {(['REVIEW REQUIRED', 'READY', 'NOT READY'] as ReadinessState[]).map((state) => (
              <button
                key={state}
                type="button"
                onClick={() => onSelectReportVariant(state)}
                className={`px-2 py-0.5 rounded border transition-colors ${
                  report.readiness === state
                    ? 'border-amber-400 bg-amber-900/40 text-white font-bold'
                    : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {state.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Primary Report Metadata Header */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-neutral-400">
              <span className="inline-flex items-center gap-1 text-cyan-400">
                <Globe className="h-3.5 w-3.5" />
                <span>Target:</span>
              </span>
              <span className="text-neutral-200 font-semibold break-all">{report.url}</span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <span>{new Date(report.timestamp).toLocaleString()}</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <span>Website Readiness Report</span>
              {!report.isDemo && (
                <span className="text-xs font-mono font-medium px-2.5 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300">
                  {batchCount > 1 ? `Cumulative Audit (${batchCount} Batches)` : 'Live Audit'}
                </span>
              )}
            </h1>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-mono text-neutral-400">
              <span className="rounded bg-neutral-950 border border-neutral-800 px-2 py-0.5">
                Report ID: <span className="text-neutral-200">{report.id}</span>
              </span>
              <span className="rounded bg-neutral-950 border border-neutral-800 px-2 py-0.5">
                HTTP Status: <span className="text-emerald-400">{report.httpStatus || 200} OK</span>
              </span>
              <span className="rounded bg-neutral-950 border border-neutral-800 px-2 py-0.5">
                Duration: <span className="text-neutral-200">{((report.scanDurationMs || 3420) / 1000).toFixed(2)}s</span>
              </span>
              <span className="rounded bg-neutral-950 border border-neutral-800 px-2 py-0.5">
                Checks Evaluated: <span className="text-neutral-200">{report.totalChecks || 24}</span>
              </span>
              {coverage && (
                <span className="rounded bg-neutral-950 border border-neutral-800 px-2 py-0.5">
                  Coverage: <span className={coverage.status === 'FULL COVERAGE' ? 'text-emerald-400' : 'text-amber-400'}>{coverage.status}</span>
                </span>
              )}
            </div>
          </div>

          {/* Large Overall Verdict Card */}
          <div
            className={`rounded-xl border ${verdict.border} ${verdict.bg} p-5 flex items-center gap-4 lg:min-w-[320px] shadow-lg`}
          >
            <div className="p-3 rounded-lg bg-neutral-950/80 border border-neutral-800 shrink-0">
              <VerdictIcon className={`h-8 w-8 ${verdict.badgeText}`} />
            </div>

            <div>
              <span className={`text-[10px] font-mono uppercase tracking-wider font-bold block ${verdict.badgeText}`}>
                Launch Verdict
              </span>
              <span className={`text-xl sm:text-2xl font-extrabold tracking-tight block ${verdict.text}`}>
                {verdict.headline}
              </span>
              <span className="text-[11px] text-neutral-300 leading-tight block mt-0.5">
                {verdict.sub}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
