/**
 * Audit Summary Section Component (Phase 4)
 *
 * Displays transparent, factual audit telemetry:
 * - Checks evaluated
 * - Checks passed
 * - Issues found
 * - Pages analyzed
 * - Total requests made
 * - Total bytes transferred
 * - Scan duration
 */

import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Layers,
  Clock,
  HardDrive,
  Activity,
  ShieldCheck
} from 'lucide-react';
import { AuditSummaryMetrics } from '../../report/types';

interface AuditSummarySectionProps {
  metrics: AuditSummaryMetrics;
  scanId: string;
  url: string;
}

export const AuditSummarySection: React.FC<AuditSummarySectionProps> = ({
  metrics,
  scanId,
  url,
}) => {
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const statCards = [
    {
      label: 'Checks Evaluated',
      value: metrics.totalChecksEvaluated,
      desc: 'Registered audit rules',
      icon: ShieldCheck,
      color: 'text-cyan-400',
    },
    {
      label: 'Checks Passed',
      value: metrics.totalChecksPassed,
      desc: 'Validated safe for launch',
      icon: CheckCircle2,
      color: 'text-emerald-400',
    },
    {
      label: 'Issues Found',
      value: metrics.totalIssuesDetected,
      desc: `${metrics.criticalIssuesCount} critical, ${metrics.importantIssuesCount} important`,
      icon: AlertTriangle,
      color: metrics.criticalIssuesCount > 0 ? 'text-rose-400' : 'text-amber-400',
    },
    {
      label: 'Pages Analyzed',
      value: metrics.pagesScannedCount,
      desc: 'Same-origin crawl depth',
      icon: Layers,
      color: 'text-neutral-200',
    },
    {
      label: 'Network Requests',
      value: metrics.requestsMadeCount,
      desc: 'Bounded HTTP queries',
      icon: Activity,
      color: 'text-neutral-200',
    },
    {
      label: 'Data Transferred',
      value: formatBytes(metrics.totalBytesTransferred),
      desc: 'Compressed payload',
      icon: HardDrive,
      color: 'text-neutral-200',
    },
    {
      label: 'Scan Duration',
      value: `${(metrics.scanDurationMs / 1000).toFixed(2)}s`,
      desc: 'End-to-end execution',
      icon: Clock,
      color: 'text-cyan-400',
    },
    {
      label: 'Audit Engine',
      value: 'Deterministic',
      desc: 'Zero AI, pure verifiable logic',
      icon: FileCode,
      color: 'text-emerald-400',
    },
  ];

  return (
    <section
      id="audit-summary-section"
      className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5 sm:p-6 space-y-5"
      aria-label="Audit Telemetry Summary"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-800">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-400" aria-hidden="true" />
            <span>Audit Execution &amp; Coverage Telemetry</span>
          </h2>
          <p className="text-xs text-neutral-400 font-mono mt-0.5">
            Target: {url} • Session ID: {scanId}
          </p>
        </div>

        {metrics.isPartialScan && (
          <div className="rounded-lg border border-amber-800/80 bg-amber-950/40 px-3 py-1 text-xs font-mono text-amber-300">
            Partial Scan: {metrics.partialScanReason || 'Coverage was bounded'}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="p-3.5 rounded-lg border border-neutral-800/90 bg-neutral-950/70 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-neutral-400 mb-2">
                <span className="text-[11px] font-mono uppercase tracking-wider">{card.label}</span>
                <Icon className={`h-4 w-4 ${card.color}`} aria-hidden="true" />
              </div>
              <div className="space-y-0.5">
                <span className={`text-xl sm:text-2xl font-bold font-mono ${card.color}`}>
                  {card.value}
                </span>
                <p className="text-[10px] text-neutral-400 truncate">{card.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
