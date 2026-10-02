/**
 * Audit Engine Utilities & Finding Factory (Phase 3)
 */

import { AuditFinding, FindingCategory, FindingSeverity, FindingConfidence, AuditFindingEvidence } from './types';
import { KNOWLEDGE_CATALOG } from './knowledge/catalog';

export function createFinding(options: {
  checkId: string;
  category: FindingCategory;
  severity: FindingSeverity;
  evidence: AuditFindingEvidence;
  confidence?: FindingConfidence;
  customTitle?: string;
}): AuditFinding {
  const knowledge = KNOWLEDGE_CATALOG[options.checkId] || {
    title: options.customTitle || options.checkId,
    explanation: 'Evaluates website configuration against industry standards.',
    whyItMatters: 'Ensures optimal quality, safety, and performance for visitors.',
    recommendation: 'Review the technical configuration for this item.',
  };

  return {
    id: `finding-${options.checkId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    checkId: options.checkId,
    category: options.category,
    severity: options.severity,
    title: options.customTitle || knowledge.title,
    evidence: options.evidence,
    explanation: knowledge.explanation,
    whyItMatters: knowledge.whyItMatters,
    recommendation: knowledge.recommendation,
    confidence: options.confidence || 'high',
  };
}
