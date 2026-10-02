import React, { useState, useMemo, useEffect } from 'react';
import { ReadinessState, FindingCategory, FindingSeverity, ScanReport } from '../../types';
import {
  DEMO_REPORT,
  DEMO_REPORT_READY,
  DEMO_REPORT_NOT_READY,
} from '../../data/mockData';
import { ReadinessHeader } from './ReadinessHeader';
import { SummaryCards } from './SummaryCards';
import { FixFirstSection } from './FixFirstSection';
import { ReportFilters } from './ReportFilters';
import { FindingList } from './FindingList';
import { RawScanDataViewer } from './RawScanDataViewer';
import { UnsupportedChecksSection } from './UnsupportedChecksSection';
import { LaunchChecklist } from './LaunchChecklist';
import { AuditSummarySection } from './AuditSummarySection';
import { ComparisonView } from './ComparisonView';
import { ReScanModal } from './ReScanModal';
import { ContinueAuditModal } from './ContinueAuditModal';
import { ScanResult } from '../../scanner/types';
import { runAudit, auditResultToScanReport } from '../../audit';
import { buildReportViewModel } from '../../report/view-model';
import { compareAuditResults } from '../../report/comparison';
import { generateAuditPdf } from '../../report/pdf-export';
import {
  getOrCreateAuditSession,
  createAuditSession,
  appendBatchToSession,
  getRemainingDiscoveredUrls,
  mergeScanResults,
} from '../../report/incremental';
import { ReportViewModel, AuditComparisonResult, AuditSession } from '../../report/types';
import { Activity, ShieldCheck, ArrowLeft, Loader2, GitCompare } from 'lucide-react';

interface ReportPageProps {
  scanId?: string;
  initialRawScan?: ScanResult | null;
  onNavigateHome: () => void;
}

export function getInitialScanForRoute(
  scanId: string | undefined,
  initialRawScan: ScanResult | null | undefined
): ScanResult | null {
  return scanId && initialRawScan?.scanId === scanId ? initialRawScan : null;
}

export function shouldFetchRouteScan(
  scanId: string | undefined,
  initialRawScan: ScanResult | null | undefined
): boolean {
  return Boolean(
    scanId &&
      !scanId.startsWith('scan-demo-') &&
      !getInitialScanForRoute(scanId, initialRawScan)
  );
}

export async function fetchRouteScan(
  scanId: string,
  fetcher: typeof fetch = fetch
): Promise<ScanResult> {
  const response = await fetcher(`/api/scan/${encodeURIComponent(scanId)}`);
  if (!response.ok) {
    throw new Error(`Scan lookup failed with status ${response.status}.`);
  }

  const scan = (await response.json()) as ScanResult;
  if (!scan || scan.scanId !== scanId) {
    throw new Error('The scan lookup returned a different scan.');
  }
  return scan;
}

export const ReportPage: React.FC<ReportPageProps> = ({
  scanId,
  initialRawScan,
  onNavigateHome,
}) => {
  const [reportState, setReportState] = useState<ReadinessState>('REVIEW REQUIRED');
  const [selectedCategory, setSelectedCategory] = useState<FindingCategory | 'all'>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<FindingSeverity | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);

  const matchingInitialScan = getInitialScanForRoute(scanId, initialRawScan);
  const [rawScanState, setRawScanState] = useState<{
    routeScanId: string | undefined;
    scan: ScanResult | null;
  }>(() => ({ routeScanId: scanId, scan: matchingInitialScan }));
  const rawScan =
    rawScanState.routeScanId === scanId
      ? rawScanState.scan || matchingInitialScan
      : matchingInitialScan;
  const setRawScan = (scan: ScanResult | null) => {
    setRawScanState({ routeScanId: scanId, scan });
  };
  const [previousScan, setPreviousScan] = useState<ScanResult | null>(null);
  const [loadingRawScan, setLoadingRawScan] = useState<boolean>(false);
  const [scanLoadError, setScanLoadError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'audit' | 'raw'>('audit');

  // Incremental Audit Session
  const [auditSession, setAuditSession] = useState<AuditSession | null>(null);

  // Re-scan and Comparison modal states
  const [isReScanOpen, setIsReScanOpen] = useState<boolean>(false);
  const [isContinueAuditOpen, setIsContinueAuditOpen] = useState<boolean>(false);
  const [showComparison, setShowComparison] = useState<boolean>(false);

  // Fetch real scan data if scanId is given and not a static demo
  useEffect(() => {
    if (matchingInitialScan) {
      setRawScanState((current) =>
        current.routeScanId === scanId && current.scan === matchingInitialScan
          ? current
          : { routeScanId: scanId, scan: matchingInitialScan }
      );
      setLoadingRawScan(false);
      setScanLoadError(null);
      return;
    }

    if (!scanId || !shouldFetchRouteScan(scanId, initialRawScan)) {
      setLoadingRawScan(false);
      setScanLoadError(null);
      return;
    }

    let isCurrentRequest = true;
    setLoadingRawScan(true);
    setScanLoadError(null);
    fetchRouteScan(scanId)
      .then((data) => {
        if (isCurrentRequest) {
          setRawScanState({ routeScanId: scanId, scan: data });
          setViewMode('audit');
        }
      })
      .catch(() => {
        if (isCurrentRequest) {
          setRawScanState({ routeScanId: scanId, scan: null });
          setScanLoadError('The requested scan result could not be loaded. It may have expired or been removed.');
        }
      })
      .finally(() => {
        if (isCurrentRequest) setLoadingRawScan(false);
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [scanId, initialRawScan, matchingInitialScan]);

  // Synchronize or initialize audit session with rawScan
  useEffect(() => {
    if (rawScan) {
      const targetUrl = rawScan.normalizedUrl || rawScan.inputUrl;
      const session = getOrCreateAuditSession(targetUrl, rawScan.scanId);
      if (session.batches.length === 0) {
        appendBatchToSession(session, rawScan, 1);
      }
      setAuditSession(session);
    }
  }, [rawScan?.scanId]);

  // Phase 3: Run deterministic audit on real scan data
  const realAuditResult = useMemo(() => {
    if (!rawScan) return null;
    return runAudit(rawScan);
  }, [rawScan]);


  const previousAuditResult = useMemo(() => {
    if (!previousScan) return null;
    return runAudit(previousScan);
  }, [previousScan]);

  const realAuditReport = useMemo(() => {
    if (!rawScan || !realAuditResult) return null;
    return auditResultToScanReport(realAuditResult, rawScan);
  }, [rawScan, realAuditResult]);

  // Active ScanReport for UI compatibility
  const activeReport: ScanReport = useMemo(() => {
    if (realAuditReport) return realAuditReport;
    if (reportState === 'READY') return DEMO_REPORT_READY;
    if (reportState === 'NOT READY') return DEMO_REPORT_NOT_READY;
    return DEMO_REPORT;
  }, [realAuditReport, reportState]);

  // Phase 4: Build unified ReportViewModel
  const reportViewModel: ReportViewModel = useMemo(() => {
    if (realAuditResult) {
      return buildReportViewModel(realAuditResult, rawScan, auditSession);
    }
    // Build view model from demo report
    return {
      scanId: activeReport.id,
      url: activeReport.url,
      domain: new URL(activeReport.url).hostname,
      startedAt: activeReport.timestamp,
      completedAt: activeReport.timestamp,
      durationMs: activeReport.scanDurationMs || 3420,
      readiness: activeReport.readiness,
      readinessReason:
        activeReport.readiness === 'READY'
          ? 'All 24 automated launch checks passed successfully.'
          : activeReport.readiness === 'NOT READY'
          ? 'Critical launch blockers detected that require immediate resolution.'
          : 'Important technical checks require review before public launch.',
      counts: {
        critical: activeReport.summary.critical,
        important: activeReport.summary.important,
        improvement: activeReport.summary.improvement,
        passed: activeReport.summary.passed,
        totalChecks: activeReport.totalChecks || 24,
      },
      metrics: {
        totalChecksEvaluated: activeReport.totalChecks || 24,
        totalChecksPassed: activeReport.summary.passed,
        totalIssuesDetected:
          activeReport.summary.critical +
          activeReport.summary.important +
          activeReport.summary.improvement,
        criticalIssuesCount: activeReport.summary.critical,
        importantIssuesCount: activeReport.summary.important,
        improvementCount: activeReport.summary.improvement,
        pagesScannedCount: 6,
        requestsMadeCount: 14,
        totalBytesTransferred: 485000,
        scanDurationMs: activeReport.scanDurationMs || 3420,
        isPartialScan: false,
      },
      fixFirst: activeReport.findings
        .filter((f) => f.severity === 'critical' || f.severity === 'important')
        .slice(0, 6)
        .map((f, i) => ({
          id: f.id,
          checkId: f.id,
          category: f.category,
          severity: f.severity,
          title: f.title,
          recommendation: f.recommendation || 'Review configuration',
          affectedCount: 1,
          rank: i + 1,
        })),
      checklist: [
        {
          id: 'chk-critical',
          title: activeReport.summary.critical > 0 ? 'Resolve Critical Launch Blockers' : 'All Critical Blockers Resolved',
          category: 'technical',
          severity: activeReport.summary.critical > 0 ? 'critical' : 'passed',
          status: activeReport.summary.critical > 0 ? 'pending' : 'resolved',
          recommendation: 'Fix high-impact issues before launch announcement.',
          affectedCount: activeReport.summary.critical,
        },
        {
          id: 'chk-indexing',
          title: 'Verify Robots.txt & Sitemap Indexing Directives',
          category: 'crawlability',
          severity: 'passed',
          status: 'resolved',
          recommendation: 'Crawl configuration conforms to standard search directives.',
          affectedCount: 0,
        },
        {
          id: 'chk-https',
          title: 'Review HTTPS & Security Headers',
          category: 'security',
          severity: activeReport.summary.important > 0 ? 'important' : 'passed',
          status: activeReport.summary.important > 0 ? 'pending' : 'resolved',
          recommendation: 'Configure HSTS, CSP, and X-Content-Type-Options.',
          affectedCount: 1,
        },
      ],
      findings: activeReport.findings.map((f) => ({
        id: f.id,
        checkId: f.id,
        category: f.category,
        severity: f.severity,
        title: f.title,
        evidence: { summary: f.evidence || '' },
        explanation: f.explanation || '',
        whyItMatters: f.explanation || '',
        recommendation: f.recommendation || '',
        confidence: 'high',
        affectedUrls: f.affectedUrl ? [f.affectedUrl] : [],
        totalAffectedCount: 1,
      })),
      unsupportedChecks: [],
      isPartial: false,
      statusText: 'Complete Audit Preview',
      coverage: {
        status: 'FULL COVERAGE',
        analyzedCount: 6,
        discoveredCount: 6,
        remainingCount: 0,
        isCompleteInventory: true,
        message: 'All 6 pages in inventory analyzed.',
      },
    };
  }, [realAuditResult, rawScan, auditSession, activeReport, reportState]);

  // Comparison between previous scan and current scan
  const comparisonResult: AuditComparisonResult = useMemo(() => {
    if (realAuditResult) {
      return compareAuditResults(previousAuditResult, realAuditResult);
    }
    // Demo comparison
    return {
      hasPrevious: Boolean(previousScan),
      currentScanId: activeReport.id,
      currentDate: activeReport.timestamp,
      currentCounts: {
        critical: activeReport.summary.critical,
        important: activeReport.summary.important,
        improvement: activeReport.summary.improvement,
        passed: activeReport.summary.passed,
      },
      resolved: [],
      stillOpen: [],
      newFindings: [],
      changed: [],
    };
  }, [realAuditResult, previousAuditResult, previousScan, activeReport]);

  const handleSelectReportVariant = (variant: ReadinessState) => {
    setReportState(variant);
    setSelectedCategory('all');
    setSelectedSeverity('all');
    setSearchQuery('');
  };

  // Re-scan complete callback (Fresh new scan)
  const handleReScanComplete = (newScan: ScanResult) => {
    if (rawScan) {
      setPreviousScan(rawScan);
    }
    const targetUrl = newScan.normalizedUrl || newScan.inputUrl;
    const freshSession = createAuditSession(targetUrl, newScan.scanId);
    appendBatchToSession(freshSession, newScan, 1);
    setAuditSession(freshSession);
    setRawScan(newScan);
    setViewMode('audit');
    setShowComparison(true);
  };

  // Continue Audit: Batch complete callback (Incremental merge)
  const handleBatchComplete = (newBatchScan: ScanResult) => {
    if (!rawScan) return;
    const targetUrl = rawScan.normalizedUrl || rawScan.inputUrl;
    const currentSession = auditSession || getOrCreateAuditSession(targetUrl, rawScan.scanId);
    const updatedSession = appendBatchToSession(
      currentSession,
      newBatchScan,
      currentSession.batches.length + 1
    );
    setAuditSession(updatedSession);
    const merged = mergeScanResults([rawScan, newBatchScan]);
    setRawScan(merged);
    setViewMode('audit');
  };

  // PDF Export
  const handleExportPdf = () => {
    generateAuditPdf(reportViewModel);
  };

  // Filter findings based on filters + search
  const filteredFindings = useMemo(() => {
    return activeReport.findings.filter((finding) => {
      if (selectedCategory !== 'all' && finding.category !== selectedCategory) {
        return false;
      }
      if (selectedSeverity !== 'all' && finding.severity !== selectedSeverity) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = finding.title.toLowerCase().includes(q);
        const matchesEvidence =
          (typeof finding.evidence === 'string'
            ? finding.evidence
            : (finding.evidence as any)?.summary || ''
          )
            .toLowerCase()
            .includes(q);
        const matchesRec = finding.recommendation?.toLowerCase().includes(q) || false;
        const matchesCat = finding.category.toLowerCase().includes(q);
        if (!matchesTitle && !matchesEvidence && !matchesRec && !matchesCat) {
          return false;
        }
      }
      return true;
    });
  }, [activeReport, selectedCategory, selectedSeverity, searchQuery]);

  const handleSelectFindingFromFixFirst = (id: string) => {
    setSelectedFindingId(id);
    setSelectedSeverity('all');
    setSelectedCategory('all');
    const elem = document.getElementById(`finding-card-${id}`);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div id="report-view-container" className="min-h-screen py-8 sm:py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-800">
          <button
            type="button"
            onClick={onNavigateHome}
            className="inline-flex items-center gap-2 text-xs font-mono text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Checker Homepage</span>
          </button>

          {rawScan && (
            <div className="inline-flex items-center p-1 rounded-lg bg-neutral-900 border border-neutral-800 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('audit')}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all ${
                  viewMode === 'audit'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Audit Report ({activeReport.findings.length} Checks)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('raw')}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all ${
                  viewMode === 'raw'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Activity className="h-3.5 w-3.5" />
                <span>Raw Scanner Facts ({rawScan.pages.length} Pages)</span>
              </button>
            </div>
          )}
        </div>

        {loadingRawScan ? (
          <div className="flex flex-col items-center justify-center py-20 text-neutral-400 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
            <p className="text-sm font-mono">Loading scanner telemetry and evaluating audit rules...</p>
          </div>
        ) : scanId && !scanId.startsWith('scan-demo-') && !rawScan ? (
          <div role="alert" className="mx-auto max-w-xl py-20 text-center space-y-4">
            <h1 className="text-xl font-semibold text-white">Scan result unavailable</h1>
            <p className="text-sm text-neutral-400">
              {scanLoadError || 'The requested scan result could not be loaded. It may have expired or been removed.'}
            </p>
            <button
              type="button"
              onClick={onNavigateHome}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
            >
              <ArrowLeft className="h-4 w-4" />
              Return to checker
            </button>
          </div>
        ) : viewMode === 'raw' && rawScan ? (
          <RawScanDataViewer scan={rawScan} />
        ) : (
          <div className="space-y-8">
            {/* 1. Readiness Header with Re-scan, Continue Audit & PDF Actions */}
            <ReadinessHeader
              report={activeReport}
              onBack={onNavigateHome}
              onSelectReportVariant={handleSelectReportVariant}
              onOpenReScan={() => setIsReScanOpen(true)}
              onContinueAudit={() => setIsContinueAuditOpen(true)}
              onExportPdf={handleExportPdf}
              hasComparison={Boolean(previousScan)}
              isComparing={showComparison}
              onToggleCompare={() => setShowComparison(!showComparison)}
              isPartial={reportViewModel.isPartial}
              partialReason={reportViewModel.metrics.partialScanReason}
              coverage={reportViewModel.coverage}
              batchCount={auditSession?.batches.length || 1}
            />

            {/* Comparison Section (when enabled or after re-scan) */}
            {showComparison && (
              <ComparisonView
                comparison={comparisonResult}
                onSelectFinding={handleSelectFindingFromFixFirst}
              />
            )}

            {/* 2. Summary Cards Bar */}
            <SummaryCards
              summary={activeReport.summary}
              selectedSeverity={selectedSeverity}
              onSelectSeverity={setSelectedSeverity}
            />

            {/* 3. Fix First Priority Section */}
            <FixFirstSection
              items={reportViewModel.fixFirst}
              onSelectFinding={handleSelectFindingFromFixFirst}
            />

            {/* 4. Launch Checklist ("Before You Launch") */}
            <LaunchChecklist
              items={reportViewModel.checklist}
              onSelectCategory={(cat) => setSelectedCategory(cat as FindingCategory)}
            />

            {/* 5. Category & Severity Filters */}
            <ReportFilters
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              selectedSeverity={selectedSeverity}
              onSelectSeverity={setSelectedSeverity}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              totalFindingsCount={activeReport.findings.length}
              filteredFindingsCount={filteredFindings.length}
            />

            {/* 6. Finding List */}
            <FindingList
              findings={filteredFindings}
              selectedFindingId={selectedFindingId}
            />

            {/* 7. Audit Summary Telemetry */}
            <AuditSummarySection
              metrics={reportViewModel.metrics}
              scanId={reportViewModel.scanId}
              url={reportViewModel.url}
            />

            {/* 8. Documented Unsupported Checks */}
            {realAuditResult && (
              <UnsupportedChecksSection
                unsupportedChecks={realAuditResult.unsupportedChecks}
              />
            )}
          </div>
        )}
      </div>

      {/* Re-scan Modal (Fresh Scan) */}
      <ReScanModal
        url={activeReport.url}
        isOpen={isReScanOpen}
        onClose={() => setIsReScanOpen(false)}
        onScanComplete={handleReScanComplete}
      />

      {/* Incremental Continue Audit Modal */}
      {rawScan && (
        <ContinueAuditModal
          url={reportViewModel.url}
          isOpen={isContinueAuditOpen}
          onClose={() => setIsContinueAuditOpen(false)}
          onBatchComplete={handleBatchComplete}
          coverage={reportViewModel.coverage}
          currentBatchIndex={auditSession?.batches.length || rawScan.batchIndex || 1}
          sessionId={auditSession?.sessionId || rawScan.scanId}
          alreadyScannedUrls={auditSession ? auditSession.allAnalyzedUrls : rawScan.pages
            .filter((page) => page.http.statusCode >= 200 && page.http.statusCode < 400)
            .map((page) => page.normalizedUrl)}
          remainingUrls={auditSession ? getRemainingDiscoveredUrls(auditSession) : (rawScan.remainingUrls || [])}
          allDiscoveredUrls={auditSession?.allDiscoveredUrls || rawScan.discoveredUrls}
        />
      )}
    </div>
  );
};
