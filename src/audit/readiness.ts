/**
 * Deterministic Readiness Engine (Phase 3)
 *
 * Computes transparent, mathematical readiness status:
 * - NOT READY: >= 1 Critical finding
 * - REVIEW REQUIRED: 0 Critical, >= 1 Important finding
 * - READY: 0 Critical, 0 Important findings (only Improvement / Passed)
 */

import { AuditFinding, ReadinessState, AuditSummaryCounts } from './types';

export interface ReadinessEvaluation {
  status: ReadinessState;
  reason: string;
  summary: AuditSummaryCounts;
}

export class ReadinessCalculator {
  public static evaluate(findings: AuditFinding[]): ReadinessEvaluation {
    let critical = 0;
    let important = 0;
    let improvement = 0;
    let passed = 0;

    for (const f of findings) {
      if (f.severity === 'critical') critical++;
      else if (f.severity === 'important') important++;
      else if (f.severity === 'improvement') improvement++;
      else if (f.severity === 'passed') passed++;
    }

    const summary: AuditSummaryCounts = {
      critical,
      important,
      improvement,
      passed,
      totalChecks: findings.length,
    };

    if (critical > 0) {
      const topCritical = findings.find((f) => f.severity === 'critical');
      return {
        status: 'NOT READY',
        reason: `${critical} critical blocker${critical > 1 ? 's' : ''} detected (${topCritical?.title || 'Site-blocking issues'}). Must be resolved before public launch.`,
        summary,
      };
    }

    if (important > 0) {
      const topImportant = findings.find((f) => f.severity === 'important');
      return {
        status: 'REVIEW REQUIRED',
        reason: `0 critical blockers found, but ${important} important quality issue${important > 1 ? 's' : ''} require attention (${topImportant?.title || 'SEO or accessibility gaps'}).`,
        summary,
      };
    }

    return {
      status: 'READY',
      reason: 'Zero critical blockers or important defects detected. Site satisfies core launch and QA readiness standards.',
      summary,
    };
  }
}
