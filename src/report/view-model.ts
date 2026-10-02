/**
 * Report Adapter & View-Model Builder (Phase 4)
 *
 * Strictly translates ScanResult and AuditResult into a presentation view-model.
 * Never mutates severity, never changes readiness, never fabricates missing facts.
 */

import { AuditResult, AuditFinding } from '../audit/types';
import { ScanResult } from '../scanner/types';
import { selectFixFirstFindings } from './fix-first';
import { generateLaunchChecklist } from './checklist';
import { ReportViewModel, EnrichedFinding, AuditSummaryMetrics, AuditCoverage, AuditSession } from './types';
import { calculateAuditCoverage, extractDiscoveredUrls, deduplicateAffectedResources } from './session';

function extractHostname(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname;
  } catch {
    return urlStr;
  }
}

export function buildReportViewModel(
  audit: AuditResult,
  scan?: ScanResult | null,
  session?: AuditSession | null
): ReportViewModel {
  const completedPages = scan?.pages?.filter((p) => p.http && p.http.statusCode >= 200 && p.http.statusCode < 400) ?? [];
  const pagesScanned =
    session?.allAnalyzedUrls?.length ??
    (scan?.summary?.pagesCompleted ??
      (completedPages.length > 0 ? completedPages.length : scan?.pages?.length ?? (audit.findings.length > 0 ? 1 : 0)));
  const requestsMade = scan?.summary?.requestsMade ?? (scan as any)?.requestsCount ?? pagesScanned;
  const bytesTransferred = scan?.summary?.totalBytesTransferred ?? 0;
  const durationMs = scan?.totalDurationMs ?? (scan as any)?.durationMs ?? 0;

  // Compute audit coverage
  let coverage: AuditCoverage;
  if (session?.coverage) {
    coverage = session.coverage;
  } else if (scan) {
    const discovered = extractDiscoveredUrls(scan);
    const hasSitemaps = Boolean(scan.sitemaps && scan.sitemaps.some((s) => s.exists));
    const hasExplicitDiscovered = Boolean(scan.discoveredUrls && scan.discoveredUrls.length > 0);
    const isComplete = hasSitemaps || hasExplicitDiscovered || discovered.length <= pagesScanned;
    coverage = calculateAuditCoverage(pagesScanned, discovered.length, isComplete);
  } else {
    coverage = calculateAuditCoverage(pagesScanned, pagesScanned, true);
  }

  const isPartial = Boolean(
    scan?.status === 'partial' ||
    (scan?.errors && scan.errors.length > 0 && scan.status !== 'completed')
  );

  const metrics: AuditSummaryMetrics = {
    totalChecksEvaluated: audit.counts.totalChecks,
    totalChecksPassed: audit.counts.passed,
    totalIssuesDetected:
      audit.counts.critical + audit.counts.important + audit.counts.improvement,
    criticalIssuesCount: audit.counts.critical,
    importantIssuesCount: audit.counts.important,
    improvementCount: audit.counts.improvement,
    pagesScannedCount: pagesScanned,
    requestsMadeCount: requestsMade,
    totalBytesTransferred: bytesTransferred,
    scanDurationMs: durationMs,
    isPartialScan: isPartial,
    partialScanReason: isPartial
      ? scan?.errors && scan.errors.length > 0
        ? scan.errors[0]?.message
        : 'Some resources or subpages could not be fetched completely.'
      : undefined,
  };

  // Enrich findings with safe affected URL arrays & counts & affected resources
  const enrichedFindings: EnrichedFinding[] = audit.findings.map((f: AuditFinding) => {
    const rawUrls = f.evidence.urls || [];
    const dedupedUrls = Array.from(new Set(rawUrls));
    const resources = deduplicateAffectedResources(f.evidence.resources);

    const baseCount = f.evidence.affectedCount ?? (dedupedUrls.length > 0 ? dedupedUrls.length : 1);
    const totalCount = f.severity === 'passed' ? 0 : Math.max(baseCount, resources.length, dedupedUrls.length);

    return {
      ...f,
      affectedUrls: dedupedUrls,
      affectedResources: resources.length > 0 ? resources : undefined,
      totalAffectedCount: totalCount,
    };
  });

  const fixFirst = selectFixFirstFindings(audit.findings, 6);
  const checklist = generateLaunchChecklist(audit);

  let statusText = 'Complete Audit';
  if (isPartial) {
    statusText = `Partial Scan (${coverage.status})`;
  } else if (scan?.status === 'failed') {
    statusText = 'Scan Failed';
  }

  const currentBatch = session?.batches.length || scan?.batchIndex || 1;
  const totalBatches = Math.max(currentBatch, Math.ceil(coverage.discoveredCount / 50));

  return {
    scanId: audit.scanId,
    url: audit.url,
    domain: extractHostname(audit.url),
    startedAt: scan?.startedAt || audit.generatedAt,
    completedAt: scan?.completedAt || audit.generatedAt,
    durationMs,
    readiness: audit.readiness,
    readinessReason: audit.readinessReason,
    counts: audit.counts,
    metrics,
    fixFirst,
    checklist,
    findings: enrichedFindings,
    unsupportedChecks: audit.unsupportedChecks,
    isPartial,
    statusText,
    coverage,
    session: session || undefined,
    currentBatch,
    totalBatches,
  };
}
