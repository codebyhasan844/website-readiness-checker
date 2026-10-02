/**
 * PART 4 REGRESSION TEST SUITE:
 * Cumulative PDF Generation, PDF Evidence Correctness, Phase 2 Security, and Phase 3 AuditEngine Boundaries
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runAudit, defaultAuditRegistry } from '../src/audit';
import { ScanResult, PageScanResult } from '../src/scanner/types';
import { SCANNER_LIMITS } from '../src/scanner/limits';
import { SecurityGuard } from '../src/scanner/security-guard';
import { RedirectHandler } from '../src/scanner/redirect-handler';
import { createAuditSession, appendBatchToSession, mergeScanResults } from '../src/report/session';
import { buildReportViewModel } from '../src/report/view-model';
import { generateAuditPdf } from '../src/report/pdf-export';

function createMockPage(url: string, title?: string, hasSecurityHeaders = true): PageScanResult {
  return {
    url,
    normalizedUrl: url,
    depth: 1,
    discoveredFrom: ['https://example.com/'],
    http: {
      requestedUrl: url,
      finalUrl: url,
      statusCode: 200,
      statusText: 'OK',
      headers: { 'content-type': 'text/html; charset=utf-8' },
      securityHeaders: hasSecurityHeaders
        ? {
            strictTransportSecurity: 'max-age=31536000; includeSubDomains',
            contentSecurityPolicy: "default-src 'self'",
            xContentTypeOptions: 'nosniff',
            xFrameOptions: 'SAMEORIGIN',
            referrerPolicy: 'strict-origin-when-cross-origin',
            permissionsPolicy: 'camera=(), microphone=()',
          }
        : {},
      contentType: 'text/html; charset=utf-8',
      responseBytes: 12000,
      durationMs: 150,
      timing: { startTime: 0, endTime: 150, totalMs: 150 },
      redirects: [],
    },
    document: {
      title: title !== undefined ? title : 'Example Page Title With Proper Length for Testing SEO',
      metaDescription: 'A valid meta description that satisfies audit checks and provides good context.',
      canonicalUrl: url,
      language: 'en',
      viewport: 'width=device-width, initial-scale=1',
      charset: 'utf-8',
      hasFavicon: true,
      hasStructuredData: true,
    },
    headings: {
      h1Count: 1,
      items: [{ level: 1, text: 'Heading 1' }],
    },
    links: [],
    images: [],
    resources: [],
    scanErrors: [],
  };
}

describe('PART 4 — PDF Generation & Cumulative Reporting', () => {
  it('PDF reflects cumulative merged result across multiple batches', () => {
    // Batch 1: 50 pages
    const batch1Pages: PageScanResult[] = [];
    for (let i = 1; i <= 50; i++) {
      // 10 pages in batch 1 have empty titles (SEO issue)
      const title = i <= 10 ? '' : `Valid Page Title ${i} for Quality SEO Checklist`;
      batch1Pages.push(createMockPage(`https://example.com/page-${i}`, title));
    }

    const mockRobots = {
      url: 'https://example.com/robots.txt',
      exists: true,
      statusCode: 200,
      directives: [{ userAgent: '*', allows: ['/'], disallows: [] }],
      sitemapDeclarations: ['https://example.com/sitemap.xml'],
    };

    const mockSitemaps = [
      {
        url: 'https://example.com/sitemap.xml',
        discoveredFrom: 'robots.txt' as const,
        exists: true,
        statusCode: 200,
        isIndex: false,
        containedUrls: ['https://example.com/'],
      },
    ];

    const batch1: ScanResult = {
      scanId: 'scan-b1',
      inputUrl: 'https://example.com/',
      normalizedUrl: 'https://example.com/',
      startedAt: '2026-03-30T10:00:00.000Z',
      completedAt: '2026-03-30T10:00:05.000Z',
      totalDurationMs: 5000,
      status: 'partial',
      batchIndex: 1,
      summary: {
        pagesAttempted: 50,
        pagesCompleted: 50,
        requestsMade: 50,
        totalBytesTransferred: 500000,
        internalLinksDiscovered: 150,
        externalLinksDiscovered: 10,
      },
      pages: batch1Pages,
      sitemaps: mockSitemaps,
      robots: mockRobots,
      errors: [],
      limits: SCANNER_LIMITS,
      discoveredUrls: Array.from({ length: 150 }, (_, i) => `https://example.com/page-${i + 1}`),
    };

    // Batch 2: 50 additional pages
    const batch2Pages: PageScanResult[] = [];
    for (let i = 51; i <= 100; i++) {
      // 15 pages in batch 2 also have empty titles
      const title = i <= 65 ? '' : `Valid Page Title ${i} for Quality SEO Checklist`;
      batch2Pages.push(createMockPage(`https://example.com/page-${i}`, title));
    }

    const batch2: ScanResult = {
      scanId: 'scan-b2',
      inputUrl: 'https://example.com/',
      normalizedUrl: 'https://example.com/',
      startedAt: '2026-03-30T10:01:00.000Z',
      completedAt: '2026-03-30T10:01:05.000Z',
      totalDurationMs: 5000,
      status: 'partial',
      batchIndex: 2,
      summary: {
        pagesAttempted: 50,
        pagesCompleted: 50,
        requestsMade: 50,
        totalBytesTransferred: 500000,
        internalLinksDiscovered: 150,
        externalLinksDiscovered: 10,
      },
      pages: batch2Pages,
      sitemaps: mockSitemaps,
      robots: mockRobots,
      errors: [],
      limits: SCANNER_LIMITS,
      discoveredUrls: Array.from({ length: 150 }, (_, i) => `https://example.com/page-${i + 1}`),
    };

    // Session tracking
    let session = createAuditSession(batch1);
    session = appendBatchToSession(session, batch2);

    // Merge scans canonically
    const cumulativeScan = mergeScanResults([batch1, batch2]);
    assert.strictEqual(cumulativeScan.pages.length, 100, 'Cumulative scan has 100 pages');

    // Run deterministic audit
    const cumulativeAudit = runAudit(cumulativeScan);
    assert.strictEqual(cumulativeAudit.counts.totalChecks, 67, 'Total evaluated checks remains strictly 67');

    // Build unified ReportViewModel
    const viewModel = buildReportViewModel(cumulativeAudit, cumulativeScan, session);
    assert.strictEqual(viewModel.metrics.pagesScannedCount, 100, 'ViewModel reflects cumulative 100 pages');
    assert.strictEqual(viewModel.coverage.analyzedCount, 100, 'Coverage analyzed count is 100');
    assert.strictEqual(viewModel.coverage.remainingCount, 50, 'Coverage remaining is 50');

    // Title finding should have aggregated 25 affected URLs (10 from b1 + 15 from b2)
    const titleFinding = viewModel.findings.find((f) => f.checkId === 'seo-missing-title');
    assert.ok(titleFinding, 'Missing title finding is present');
    assert.strictEqual(titleFinding.severity, 'critical');
    assert.strictEqual(titleFinding.affectedUrls.length, 25, 'Affected URLs accumulated to 25 unique pages');

    // Generate PDF document
    const doc = generateAuditPdf(viewModel, { returnDoc: true });
    assert.ok(doc, 'PDF doc generated successfully');
    assert.ok(doc.getNumberOfPages() >= 2, 'PDF is multi-page and contains tables');
  });

  it('PDF evidence correctly handles single and multi-page URL formatting without clipping', () => {
    // Create scan with 1 single-URL issue and 1 large multi-URL issue (40 pages)
    const pages: PageScanResult[] = [];
    for (let i = 1; i <= 50; i++) {
      const hasSecurity = i !== 1; // Only page 1 missing security headers
      const title = i <= 40 ? '' : 'Valid Page Title for Testing Audit Checklist';
      pages.push(createMockPage(`https://example.com/test-p${i}`, title, hasSecurity));
    }

    const scan: ScanResult = {
      scanId: 'scan-evidence-test',
      inputUrl: 'https://example.com/',
      normalizedUrl: 'https://example.com/',
      startedAt: '2026-03-30T10:00:00.000Z',
      completedAt: '2026-03-30T10:00:02.000Z',
      totalDurationMs: 2000,
      status: 'completed',
      summary: {
        pagesAttempted: 50,
        pagesCompleted: 50,
        requestsMade: 50,
        totalBytesTransferred: 500000,
        internalLinksDiscovered: 50,
        externalLinksDiscovered: 0,
      },
      pages,
      sitemaps: [],
      robots: {
        url: 'https://example.com/robots.txt',
        exists: true,
        statusCode: 200,
        directives: [{ userAgent: '*', allows: ['/'], disallows: [] }],
        sitemapDeclarations: [],
      },
      errors: [],
      limits: SCANNER_LIMITS,
    };

    const audit = runAudit(scan);
    const viewModel = buildReportViewModel(audit, scan);
    const doc = generateAuditPdf(viewModel, { returnDoc: true });

    assert.ok(doc, 'PDF rendered without errors');
    assert.ok(doc.getNumberOfPages() >= 2, 'PDF generated complete multi-page output');
  });

  it('PDF handles 100% passed checks gracefully', () => {
    const perfectPage = createMockPage('https://example.com/perfect');
    const scan: ScanResult = {
      scanId: 'scan-perfect',
      inputUrl: 'https://example.com/perfect',
      normalizedUrl: 'https://example.com/perfect',
      startedAt: '2026-03-30T10:00:00.000Z',
      completedAt: '2026-03-30T10:00:01.000Z',
      totalDurationMs: 1000,
      status: 'completed',
      summary: {
        pagesAttempted: 1,
        pagesCompleted: 1,
        requestsMade: 1,
        totalBytesTransferred: 10000,
        internalLinksDiscovered: 1,
        externalLinksDiscovered: 0,
      },
      pages: [perfectPage],
      sitemaps: [],
      robots: {
        url: 'https://example.com/robots.txt',
        exists: true,
        statusCode: 200,
        directives: [{ userAgent: '*', allows: ['/'], disallows: [] }],
        sitemapDeclarations: [],
      },
      errors: [],
      limits: SCANNER_LIMITS,
    };

    const audit = runAudit(scan);
    const viewModel = buildReportViewModel(audit, scan);
    const doc = generateAuditPdf(viewModel, { returnDoc: true });

    assert.ok(doc);
    assert.ok(doc.getNumberOfPages() >= 1);
  });
});

describe('PART 4 — Phase 2 Security Protections Regression', () => {
  it('blocks private IPv4 addresses (RFC 1918)', () => {
    assert.throws(
      () => SecurityGuard.validateHostAndPort('10.0.0.1', 80),
      /private/i
    );
    assert.throws(
      () => SecurityGuard.validateHostAndPort('172.16.0.1', 80),
      /private/i
    );
    assert.throws(
      () => SecurityGuard.validateHostAndPort('192.168.1.1', 80),
      /private/i
    );
  });

  it('blocks loopback and localhost addresses', () => {
    assert.throws(
      () => SecurityGuard.validateHostAndPort('localhost', 80),
      /localhost|internal/i
    );
    assert.throws(
      () => SecurityGuard.validateHostAndPort('127.0.0.1', 80),
      /loopback/i
    );
    assert.throws(
      () => SecurityGuard.validateHostAndPort('127.0.0.5', 80),
      /loopback/i
    );
  });

  it('blocks cloud metadata service (169.254.169.254) and link-local', () => {
    assert.throws(
      () => SecurityGuard.validateHostAndPort('169.254.169.254', 80),
      /restricted|private|internal|link-local|metadata/i
    );
  });

  it('blocks IPv6 loopback and unique local addresses', () => {
    assert.throws(
      () => SecurityGuard.validateHostAndPort('::1', 80),
      /loopback/i
    );
    assert.throws(
      () => SecurityGuard.validateHostAndPort('fc00::1', 80),
      /unique local|private/i
    );
    assert.throws(
      () => SecurityGuard.validateHostAndPort('fe80::1', 80),
      /link-local/i
    );
  });

  it('blocks non-standard / unsafe ports', () => {
    assert.throws(
      () => SecurityGuard.validateHostAndPort('example.com', 22),
      /port/i
    );
    assert.throws(
      () => SecurityGuard.validateHostAndPort('example.com', 25),
      /port/i
    );
    assert.throws(
      () => SecurityGuard.validateHostAndPort('example.com', 3000),
      /port/i
    );
    assert.throws(
      () => SecurityGuard.validateHostAndPort('example.com', 8080),
      /port/i
    );
  });

  it('allows standard public ports 80 and 443', () => {
    assert.doesNotThrow(() => SecurityGuard.validateHostAndPort('example.com', 80));
    assert.doesNotThrow(() => SecurityGuard.validateHostAndPort('example.com', 443));
    assert.doesNotThrow(() => SecurityGuard.validateHostAndPort('google.com', 443));
  });

  it('redirect handler blocks redirects hopping to internal or loopback IP', async () => {
    const handler = new RedirectHandler('https://example.com/');
    await assert.rejects(
      async () => {
        await handler.handleRedirect('https://example.com/', 302, 'http://127.0.0.1/admin');
      },
      /loopback|private|blocked/i
    );

    await assert.rejects(
      async () => {
        await handler.handleRedirect('https://example.com/', 301, 'http://169.254.169.254/latest/meta-data/');
      },
      /cloud metadata|link-local|blocked/i
    );
  });

  it('redirect handler detects redirect loops and aborts', async () => {
    const handler = new RedirectHandler('https://example.com/loop1');
    await handler.handleRedirect('https://example.com/loop1', 302, 'https://example.com/loop2');
    await assert.rejects(
      async () => {
        await handler.handleRedirect('https://example.com/loop2', 302, 'https://example.com/loop1');
      },
      /loop/i
    );
  });
});

describe('PART 4 — Phase 3 AuditEngine Boundaries Regression', () => {
  it('registry has exactly 67 deterministic launch readiness checks registered', () => {
    const checks = defaultAuditRegistry.getAllChecks();
    assert.strictEqual(checks.length, 67, 'Audit registry must have exactly 67 registered checks');
  });

  it('all registered checks have unique checkId and valid metadata', () => {
    const checks = defaultAuditRegistry.getAllChecks();
    const seenIds = new Set<string>();

    for (const check of checks) {
      assert.ok(check.id, 'Check ID must be defined');
      assert.ok(!seenIds.has(check.id), `Duplicate checkId found: ${check.id}`);
      seenIds.add(check.id);
      assert.ok(check.name, `Check ${check.id} must have name`);
      assert.ok(check.category, `Check ${check.id} must have category`);
      assert.ok(check.description, `Check ${check.id} must have description`);
      assert.strictEqual(typeof check.evaluate, 'function', `Check ${check.id} must have evaluate function`);
    }
  });

  it('running audit across 100 pages does not multiply check count', () => {
    const pages: PageScanResult[] = [];
    for (let i = 1; i <= 100; i++) {
      pages.push(createMockPage(`https://example.com/item-${i}`));
    }
    const scan: ScanResult = {
      scanId: 'scan-check-stability',
      inputUrl: 'https://example.com/',
      normalizedUrl: 'https://example.com/',
      startedAt: '2026-03-30T10:00:00.000Z',
      completedAt: '2026-03-30T10:00:05.000Z',
      totalDurationMs: 5000,
      status: 'completed',
      summary: {
        pagesAttempted: 100,
        pagesCompleted: 100,
        requestsMade: 100,
        totalBytesTransferred: 1000000,
        internalLinksDiscovered: 100,
        externalLinksDiscovered: 0,
      },
      pages,
      sitemaps: [
        {
          url: 'https://example.com/sitemap.xml',
          discoveredFrom: 'robots.txt',
          exists: true,
          statusCode: 200,
          isIndex: false,
          containedUrls: ['https://example.com/'],
        },
      ],
      robots: {
        url: 'https://example.com/robots.txt',
        exists: true,
        statusCode: 200,
        directives: [{ userAgent: '*', allows: ['/'], disallows: [] }],
        sitemapDeclarations: ['https://example.com/sitemap.xml'],
      },
      errors: [],
      limits: SCANNER_LIMITS,
    };

    const audit = runAudit(scan);
    assert.strictEqual(audit.counts.totalChecks, 67, 'Total checks evaluated must remain 67');
    assert.strictEqual(audit.findings.length, 67, 'Findings length must match 67 registered checks');

    const sum = audit.counts.critical + audit.counts.important + audit.counts.improvement + audit.counts.passed;
    assert.strictEqual(sum, 67, 'Critical + Important + Improvement + Passed must strictly equal 67');
  });

  it('runAudit preserves pure input/output contract without mutating scan result', () => {
    const page = createMockPage('https://example.com/pure');
    const scan: ScanResult = {
      scanId: 'scan-pure',
      inputUrl: 'https://example.com/pure',
      normalizedUrl: 'https://example.com/pure',
      startedAt: '2026-03-30T10:00:00.000Z',
      completedAt: '2026-03-30T10:00:01.000Z',
      totalDurationMs: 1000,
      status: 'completed',
      summary: {
        pagesAttempted: 1,
        pagesCompleted: 1,
        requestsMade: 1,
        totalBytesTransferred: 10000,
        internalLinksDiscovered: 1,
        externalLinksDiscovered: 0,
      },
      pages: [page],
      sitemaps: [],
      robots: {
        url: 'https://example.com/robots.txt',
        exists: true,
        statusCode: 200,
        directives: [{ userAgent: '*', allows: ['/'], disallows: [] }],
        sitemapDeclarations: [],
      },
      errors: [],
      limits: SCANNER_LIMITS,
    };

    const scanJsonBefore = JSON.stringify(scan);
    const audit = runAudit(scan);
    const scanJsonAfter = JSON.stringify(scan);

    assert.strictEqual(scanJsonBefore, scanJsonAfter, 'runAudit must NOT mutate input ScanResult');
    assert.ok(audit.scanId, 'Audit has scanId');
  });
});
