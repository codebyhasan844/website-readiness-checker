/**
 * Deterministic Audit Comparison Engine (Phase 4)
 *
 * Compares two AuditResult instances (Previous vs Current) using stable check IDs
 * and measurable evidence.
 *
 * Classifications:
 * - Resolved: Check failed in previous, now passed (or no longer raised) in current.
 * - Still Open: Check fails in both previous and current with the same severity and impact.
 * - New: Check passed or was absent in previous, but now fails in current.
 * - Changed: Check fails in both, but severity changed or affected count / details changed.
 *
 * Strictly NO AI, NO heuristic guessing.
 */

import { AuditFinding, AuditResult } from '../audit/types';
import { AuditComparisonResult, FindingChangeDetail } from './types';

export function compareAuditResults(
  previous: AuditResult | null | undefined,
  current: AuditResult
): AuditComparisonResult {
  if (!previous) {
    return {
      hasPrevious: false,
      currentScanId: current.scanId,
      currentDate: current.generatedAt,
      currentCounts: {
        critical: current.counts.critical,
        important: current.counts.important,
        improvement: current.counts.improvement,
        passed: current.counts.passed,
      },
      resolved: [],
      stillOpen: current.findings.filter((f) => f.severity !== 'passed'),
      newFindings: [],
      changed: [],
    };
  }

  // Map non-passed findings by stable checkId
  const prevMap = new Map<string, AuditFinding>();
  for (const f of previous.findings) {
    if (f.severity !== 'passed') {
      prevMap.set(f.checkId, f);
    }
  }

  const currMap = new Map<string, AuditFinding>();
  for (const f of current.findings) {
    if (f.severity !== 'passed') {
      currMap.set(f.checkId, f);
    }
  }

  const resolved: AuditFinding[] = [];
  const stillOpen: AuditFinding[] = [];
  const newFindings: AuditFinding[] = [];
  const changed: FindingChangeDetail[] = [];

  // 1. Detect Resolved findings (in prev, not in current)
  for (const [checkId, prevFinding] of prevMap.entries()) {
    const currFinding = currMap.get(checkId);
    if (!currFinding) {
      resolved.push(prevFinding);
    }
  }

  // 2. Detect New, Still Open, or Changed findings
  for (const [checkId, currFinding] of currMap.entries()) {
    const prevFinding = prevMap.get(checkId);

    if (!prevFinding) {
      // Exists in current but was not failing in previous -> New
      newFindings.push(currFinding);
    } else {
      // Exists in both: check for meaningful changes
      const prevCount = prevFinding.evidence.affectedCount ?? prevFinding.evidence.urls?.length ?? 1;
      const currCount = currFinding.evidence.affectedCount ?? currFinding.evidence.urls?.length ?? 1;
      const severityChanged = prevFinding.severity !== currFinding.severity;
      const countChanged = prevCount !== currCount;

      if (severityChanged || countChanged) {
        changed.push({
          checkId,
          title: currFinding.title,
          category: currFinding.category,
          previousSeverity: prevFinding.severity,
          currentSeverity: currFinding.severity,
          previousAffectedCount: prevCount,
          currentAffectedCount: currCount,
          summaryChange: severityChanged
            ? `Severity shifted from ${prevFinding.severity.toUpperCase()} to ${currFinding.severity.toUpperCase()}`
            : `Affected items changed from ${prevCount} to ${currCount}`,
        });
      } else {
        stillOpen.push(currFinding);
      }
    }
  }

  return {
    hasPrevious: true,
    previousScanId: previous.scanId,
    currentScanId: current.scanId,
    previousDate: previous.generatedAt,
    currentDate: current.generatedAt,
    previousCounts: {
      critical: previous.counts.critical,
      important: previous.counts.important,
      improvement: previous.counts.improvement,
      passed: previous.counts.passed,
    },
    currentCounts: {
      critical: current.counts.critical,
      important: current.counts.important,
      improvement: current.counts.improvement,
      passed: current.counts.passed,
    },
    resolved,
    stillOpen,
    newFindings,
    changed,
  };
}
