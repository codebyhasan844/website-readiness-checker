/**
 * Incremental Audit Session Management (Phase 4.1)
 *
 * Implements session storage, batch tracking, and remaining URL calculation
 * for controlled multi-batch full-site audits.
 */

import { ScanResult } from '../scanner/types';
import { AuditSession } from './types';
import { UrlValidator } from '../scanner/url-validator';
import {
  createAuditSession as initSession,
  appendBatchToSession as addBatch,
  mergeScanResults,
  extractDiscoveredUrls,
  calculateAuditCoverage,
  deduplicateAffectedResources,
} from './session';

// In-memory session registry for browser session persistence
const sessionStore = new Map<string, AuditSession>();

/**
 * Retrieves an existing session by URL / session ID, or creates a new one.
 */
export function getOrCreateAuditSession(url: string, sessionId?: string): AuditSession {
  const key = sessionId || url;
  if (sessionStore.has(key)) {
    return sessionStore.get(key)!;
  }

  // Create empty initial session
  const newSession: AuditSession = {
    sessionId: key,
    url,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    batches: [],
    allDiscoveredUrls: [],
    allAnalyzedUrls: [],
    coverage: {
      status: 'LIMITED COVERAGE',
      analyzedCount: 0,
      discoveredCount: 0,
      remainingCount: 0,
      isCompleteInventory: false,
      message: 'Audit session initialized. Ready for batch analysis.',
    },
  };

  sessionStore.set(key, newSession);
  return newSession;
}

/**
 * Creates and registers a new audit session.
 */
export function createAuditSession(urlOrScan: string | ScanResult, initialScanId?: string): AuditSession {
  if (typeof urlOrScan === 'object') {
    const session = initSession(urlOrScan);
    sessionStore.set(session.sessionId, session);
    return session;
  }

  const key = initialScanId || urlOrScan;
  const newSession: AuditSession = {
    sessionId: key,
    url: urlOrScan,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    batches: [],
    allDiscoveredUrls: [],
    allAnalyzedUrls: [],
    coverage: {
      status: 'LIMITED COVERAGE',
      analyzedCount: 0,
      discoveredCount: 0,
      remainingCount: 0,
      isCompleteInventory: false,
      message: 'Audit session initialized.',
    },
  };
  sessionStore.set(key, newSession);
  return newSession;
}

/**
 * Appends a new scan batch to a session and updates the session store.
 */
export function appendBatchToSession(
  session: AuditSession,
  newScan: ScanResult,
  batchIndex?: number
): AuditSession {
  if (session.batches.length === 0) {
    const initialized = initSession(newScan);
    sessionStore.set(session.sessionId, initialized);
    return initialized;
  }

  const updated = addBatch(session, newScan);
  sessionStore.set(session.sessionId, updated);
  return updated;
}

/**
 * Computes remaining discovered URLs not yet analyzed in the session.
 */
export function getRemainingDiscoveredUrls(session: AuditSession): string[] {
  const baseCanonical = session.url;
  const canonicalize = (u: string) => UrlValidator.resolveAndNormalizeLink(u, baseCanonical) || u;
  const analyzedCanonicalSet = new Set(session.allAnalyzedUrls.map(canonicalize));

  const remaining: string[] = [];
  const seen = new Set<string>();

  for (const rawUrl of session.allDiscoveredUrls) {
    const canonical = canonicalize(rawUrl);
    if (!analyzedCanonicalSet.has(canonical) && !seen.has(canonical)) {
      seen.add(canonical);
      remaining.push(canonical);
    }
  }

  return remaining;
}

export {
  mergeScanResults,
  extractDiscoveredUrls,
  calculateAuditCoverage,
  deduplicateAffectedResources,
};
