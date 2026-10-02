/**
 * Phase 4.1: Audit Session & Incremental Audit Engine
 *
 * Governs multi-batch incremental audits, cumulative coverage metrics,
 * and finding aggregation without duplicate re-scanning or fabricated data.
 */

import { ScanResult, PageScanResult } from '../scanner/types';
import { AuditResult, AuditFinding, AffectedResource } from '../audit/types';
import { runAudit } from '../audit';
import { AuditCoverage, AuditSession, AuditBatch, CoverageStatus } from './types';
import { UrlValidator } from '../scanner/url-validator';

/**
 * Formats coverage percentage with meaningful precision.
 * Always preserves 1 decimal place when fractional, and never displays 100%
 * if analyzedCount is strictly less than discoveredCount.
 */
export function formatCoveragePercentage(analyzedCount: number, discoveredCount: number): string {
  if (discoveredCount <= 0) return '100%';
  if (analyzedCount >= discoveredCount) return '100%';
  if (analyzedCount <= 0) return '0%';

  const raw = (analyzedCount / discoveredCount) * 100;
  let rounded = Number(raw.toFixed(1));
  if (rounded >= 100) {
    rounded = 99.9;
  }
  return `${rounded}%`;
}

/**
 * Calculates deterministic coverage status based on analyzed vs discovered page inventory.
 */
export function calculateAuditCoverage(
  analyzedCount: number,
  discoveredCount: number,
  isCompleteInventory = true
): AuditCoverage {
  const safeDiscovered = Math.max(discoveredCount, analyzedCount);
  const remainingCount = Math.max(0, safeDiscovered - analyzedCount);
  const percentageText = formatCoveragePercentage(analyzedCount, safeDiscovered);

  let status: CoverageStatus = 'PARTIAL COVERAGE';
  let message = `${analyzedCount} of ${safeDiscovered} discovered pages analyzed (${remainingCount} pages remaining).`;

  if (!isCompleteInventory) {
    status = 'LIMITED COVERAGE';
    message = `Limited coverage: ${analyzedCount} pages analyzed. Inventory could not be confirmed completely.`;
  } else if (remainingCount === 0 && safeDiscovered > 0) {
    status = 'FULL COVERAGE';
    message = `Full coverage: All ${safeDiscovered} discovered pages analyzed.`;
  }

  return {
    status,
    analyzedCount,
    discoveredCount: safeDiscovered,
    remainingCount,
    isCompleteInventory,
    message,
    percentageText,
  };
}

/**
 * Extracts all unique discovered URLs from a ScanResult.
 */
export function extractDiscoveredUrls(scan: ScanResult): string[] {
  const baseCanonical = scan.normalizedUrl || scan.inputUrl;
  const canonicalize = (u: string) => UrlValidator.resolveAndNormalizeLink(u, baseCanonical) || u;

  if (scan.discoveredUrls && scan.discoveredUrls.length > 0) {
    const result = new Set<string>();
    for (const u of scan.discoveredUrls) {
      if (u) result.add(canonicalize(u));
    }
    return Array.from(result);
  }

  const set = new Set<string>();
  if (scan.normalizedUrl) set.add(canonicalize(scan.normalizedUrl));

  if (Array.isArray(scan.pages)) {
    for (const page of scan.pages) {
      if (page?.normalizedUrl) set.add(canonicalize(page.normalizedUrl));
      if (Array.isArray(page?.links)) {
        for (const link of page.links) {
          if (link?.isInternal && link.normalizedDestination) {
            set.add(canonicalize(link.normalizedDestination));
          }
        }
      }
    }
  }

  if (Array.isArray(scan.sitemaps)) {
    for (const sitemap of scan.sitemaps) {
      if (Array.isArray(sitemap?.containedUrls)) {
        for (const u of sitemap.containedUrls) {
          if (u) set.add(canonicalize(u));
        }
      }
    }
  }

  return Array.from(set);
}

/**
 * Creates an initial AuditSession from the first scan batch.
 */
export function createAuditSession(firstScan: ScanResult): AuditSession {
  const sessionId = firstScan.sessionId || firstScan.scanId;
  const baseCanonical = firstScan.normalizedUrl || firstScan.inputUrl;
  const canonicalize = (u: string) => UrlValidator.resolveAndNormalizeLink(u, baseCanonical) || u;

  const discovered = extractDiscoveredUrls(firstScan);
  const completedPages = firstScan.pages.filter(
    (p) => p.http && p.http.statusCode >= 200 && p.http.statusCode < 400
  );
  const analyzed = Array.from(new Set(completedPages.map((p) => canonicalize(p.normalizedUrl))));
  const attempted = Array.from(new Set(firstScan.pages.map((p) => canonicalize(p.normalizedUrl))));
  const hasSitemaps = Boolean(firstScan.sitemaps && firstScan.sitemaps.some((s) => s.exists));
  const hasExplicitDiscovered = Boolean(firstScan.discoveredUrls && firstScan.discoveredUrls.length > 0);
  const isComplete = hasSitemaps || hasExplicitDiscovered || discovered.length <= analyzed.length;

  const coverage = calculateAuditCoverage(analyzed.length, discovered.length, isComplete);

  const initialBatch: AuditBatch = {
    batchIndex: firstScan.batchIndex || 1,
    scanId: firstScan.scanId,
    startedAt: firstScan.startedAt,
    completedAt: firstScan.completedAt || new Date().toISOString(),
    analyzedUrls: analyzed,
    pageCount: analyzed.length,
    status: firstScan.status === 'failed' ? 'failed' : 'completed',
    error: firstScan.errors?.[0]?.message,
  };

  return {
    sessionId,
    url: baseCanonical,
    createdAt: firstScan.startedAt,
    updatedAt: firstScan.completedAt || new Date().toISOString(),
    batches: [initialBatch],
    allDiscoveredUrls: discovered,
    allAnalyzedUrls: analyzed,
    allAttemptedUrls: attempted,
    coverage,
  };
}

/**
 * Appends a newly completed batch to an existing AuditSession.
 */
export function appendBatchToSession(session: AuditSession, newScan: ScanResult): AuditSession {
  const baseCanonical = session.url;
  const canonicalize = (u: string) => UrlValidator.resolveAndNormalizeLink(u, baseCanonical) || u;

  const newDiscovered = extractDiscoveredUrls(newScan);
  const combinedDiscovered = Array.from(
    new Set([...session.allDiscoveredUrls, ...newDiscovered].map(canonicalize))
  );

  const completedPages = newScan.pages.filter(
    (p) => p.http && p.http.statusCode >= 200 && p.http.statusCode < 400
  );
  const newAnalyzed = completedPages.map((p) => canonicalize(p.normalizedUrl));
  const combinedAnalyzed = Array.from(
    new Set([...session.allAnalyzedUrls, ...newAnalyzed])
  );

  const newAttempted = newScan.pages.map((p) => canonicalize(p.normalizedUrl));
  const combinedAttempted = Array.from(
    new Set([...(session.allAttemptedUrls || session.allAnalyzedUrls), ...newAttempted])
  );

  const nextBatchIndex = session.batches.length + 1;
  const newBatch: AuditBatch = {
    batchIndex: newScan.batchIndex || nextBatchIndex,
    scanId: newScan.scanId,
    startedAt: newScan.startedAt,
    completedAt: newScan.completedAt || new Date().toISOString(),
    analyzedUrls: newAnalyzed,
    pageCount: newAnalyzed.length,
    status: newScan.status === 'failed' ? 'failed' : 'completed',
    error: newScan.errors?.[0]?.message,
  };

  const coverage = calculateAuditCoverage(
    combinedAnalyzed.length,
    combinedDiscovered.length,
    session.coverage.isCompleteInventory
  );

  return {
    ...session,
    updatedAt: newScan.completedAt || new Date().toISOString(),
    batches: [...session.batches, newBatch],
    allDiscoveredUrls: combinedDiscovered,
    allAnalyzedUrls: combinedAnalyzed,
    allAttemptedUrls: combinedAttempted,
    coverage,
  };
}

/**
 * Merges multiple ScanResults across batches into a single cumulative ScanResult.
 * Deduplicates pages by normalizedUrl so no page is evaluated twice.
 */
export function mergeScanResults(batches: ScanResult[]): ScanResult {
  if (batches.length === 0) {
    throw new Error('Cannot merge empty batches array');
  }
  if (batches.length === 1) {
    return batches[0];
  }

  const primary = batches[0];
  const baseCanonical = primary.normalizedUrl || primary.inputUrl;
  const canonicalize = (u: string) => UrlValidator.resolveAndNormalizeLink(u, baseCanonical) || u;
  const pagesByUrl = new Map<string, PageScanResult>();

  let totalRequestsMade = 0;
  let totalBytesTransferred = 0;
  let totalDurationMs = 0;
  let totalExternalLinks = primary.summary?.externalLinksDiscovered || 0;
  const allErrors: ScanResult['errors'] = [];

  for (const b of batches) {
    totalRequestsMade += b.summary?.requestsMade ?? (b as any)?.requestsCount ?? b.pages.length;
    totalBytesTransferred += b.summary?.totalBytesTransferred ?? 0;
    totalDurationMs += b.totalDurationMs || 0;
    if (b !== primary && b.summary?.externalLinksDiscovered) {
      totalExternalLinks += b.summary.externalLinksDiscovered;
    }

    for (const page of b.pages) {
      const canonicalKey = canonicalize(page.normalizedUrl);
      if (!pagesByUrl.has(canonicalKey)) {
        pagesByUrl.set(canonicalKey, page);
      } else {
        const existing = pagesByUrl.get(canonicalKey)!;
        const pageCode = page.http?.statusCode ?? 200;
        const existCode = existing.http?.statusCode ?? 200;
        const pageSucceeded = pageCode >= 200 && pageCode < 400;
        const existingSucceeded = existCode >= 200 && existCode < 400;
        if (pageSucceeded && !existingSucceeded) {
          pagesByUrl.set(canonicalKey, page);
        }
      }
    }

    for (const err of (b.errors || [])) {
      if (!allErrors.some((e) =>
        e.code === err.code &&
        e.message === err.message &&
        e.targetUrl === err.targetUrl
      )) {
        allErrors.push(err);
      }
    }
  }

  const combinedPages = Array.from(pagesByUrl.values());
  const successfulPageUrls = new Set(
    combinedPages
      .filter((page) => page.http.statusCode >= 200 && page.http.statusCode < 400)
      .map((page) => canonicalize(page.normalizedUrl))
  );
  const recoveredPageErrors = new Set<string>();
  for (const batch of batches) {
    for (const page of batch.pages) {
      const pageUrl = canonicalize(page.normalizedUrl);
      if (successfulPageUrls.has(pageUrl)) {
        for (const error of page.scanErrors || []) {
          recoveredPageErrors.add(`${error.code}\0${error.message}\0${pageUrl}`);
        }
      }
    }
  }
  const activeErrors = allErrors.filter((error) => {
    if (!error.targetUrl) return true;
    const targetUrl = canonicalize(error.targetUrl);
    return !recoveredPageErrors.has(`${error.code}\0${error.message}\0${targetUrl}`);
  });
  for (const page of combinedPages) {
    for (const error of page.scanErrors || []) {
      if (!activeErrors.some((existing) =>
        existing.code === error.code &&
        existing.message === error.message &&
        existing.targetUrl === error.targetUrl
      )) {
        activeErrors.push(error);
      }
    }
  }
  const discoveredSet = new Set<string>();
  const attemptedSet = new Set<string>();

  for (const b of batches) {
    for (const u of extractDiscoveredUrls(b)) discoveredSet.add(canonicalize(u));
    for (const u of b.alreadyScannedUrls || []) attemptedSet.add(canonicalize(u));
  }
  const scannedSet = new Set<string>();
  for (const u of attemptedSet) {
    const page = pagesByUrl.get(u);
    if (!page || (page.http.statusCode >= 200 && page.http.statusCode < 400)) {
      scannedSet.add(u);
    }
  }
  for (const p of combinedPages) {
    const canonicalU = canonicalize(p.normalizedUrl);
    if (p.http.statusCode >= 200 && p.http.statusCode < 400) {
      scannedSet.add(canonicalU);
    }
    discoveredSet.add(canonicalU);
  }

  const allDiscovered = Array.from(discoveredSet);
  const allScanned = Array.from(scannedSet);
  const remainingUrls = allDiscovered.filter((u) => !scannedSet.has(u));

  const completedPagesCount = combinedPages.filter(
    (p) => p.http && p.http.statusCode >= 200 && p.http.statusCode < 400
  ).length;
  const mergedStatus =
    activeErrors.length === 0
      ? 'completed'
      : completedPagesCount === 0
      ? 'failed'
      : 'partial';

  const maxBatchIndex = Math.max(...batches.map((b) => b.batchIndex || 1));
  const effectiveBatchIndex = Math.max(maxBatchIndex, batches.length);

  return {
    ...primary,
    status: mergedStatus,
    completedAt: batches[batches.length - 1].completedAt || new Date().toISOString(),
    totalDurationMs,
    summary: {
      pagesAttempted: combinedPages.length,
      pagesCompleted: completedPagesCount,
      requestsMade: totalRequestsMade,
      totalBytesTransferred,
      internalLinksDiscovered: allDiscovered.length,
      externalLinksDiscovered: totalExternalLinks,
    },
    pages: combinedPages,
    errors: activeErrors,
    sessionId: primary.sessionId || primary.scanId,
    batchIndex: effectiveBatchIndex,
    discoveredUrls: allDiscovered,
    alreadyScannedUrls: allScanned,
    remainingUrls,
  };
}

/**
 * Aggregates a cumulative audit across all batches in a session.
 */
export function aggregateCumulativeAudit(batches: ScanResult[]): {
  cumulativeScan: ScanResult;
  cumulativeAudit: AuditResult;
} {
  const cumulativeScan = mergeScanResults(batches);
  const cumulativeAudit = runAudit(cumulativeScan);
  return { cumulativeScan, cumulativeAudit };
}

/**
 * Deduplicates affected resources by resourceUrl and referencedFrom.
 */
export function deduplicateAffectedResources(resources?: AffectedResource[]): AffectedResource[] {
  if (!resources || resources.length === 0) return [];
  const map = new Map<string, AffectedResource>();

  for (const r of resources) {
    const key = `${r.resourceUrl}__${r.referencedFrom || ''}`;
    if (!map.has(key)) {
      map.set(key, r);
    }
  }

  return Array.from(map.values());
}
