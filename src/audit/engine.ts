/**
 * Deterministic Audit Engine (Phase 3 Core)
 *
 * Consumes structured ScanResult from Phase 2, executes registered checks,
 * and produces a transparent, evidence-backed AuditResult.
 *
 * Strictly pure logic: Zero network requests, zero crawling, zero AI/LLMs.
 */

import { ScanResult } from '../scanner/types';
import { AuditResult, AuditFinding, AuditCheck } from './types';
import { defaultAuditRegistry, AuditRegistry } from './registry';
import { UNSUPPORTED_CHECKS } from './checks';
import { ReadinessCalculator } from './readiness';
import { ScanReport, Finding } from '../types';

export class AuditEngine {
  /**
   * Executes all registered audit rules on raw scan data.
   */
  public static runAudit(
    scan: ScanResult,
    registry: AuditRegistry = defaultAuditRegistry
  ): AuditResult {
    const checks: AuditCheck[] = registry.getAllChecks();
    const allFindings: AuditFinding[] = [];

    // Deterministically evaluate each registered check
    for (const check of checks) {
      try {
        const checkFindings = check.evaluate(scan);
        if (checkFindings.length === 0) {
          allFindings.push({
            id: `pass-${check.id}`,
            checkId: check.id,
            category: check.category,
            severity: 'passed',
            title: check.name,
            evidence: {
              summary: 'Check evaluated: no applicable defects or issues detected.',
              affectedCount: 0,
            },
            explanation: check.description,
            whyItMatters: 'Preserves deterministic audit evaluation across all registered checks.',
            recommendation: 'No action required.',
            confidence: 'high',
          });
        } else {
          for (const f of checkFindings) {
            allFindings.push(f);
          }
        }
      } catch (err: unknown) {
        // Defensive resilience: If a rule throws unexpectedly, capture it without crashing
        allFindings.push({
          id: `err-${check.id}`,
          checkId: check.id,
          category: check.category,
          severity: 'improvement',
          title: check.name,
          evidence: {
            summary: `Audit check encountered an unexpected error: ${err instanceof Error ? err.message : String(err)}`,
            affectedCount: 1,
          },
          explanation: 'Check could not complete deterministic evaluation.',
          whyItMatters: 'Ensures audit process remains transparent when edge-case markup is encountered.',
          recommendation: 'Check page markup and structure.',
          confidence: 'low',
        });
      }
    }

    // Sort findings deterministically: critical -> important -> improvement -> passed
    const severityOrder = { critical: 0, important: 1, improvement: 2, passed: 3 };
    allFindings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    // Calculate readiness status and counts
    const readinessEval = ReadinessCalculator.evaluate(allFindings);

    return {
      scanId: scan.scanId,
      url: scan.normalizedUrl || scan.inputUrl,
      readiness: readinessEval.status,
      readinessReason: readinessEval.reason,
      counts: readinessEval.summary,
      findings: allFindings,
      generatedAt: new Date().toISOString(),
      unsupportedChecks: UNSUPPORTED_CHECKS,
    };
  }

  /**
   * Maps an AuditResult to the ScanReport UI contract for seamless rendering in Phase 1 / Phase 4 UI.
   */
  public static toScanReport(audit: AuditResult, scan: ScanResult): ScanReport {
    const uiFindings: Finding[] = audit.findings.map((f) => {
      const rawUrls = f.evidence.urls || [];
      const dedupedUrls = Array.from(new Set(rawUrls));
      const resources = f.evidence.resources || [];
      const details = f.evidence.details ? `\n\n${f.evidence.details}` : '';
      const urlList = dedupedUrls.length > 0 ? ` [${dedupedUrls[0]}]` : '';

      return {
        id: f.id,
        severity: f.severity,
        category: f.category,
        title: f.title,
        evidence: `${f.evidence.summary}${details}${urlList}`,
        explanation: f.explanation,
        recommendation: f.recommendation,
        technicalDetails: f.whyItMatters,
        affectedUrl: dedupedUrls[0],
        affectedUrls: dedupedUrls,
        affectedResources: resources.length > 0 ? resources : undefined,
        totalAffectedCount:
          f.severity === 'passed'
            ? 0
            : Math.max(f.evidence.affectedCount ?? dedupedUrls.length, resources.length, dedupedUrls.length),
      };
    });

    return {
      id: audit.scanId,
      url: audit.url,
      timestamp: audit.generatedAt,
      readiness: audit.readiness,
      summary: {
        critical: audit.counts.critical,
        important: audit.counts.important,
        improvement: audit.counts.improvement,
        passed: audit.counts.passed,
      },
      findings: uiFindings,
      isDemo: false,
      scanDurationMs: scan.totalDurationMs,
      httpStatus: scan.pages[0]?.http.statusCode,
      totalChecks: audit.counts.totalChecks,
      rawScan: scan,
    };
  }
}

/**
 * Convenient standalone pure function export
 */
export function runAudit(scan: ScanResult, registry?: AuditRegistry): AuditResult {
  return AuditEngine.runAudit(scan, registry);
}

export function auditResultToScanReport(audit: AuditResult, scan: ScanResult): ScanReport {
  return AuditEngine.toScanReport(audit, scan);
}
