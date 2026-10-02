import React from 'react';
import {
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Terminal,
  Clock,
  Globe
} from 'lucide-react';
import { DEMO_REPORT } from '../data/mockData';
import { FindingCard } from './FindingCard';

interface ReportPreviewCardProps {
  onViewFullReport: () => void;
}

export const ReportPreviewCard: React.FC<ReportPreviewCardProps> = ({ onViewFullReport }) => {
  // Grab the 4 iconic example findings specified in Section 9
  const previewFindings = [
    DEMO_REPORT.findings.find((f) => f.severity === 'critical')!,
    DEMO_REPORT.findings.find((f) => f.id === 'find-imp-1')!,
    DEMO_REPORT.findings.find((f) => f.id === 'find-impr-1')!,
    DEMO_REPORT.findings.find((f) => f.id === 'find-pass-1')!,
  ].filter(Boolean);

  return (
    <section
      id="report-preview-section"
      className="mt-16 sm:mt-24 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8"
      aria-label="Example Readiness Report Preview"
    >
      {/* Section Header */}
      <div className="text-center max-w-2xl mx-auto mb-8">
        <div className="inline-flex items-center gap-1.5 rounded-md border border-neutral-800 bg-neutral-900/80 px-2.5 py-1 text-xs font-mono text-cyan-400 mb-3">
          <Terminal className="h-3.5 w-3.5" />
          <span>Product Demo Output</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-100">
          Realistic Launch Readiness Report
        </h2>
        <p className="mt-2 text-sm text-neutral-400">
          Preview how technical, security, and SEO audit signals are synthesized into one definitive launch verdict.
        </p>
      </div>

      {/* Main Container Card */}
      <div className="relative rounded-2xl border border-neutral-800 bg-neutral-900/50 backdrop-blur-sm overflow-hidden shadow-2xl">
        {/* Prominent Demo Watermark Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-neutral-800 bg-neutral-950/80">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-amber-400" />
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-amber-300">
              Demo Preview • Static Sample Data
            </span>
          </div>
          <span className="text-[11px] font-mono text-neutral-400">
            Target: <code className="text-neutral-200">https://demo-launch-store.io</code>
          </span>
        </div>

        <div className="p-6 sm:p-8 space-y-8">
          {/* Header block with Overall Verdict */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-neutral-800">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-neutral-400 mb-1">
                <Globe className="h-3.5 w-3.5 text-neutral-400" />
                <span>Target: https://demo-launch-store.io</span>
                <span>•</span>
                <Clock className="h-3.5 w-3.5 text-neutral-400" />
                <span>Simulated scan timestamp: Just now</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                Website Readiness Status
              </h3>
            </div>

            {/* Verdict Badge */}
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-amber-500/40 bg-amber-950/40 px-4 py-2.5 flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-amber-400 shrink-0" />
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 block font-semibold">
                    Overall Verdict
                  </span>
                  <span className="text-base sm:text-lg font-extrabold tracking-tight text-amber-200">
                    REVIEW REQUIRED
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Summary counts bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-rose-900/50 bg-neutral-950/60 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-300">Critical</span>
                <AlertOctagon className="h-4 w-4 text-rose-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-rose-200">1</span>
                <span className="text-[11px] text-neutral-400">blocking issue</span>
              </div>
            </div>

            <div className="rounded-xl border border-amber-900/50 bg-neutral-950/60 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-300">Important</span>
                <AlertTriangle className="h-4 w-4 text-amber-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-amber-200">2</span>
                <span className="text-[11px] text-neutral-400">action items</span>
              </div>
            </div>

            <div className="rounded-xl border border-sky-900/50 bg-neutral-950/60 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-sky-300">Improvements</span>
                <Info className="h-4 w-4 text-sky-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-sky-200">2</span>
                <span className="text-[11px] text-neutral-400">recommended</span>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-900/50 bg-neutral-950/60 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-300">Passed</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-emerald-200">4</span>
                <span className="text-[11px] text-neutral-400">checks healthy</span>
              </div>
            </div>
          </div>

          {/* Sample Findings List */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-neutral-300 font-mono flex items-center gap-2">
                <span>Sample Audit Findings</span>
                <span className="text-[11px] font-normal text-neutral-400">(Click to expand diagnostic traces)</span>
              </h4>
              <span className="text-xs text-neutral-400 font-mono">Showing 4 of 9</span>
            </div>

            <div className="space-y-2.5">
              {previewFindings.map((finding, idx) => (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                  defaultExpanded={idx === 0}
                />
              ))}
            </div>
          </div>

          {/* Footer CTA to full report page */}
          <div className="pt-4 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-neutral-400 text-center sm:text-left">
              The full report provides category filters, remediation steps, and fix prioritization.
            </p>
            <button
              id="view-full-sample-report-btn"
              type="button"
              onClick={onViewFullReport}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 px-4 py-2.5 text-xs font-semibold text-white border border-neutral-700 transition-colors w-full sm:w-auto"
            >
              <span>Explore Full Interactive Report (/report/scan-demo-7492)</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
