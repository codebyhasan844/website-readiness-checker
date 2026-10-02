/**
 * Audit & Rules Engine Type Contracts (Phase 3)
 *
 * Defines pure, deterministic types for audit checks, findings,
 * evidence structures, knowledge references, and readiness evaluation.
 */

import { ScanResult } from '../scanner/types';

export type FindingSeverity = 'critical' | 'important' | 'improvement' | 'passed';

export type FindingCategory =
  | 'technical'
  | 'crawlability'
  | 'seo'
  | 'assets'
  | 'performance'
  | 'security'
  | 'accessibility';

export type ReadinessState = 'READY' | 'REVIEW REQUIRED' | 'NOT READY';

export type FindingConfidence = 'high' | 'medium' | 'low';

export interface AffectedResource {
  resourceUrl: string;
  referencedFrom?: string;
  statusCode?: number | string;
  statusText?: string;
}

export interface AuditFindingEvidence {
  summary: string;
  details?: string;
  urls?: string[];
  affectedCount?: number;
  resources?: AffectedResource[];
  technicalData?: Record<string, unknown>;
}

export interface AuditFinding {
  id: string;
  checkId: string;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  evidence: AuditFindingEvidence;
  explanation: string;
  whyItMatters: string;
  recommendation: string;
  confidence: FindingConfidence;
}

export interface AuditSummaryCounts {
  critical: number;
  important: number;
  improvement: number;
  passed: number;
  totalChecks: number;
}

export interface UnsupportedCheck {
  id: string;
  name: string;
  category: FindingCategory;
  reason: string;
}

export interface AuditResult {
  scanId: string;
  url: string;
  readiness: ReadinessState;
  readinessReason: string;
  counts: AuditSummaryCounts;
  findings: AuditFinding[];
  generatedAt: string;
  unsupportedChecks: UnsupportedCheck[];
}

export interface AuditCheck {
  id: string;
  name: string;
  category: FindingCategory;
  description: string;
  evaluate: (scan: ScanResult) => AuditFinding[];
}
