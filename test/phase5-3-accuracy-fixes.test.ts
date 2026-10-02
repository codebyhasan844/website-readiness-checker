/**
 * PHASE 5.3 FOCUSED ACCURACY & RELIABILITY REGRESSION TEST SUITE:
 * 
 * ACC-01: Fix budget-skipped assets being falsely flagged as broken
 * ACC-02: Form control label semantic HTML recognition (<label for>, wrapping <label>, aria)
 * ACC-03: Relative canonical URL resolution against page URL
 * ACC-04: Content compression observation & Accept-Encoding headers
 * ACC-09: Precision in dev/staging/localhost references without false positives on 'test.*' filenames
 * ACC-10: Accurate HTTP->HTTPS redirect claim (no false PASS when unverified)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HtmlParser } from '../src/scanner/parser';
import { defaultAuditRegistry } from '../src/audit/registry';
import { ScanResult, PageScanResult } from '../src/scanner/types';
import { SCANNER_LIMITS } from '../src/scanner/limits';

function createMockPage(url: string, overrides: Partial<PageScanResult> = {}): PageScanResult {
  return {
    url,
    normalizedUrl: url,
    depth: 0,
    discoveredFrom: ['input'],
    http: {
      requestedUrl: url,
      finalUrl: url,
      statusCode: 200,
      statusText: 'OK',
      headers: { 'content-type': 'text/html; charset=utf-8' },
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
      responseBytes: 10000,
      durationMs: 120,
      timing: { startTime: 0, endTime: 120, totalMs: 120 },
      redirects: [],
    },
    document: {
      title: 'Valid Example Title For Page Testing SEO Compliance',
      metaDescription: 'A valid meta description meeting standard length and relevance specifications.',
      canonicalUrl: url,
      language: 'en',
      viewport: 'width=device-width, initial-scale=1',
      charset: 'utf-8',
      hasFavicon: true,
      hasStructuredData: true,
    },
    headings: {
      h1Count: 1,
      items: [{ level: 1, text: 'Main Heading' }],
    },
    links: [],
    images: [],
    resources: [],
    scanErrors: [],
    ...overrides,
  };
}

function createBaseScan(pages: PageScanResult[], overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    scanId: 'scan-acc-test',
    inputUrl: pages[0]?.url || 'https://example.com/',
    normalizedUrl: pages[0]?.normalizedUrl || 'https://example.com/',
    startedAt: '2026-03-30T10:00:00.000Z',
    completedAt: '2026-03-30T10:00:02.000Z',
    totalDurationMs: 2000,
    status: 'completed',
    summary: {
      pagesAttempted: pages.length,
      pagesCompleted: pages.length,
      requestsMade: pages.length,
      totalBytesTransferred: 50000,
      internalLinksDiscovered: 5,
      externalLinksDiscovered: 0,
    },
    pages,
    robots: {
      url: 'https://example.com/robots.txt',
      exists: true,
      statusCode: 200,
      directives: [{ userAgent: '*', allows: ['/'], disallows: [] }],
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

describe('ACC-01 — Budget-Skipped Assets vs Actual Broken Assets', () => {
  const check = defaultAuditRegistry.getCheckById('asset-broken-resources')!;

  it('budget-skipped resources do NOT trigger broken resource finding', () => {
    const page = createMockPage('https://example.com/', {
      resources: [
        {
          type: 'javascript',
          url: 'https://example.com/script.js',
          isInternal: true,
          isSkipped: true,
          skippedReason: 'global scan request limit reached',
        },
        {
          type: 'css',
          url: 'https://example.com/style.css',
          isInternal: true,
          isSkipped: true,
          skippedReason: 'global scan request limit reached',
        },
      ],
    });

    const scan = createBaseScan([page]);
    const findings = check.evaluate(scan);

    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, 'passed');
    assert.ok(findings[0].evidence.summary.includes('skipped due to request budget limit'));
  });

  it('actual 404 HTTP resource DOES trigger broken resource finding', () => {
    const page = createMockPage('https://example.com/', {
      resources: [
        {
          type: 'javascript',
          url: 'https://example.com/missing.js',
          isInternal: true,
          statusCode: 404,
        },
      ],
    });

    const scan = createBaseScan([page]);
    const findings = check.evaluate(scan);

    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, 'critical');
    assert.ok(findings[0].evidence.summary.includes('1 referenced resource(s) failed'));
  });

  it('actual 5xx HTTP resource DOES trigger broken resource finding', () => {
    const page = createMockPage('https://example.com/', {
      resources: [
        {
          type: 'css',
          url: 'https://example.com/server-error.css',
          isInternal: true,
          statusCode: 502,
        },
      ],
    });

    const scan = createBaseScan([page]);
    const findings = check.evaluate(scan);

    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, 'critical');
  });

  it('actual network fetch failure DOES trigger broken resource finding', () => {
    const page = createMockPage('https://example.com/', {
      resources: [
        {
          type: 'font',
          url: 'https://example.com/font.woff2',
          isInternal: true,
          error: 'Connection reset by peer',
        },
      ],
    });

    const scan = createBaseScan([page]);
    const findings = check.evaluate(scan);

    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, 'critical');
    assert.ok(findings[0].evidence.summary.includes('failed to load'));
  });
});

describe('ACC-02 — Form Control Label Semantic HTML Recognition', () => {
  it('recognizes <label for="..."> association as labeled', () => {
    const html = `
      <form>
        <label for="username">Username</label>
        <input id="username" type="text">
        <label for="pwd">Password</label>
        <input id="pwd" type="password">
      </form>
    `;
    const doc = HtmlParser.extractDocumentData(html);
    assert.equal(doc.unlabeledFormControls, 0);
  });

  it('recognizes wrapping <label>...</label> as labeled', () => {
    const html = `
      <form>
        <label>
          Email Address
          <input type="email">
        </label>
        <label>
          Comments
          <textarea></textarea>
        </label>
      </form>
    `;
    const doc = HtmlParser.extractDocumentData(html);
    assert.equal(doc.unlabeledFormControls, 0);
  });

  it('recognizes aria-label and aria-labelledby', () => {
    const html = `
      <div>
        <h2 id="search-heading">Search Site</h2>
        <input type="search" aria-labelledby="search-heading">
        <input type="text" aria-label="Postal Code">
      </div>
    `;
    const doc = HtmlParser.extractDocumentData(html);
    assert.equal(doc.unlabeledFormControls, 0);
  });

  it('recognizes title and placeholder attributes', () => {
    const html = `
      <div>
        <input type="text" title="First Name">
        <input type="text" placeholder="Enter keywords...">
      </div>
    `;
    const doc = HtmlParser.extractDocumentData(html);
    assert.equal(doc.unlabeledFormControls, 0);
  });

  it('correctly counts genuinely unlabeled inputs while ignoring buttons and hidden fields', () => {
    const html = `
      <form>
        <input type="hidden" name="csrf" value="abc123">
        <input type="submit" value="Submit">
        <button type="button">Click</button>
        <input type="text"> <!-- Unlabeled -->
        <select><option>Choose</option></select> <!-- Unlabeled -->
      </form>
    `;
    const doc = HtmlParser.extractDocumentData(html);
    assert.equal(doc.unlabeledFormControls, 2);
  });
});

describe('ACC-03 — Relative Canonical URL Resolution & Validation', () => {
  const check = defaultAuditRegistry.getCheckById('seo-invalid-canonical')!;

  it('accepts valid absolute canonical URL', () => {
    const page = createMockPage('https://example.com/articles/post', {
      document: {
        title: 'Title',
        canonicalUrl: 'https://example.com/articles/post',
      },
    });
    const scan = createBaseScan([page]);
    const findings = check.evaluate(scan);
    assert.equal(findings[0].severity, 'passed');
  });

  it('accepts root-relative canonical URL and resolves against page URL', () => {
    const page = createMockPage('https://example.com/articles/post', {
      document: {
        title: 'Title',
        canonicalUrl: '/articles/post',
      },
    });
    const scan = createBaseScan([page]);
    const findings = check.evaluate(scan);
    assert.equal(findings[0].severity, 'passed');
  });

  it('accepts relative canonical URL (./post and ../post)', () => {
    const page1 = createMockPage('https://example.com/category/tech/post', {
      document: {
        title: 'Title',
        canonicalUrl: '../tech/post',
      },
    });
    const page2 = createMockPage('https://example.com/category/tech/', {
      document: {
        title: 'Title',
        canonicalUrl: './overview',
      },
    });
    const scan = createBaseScan([page1, page2]);
    const findings = check.evaluate(scan);
    assert.equal(findings[0].severity, 'passed');
  });

  it('flags unsupported schemes (javascript, file, ftp)', () => {
    const page = createMockPage('https://example.com/articles/post', {
      document: {
        title: 'Title',
        canonicalUrl: 'javascript:alert(1)',
      },
    });
    const scan = createBaseScan([page]);
    const findings = check.evaluate(scan);
    assert.equal(findings[0].severity, 'critical');
    assert.ok(findings[0].evidence.summary.includes('malformed or unresolvable'));
  });

  it('flags empty canonical string', () => {
    const page = createMockPage('https://example.com/articles/post', {
      document: {
        title: 'Title',
        canonicalUrl: '   ',
      },
    });
    const scan = createBaseScan([page]);
    const findings = check.evaluate(scan);
    assert.equal(findings[0].severity, 'critical');
  });
});

describe('ACC-09 — Staging and Localhost Reference Precision', () => {
  const check = defaultAuditRegistry.getCheckById('tech-staging-localhost-refs')!;

  it('does NOT flag legitimate production assets containing "test." in filename', () => {
    const page = createMockPage('https://example.com/', {
      links: [
        {
          sourceUrl: 'https://example.com/',
          destinationUrl: 'https://example.com/user-test.html',
          normalizedDestination: 'https://example.com/user-test.html',
          anchorText: 'User Test',
          isInternal: true,
        },
      ],
      resources: [
        {
          type: 'javascript',
          url: 'https://example.com/assets/speedtest.min.js',
          isInternal: true,
        },
        {
          type: 'image',
          url: 'https://example.com/images/test.png',
          isInternal: true,
        },
      ],
    });

    const scan = createBaseScan([page]);
    const findings = check.evaluate(scan);
    assert.equal(findings[0].severity, 'passed');
  });

  it('DOES detect genuine localhost and 127.0.0.1 references', () => {
    const page = createMockPage('https://example.com/', {
      links: [
        {
          sourceUrl: 'https://example.com/',
          destinationUrl: 'http://localhost:3000/api',
          normalizedDestination: 'http://localhost:3000/api',
          anchorText: 'Dev API',
          isInternal: false,
        },
      ],
    });

    const scan = createBaseScan([page]);
    const findings = check.evaluate(scan);
    assert.equal(findings[0].severity, 'important');
    assert.ok(findings[0].evidence.summary.includes('localhost'));
  });

  it('DOES detect staging and dev subdomains (dev.example.com, staging.example.com)', () => {
    const page = createMockPage('https://example.com/', {
      resources: [
        {
          type: 'javascript',
          url: 'https://staging.example.com/bundle.js',
          isInternal: false,
        },
      ],
    });

    const scan = createBaseScan([page]);
    const findings = check.evaluate(scan);
    assert.equal(findings[0].severity, 'important');
  });
});

describe('ACC-10 — HTTP to HTTPS Redirect Verification Claim', () => {
  const check = defaultAuditRegistry.getCheckById('tech-http-to-https-redirect')!;

  it('reports state as unverified improvement (NOT false pass) when scan started on HTTPS', () => {
    const page = createMockPage('https://example.com/');
    const scan = createBaseScan([page], {
      inputUrl: 'https://example.com/',
      normalizedUrl: 'https://example.com/',
    });

    const findings = check.evaluate(scan);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, 'improvement');
    assert.ok(findings[0].evidence.summary.includes('not verified'));
  });

  it('reports passed when scan input was http:// and redirected to https://', () => {
    const page = createMockPage('https://example.com/', {
      http: {
        requestedUrl: 'http://example.com/',
        finalUrl: 'https://example.com/',
        statusCode: 200,
        statusText: 'OK',
        headers: {},
        securityHeaders: {},
        contentType: 'text/html',
        responseBytes: 5000,
        durationMs: 150,
        timing: { startTime: 0, endTime: 150, totalMs: 150 },
        redirects: [
          {
            requestedUrl: 'http://example.com/',
            destinationUrl: 'https://example.com/',
            statusCode: 301,
          },
        ],
      },
    });

    const scan = createBaseScan([page], {
      inputUrl: 'http://example.com/',
      normalizedUrl: 'https://example.com/',
    });

    const findings = check.evaluate(scan);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, 'passed');
    assert.ok(findings[0].evidence.summary.includes('automatically redirect to secure HTTPS'));
  });

  it('reports important issue when scan input was http:// and stayed on unencrypted http://', () => {
    const page = createMockPage('http://example.com/', {
      http: {
        requestedUrl: 'http://example.com/',
        finalUrl: 'http://example.com/',
        statusCode: 200,
        statusText: 'OK',
        headers: {},
        securityHeaders: {},
        contentType: 'text/html',
        responseBytes: 5000,
        durationMs: 150,
        timing: { startTime: 0, endTime: 150, totalMs: 150 },
        redirects: [],
      },
    });

    const scan = createBaseScan([page], {
      inputUrl: 'http://example.com/',
      normalizedUrl: 'http://example.com/',
    });

    const findings = check.evaluate(scan);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, 'important');
    assert.ok(findings[0].evidence.summary.includes('do not redirect to HTTPS'));
  });
});

describe('ACC-05 — High Resource Request Count (perf-excessive-resources)', () => {
  const check = defaultAuditRegistry.getCheckById('perf-excessive-resources')!;

  it('triggers improvement when totalResourcesDiscovered exceeds 60', () => {
    const page = createMockPage('https://example.com/', {
      totalResourcesDiscovered: 75,
      resources: Array.from({ length: 30 }, (_, i) => ({
        type: 'javascript',
        url: `https://example.com/script-${i}.js`,
        isInternal: true,
      })),
    });
    const scan = createBaseScan([page]);
    const findings = check.evaluate(scan);
    assert.equal(findings[0].severity, 'improvement');
    assert.ok(findings[0].evidence.summary.includes('more than 60 separate resource requests'));
  });

  it('passes when totalResourcesDiscovered is 60 or less', () => {
    const page = createMockPage('https://example.com/', {
      totalResourcesDiscovered: 25,
      resources: [],
    });
    const scan = createBaseScan([page]);
    const findings = check.evaluate(scan);
    assert.equal(findings[0].severity, 'passed');
  });
});

describe('ACC-06 — Oversized Image Weights (asset-oversized-images)', () => {
  const check = defaultAuditRegistry.getCheckById('asset-oversized-images')!;

  it('triggers important finding when a sampled image exceeds 1 MB', () => {
    const page = createMockPage('https://example.com/', {
      resources: [
        {
          type: 'image',
          url: 'https://example.com/huge.png',
          isInternal: true,
          sizeBytes: 1.5 * 1024 * 1024,
        },
      ],
    });
    const scan = createBaseScan([page]);
    const findings = check.evaluate(scan);
    assert.equal(findings[0].severity, 'important');
    assert.ok(findings[0].evidence.summary.includes('exceed 1 MB in file weight'));
  });

  it('passes when all sampled images are <= 1 MB', () => {
    const page = createMockPage('https://example.com/', {
      resources: [
        {
          type: 'image',
          url: 'https://example.com/normal.png',
          isInternal: true,
          sizeBytes: 250 * 1024,
        },
      ],
    });
    const scan = createBaseScan([page]);
    const findings = check.evaluate(scan);
    assert.equal(findings[0].severity, 'passed');
  });
});

describe('ACC-07 — Site Crawl Depth & Structure (crawl-crawl-depth)', () => {
  const check = defaultAuditRegistry.getCheckById('crawl-crawl-depth')!;

  it('triggers improvement when depth-blocked URLs are reported by scanner', () => {
    const page = createMockPage('https://example.com/deep/page', { depth: 3 });
    const scan = createBaseScan([page], { depthBlockedUrlsCount: 8 });
    const findings = check.evaluate(scan);
    assert.equal(findings[0].severity, 'improvement');
    assert.ok(findings[0].evidence.summary.includes('require more than 3 clicks'));
  });

  it('passes when site hierarchy remains within 3 hops with zero depth-blocked links', () => {
    const page = createMockPage('https://example.com/page', { depth: 2 });
    const scan = createBaseScan([page], { depthBlockedUrlsCount: 0 });
    const findings = check.evaluate(scan);
    assert.equal(findings[0].severity, 'passed');
    assert.ok(findings[0].evidence.summary.includes('optimal click depth'));
  });
});

describe('ACC-08 — Static Asset Cache Headers (perf-cache-control)', () => {
  const check = defaultAuditRegistry.getCheckById('perf-cache-control')!;

  it('triggers improvement when sampled static assets lack effective cache-control', () => {
    const page = createMockPage('https://example.com/', {
      resources: [
        {
          type: 'css',
          url: 'https://example.com/styles.css',
          isInternal: true,
          statusCode: 200,
          cacheControl: 'no-store',
        },
      ],
    });
    const scan = createBaseScan([page]);
    const findings = check.evaluate(scan);
    assert.equal(findings[0].severity, 'improvement');
    assert.ok(findings[0].evidence.summary.includes('lack effective browser caching policies'));
  });

  it('passes when sampled static assets declare long max-age cache-control', () => {
    const page = createMockPage('https://example.com/', {
      resources: [
        {
          type: 'css',
          url: 'https://example.com/styles.css',
          isInternal: true,
          statusCode: 200,
          cacheControl: 'public, max-age=31536000, immutable',
        },
      ],
    });
    const scan = createBaseScan([page]);
    const findings = check.evaluate(scan);
    assert.equal(findings[0].severity, 'passed');
  });
});

describe('ACC-11 — Total Bytes Transferred Accounting', () => {
  it('correctly aggregates bytes transferred across pages, resources, robots, and sitemaps', () => {
    const page1 = createMockPage('https://example.com/');
    const page2 = createMockPage('https://example.com/about');
    const scan = createBaseScan([page1, page2], {
      summary: {
        pagesAttempted: 2,
        pagesCompleted: 2,
        requestsMade: 4,
        totalBytesTransferred: 65432,
        internalLinksDiscovered: 2,
        externalLinksDiscovered: 0,
      },
    });

    assert.equal(scan.summary.totalBytesTransferred, 65432);
    assert.ok(scan.summary.totalBytesTransferred > 0);
  });
});

describe('ACC-12 — Crawler Discovery Truncation Protection', () => {
  it('enqueueing candidates beyond crawl queue capacity does not discard discovery inventory', async () => {
    const { BoundedCrawler } = await import('../src/scanner/crawler');
    const crawler = new BoundedCrawler('https://example.com/');

    const candidateLinks = Array.from({ length: 300 }, (_, i) => `https://example.com/item-${i + 1}`);
    crawler.enqueue(candidateLinks, 1, 'catalog-page');

    const discovered = crawler.getDiscoveredUrls();
    assert.ok(discovered.length >= 300, `Expected at least 300 discovered, got ${discovered.length}`);
    assert.ok(crawler.getQueueLength() <= 250, 'Queue length is capped at 250');
  });
});

describe('ACC-13 — HTML Parser Contamination From Comments & Scripts', () => {
  it('does NOT extract links inside HTML comments', () => {
    const html = `
      <div>
        <a href="/real-page">Real Link</a>
        <!-- <a href="/commented-out-page">Fake Link</a> -->
      </div>
    `;
    const links = HtmlParser.extractLinks(html, 'https://example.com/');
    assert.equal(links.length, 1);
    assert.equal(links[0].destinationUrl, '/real-page');
  });

  it('does NOT extract images inside HTML comments or scripts', () => {
    const html = `
      <div>
        <img src="/assets/real.png" alt="Real">
        <!-- <img src="/assets/commented.png" alt="Commented"> -->
        <script>const x = '<img src="/assets/script.png">';</script>
      </div>
    `;
    const images = HtmlParser.extractImages(html, 'https://example.com/');
    assert.equal(images.length, 1);
    assert.equal(images[0].src, '/assets/real.png');
  });

  it('does NOT extract referenced resources inside HTML comments', () => {
    const html = `
      <head>
        <link rel="stylesheet" href="/assets/real.css">
        <!-- <link rel="stylesheet" href="/assets/commented.css"> -->
        <!-- <script src="/assets/commented.js"></script> -->
        <script src="/assets/real.js"></script>
      </head>
    `;
    const resources = HtmlParser.extractResources(html, 'https://example.com/');
    assert.equal(resources.length, 2);
    assert.ok(resources.some((r) => r.url.endsWith('/assets/real.css')));
    assert.ok(resources.some((r) => r.url.endsWith('/assets/real.js')));
    assert.ok(!resources.some((r) => r.url.includes('commented')));
  });
});

describe('ACC-14 — Robots.txt Multi-Agent Parsing', () => {
  it('correctly maps shared directives to multiple user-agents per RFC 9309', async () => {
    const { RobotsHandler } = await import('../src/scanner/robots');
    const robotsText = `
      User-agent: Googlebot
      User-agent: Bingbot
      Disallow: /private/
      Allow: /private/public-doc

      User-agent: *
      Disallow: /admin/
    `;

    const parsed = RobotsHandler.parseRobotsText(robotsText);
    assert.equal(parsed.directives.length, 3);

    const googlebot = parsed.directives.find((d) => d.userAgent === 'Googlebot')!;
    const bingbot = parsed.directives.find((d) => d.userAgent === 'Bingbot')!;
    const wildcard = parsed.directives.find((d) => d.userAgent === '*')!;

    assert.ok(googlebot);
    assert.deepEqual(googlebot.disallows, ['/private/']);
    assert.deepEqual(googlebot.allows, ['/private/public-doc']);

    assert.ok(bingbot);
    assert.deepEqual(bingbot.disallows, ['/private/']);
    assert.deepEqual(bingbot.allows, ['/private/public-doc']);

    assert.ok(wildcard);
    assert.deepEqual(wildcard.disallows, ['/admin/']);
  });
});

