import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import type { PageScanResult, ScanResult } from '../src/scanner/types';

describe('Phase 5.4 — UX, Performance & Accessibility Verification', () => {
  it('A11Y-01: index.css includes prefers-reduced-motion media query for WCAG 2.3.3 compliance', () => {
    const cssPath = path.resolve('src/index.css');
    const content = fs.readFileSync(cssPath, 'utf8');
    assert.ok(
      content.includes('@media (prefers-reduced-motion: reduce)'),
      'index.css must include prefers-reduced-motion media query'
    );
    assert.ok(
      content.includes('animation-duration: 0.01ms') || content.includes('transition-duration'),
      'index.css must reduce animation/transition duration when prefers-reduced-motion is active'
    );
  });

  it('A11Y-02: App.tsx includes Skip to Main Content link and main content landmark id', () => {
    const appPath = path.resolve('src/App.tsx');
    const content = fs.readFileSync(appPath, 'utf8');
    assert.ok(
      content.includes('Skip to main content'),
      'App.tsx must contain a skip link for keyboard navigation'
    );
    assert.ok(
      content.includes('id="main-content"'),
      'App.tsx must provide id="main-content" on the main landmark'
    );
  });

  it('A11Y-03: UrlScanInput has accessible label and aria-live announcements for screen readers', () => {
    const inputPath = path.resolve('src/components/UrlScanInput.tsx');
    const content = fs.readFileSync(inputPath, 'utf8');
    assert.ok(
      content.includes('htmlFor="target-url-input"') || content.includes('aria-label="Target Website URL to check"'),
      'UrlScanInput must have an accessible name/label for the URL input'
    );
    assert.ok(
      content.includes('aria-live="polite"'),
      'UrlScanInput must announce scanning progress to screen readers via aria-live'
    );
    assert.ok(
      content.includes('aria-invalid='),
      'UrlScanInput must communicate invalid state via aria-invalid'
    );
  });

  it('SCAN-UI-01: UrlScanInput exits scanning and displays scan_error messages', () => {
    const inputPath = path.resolve('src/components/UrlScanInput.tsx');
    const content = fs.readFileSync(inputPath, 'utf8');

    assert.ok(content.includes('consumeScanSseStream'));
    assert.ok(content.includes("setScanState('failed')"));
    assert.ok(content.includes('onError: (message: string) =>'));
  });

  it('SCAN-UI-02: UrlScanInput stops on cancellation and handles shutdown/stream termination', () => {
    const inputPath = path.resolve('src/components/UrlScanInput.tsx');
    const content = fs.readFileSync(inputPath, 'utf8');

    assert.ok(content.includes('onCancelled: () =>'));
    assert.ok(content.includes("setScanState('idle')"));
    assert.ok(content.includes('onServerShutdown: () =>'));
    assert.ok(content.includes('temporarily unavailable'));
    assert.ok(content.includes('onError: (message: string) =>'));
  });

  it('A11Y-04: ReportFilters search input has accessible label and buttons have aria-pressed', () => {
    const filtersPath = path.resolve('src/components/report/ReportFilters.tsx');
    const content = fs.readFileSync(filtersPath, 'utf8');
    assert.ok(
      content.includes('htmlFor="findings-search-input"'),
      'ReportFilters must include an associated label for search input'
    );
    assert.ok(
      content.includes('aria-pressed='),
      'Filter buttons in ReportFilters must declare active state via aria-pressed'
    );
    assert.ok(
      content.includes('aria-label="Clear search query"'),
      'Search reset button must have an accessible aria-label'
    );
  });

  it('A11Y-05: FixFirstSection uses semantic button elements with h2/h3 hierarchy', () => {
    const fixFirstPath = path.resolve('src/components/report/FixFirstSection.tsx');
    const content = fs.readFileSync(fixFirstPath, 'utf8');
    assert.ok(
      content.includes('<h2 className="text-sm sm:text-base font-bold text-white'),
      'FixFirstSection must use h2 for section title under page h1'
    );
    assert.ok(
      content.includes('<button') && content.includes('onClick={() => onSelectFinding(item.id)}'),
      'FixFirstSection items must be semantic button elements for keyboard navigation'
    );
    assert.ok(
      content.includes('focus-visible:ring-2'),
      'FixFirstSection buttons must have visible focus rings'
    );
  });

  it('A11Y-06: LaunchChecklist uses semantic h2 and avoids nested interactive elements', () => {
    const checklistPath = path.resolve('src/components/report/LaunchChecklist.tsx');
    const content = fs.readFileSync(checklistPath, 'utf8');
    assert.ok(
      content.includes('<h2 className="text-base font-bold text-white'),
      'LaunchChecklist must use h2 for section title'
    );
    assert.ok(
      content.includes('aria-pressed={isMarked}'),
      'Checkbox toggle button must declare state via aria-pressed'
    );
  });

  it('A11Y-07: ComparisonView uses semantic buttons for stillOpen, new, and changed findings', () => {
    const compPath = path.resolve('src/components/report/ComparisonView.tsx');
    const content = fs.readFileSync(compPath, 'utf8');
    assert.ok(
      content.includes('<h2 className="text-base font-bold text-white'),
      'ComparisonView must use h2 for section title'
    );
    assert.ok(
      content.includes('role="tab"'),
      'Filter tabs must declare role="tab"'
    );
    assert.ok(
      content.includes('<button') && content.includes('onClick={() => onSelectFinding?.(f.checkId)}'),
      'Comparison items must be accessible button elements'
    );
  });

  it('A11Y-08: Modals support keyboard Escape key and focus management', () => {
    const rescanPath = path.resolve('src/components/report/ReScanModal.tsx');
    const continuePath = path.resolve('src/components/report/ContinueAuditModal.tsx');
    const rescanContent = fs.readFileSync(rescanPath, 'utf8');
    const continueContent = fs.readFileSync(continuePath, 'utf8');

    assert.ok(
      rescanContent.includes("e.key === 'Escape'"),
      'ReScanModal must close on Escape key'
    );
    assert.ok(
      rescanContent.includes('ref={modalRef}'),
      'ReScanModal must manage focus via modalRef'
    );
    assert.ok(
      continueContent.includes("e.key === 'Escape'"),
      'ContinueAuditModal must close on Escape key'
    );
    assert.ok(
      continueContent.includes('aria-label="Close modal"'),
      'ContinueAuditModal must have accessible close button label'
    );
  });

  it('PERF-01: FindingCard uses useMemo and safeguards against massive DOM flooding', () => {
    const cardPath = path.resolve('src/components/FindingCard.tsx');
    const content = fs.readFileSync(cardPath, 'utf8');
    assert.ok(
      content.includes('useMemo'),
      'FindingCard must use useMemo to avoid repeated array allocations'
    );
    assert.ok(
      content.includes('MAX_DOM_ITEMS'),
      'FindingCard must cap maximum rendered URLs/resources to protect browser DOM performance'
    );
  });

  it('PERF-02: FindingList memoizes groups and provides Expand All / Collapse All controls', () => {
    const listPath = path.resolve('src/components/report/FindingList.tsx');
    const content = fs.readFileSync(listPath, 'utf8');
    assert.ok(
      content.includes('useMemo'),
      'FindingList must memoize finding severity groups'
    );
    assert.ok(
      content.includes('Expand All') && content.includes('Collapse All'),
      'FindingList must provide bulk expand/collapse controls for user convenience'
    );
  });

  it('UX-01: ReadinessHeader provides loading state on PDF export', () => {
    const headerPath = path.resolve('src/components/report/ReadinessHeader.tsx');
    const content = fs.readFileSync(headerPath, 'utf8');
    assert.ok(
      content.includes('isExportingPdf'),
      'ReadinessHeader must manage isExportingPdf state'
    );
    assert.ok(
      content.includes('aria-busy='),
      'Export PDF button must communicate loading state via aria-busy'
    );
  });

  it('LIMITS-01: Scanner limits strictly match Phase 5.3 verified values without regression', async () => {
    const { SCANNER_LIMITS } = await import('../src/scanner/limits');
    const { MemoryRateLimiter } = await import('../src/scanner/rate-limiter');

    assert.strictEqual(SCANNER_LIMITS.maxPages, 50, 'maxPages must be 50');
    assert.strictEqual(SCANNER_LIMITS.maxDepth, 3, 'maxDepth must be 3');
    assert.strictEqual(SCANNER_LIMITS.maxRedirects, 5, 'maxRedirects must be 5');
    assert.strictEqual(SCANNER_LIMITS.maxTotalRequests, 150, 'maxTotalRequests must be 150');
    assert.strictEqual(SCANNER_LIMITS.requestTimeoutMs, 8000, 'requestTimeoutMs must be 8000');
    assert.strictEqual(SCANNER_LIMITS.maxScanDurationMs, 60000, 'maxScanDurationMs must be 60000');
    assert.strictEqual(SCANNER_LIMITS.maxResponseBytes, 3145728, 'maxResponseBytes must be 3145728 (3 MB)');
    assert.strictEqual(SCANNER_LIMITS.maxHtmlBytes, 2097152, 'maxHtmlBytes must be 2097152 (2 MB)');
    assert.strictEqual(SCANNER_LIMITS.maxSitemapUrls, 250, 'maxSitemapUrls must be 250');
    assert.deepStrictEqual(SCANNER_LIMITS.allowedPorts, [80, 443], 'allowedPorts must be [80, 443]');
    assert.strictEqual(SCANNER_LIMITS.maxResourcesPerPage, 5, 'maxResourcesPerPage must be 5');

    const limiter = new MemoryRateLimiter();
    assert.strictEqual(limiter['options'].maxConcurrentScans, 3, 'maxConcurrentScans must be 3');
    assert.strictEqual(limiter['options'].maxScansPerWindow, 15, 'maxScansPerWindow must be 15');
    assert.strictEqual(limiter['options'].windowMs, 300000, 'windowMs must be 300000 (5 minutes)');
  });

  it('INVARIANT-01: Audit engine guarantees strict 67-check evaluation boundary under all conditions', async () => {
    const { runAudit } = await import('../src/audit/engine');
    const { defaultAuditRegistry } = await import('../src/audit/registry');
    const { SCANNER_LIMITS } = await import('../src/scanner/limits');

    const registered = defaultAuditRegistry.getAllChecks();
    assert.strictEqual(registered.length, 67, 'Audit registry must have exactly 67 registered checks');

    const makeScan = (overrides: Partial<ScanResult> = {}): ScanResult => {
      const page: PageScanResult = {
        url: 'https://example.com/',
        normalizedUrl: 'https://example.com/',
        depth: 0,
        discoveredFrom: ['input'],
        http: {
          requestedUrl: 'https://example.com/',
          finalUrl: 'https://example.com/',
          statusCode: 200,
          statusText: 'OK',
          headers: { 'content-type': 'text/html' },
          redirects: [],
          contentType: 'text/html',
          responseBytes: 1000,
          durationMs: 50,
          timing: { startTime: 0, endTime: 50, totalMs: 50 },
          securityHeaders: {},
        },
        document: {
          title: 'Test Title',
          metaDescription: 'Test Description that is adequately descriptive.',
          canonicalUrl: 'https://example.com/',
          language: 'en',
          viewport: 'width=device-width, initial-scale=1',
          charset: 'utf-8',
          hasFavicon: true,
          hasStructuredData: true,
        },
        headings: { h1Count: 1, items: [{ level: 1, text: 'Heading' }] },
        links: [],
        images: [],
        resources: [],
        scanErrors: [],
      };

      return {
        scanId: 'scan-inv-test',
        inputUrl: 'https://example.com/',
        normalizedUrl: 'https://example.com/',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        totalDurationMs: 100,
        status: 'completed',
        summary: {
          pagesAttempted: 1,
          pagesCompleted: 1,
          requestsMade: 1,
          totalBytesTransferred: 1000,
          internalLinksDiscovered: 0,
          externalLinksDiscovered: 0,
        },
        pages: [page],
        sitemaps: [],
        robots: {
          url: 'https://example.com/robots.txt',
          exists: false,
          statusCode: 404,
          directives: [],
          sitemapDeclarations: [],
        },
        errors: [],
        limits: SCANNER_LIMITS,
        ...overrides,
      };
    };

    // Case 1: No sitemaps, no robots.txt, tiny payload (< 1KB)
    const audit1 = runAudit(makeScan());
    assert.strictEqual(audit1.counts.totalChecks, 67, 'Must evaluate 67 checks without sitemaps or robots');
    assert.strictEqual(audit1.findings.length, 67, 'Must produce 67 findings');
    const sum1 = audit1.counts.critical + audit1.counts.important + audit1.counts.improvement + audit1.counts.passed;
    assert.strictEqual(sum1, 67, 'Sum of severities must equal 67');

    // Case 2: HTTP scan (not HTTPS)
    const httpScan = makeScan({
      inputUrl: 'http://example.com/',
      normalizedUrl: 'http://example.com/',
      pages: [
        {
          ...makeScan().pages[0],
          url: 'http://example.com/',
          http: {
            ...makeScan().pages[0].http,
            requestedUrl: 'http://example.com/',
            finalUrl: 'http://example.com/',
          },
        },
      ],
    });
    const audit2 = runAudit(httpScan);
    assert.strictEqual(audit2.counts.totalChecks, 67, 'Must evaluate 67 checks on HTTP scan');
    assert.strictEqual(audit2.findings.length, 67, 'Must produce 67 findings on HTTP scan');
    const sum2 = audit2.counts.critical + audit2.counts.important + audit2.counts.improvement + audit2.counts.passed;
    assert.strictEqual(sum2, 67, 'Sum of severities on HTTP must equal 67');
  });
});
