/**
 * Core type contracts for Website Readiness Checker (Phase 1 Foundation)
 * 
 * Strict architectural separation:
 * 1. Scanner Engine (Data collection - future phase)
 * 2. Audit / Rules Engine (Evaluation & findings - future phase)
 * 3. Report UI (Structured findings display - Phase 1 UI)
 */

export type ScanState =
  | 'idle'
  | 'validating'
  | 'scanning'
  | 'completed'
  | 'failed';

export type FindingSeverity =
  | 'critical'
  | 'important'
  | 'improvement'
  | 'passed';

export type FindingCategory =
  | 'technical'
  | 'seo'
  | 'security'
  | 'performance'
  | 'accessibility'
  | 'crawlability'
  | 'assets';

export type ReadinessState =
  | 'READY'
  | 'REVIEW REQUIRED'
  | 'NOT READY';

export interface Finding {
  id: string;
  severity: FindingSeverity;
  category: FindingCategory;
  title: string;
  evidence?: string;
  explanation?: string;
  recommendation?: string;
  technicalDetails?: string;
  affectedUrl?: string;
  affectedUrls?: string[];
  affectedResources?: any[];
  totalAffectedCount?: number;
}

export interface ReportSummaryCounts {
  critical: number;
  important: number;
  improvement: number;
  passed: number;
}

export interface ScanReport {
  id: string;
  url: string;
  timestamp: string;
  readiness: ReadinessState;
  summary: ReportSummaryCounts;
  findings: Finding[];
  isDemo: boolean;
  scanDurationMs?: number;
  httpStatus?: number;
  totalChecks?: number;
  rawScan?: import('./scanner/types').ScanResult;
}

export interface ScanSimulationStep {
  id: string;
  stepNumber: number;
  label: string;
  description: string;
  status: 'waiting' | 'in_progress' | 'completed';
}

export type UIErrorType =
  | 'invalid_url'
  | 'scan_failed'
  | 'website_unreachable'
  | 'partial_result';
