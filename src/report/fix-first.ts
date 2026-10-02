/**
 * Deterministic Fix First Priority Selector (Phase 4)
 *
 * Selects and orders top-priority action items using strict, deterministic criteria:
 * 1. Existing Phase 3 priority metadata (if available on finding.evidence.technicalData?.priority)
 * 2. Severity tier: Critical first, then Important
 * 3. Affected page/resource volume: Higher affected count prioritized first
 * 4. Deterministic stable tie-breaker: checkId, then finding.id alphabetically
 *
 * Strictly NO AI, NO random weights, NO subjective ranking.
 */

import { AuditFinding, FindingSeverity } from '../audit/types';
import { FixFirstItem } from './types';

const SEVERITY_WEIGHT: Record<FindingSeverity, number> = {
  critical: 300,
  important: 200,
  improvement: 100,
  passed: 0,
};

export function selectFixFirstFindings(
  findings: AuditFinding[],
  maxItems: number = 6
): FixFirstItem[] {
  // Only critical and important issues qualify for Fix First
  const actionables = findings.filter(
    (f) => f.severity === 'critical' || f.severity === 'important'
  );

  if (actionables.length === 0) {
    return [];
  }

  // Deterministic sorting
  const sorted = [...actionables].sort((a, b) => {
    // 1. Explicit Phase 3 priority metadata if attached to technicalData
    const aPriority = typeof a.evidence.technicalData?.priority === 'number'
      ? (a.evidence.technicalData.priority as number)
      : null;
    const bPriority = typeof b.evidence.technicalData?.priority === 'number'
      ? (b.evidence.technicalData.priority as number)
      : null;

    if (aPriority !== null && bPriority !== null && aPriority !== bPriority) {
      return bPriority - aPriority; // higher number = higher priority
    }
    if (aPriority !== null && bPriority === null) return -1;
    if (aPriority === null && bPriority !== null) return 1;

    // 2. Severity rank (critical > important)
    const sevDiff = SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
    if (sevDiff !== 0) {
      return sevDiff;
    }

    // 3. Impact / Affected count (higher affected count first)
    const aCount = a.evidence.affectedCount ?? a.evidence.urls?.length ?? 1;
    const bCount = b.evidence.affectedCount ?? b.evidence.urls?.length ?? 1;
    if (bCount !== aCount) {
      return bCount - aCount;
    }

    // 4. Stable deterministic tie-breaker: checkId then id
    if (a.checkId !== b.checkId) {
      return a.checkId.localeCompare(b.checkId);
    }
    return a.id.localeCompare(b.id);
  });

  return sorted.slice(0, maxItems).map((f, index) => ({
    id: f.id,
    checkId: f.checkId,
    category: f.category,
    severity: f.severity,
    title: f.title,
    recommendation: f.recommendation,
    affectedCount: f.evidence.affectedCount ?? f.evidence.urls?.length ?? 1,
    sampleUrl: f.evidence.urls?.[0],
    rank: index + 1,
  }));
}
