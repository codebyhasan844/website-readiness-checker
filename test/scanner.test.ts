/**
 * Automated Test Suite for Secure Scanner Engine (Phase 2)
 *
 * Tests:
 * 1. URL Validation & Normalization
 * 2. SSRF Security Guard & IP Range Protection
 * 3. DNS Safety Verification
 * 4. Redirect Safety & Loop Detection
 * 5. HTML & Resource Parser
 * 6. Robots.txt & Sitemap Parsers
 * 7. Centralized Limits Adherence
 * 8. Error Model Sanitization
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  UrlValidator,
  SecurityGuard,
  RedirectHandler,
  HtmlParser,
  RobotsHandler,
  SitemapHandler,
  SCANNER_LIMITS,
  ScannerException,
  sanitizeScannerError,
} from '../src/scanner';

describe('1. URL Validation & Normalization', () => {
  it('should accept valid HTTPS URL and normalize it', () => {
    const res = UrlValidator.validate('https://example.com/');
    assert.equal(res.protocol, 'https:');
    assert.equal(res.hostname, 'example.com');
    assert.equal(res.port, 443);
    assert.equal(res.normalizedUrl, 'https://example.com/');
  });

  it('should accept valid HTTP URL', () => {
    const res = UrlValidator.validate('http://sub.example.org:80/path');
    assert.equal(res.protocol, 'http:');
    assert.equal(res.hostname, 'sub.example.org');
    assert.equal(res.port, 80);
    // Port 80 should be stripped in normalized representation
    assert.equal(res.normalizedUrl, 'http://sub.example.org/path');
  });

  it('should auto-prepend https:// if scheme is omitted', () => {
    const res = UrlValidator.validate('my-company.dev');
    assert.equal(res.protocol, 'https:');
    assert.equal(res.normalizedUrl, 'https://my-company.dev/');
  });

  it('should strip hash fragments from normalized URL', () => {
    const res = UrlValidator.validate('https://example.com/docs#heading-2');
    assert.equal(res.normalizedUrl, 'https://example.com/docs');
    assert.equal(res.originalInput, 'https://example.com/docs#heading-2');
  });

  it('should reject unsupported schemes (javascript, file, ftp, data)', () => {
    assert.throws(
      () => UrlValidator.validate('javascript:alert(1)'),
      (err: any) => err.code === 'INVALID_URL'
    );
    assert.throws(
      () => UrlValidator.validate('file:///etc/passwd'),
      (err: any) => err.code === 'INVALID_URL'
    );
    assert.throws(
      () => UrlValidator.validate('ftp://ftp.example.com'),
      (err: any) => err.code === 'INVALID_URL'
    );
    assert.throws(
      () => UrlValidator.validate('data:text/html,<h1>hi</h1>'),
      (err: any) => err.code === 'INVALID_URL'
    );
  });

  it('should reject malformed or empty URLs', () => {
    assert.throws(
      () => UrlValidator.validate(''),
      (err: any) => err.code === 'INVALID_URL'
    );
    assert.throws(
      () => UrlValidator.validate('not a url'),
      (err: any) => err.code === 'INVALID_URL'
    );
    assert.throws(
      () => UrlValidator.validate('http://'),
      (err: any) => err.code === 'INVALID_URL'
    );
  });

  it('should resolve relative links against a base URL', () => {
    const resolved = UrlValidator.resolveAndNormalizeLink('/about', 'https://example.com/blog/');
    assert.equal(resolved, 'https://example.com/about');

    const relative = UrlValidator.resolveAndNormalizeLink('../pricing', 'https://example.com/blog/posts/');
    assert.equal(relative, 'https://example.com/blog/pricing');
  });

  it('should correctly classify same-site (including www vs apex)', () => {
    assert.equal(UrlValidator.isSameSite('https://example.com/about', 'https://example.com/'), true);
    assert.equal(UrlValidator.isSameSite('https://www.example.com/team', 'https://example.com/'), true);
    assert.equal(UrlValidator.isSameSite('https://other.com/landing', 'https://example.com/'), false);
  });
});

describe('2. SSRF Security Guard & IP Range Protection', () => {
  it('should allow public internet hostnames and ports 80/443', () => {
    assert.doesNotThrow(() => SecurityGuard.validateHostAndPort('example.com', 443));
    assert.doesNotThrow(() => SecurityGuard.validateHostAndPort('google.com', 80));
  });

  it('should reject unsafe ports (e.g. 22, 3000, 8080, 25)', () => {
    assert.throws(
      () => SecurityGuard.validateHostAndPort('example.com', 22),
      (err: any) => err.code === 'BLOCKED_DESTINATION'
    );
    assert.throws(
      () => SecurityGuard.validateHostAndPort('example.com', 3000),
      (err: any) => err.code === 'BLOCKED_DESTINATION'
    );
    assert.throws(
      () => SecurityGuard.validateHostAndPort('example.com', 8080),
      (err: any) => err.code === 'BLOCKED_DESTINATION'
    );
  });

  it('should block localhost and internal domain suffixes', () => {
    assert.throws(
      () => SecurityGuard.validateHostAndPort('localhost', 80),
      (err: any) => err.code === 'BLOCKED_DESTINATION'
    );
    assert.throws(
      () => SecurityGuard.validateHostAndPort('app.internal', 443),
      (err: any) => err.code === 'BLOCKED_DESTINATION'
    );
    assert.throws(
      () => SecurityGuard.validateHostAndPort('api.local', 443),
      (err: any) => err.code === 'BLOCKED_DESTINATION'
    );
    assert.throws(
      () => SecurityGuard.validateHostAndPort('metadata.google.internal', 80),
      (err: any) => err.code === 'BLOCKED_DESTINATION'
    );
  });

  it('should block IPv4 loopback (127.0.0.0/8)', () => {
    assert.throws(
      () => SecurityGuard.validateIpAddress('127.0.0.1'),
      (err: any) => err.code === 'BLOCKED_DESTINATION'
    );
    assert.throws(
      () => SecurityGuard.validateIpAddress('127.12.34.56'),
      (err: any) => err.code === 'BLOCKED_DESTINATION'
    );
  });

  it('should block private RFC 1918 IPv4 ranges (10.x, 172.16-31.x, 192.168.x)', () => {
    assert.throws(
      () => SecurityGuard.validateIpAddress('10.0.0.1'),
      (err: any) => err.code === 'BLOCKED_DESTINATION'
    );
    assert.throws(
      () => SecurityGuard.validateIpAddress('172.16.0.1'),
      (err: any) => err.code === 'BLOCKED_DESTINATION'
    );
    assert.throws(
      () => SecurityGuard.validateIpAddress('172.31.255.254'),
      (err: any) => err.code === 'BLOCKED_DESTINATION'
    );
    assert.throws(
      () => SecurityGuard.validateIpAddress('192.168.1.1'),
      (err: any) => err.code === 'BLOCKED_DESTINATION'
    );
  });

  it('blocks the full 198.18.0.0/15 benchmarking range but allows adjacent addresses', () => {
    for (const address of [
      '198.18.0.0',
      '198.18.0.1',
      '198.19.255.255',
      '3323068417',
      '0xc6120001',
    ]) {
      assert.throws(
        () => SecurityGuard.validateIpAddress(address),
        (err: any) => err.code === 'BLOCKED_DESTINATION',
        `${address} must be blocked`
      );
    }

    for (const address of ['198.17.255.255', '198.20.0.0']) {
      assert.doesNotThrow(
        () => SecurityGuard.validateIpAddress(address),
        `${address} is immediately outside the blocked range`
      );
    }
  });

  it('should block cloud metadata and link-local (169.254.0.0/16)', () => {
    assert.throws(
      () => SecurityGuard.validateIpAddress('169.254.169.254'),
      (err: any) => err.code === 'BLOCKED_DESTINATION'
    );
    assert.throws(
      () => SecurityGuard.validateIpAddress('169.254.1.1'),
      (err: any) => err.code === 'BLOCKED_DESTINATION'
    );
  });

  it('should block multicast, broadcast, and reserved networks', () => {
    assert.throws(
      () => SecurityGuard.validateIpAddress('0.0.0.0'),
      (err: any) => err.code === 'BLOCKED_DESTINATION'
    );
    assert.throws(
      () => SecurityGuard.validateIpAddress('224.0.0.1'),
      (err: any) => err.code === 'BLOCKED_DESTINATION'
    );
    assert.throws(
      () => SecurityGuard.validateIpAddress('255.255.255.255'),
      (err: any) => err.code === 'BLOCKED_DESTINATION'
    );
  });

  it('should block IPv6 loopback, unique local, link-local, and IPv4-mapped loopback', () => {
    for (const address of [
      '::1',
      '0:0:0:0:0:0:0:1',
      '0000:0000:0000:0000:0000:0000:0000:0001',
      '::ffff:7f00:1',
    ]) {
      assert.throws(
        () => SecurityGuard.validateIpAddress(address),
        (err: any) => err.code === 'BLOCKED_DESTINATION',
        `${address} must be blocked as IPv6 loopback or mapped loopback`
      );
    }
    assert.throws(
      () => SecurityGuard.validateIpAddress('fe80::1'),
      (err: any) => err.code === 'BLOCKED_DESTINATION'
    );
    assert.throws(
      () => SecurityGuard.validateIpAddress('fc00::1'),
      (err: any) => err.code === 'BLOCKED_DESTINATION'
    );
    assert.throws(
      () => SecurityGuard.validateIpAddress('::ffff:127.0.0.1'),
      (err: any) => err.code === 'BLOCKED_DESTINATION'
    );
  });

  it('should detect alternate IP encodings (decimal, hex DWORD)', () => {
    // 2130706433 is 127.0.0.1
    assert.equal(SecurityGuard.normalizeIp('2130706433'), '127.0.0.1');
    assert.throws(
      () => SecurityGuard.validateHostAndPort('2130706433', 80),
      (err: any) => err.code === 'BLOCKED_DESTINATION'
    );

    // 0x7f000001 is 127.0.0.1
    assert.equal(SecurityGuard.normalizeIp('0x7f000001'), '127.0.0.1');
    assert.throws(
      () => SecurityGuard.validateHostAndPort('0x7f000001', 80),
      (err: any) => err.code === 'BLOCKED_DESTINATION'
    );
  });
});

describe('3. Redirect Handler & Loop Protection', () => {
  it('should track redirect chain and return normalized next URL', async () => {
    const handler = new RedirectHandler('https://example.com/');
    const next = await handler.handleRedirect('https://example.com/', 301, 'https://example.com/home');
    assert.equal(next.normalizedUrl, 'https://example.com/home');

    const chain = handler.getChain();
    assert.equal(chain.length, 1);
    assert.equal(chain[0].statusCode, 301);
    assert.equal(chain[0].destinationUrl, 'https://example.com/home');
  });

  it('should detect redirect loops and halt', async () => {
    const handler = new RedirectHandler('https://example.com/a');
    await handler.handleRedirect('https://example.com/a', 302, 'https://example.com/b');

    await assert.rejects(
      async () => {
        await handler.handleRedirect('https://example.com/b', 302, 'https://example.com/a');
      },
      (err: any) => err.code === 'REDIRECT_LIMIT'
    );
  });

  it('should block redirect hopping to internal address', async () => {
    const handler = new RedirectHandler('https://example.com/');
    await assert.rejects(
      async () => {
        await handler.handleRedirect('https://example.com/', 302, 'http://127.0.0.1:80/admin');
      },
      (err: any) => err.code === 'REDIRECT_BLOCKED'
    );
  });
});

describe('4. HTML & Resource Parser', () => {
  const sampleHtml = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>Launch Store | Welcome</title>
        <meta name="description" content="The premier website launch test suite.">
        <link rel="canonical" href="https://example.com/">
        <meta name="robots" content="index, follow">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta property="og:title" content="Launch Store OG">
        <link rel="stylesheet" href="/assets/style.css">
        <link rel="preload" as="font" href="/assets/font.woff2">
        <script src="/assets/app.js"></script>
      </head>
      <body>
        <h1>Main Heading 1</h1>
        <p>Some text</p>
        <h2>Subheading 2.1</h2>
        <h2>Subheading 2.2</h2>
        <a href="/pricing" rel="noopener">See Pricing</a>
        <a href="https://external.org/partner" target="_blank">Partner</a>
        <img src="/assets/hero.jpg" alt="Hero Banner" width="1200" height="600" loading="lazy">
        <img src="/assets/noalt.png">
        <iframe src="https://widget.example.com/embed"></iframe>
      </body>
    </html>
  `;

  it('should extract document metadata', () => {
    const parsed = HtmlParser.parse(sampleHtml, 'https://example.com/');
    assert.equal(parsed.document.title, 'Launch Store | Welcome');
    assert.equal(parsed.document.metaDescription, 'The premier website launch test suite.');
    assert.equal(parsed.document.canonicalUrl, 'https://example.com/');
    assert.equal(parsed.document.robotsMeta, 'index, follow');
    assert.equal(parsed.document.language, 'en');
    assert.equal(parsed.document.charset, 'utf-8');
    assert.equal(parsed.document.viewport, 'width=device-width, initial-scale=1.0');
    assert.equal(parsed.document.openGraph?.['og:title'], 'Launch Store OG');
  });

  it('should extract headings with levels and count H1', () => {
    const parsed = HtmlParser.parse(sampleHtml, 'https://example.com/');
    assert.equal(parsed.headings.h1Count, 1);
    assert.equal(parsed.headings.items.length, 3);
    assert.equal(parsed.headings.items[0].level, 1);
    assert.equal(parsed.headings.items[0].text, 'Main Heading 1');
    assert.equal(parsed.headings.items[1].level, 2);
  });

  it('should extract links and categorize internal vs external', () => {
    const parsed = HtmlParser.parse(sampleHtml, 'https://example.com/');
    assert.equal(parsed.links.length, 2);

    const internalLink = parsed.links.find((l) => l.isInternal);
    assert.ok(internalLink);
    assert.equal(internalLink.normalizedDestination, 'https://example.com/pricing');
    assert.equal(internalLink.anchorText, 'See Pricing');

    const externalLink = parsed.links.find((l) => !l.isInternal);
    assert.ok(externalLink);
    assert.equal(externalLink.destinationUrl, 'https://external.org/partner');
  });

  it('should extract images with alt text, dimensions, and type', () => {
    const parsed = HtmlParser.parse(sampleHtml, 'https://example.com/');
    assert.equal(parsed.images.length, 2);

    const heroImg = parsed.images[0];
    assert.equal(heroImg.hasAlt, true);
    assert.equal(heroImg.altText, 'Hero Banner');
    assert.equal(heroImg.width, '1200');
    assert.equal(heroImg.imageType, 'jpg');

    const noAltImg = parsed.images[1];
    assert.equal(noAltImg.hasAlt, false);
    assert.equal(noAltImg.altText, '');
    assert.equal(noAltImg.imageType, 'png');
  });

  it('should extract referenced CSS, JS, font, and iframe resources', () => {
    const parsed = HtmlParser.parse(sampleHtml, 'https://example.com/');
    const types = parsed.resources.map((r) => r.type);
    assert.ok(types.includes('css'));
    assert.ok(types.includes('javascript'));
    assert.ok(types.includes('font'));
    assert.ok(types.includes('iframe'));
  });
});

describe('5. Robots.txt & Sitemap Parsers', () => {
  it('should parse robots.txt user-agents, allow/disallow, and sitemaps', () => {
    const robotsContent = `
      # Comment line
      User-agent: *
      Disallow: /admin/
      Disallow: /private/
      Allow: /public/

      User-agent: Googlebot
      Disallow: /temp/

      Sitemap: https://example.com/sitemap.xml
      Sitemap: https://example.com/sitemap2.xml
    `;

    const parsed = RobotsHandler.parseRobotsText(robotsContent);
    assert.equal(parsed.directives.length, 2);
    assert.equal(parsed.directives[0].userAgent, '*');
    assert.deepEqual(parsed.directives[0].disallows, ['/admin/', '/private/']);
    assert.deepEqual(parsed.directives[0].allows, ['/public/']);

    assert.equal(parsed.sitemapDeclarations.length, 2);
    assert.equal(parsed.sitemapDeclarations[0], 'https://example.com/sitemap.xml');
  });

  it('should parse XML sitemaps and extract URLs', () => {
    const sitemapXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>https://example.com/</loc>
        </url>
        <url>
          <loc>https://example.com/about</loc>
        </url>
      </urlset>
    `;

    const parsed = SitemapHandler.parseSitemapXml(sitemapXml);
    assert.equal(parsed.isIndex, false);
    assert.equal(parsed.urls.length, 2);
    assert.equal(parsed.urls[0], 'https://example.com/');
    assert.equal(parsed.urls[1], 'https://example.com/about');
  });

  it('should detect sitemap index XML', () => {
    const indexXml = `
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap>
          <loc>https://example.com/sub-sitemap.xml</loc>
        </sitemap>
      </sitemapindex>
    `;
    const parsed = SitemapHandler.parseSitemapXml(indexXml);
    assert.equal(parsed.isIndex, true);
    assert.equal(parsed.urls[0], 'https://example.com/sub-sitemap.xml');
  });
});

describe('6. Centralized Limits', () => {
  it('should define positive conservative limits', () => {
    assert.equal(SCANNER_LIMITS.maxPages, 50);
    assert.ok(SCANNER_LIMITS.maxDepth > 0 && SCANNER_LIMITS.maxDepth <= 5);
    assert.ok(SCANNER_LIMITS.maxRedirects > 0 && SCANNER_LIMITS.maxRedirects <= 10);
    assert.ok(SCANNER_LIMITS.maxTotalRequests > 0);
    assert.ok(SCANNER_LIMITS.requestTimeoutMs > 0);
    assert.ok(SCANNER_LIMITS.maxScanDurationMs > 0);
    assert.deepEqual(SCANNER_LIMITS.allowedPorts, [80, 443]);
  });
});

describe('7. Error Model Sanitization', () => {
  it('should sanitize DNS errors into user-friendly message without stack trace', () => {
    const err = new Error('getaddrinfo ENOTFOUND fake-host.invalid');
    const sanitized = sanitizeScannerError(err, 'https://fake-host.invalid');
    assert.equal(sanitized.code, 'DNS_FAILURE');
    assert.ok(sanitized.message.includes('public DNS'));
    assert.equal(sanitized.targetUrl, 'https://fake-host.invalid');
  });

  it('should sanitize connection timeout errors', () => {
    const err = new Error('The operation was aborted due to timeout');
    const sanitized = sanitizeScannerError(err, 'https://example.com');
    assert.equal(sanitized.code, 'CONNECTION_TIMEOUT');
  });
});
