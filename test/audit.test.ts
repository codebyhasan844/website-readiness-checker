/**
 * Automated Test Suite for Audit & Rules Engine (Phase 3)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runAudit, auditResultToScanReport, defaultAuditRegistry } from '../src/audit';
import { ScanResult } from '../src/scanner/types';
import { SCANNER_LIMITS } from '../src/scanner/limits';

function createMockScanResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    scanId: 'scan-test-123',
    inputUrl: 'https://example.com/',
    normalizedUrl: 'https://example.com/',
    startedAt: '2026-03-30T10:00:00.000Z',
    completedAt: '2026-03-30T10:00:02.000Z',
    totalDurationMs: 2000,
    status: 'completed',
    summary: {
      pagesAttempted: 1,
      pagesCompleted: 1,
      requestsMade: 3,
      totalBytesTransferred: 50000,
      internalLinksDiscovered: 5,
      externalLinksDiscovered: 2,
    },
    pages: [
      {
        url: 'https://example.com/',
        normalizedUrl: 'https://example.com/',
        depth: 0,
        discoveredFrom: ['user-input'],
        http: {
          requestedUrl: 'https://example.com/',
          finalUrl: 'https://example.com/',
          statusCode: 200,
          statusText: 'OK',
          headers: {
            'content-type': 'text/html; charset=utf-8',
          },
          securityHeaders: {
            strictTransportSecurity: 'max-age=31536000; includeSubDomains',
            contentSecurityPolicy: "default-src 'self'",
            xContentTypeOptions: 'nosniff',
            xFrameOptions: 'SAMEORIGIN',
            referrerPolicy: 'strict-origin-when-cross-origin',
            permissionsPolicy: 'camera=(), microphone=()',
            contentEncoding: 'gzip',
          },
          contentType: 'text/html; charset=utf-8',
          responseBytes: 15000,
          durationMs: 250,
          timing: {
            startTime: 0,
            endTime: 250,
            totalMs: 250,
          },
          redirects: [],
        },
        document: {
          title: 'Example Domain - Official Production Portal',
          metaDescription: 'Welcome to Example Domain, a demonstration website featuring valid launch specifications.',
          canonicalUrl: 'https://example.com/',
          language: 'en',
          viewport: 'width=device-width, initial-scale=1',
          charset: 'utf-8',
          hasFavicon: true,
          hasStructuredData: true,
          openGraph: {
            'og:title': 'Example Domain',
            'og:image': 'https://example.com/social.png',
          },
        },
        headings: {
          h1Count: 1,
          items: [
            { level: 1, text: 'Welcome to Example Domain' },
            { level: 2, text: 'Getting Started' },
            { level: 3, text: 'Installation Guide' },
          ],
        },
        links: [
          {
            sourceUrl: 'https://example.com/',
            destinationUrl: '/about',
            normalizedDestination: 'https://example.com/about',
            anchorText: 'About Us',
            isInternal: true,
          },
        ],
        images: [
          {
            sourceUrl: 'https://example.com/',
            src: 'https://example.com/logo.webp',
            hasAlt: true,
            altText: 'Example Company Logo',
            width: '200',
            height: '50',
            imageType: 'webp',
          },
        ],
        resources: [
          {
            type: 'css',
            url: 'https://example.com/styles.css',
            isInternal: true,
            statusCode: 200,
            sizeBytes: 15000,
          },
          {
            type: 'javascript',
            url: 'https://example.com/app.js',
            isInternal: true,
            statusCode: 200,
            sizeBytes: 80000,
          },
        ],
        scanErrors: [],
      },
    ],
    robots: {
      url: 'https://example.com/robots.txt',
      exists: true,
      statusCode: 200,
      directives: [
        {
          userAgent: '*',
          allows: ['/'],
          disallows: ['/admin'],
        },
      ],
      sitemapDeclarations: ['https://example.com/sitemap.xml'],
    },
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
    errors: [],
    limits: SCANNER_LIMITS,
    ...overrides,
  };
}

describe('1. Audit Engine Pure Determinism & Readiness Status', () => {
  it('should evaluate a clean website as READY', () => {
    const scan = createMockScanResult();
    const audit = runAudit(scan);

    assert.equal(audit.readiness, 'READY');
    assert.equal(audit.counts.critical, 0);
    assert.equal(audit.counts.important, 0);
    assert.ok(audit.counts.passed > 20);
    assert.ok(audit.readinessReason.includes('Zero critical blockers'));
  });

  it('should evaluate identical scans deterministically with zero variance', () => {
    const scan = createMockScanResult();
    const audit1 = runAudit(scan);
    const audit2 = runAudit(scan);

    assert.equal(audit1.readiness, audit2.readiness);
    assert.equal(audit1.counts.critical, audit2.counts.critical);
    assert.equal(audit1.counts.important, audit2.counts.important);
    assert.equal(audit1.findings.length, audit2.findings.length);
  });

  it('should categorize a site with critical blockers as NOT READY', () => {
    const scan = createMockScanResult({
      status: 'failed',
      pages: [],
      errors: [
        {
          code: 'REQUEST_FAILED',
          message: 'Connection refused at port 443',
          timestamp: '2026-03-30T10:00:00Z',
        },
      ],
    });

    const audit = runAudit(scan);
    assert.equal(audit.readiness, 'NOT READY');
    assert.ok(audit.counts.critical >= 1);
    const reachableFinding = audit.findings.find((f) => f.checkId === 'tech-website-reachable');
    assert.equal(reachableFinding?.severity, 'critical');
  });

  it('should categorize a site with important issues but no critical issues as REVIEW REQUIRED', () => {
    const scan = createMockScanResult();
    // Invalidate sitemap and remove title to introduce important issues
    scan.sitemaps = [];
    scan.pages[0].document.metaDescription = undefined;

    const audit = runAudit(scan);
    assert.equal(audit.readiness, 'REVIEW REQUIRED');
    assert.equal(audit.counts.critical, 0);
    assert.ok(audit.counts.important >= 1);
  });
});

describe('2. Mandatory 5 Attributes on Every Finding', () => {
  it('should ensure all findings contain title, evidence, explanation, whyItMatters, and recommendation', () => {
    const scan = createMockScanResult();
    const audit = runAudit(scan);

    for (const f of audit.findings) {
      assert.ok(f.id && f.id.length > 0, `Finding id missing for check ${f.checkId}`);
      assert.ok(f.title && f.title.length > 0, `Finding title missing for check ${f.checkId}`);
      assert.ok(f.evidence && f.evidence.summary.length > 0, `Evidence summary missing for check ${f.checkId}`);
      assert.ok(f.explanation && f.explanation.length > 0, `Explanation missing for check ${f.checkId}`);
      assert.ok(f.whyItMatters && f.whyItMatters.length > 0, `WhyItMatters missing for check ${f.checkId}`);
      assert.ok(f.recommendation && f.recommendation.length > 0, `Recommendation missing for check ${f.checkId}`);
    }
  });
});

describe('3. Category Groupings & Check Execution', () => {
  it('should include checks across all 7 core categories', () => {
    const scan = createMockScanResult();
    const audit = runAudit(scan);

    const categories = new Set(audit.findings.map((f) => f.category));
    assert.ok(categories.has('technical'));
    assert.ok(categories.has('crawlability'));
    assert.ok(categories.has('seo'));
    assert.ok(categories.has('assets'));
    assert.ok(categories.has('performance'));
    assert.ok(categories.has('security'));
    assert.ok(categories.has('accessibility'));
  });

  it('should detect technical redirect loops and mark as critical', () => {
    const scan = createMockScanResult({
      errors: [
        {
          code: 'REDIRECT_LIMIT',
          message: 'Redirect loop detected between /home and /index',
          timestamp: '2026-03-30T10:00:00Z',
        },
      ],
    });

    const audit = runAudit(scan);
    const loopFinding = audit.findings.find((f) => f.checkId === 'tech-redirect-loop');
    assert.ok(loopFinding);
    assert.equal(loopFinding.severity, 'critical');
    assert.equal(audit.readiness, 'NOT READY');
  });

  it('should detect robots.txt Disallow: / and mark as critical', () => {
    const scan = createMockScanResult({
      robots: {
        url: 'https://example.com/robots.txt',
        exists: true,
        statusCode: 200,
        directives: [
          {
            userAgent: '*',
            allows: [],
            disallows: ['/'],
          },
        ],
        sitemapDeclarations: [],
      },
    });

    const audit = runAudit(scan);
    const blockFinding = audit.findings.find((f) => f.checkId === 'tech-homepage-robots-block');
    assert.ok(blockFinding);
    assert.equal(blockFinding.severity, 'critical');
  });

  it('should detect broken internal links and mark as critical', () => {
    const scan = createMockScanResult();
    scan.pages.push({
      url: 'https://example.com/broken-page',
      normalizedUrl: 'https://example.com/broken-page',
      depth: 1,
      discoveredFrom: ['homepage-link'],
      http: {
        requestedUrl: 'https://example.com/broken-page',
        finalUrl: 'https://example.com/broken-page',
        statusCode: 404,
        statusText: 'Not Found',
        headers: {},
        securityHeaders: {},
        contentType: 'text/html',
        responseBytes: 200,
        durationMs: 100,
        timing: { startTime: 0, endTime: 100, totalMs: 100 },
        redirects: [],
      },
      document: {},
      headings: { h1Count: 0, items: [] },
      links: [],
      images: [],
      resources: [],
      scanErrors: [],
    });

    scan.pages[0].links.push({
      sourceUrl: 'https://example.com/',
      destinationUrl: 'https://example.com/broken-page',
      normalizedDestination: 'https://example.com/broken-page',
      anchorText: 'Broken link',
      isInternal: true,
    });

    const audit = runAudit(scan);
    const brokenLinkFinding = audit.findings.find((f) => f.checkId === 'crawl-broken-internal-links');
    assert.ok(brokenLinkFinding);
    assert.equal(brokenLinkFinding.severity, 'critical');
  });

  it('should detect missing H1 heading', () => {
    const scan = createMockScanResult();
    scan.pages[0].headings.h1Count = 0;

    const audit = runAudit(scan);
    const h1Finding = audit.findings.find((f) => f.checkId === 'seo-missing-h1');
    assert.ok(h1Finding);
    assert.equal(h1Finding.severity, 'important');
  });
});

describe('4. Documented Unsupported Checks', () => {
  it('should clearly list unsupported checks without hallucinating evidence', () => {
    const scan = createMockScanResult();
    const audit = runAudit(scan);

    assert.ok(audit.unsupportedChecks.length > 0);
    const sslUnsupported = audit.unsupportedChecks.find((u) => u.id === 'tech-ssl-cert-validity');
    assert.ok(sslUnsupported);
    assert.ok(sslUnsupported.reason.includes('Node HTTP/fetch scanner abstraction'));
  });
});

describe('5. Conversion to UI ScanReport Contract', () => {
  it('should convert AuditResult to ScanReport seamlessly', () => {
    const scan = createMockScanResult();
    const audit = runAudit(scan);
    const report = auditResultToScanReport(audit, scan);

    assert.equal(report.id, scan.scanId);
    assert.equal(report.readiness, audit.readiness);
    assert.equal(report.summary.critical, audit.counts.critical);
    assert.equal(report.summary.important, audit.counts.important);
    assert.equal(report.findings.length, audit.findings.length);
    assert.ok(report.findings[0].evidence);
    assert.ok(report.findings[0].explanation);
    assert.ok(report.findings[0].recommendation);
  });
});
