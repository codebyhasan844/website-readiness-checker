/**
 * Phase 4: Premium Report & User Experience Data Types
 *
 * Provides view-model structures, comparison contracts, and dynamic checklist models
 * strictly derived from Phase 2 ScanResult and Phase 3 AuditResult.
 */

import { FindingCategory, FindingSeverity, ReadinessState, AuditFinding, AuditResult, AffectedResource } from '../audit/types';
import { ScanResult } from '../scanner/types';

export type CoverageStatus = 'FULL COVERAGE' | 'PARTIAL COVERAGE' | 'LIMITED COVERAGE';

export interface AuditCoverage {
  status: CoverageStatus;
  analyzedCount: number;
  discoveredCount: number;
  remainingCount: number;
  isCompleteInventory: boolean;
  message: string;
  percentageText?: string;
}

export interface AuditBatch {
  batchIndex: number;
  scanId: string;
  startedAt: string;
  completedAt: string;
  analyzedUrls: string[];
  pageCount: number;
  status: 'completed' | 'partial' | 'failed';
  error?: string;
}

export interface AuditSession {
  sessionId: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  batches: AuditBatch[];
  allDiscoveredUrls: string[];
  allAnalyzedUrls: string[];
  allAttemptedUrls?: string[];
  coverage: AuditCoverage;
}

export interface EnrichedFinding extends AuditFinding {
  affectedUrls: string[];
  affectedResources?: AffectedResource[];
  totalAffectedCount: number;
}

export interface FixFirstItem {
  id: string;
  checkId: string;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  recommendation: string;
  affectedCount: number;
  sampleUrl?: string;
  rank: number;
}

export interface LaunchChecklistItem {
  id: string;
  title: string;
  category: FindingCategory;
  severity: FindingSeverity;
  status: 'pending' | 'resolved';
  recommendation: string;
  affectedCount: number;
}

export interface AuditSummaryMetrics {
  totalChecksEvaluated: number;
  totalChecksPassed: number;
  totalIssuesDetected: number;
  criticalIssuesCount: number;
  importantIssuesCount: number;
  improvementCount: number;
  pagesScannedCount: number;
  requestsMadeCount: number;
  totalBytesTransferred: number;
  scanDurationMs: number;
  isPartialScan: boolean;
  partialScanReason?: string;
}

export interface ReportViewModel {
  scanId: string;
  url: string;
  domain: string;
  startedAt: string;
  completedAt?: string;
  durationMs: number;
  readiness: ReadinessState;
  readinessReason: string;
  counts: {
    critical: number;
    important: number;
    improvement: number;
    passed: number;
    totalChecks: number;
  };
  metrics: AuditSummaryMetrics;
  fixFirst: FixFirstItem[];
  checklist: LaunchChecklistItem[];
  findings: EnrichedFinding[];
  unsupportedChecks: AuditResult['unsupportedChecks'];
  isPartial: boolean;
  statusText: string;
  coverage: AuditCoverage;
  session?: AuditSession;
  currentBatch?: number;
  totalBatches?: number;
}

export interface FindingChangeDetail {
  checkId: string;
  title: string;
  category: FindingCategory;
  previousSeverity: FindingSeverity;
  currentSeverity: FindingSeverity;
  previousAffectedCount: number;
  currentAffectedCount: number;
  summaryChange: string;
}

export interface AuditComparisonResult {
  hasPrevious: boolean;
  previousScanId?: string;
  currentScanId: string;
  previousDate?: string;
  currentDate: string;
  previousCounts?: {
    critical: number;
    important: number;
    improvement: number;
    passed: number;
  };
  currentCounts: {
    critical: number;
    important: number;
    improvement: number;
    passed: number;
  };
  resolved: AuditFinding[];
  stillOpen: AuditFinding[];
  newFindings: AuditFinding[];
  changed: FindingChangeDetail[];
}
