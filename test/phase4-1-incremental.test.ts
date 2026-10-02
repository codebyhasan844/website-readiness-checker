/**
 * Phase 4.1: Developer Actionability & Incremental Full-Site Audit Test Suite
 *
 * Verifies:
 * 1. Developer Actionability: Every applicable audit finding exposes exact affected page URLs
 *    and affected resource URLs with reference pages.
 * 2. Safe 50-page maximum limit per execution batch.
 * 3. Inventory extraction and coverage calculation (FULL, PARTIAL, LIMITED).
 * 4. Incremental audit multi-batch accumulation without rescanning completed URLs.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runAudit, AuditEngine } from '../src/audit';
import { SCANNER_LIMITS } from '../src/scanner/limits';
import { UrlValidator } from '../src/scanner/url-validator';
import { ResourceAnalyzer } from '../src/scanner/resource-analyzer';
import { BoundedCrawler } from '../src/scanner/crawler';
import {
  extractDiscoveredUrls,
  calculateAuditCoverage,
  formatCoveragePercentage,
  createAuditSession,
  appendBatchToSession,
  mergeScanResults,
} from '../src/report/session';
import {
  getOrCreateAuditSession,
  getRemainingDiscoveredUrls,
} from '../src/report/incremental';
import { buildReportViewModel } from '../src/report/view-model';
import { ScanResult, PageScanResult } from '../src/scanner/types';

function createDummyPage(url: string, links: string[] = [], brokenResources: Array<{ url: string; type?: string; statusCode?: number; statusText?: string }> = []): PageScanResult {
  return {
    url,
    normalizedUrl: url,
    depth: 0,
    discoveredFrom: ['crawl'],
    http: {
      requestedUrl: url,
      finalUrl: url,
      statusCode: 200,
      statusText: 'OK',
      headers: { 'content-type': 'text/html; charset=utf-8' },
      securityHeaders: {},
      contentType: 'text/html; charset=utf-8',
      responseBytes: 15000,
      durationMs: 120,
      timing: { startTime: 0, endTime: 120, totalMs: 120 },
      redirects: [],
    },
    document: {
      title: `Page ${url}`,
      metaDescription: 'A valid descriptive meta description with over seventy characters for testing purposes.',
      canonicalUrl: url,
      language: 'en',
      viewport: 'width=device-width, initial-scale=1',
      charset: 'utf-8',
      hasFavicon: true,
      hasStructuredData: false,
      openGraph: {},
    },
    headings: {
      h1Count: 1,
      items: [{ level: 1, text: 'Heading' }],
    },
    links: links.map((dest) => ({
      sourceUrl: url,
      destinationUrl: dest,
      normalizedDestination: dest,
      anchorText: 'Link',
      isInternal: dest.startsWith('https://example.com'),
    })),
    images: [],
    resources: brokenResources.map((r) => ({
      type: (r.type as any) || 'image',
      url: r.url,
      isInternal: true,
      statusCode: r.statusCode || 200,
      sizeBytes: 1024,
      error: r.statusCode && r.statusCode >= 400 ? (r.statusText || `HTTP ${r.statusCode}`) : undefined,
    })),
    scanErrors: [],
  };
}

function createDummyScan(pages: PageScanResult[], discoveredUrls?: string[]): ScanResult {
  return {
    scanId: 'scan-batch-1',
    inputUrl: pages[0]?.url || 'https://example.com/',
    normalizedUrl: pages[0]?.normalizedUrl || 'https://example.com/',
    status: 'completed',
    startedAt: '2026-03-30T10:00:00.000Z',
    completedAt: '2026-03-30T10:00:05.000Z',
    totalDurationMs: 5000,
    summary: {
      pagesAttempted: pages.length,
      pagesCompleted: pages.length,
      requestsMade: pages.length * 2,
      totalBytesTransferred: pages.length * 15000,
      internalLinksDiscovered: 10,
      externalLinksDiscovered: 2,
    },
    pages,
    sitemaps: [],
    robots: {
      url: 'https://example.com/robots.txt',
      exists: true,
      statusCode: 200,
      rawText: 'User-agent: *\nAllow: /',
      sitemapDeclarations: [],
      directives: [],
    },
    errors: [],
    limits: SCANNER_LIMITS,
    discoveredUrls,
  };
}

describe('Phase 4.1: Developer Actionability & Affected URLs', () => {
  it('exposes exact affected page URLs on findings for immediate developer handoff', () => {
    // Create pages with specific issues: page 2 and page 3 have missing H1
    const p1 = createDummyPage('https://example.com/');
    const p2: PageScanResult = {
      ...createDummyPage('https://example.com/about'),
      headings: { h1Count: 0, items: [] },
    };
    const p3: PageScanResult = {
      ...createDummyPage('https://example.com/contact'),
      headings: { h1Count: 0, items: [] },
    };

    const scan = createDummyScan([p1, p2, p3]);
    const audit = runAudit(scan);
    const vm = buildReportViewModel(audit, scan);

    // Find the H1 check
    const h1Finding = vm.findings.find((f) => f.checkId === 'seo-missing-h1');
    assert.ok(h1Finding, 'H1 finding should be present');
    assert.equal(h1Finding.severity, 'important');
    assert.ok(h1Finding.affectedUrls.length >= 2, 'Should list affected pages');
    assert.ok(h1Finding.affectedUrls.includes('https://example.com/about'));
    assert.ok(h1Finding.affectedUrls.includes('https://example.com/contact'));
    assert.equal(h1Finding.totalAffectedCount, 2);
  });

  it('exposes exact affected resource URLs with referencedFrom page URLs for developer tickets', () => {
    const brokenAsset = {
      url: 'https://example.com/assets/missing-logo.png',
      type: 'image',
      statusCode: 404,
      statusText: '404 Not Found',
    };

    const pageWithBrokenAsset = createDummyPage(
      'https://example.com/services',
      [],
      [brokenAsset]
    );

    const scan = createDummyScan([pageWithBrokenAsset]);
    const audit = runAudit(scan);
    const vm = buildReportViewModel(audit, scan);

    const brokenResFinding = vm.findings.find((f) => f.checkId === 'asset-broken-resources');
    assert.ok(brokenResFinding, 'Broken resource finding should be generated');
    assert.equal(brokenResFinding.severity, 'critical');
    assert.ok(brokenResFinding.affectedResources, 'Should contain structured affected resources');
    assert.equal(brokenResFinding.affectedResources?.length, 1);
    assert.equal(brokenResFinding.affectedResources[0].resourceUrl, 'https://example.com/assets/missing-logo.png');
    assert.equal(brokenResFinding.affectedResources[0].referencedFrom, 'https://example.com/services');
    assert.equal(brokenResFinding.affectedResources[0].statusCode, 404);
  });
});

describe('Phase 4.1: Incremental Full-Site Audit & 50-Page Limits', () => {
  it('enforces safe maximum of 50 pages per batch execution', () => {
    assert.equal(SCANNER_LIMITS.maxPages, 50, 'Max pages per execution batch must equal 50');
  });

  it('calculates audit coverage states accurately (FULL, PARTIAL, LIMITED)', () => {
    // 1. FULL COVERAGE
    const full = calculateAuditCoverage(25, 25, true);
    assert.equal(full.status, 'FULL COVERAGE');
    assert.equal(full.remainingCount, 0);

    // 2. PARTIAL COVERAGE
    const partial = calculateAuditCoverage(50, 142, true);
    assert.equal(partial.status, 'PARTIAL COVERAGE');
    assert.equal(partial.remainingCount, 92);
    assert.match(partial.message, /92 pages remaining/);

    // 3. LIMITED COVERAGE (when full inventory could not be completed)
    const limited = calculateAuditCoverage(50, 50, false);
    assert.equal(limited.status, 'LIMITED COVERAGE');
  });

  it('formats coverage percentage with meaningful precision and never displays 100% when below 100%', () => {
    // 50 / 198 = 25.25% → 25.3%
    assert.equal(formatCoveragePercentage(50, 198), '25.3%');
    // 100 / 198 = 50.51% → 50.5%
    assert.equal(formatCoveragePercentage(100, 198), '50.5%');
    // 150 / 199 = 75.38% → 75.4%
    assert.equal(formatCoveragePercentage(150, 199), '75.4%');
    // 200 / 201 = 99.50% → 99.5% (NOT 100%)
    assert.equal(formatCoveragePercentage(200, 201), '99.5%');
    assert.notEqual(formatCoveragePercentage(200, 201), '100%');
    // 201 / 201 = 100%
    assert.equal(formatCoveragePercentage(201, 201), '100%');
    // Near 100% boundary: 9999 / 10000 = 99.99% → 99.9% (NOT 100%)
    assert.equal(formatCoveragePercentage(9999, 10000), '99.9%');
    assert.notEqual(formatCoveragePercentage(9999, 10000), '100%');
    // Zero analyzed
    assert.equal(formatCoveragePercentage(0, 50), '0%');

    // Integrated calculateAuditCoverage test for 200/201 case
    const coverage200 = calculateAuditCoverage(200, 201, true);
    assert.equal(coverage200.status, 'PARTIAL COVERAGE');
    assert.equal(coverage200.remainingCount, 1);
    assert.equal(coverage200.percentageText, '99.5%');
    assert.notEqual(coverage200.percentageText, '100%');

    // Integrated calculateAuditCoverage test for 201/201 case
    const coverage201 = calculateAuditCoverage(201, 201, true);
    assert.equal(coverage201.status, 'FULL COVERAGE');
    assert.equal(coverage201.remainingCount, 0);
    assert.equal(coverage201.percentageText, '100%');
  });

  it('extracts discovered URLs from pages, internal links, and sitemaps without duplication', () => {
    const p1 = createDummyPage('https://example.com/', [
      'https://example.com/page-1',
      'https://example.com/page-2',
      'https://external.com/other',
    ]);
    const p2 = createDummyPage('https://example.com/page-1', [
      'https://example.com/page-2',
      'https://example.com/page-3',
    ]);

    const scan = createDummyScan([p1, p2]);
    const discovered = extractDiscoveredUrls(scan);

    assert.ok(discovered.includes('https://example.com/'));
    assert.ok(discovered.includes('https://example.com/page-1'));
    assert.ok(discovered.includes('https://example.com/page-2'));
    assert.ok(discovered.includes('https://example.com/page-3'));
    assert.ok(!discovered.includes('https://external.com/other'), 'Should not include external URLs');
  });

  it('accumulates multi-batch scans into an AuditSession without rescanning completed URLs', () => {
    const p1 = createDummyPage('https://example.com/');
    const p2 = createDummyPage('https://example.com/pricing');
    const p3 = createDummyPage('https://example.com/docs');
    const p4 = createDummyPage('https://example.com/blog');

    // Batch 1 scanned p1 and p2
    const batch1 = createDummyScan([p1, p2], [
      'https://example.com/',
      'https://example.com/pricing',
      'https://example.com/docs',
      'https://example.com/blog',
    ]);
    batch1.scanId = 'batch-1';

    const session = createAuditSession(batch1);
    assert.equal(session.batches.length, 1);
    assert.equal(session.allAnalyzedUrls.length, 2);
    assert.equal(session.coverage.status, 'PARTIAL COVERAGE');
    assert.equal(session.coverage.remainingCount, 2);

    // Remaining discovered URLs should only be docs and blog
    const remaining = getRemainingDiscoveredUrls(session);

    assert.equal(remaining.length, 2);
    assert.ok(remaining.includes('https://example.com/docs'));
    assert.ok(remaining.includes('https://example.com/blog'));
    assert.ok(!remaining.includes('https://example.com/'));

    // Batch 2 scans p3 and p4
    const batch2 = createDummyScan([p3, p4]);
    batch2.scanId = 'batch-2';

    const updatedSession = appendBatchToSession(session, batch2);
    assert.equal(updatedSession.batches.length, 2);
    assert.equal(updatedSession.allAnalyzedUrls.length, 4);
    assert.equal(updatedSession.coverage.status, 'FULL COVERAGE');
    assert.equal(updatedSession.coverage.remainingCount, 0);

    // Merged scan should contain all 4 pages
    const merged = mergeScanResults([batch1, batch2]);
    assert.equal(merged.pages.length, 4);
  });

  it('aligns apex vs www to canonical base host and preserves external URLs', () => {
    const canonicalBase = 'https://www.nexoratools.me/';
    
    // Apex URL should resolve to www canonical base host
    const resolvedApex = UrlValidator.resolveAndNormalizeLink(
      'https://nexoratools.me/tools',
      canonicalBase
    );
    assert.equal(resolvedApex, 'https://www.nexoratools.me/tools');

    // HTTP apex should resolve to HTTPS www if base is HTTPS
    const resolvedHttp = UrlValidator.resolveAndNormalizeLink(
      'http://nexoratools.me/privacy',
      canonicalBase
    );
    assert.equal(resolvedHttp, 'https://www.nexoratools.me/privacy');

    // External URL hostname must NOT be touched
    const external = UrlValidator.resolveAndNormalizeLink(
      'https://github.com/vornisse',
      canonicalBase
    );
    assert.equal(external, 'https://github.com/vornisse');
  });

  it('deduplicates apex and www variants in discovered inventory and remaining calculation', () => {
    // Session established on www.nexoratools.me
    const p1 = createDummyPage('https://www.nexoratools.me/');
    const p2 = createDummyPage('https://www.nexoratools.me/tools');

    // Discovered inventory contains both apex and www variants of the same pages
    const scan1 = createDummyScan([p1, p2], [
      'https://www.nexoratools.me/',
      'https://nexoratools.me/',
      'https://www.nexoratools.me/tools',
      'https://nexoratools.me/tools',
      'https://nexoratools.me/contact', // Unanalyzed page exposed as apex
    ]);
    scan1.normalizedUrl = 'https://www.nexoratools.me/';

    const session = createAuditSession(scan1);

    // Discovered inventory should deduplicate apex and www versions of the same pages
    assert.ok(session.allDiscoveredUrls.includes('https://www.nexoratools.me/tools'));
    assert.ok(!session.allDiscoveredUrls.includes('https://nexoratools.me/tools'));
    assert.equal(session.allDiscoveredUrls.length, 3); // '/', '/tools', '/contact'

    // Remaining URLs should only contain unanalyzed '/contact', not '/tools' or '/'
    const remaining = getRemainingDiscoveredUrls(session);
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0], 'https://www.nexoratools.me/contact');
  });

  it('prevents crawler from re-visiting already analyzed pages even if submitted as apex seeds', () => {
    const crawler = new BoundedCrawler('https://www.nexoratools.me/');
    // Mark both homepage and www page as already scanned
    crawler.markAlreadyScanned([
      'https://www.nexoratools.me/',
      'https://www.nexoratools.me/tools',
    ]);

    // Attempt to enqueue apex variant of /tools as candidate seed
    crawler.enqueue(['https://nexoratools.me/tools'], 1, 'seed');

    // Queue must be 0 because apex variant is canonicalized and recognized as already visited
    assert.equal(crawler.getQueueLength(), 0);

    // Remaining unanalyzed URLs must be 0
    const remaining = crawler.getRemainingUrls();
    assert.equal(remaining.length, 0);
  });

  it('deduplicates static resource fetches using resourceCache to preserve request budget', async () => {
    const cache = new Map();
    const mockResources = [
      {
        type: 'css' as const,
        url: 'https://example.com/assets/styles.css',
        isInternal: true,
      },
    ];

    // Pre-populate cache with an analyzed record
    cache.set('https://example.com/assets/styles.css', {
      type: 'css',
      url: 'https://example.com/assets/styles.css',
      isInternal: true,
      statusCode: 200,
      sizeBytes: 4096,
      durationMs: 15,
    });

    // Analyze resources with cache provided
    const { resources, requestsMade } = await ResourceAnalyzer.analyzeResources(
      mockResources,
      0,
      cache,
      150
    );

    // Reused from cache, so 0 HTTP network requests were made!
    assert.equal(requestsMade, 0);
    assert.equal(resources.length, 1);
    assert.equal(resources[0].statusCode, 200);
    assert.equal(resources[0].sizeBytes, 4096);
  });

  it('aggregates findings and preserves all affected URLs across multiple batches', () => {
    // Batch 1: p1 has missing title, p2 has valid title
    const p1 = createDummyPage('https://example.com/p1');
    p1.document.title = '';
    const p2 = createDummyPage('https://example.com/p2');
    p2.document.title = 'Valid Title';

    const batch1 = createDummyScan([p1, p2], [
      'https://example.com/p1',
      'https://example.com/p2',
      'https://example.com/p3',
      'https://example.com/p4',
    ]);
    batch1.batchIndex = 1;

    // Batch 2: p3 also has missing title, p4 has valid title
    const p3 = createDummyPage('https://example.com/p3');
    p3.document.title = '';
    const p4 = createDummyPage('https://example.com/p4');
    p4.document.title = 'Valid Title';

    const batch2 = createDummyScan([p3, p4]);
    batch2.batchIndex = 2;

    const merged = mergeScanResults([batch1, batch2]);
    assert.equal(merged.pages.length, 4);
    assert.equal(merged.batchIndex, 2);

    const audit = runAudit(merged);
    const missingTitleFinding = audit.findings.find((f) => f.checkId === 'seo-missing-title');
    assert.ok(missingTitleFinding);
    assert.equal(missingTitleFinding.severity, 'critical');
    // Check-level aggregation: ONE finding with 2 affected URLs
    assert.equal(missingTitleFinding.evidence.affectedCount, 2);
    assert.ok(missingTitleFinding.evidence.urls?.includes('https://example.com/p1'));
    assert.ok(missingTitleFinding.evidence.urls?.includes('https://example.com/p3'));

    // Check toScanReport retains all affected URLs
    const scanReport = AuditEngine.toScanReport(audit, merged);
    const uiFinding = scanReport.findings.find((f) => f.id === missingTitleFinding.id);
    assert.ok(uiFinding);
    assert.equal(uiFinding.affectedUrls?.length, 2);
    assert.ok(uiFinding.affectedUrls?.includes('https://example.com/p1'));
    assert.ok(uiFinding.affectedUrls?.includes('https://example.com/p3'));
  });

  it('excludes failed requests (HTTP 4xx/5xx) from successfully analyzed pages and coverage count', () => {
    const pSuccess = createDummyPage('https://example.com/ok');
    pSuccess.http.statusCode = 200;

    const pFail = createDummyPage('https://example.com/failed');
    pFail.http.statusCode = 404;
    pFail.http.statusText = 'Not Found';

    const scan = createDummyScan([pSuccess, pFail], [
      'https://example.com/ok',
      'https://example.com/failed',
    ]);

    const session = createAuditSession(scan);
    // Only 1 page succeeded
    assert.equal(session.allAnalyzedUrls.length, 1);
    assert.equal(session.allAnalyzedUrls[0], 'https://example.com/ok');
    // Attempted recorded both
    assert.equal(session.allAttemptedUrls?.length, 2);
    // Coverage analyzedCount reflects only successful pages
    assert.equal(session.coverage.analyzedCount, 1);
    assert.equal(session.coverage.remainingCount, 1);

    const remaining = getRemainingDiscoveredUrls(session);
    assert.deepEqual(remaining, ['https://example.com/failed']);

    const viewModel = buildReportViewModel(runAudit(scan), scan, session);
    assert.equal(viewModel.metrics.pagesScannedCount, 1);
  });

  it('keeps failed attempts retryable while excluding successful pages from continuation', () => {
    const successfulPage = createDummyPage('https://example.com/ok');
    const failedPage = createDummyPage('https://example.com/retry');
    failedPage.http.statusCode = 0;
    failedPage.scanErrors = [{
      code: 'CONNECTION_TIMEOUT',
      message: 'The target page timed out.',
      targetUrl: failedPage.normalizedUrl,
      timestamp: new Date().toISOString(),
    }];
    const scan = createDummyScan([successfulPage, failedPage], [
      successfulPage.normalizedUrl,
      failedPage.normalizedUrl,
    ]);

    const session = createAuditSession(scan);
    const remaining = getRemainingDiscoveredUrls(session);

    assert.deepEqual(session.allAnalyzedUrls, [successfulPage.normalizedUrl]);
    assert.deepEqual(session.allAttemptedUrls, [successfulPage.normalizedUrl, failedPage.normalizedUrl]);
    assert.deepEqual(remaining, [failedPage.normalizedUrl]);
    assert.equal(session.coverage.analyzedCount, 1);
    assert.equal(session.coverage.remainingCount, 1);

    const crawler = new BoundedCrawler('https://example.com/');
    crawler.markAlreadyScanned(session.allAnalyzedUrls);
    crawler.enqueue(remaining, 1, 'batch-seed');
    assert.equal(crawler.getQueueLength(), 1);
    crawler.enqueue([successfulPage.normalizedUrl], 1, 'batch-seed');
    assert.equal(crawler.getQueueLength(), 1);
  });

  it('clears a recovered page failure from merged active status while retaining attempt history', () => {
    const recoveredUrl = 'https://example.com/retry';
    const success = createDummyPage('https://example.com/ok');
    const failed = createDummyPage(recoveredUrl);
    failed.http.statusCode = 0;
    const pageError = {
      code: 'CONNECTION_TIMEOUT' as const,
      message: 'The target page timed out.',
      targetUrl: recoveredUrl,
      timestamp: '2026-03-30T10:00:01.000Z',
    };
    failed.scanErrors = [pageError];

    const firstBatch = createDummyScan([success, failed], [success.normalizedUrl, recoveredUrl]);
    firstBatch.status = 'partial';
    firstBatch.errors = [pageError];
    firstBatch.alreadyScannedUrls = [success.normalizedUrl, recoveredUrl];

    const recovered = createDummyPage(recoveredUrl);
    const retryBatch = createDummyScan([recovered], [recoveredUrl]);
    retryBatch.status = 'completed';
    retryBatch.alreadyScannedUrls = [recoveredUrl];

    const merged = mergeScanResults([firstBatch, retryBatch]);

    assert.equal(merged.status, 'completed');
    assert.deepEqual(merged.errors, []);
    assert.equal(merged.pages.find((page) => page.normalizedUrl === recoveredUrl)?.http.statusCode, 200);
    assert.deepEqual(merged.alreadyScannedUrls?.sort(), [recoveredUrl, success.normalizedUrl].sort());

    const session = createAuditSession(firstBatch);
    const updatedSession = appendBatchToSession(session, retryBatch);
    assert.ok(updatedSession.allAttemptedUrls?.includes(recoveredUrl));
  });

  it('retains an unresolved page failure after a failed retry and preserves other successful pages', () => {
    const recoveredIndependentPage = createDummyPage('https://example.com/ok');
    const failed = createDummyPage('https://example.com/retry');
    failed.http.statusCode = 0;
    const firstError = {
      code: 'CONNECTION_TIMEOUT' as const,
      message: 'The target page timed out.',
      targetUrl: failed.normalizedUrl,
      timestamp: '2026-03-30T10:00:01.000Z',
    };
    failed.scanErrors = [firstError];
    const firstBatch = createDummyScan([recoveredIndependentPage, failed]);
    firstBatch.status = 'partial';
    firstBatch.errors = [firstError];

    const retryFailed = createDummyPage(failed.normalizedUrl);
    retryFailed.http.statusCode = 0;
    retryFailed.scanErrors = [{
      ...firstError,
      message: 'The retried target page timed out.',
      timestamp: '2026-03-30T10:00:10.000Z',
    }];
    const retryBatch = createDummyScan([retryFailed]);
    retryBatch.status = 'partial';
    retryBatch.errors = retryFailed.scanErrors;

    const merged = mergeScanResults([firstBatch, retryBatch]);

    assert.equal(merged.status, 'partial');
    assert.ok(merged.errors.some((error) => error.targetUrl === failed.normalizedUrl));
    assert.equal(merged.pages.length, 2);
    assert.ok(merged.pages.some((page) => page.normalizedUrl === recoveredIndependentPage.normalizedUrl));
  });

  it('clears only the recovered URL error when another page remains failed', () => {
    const recoveredUrl = 'https://example.com/recovered';
    const remainingFailedUrl = 'https://example.com/still-failing';
    const initialPages = [recoveredUrl, remainingFailedUrl].map((url) => {
      const page = createDummyPage(url);
      page.http.statusCode = 0;
      page.scanErrors = [{
        code: 'CONNECTION_TIMEOUT' as const,
        message: `Failed: ${url}`,
        targetUrl: url,
        timestamp: '2026-03-30T10:00:01.000Z',
      }];
      return page;
    });
    const firstBatch = createDummyScan(initialPages);
    firstBatch.status = 'partial';
    firstBatch.errors = initialPages.flatMap((page) => page.scanErrors);

    const retrySuccess = createDummyPage(recoveredUrl);
    const retryBatch = createDummyScan([retrySuccess]);
    retryBatch.status = 'completed';

    const merged = mergeScanResults([firstBatch, retryBatch]);

    assert.equal(merged.status, 'partial');
    assert.equal(merged.errors.length, 1);
    assert.equal(merged.errors[0].targetUrl, remainingFailedUrl);
  });

  it('merges a successful retry over the failed attempt without duplicating the page', () => {
    const failedPage = createDummyPage('https://example.com/retry');
    failedPage.http.statusCode = 0;
    failedPage.scanErrors = [{
      code: 'CONNECTION_TIMEOUT',
      message: 'The target page timed out.',
      targetUrl: failedPage.normalizedUrl,
      timestamp: new Date().toISOString(),
    }];
    const firstBatch = createDummyScan([failedPage], [failedPage.normalizedUrl]);
    const session = createAuditSession(firstBatch);

    assert.deepEqual(getRemainingDiscoveredUrls(session), [failedPage.normalizedUrl]);

    const successfulRetry = createDummyPage('https://example.com/retry');
    const secondBatch = createDummyScan([successfulRetry]);
    const updatedSession = appendBatchToSession(session, secondBatch);
    const merged = mergeScanResults([firstBatch, secondBatch]);

    assert.deepEqual(getRemainingDiscoveredUrls(updatedSession), []);
    assert.equal(updatedSession.coverage.analyzedCount, 1);
    assert.equal(updatedSession.coverage.remainingCount, 0);
    assert.equal(merged.pages.length, 1);
    assert.equal(merged.pages[0].http.statusCode, 200);
    assert.deepEqual(merged.remainingUrls, []);
  });

  it('accumulates cumulative report state across 4 consecutive batches up to 200 pages', () => {
    const all200Urls = Array.from({ length: 200 }, (_, i) => `https://example.com/page-${i + 1}`);

    // Batch 1: pages 0..49
    const b1Pages = all200Urls.slice(0, 50).map((u) => createDummyPage(u));
    const b1Scan = createDummyScan(b1Pages, all200Urls);
    b1Scan.batchIndex = 1;
    let session = createAuditSession(b1Scan);
    let cumulativeScan = b1Scan;

    assert.equal(session.allAnalyzedUrls.length, 50);
    assert.equal(session.coverage.status, 'PARTIAL COVERAGE');
    assert.equal(session.coverage.remainingCount, 150);

    // Batch 2: pages 50..99
    const b2Pages = all200Urls.slice(50, 100).map((u) => createDummyPage(u));
    const b2Scan = createDummyScan(b2Pages);
    b2Scan.batchIndex = 2;
    session = appendBatchToSession(session, b2Scan);
    cumulativeScan = mergeScanResults([cumulativeScan, b2Scan]);

    assert.equal(session.allAnalyzedUrls.length, 100);
    assert.equal(session.batches.length, 2);
    assert.equal(cumulativeScan.pages.length, 100);
    assert.equal(cumulativeScan.batchIndex, 2);
    assert.equal(session.coverage.remainingCount, 100);

    // Batch 3: pages 100..149
    const b3Pages = all200Urls.slice(100, 150).map((u) => createDummyPage(u));
    const b3Scan = createDummyScan(b3Pages);
    b3Scan.batchIndex = 3;
    session = appendBatchToSession(session, b3Scan);
    cumulativeScan = mergeScanResults([cumulativeScan, b3Scan]);

    assert.equal(session.allAnalyzedUrls.length, 150);
    assert.equal(session.batches.length, 3);
    assert.equal(cumulativeScan.pages.length, 150);
    assert.equal(cumulativeScan.batchIndex, 3);
    assert.equal(session.coverage.remainingCount, 50);

    // Batch 4: pages 150..199
    const b4Pages = all200Urls.slice(150, 200).map((u) => createDummyPage(u));
    const b4Scan = createDummyScan(b4Pages);
    b4Scan.batchIndex = 4;
    session = appendBatchToSession(session, b4Scan);
    cumulativeScan = mergeScanResults([cumulativeScan, b4Scan]);

    assert.equal(session.allAnalyzedUrls.length, 200);
    assert.equal(session.batches.length, 4);
    assert.equal(cumulativeScan.pages.length, 200);
    assert.equal(cumulativeScan.batchIndex, 4);
    assert.equal(session.coverage.remainingCount, 0);
    assert.equal(session.coverage.status, 'FULL COVERAGE');

    const audit = runAudit(cumulativeScan);
    const vm = buildReportViewModel(audit, cumulativeScan, session);
    assert.equal(vm.metrics.pagesScannedCount, 200);
    assert.equal(vm.currentBatch, 4);
    assert.equal(vm.coverage.status, 'FULL COVERAGE');
    assert.equal(vm.coverage.remainingCount, 0);
  });
});
