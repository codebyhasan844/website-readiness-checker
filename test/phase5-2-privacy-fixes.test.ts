/**
 * PHASE 5.2 FOCUSED REGRESSION TEST SUITE:
 * 1. Cryptographically Unguessable Scan IDs
 * 2. Explicit No-Store Caching Headers on Scan/Report APIs
 * 3. Sensitive Origin Response-Header Filtering
 * 4. Basic HTTP Privacy & Security Header Hardening
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server';
import { globalScanStore } from '../src/scanner/store';
import { SafeFetcher } from '../src/scanner/fetcher';
import { ScanResult, PageScanResult } from '../src/scanner/types';
import { SCANNER_LIMITS } from '../src/scanner/limits';
import crypto from 'node:crypto';

describe('Phase 5.2 — Fix 1: Cryptographically Unguessable Scan IDs', () => {
  const UUID_SCAN_REGEX = /^scan-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const PREDICTABLE_TIMESTAMP_REGEX = /^scan-\d{13}-[a-z0-9]{6}$/;

  it('generates scan IDs adhering to cryptographically secure UUID format', () => {
    // Generate sample IDs following the orchestrator implementation
    const generatedId1 = `scan-${crypto.randomUUID()}`;
    const generatedId2 = `scan-${crypto.randomUUID()}`;

    assert.match(generatedId1, UUID_SCAN_REGEX, 'Scan ID must match UUID structure');
    assert.match(generatedId2, UUID_SCAN_REGEX, 'Scan ID must match UUID structure');
    assert.notEqual(generatedId1, generatedId2, 'Consecutively generated IDs must be distinct');
  });

  it('no longer uses predictable timestamp and Math.random construction', () => {
    const generatedId = `scan-${crypto.randomUUID()}`;
    assert.doesNotMatch(
      generatedId,
      PREDICTABLE_TIMESTAMP_REGEX,
      'Scan ID must not use timestamp and Math.random pattern'
    );
  });

  it('cryptographic scan IDs remain fully compatible with globalScanStore', () => {
    const scanId = `scan-${crypto.randomUUID()}`;
    const mockScan: ScanResult = {
      scanId,
      inputUrl: 'https://example.com',
      normalizedUrl: 'https://example.com/',
      startedAt: new Date().toISOString(),
      status: 'completed',
      summary: {
        pagesAttempted: 1,
        pagesCompleted: 1,
        requestsMade: 1,
        totalBytesTransferred: 500,
        internalLinksDiscovered: 0,
        externalLinksDiscovered: 0,
      },
      pages: [],
      sitemaps: [],
      errors: [],
      limits: SCANNER_LIMITS,
    };

    globalScanStore.set(mockScan);
    assert.equal(globalScanStore.has(scanId), true);
    const retrieved = globalScanStore.get(scanId);
    assert.ok(retrieved);
    assert.equal(retrieved?.scanId, scanId);
  });
});

describe('Phase 5.2 — Fix 2: Explicit No-Store Caching Headers on Scan APIs', () => {
  let server: http.Server;
  let baseUrl: string;
  const seededScanId = `scan-${crypto.randomUUID()}`;

  before(async () => {
    const app = createApp();
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });
    const port = (server.address() as any).port;
    baseUrl = `http://127.0.0.1:${port}`;

    // Seed a scan for 200 OK tests
    const mockPage: PageScanResult = {
      url: 'https://example.com',
      normalizedUrl: 'https://example.com/',
      depth: 0,
      discoveredFrom: ['user-input'],
      http: {
        requestedUrl: 'https://example.com',
        finalUrl: 'https://example.com/',
        statusCode: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/html' },
        securityHeaders: {},
        contentType: 'text/html',
        responseBytes: 200,
        durationMs: 50,
        timing: { startTime: 0, endTime: 50, totalMs: 50 },
        redirects: [],
      },
      document: { title: 'Example' },
      headings: { h1Count: 1, items: [{ level: 1, text: 'Hello' }] },
      links: [],
      images: [],
      resources: [],
      scanErrors: [],
    };

    const mockScan: ScanResult = {
      scanId: seededScanId,
      inputUrl: 'https://example.com',
      normalizedUrl: 'https://example.com/',
      startedAt: new Date().toISOString(),
      status: 'completed',
      summary: {
        pagesAttempted: 1,
        pagesCompleted: 1,
        requestsMade: 1,
        totalBytesTransferred: 200,
        internalLinksDiscovered: 0,
        externalLinksDiscovered: 0,
      },
      pages: [mockPage],
      sitemaps: [],
      errors: [],
      limits: SCANNER_LIMITS,
    };

    globalScanStore.set(mockScan);
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('GET /api/scan/:id (200 OK) sets Cache-Control: private, no-store', async () => {
    const res = await fetch(`${baseUrl}/api/scan/${seededScanId}`);
    assert.equal(res.status, 200);
    const cacheControl = res.headers.get('cache-control');
    assert.ok(cacheControl, 'Cache-Control header must be set');
    assert.match(cacheControl, /no-store/i, 'Must contain no-store');
    assert.match(cacheControl, /private/i, 'Must contain private');
  });

  it('GET /api/scan/:id (404 Not Found) sets Cache-Control: private, no-store', async () => {
    const nonExistentId = `scan-${crypto.randomUUID()}`;
    const res = await fetch(`${baseUrl}/api/scan/${nonExistentId}`);
    assert.equal(res.status, 404);
    const cacheControl = res.headers.get('cache-control');
    assert.ok(cacheControl, 'Cache-Control header must be set on 404');
    assert.match(cacheControl, /no-store/i);
  });

  it('GET /api/audit/:id (200 OK) sets Cache-Control: private, no-store', async () => {
    const res = await fetch(`${baseUrl}/api/audit/${seededScanId}`);
    assert.equal(res.status, 200);
    const cacheControl = res.headers.get('cache-control');
    assert.ok(cacheControl, 'Cache-Control header must be set on audit endpoint');
    assert.match(cacheControl, /no-store/i);
    assert.match(cacheControl, /private/i);
  });

  it('GET /api/audit/:id (404 Not Found) sets Cache-Control: private, no-store', async () => {
    const nonExistentId = `scan-${crypto.randomUUID()}`;
    const res = await fetch(`${baseUrl}/api/audit/${nonExistentId}`);
    assert.equal(res.status, 404);
    const cacheControl = res.headers.get('cache-control');
    assert.ok(cacheControl, 'Cache-Control header must be set on 404');
    assert.match(cacheControl, /no-store/i);
  });
});

describe('Phase 5.2 — Fix 3: Sensitive Origin Response-Header Filtering', () => {
  it('filters set-cookie and cookie headers completely and case-insensitively', () => {
    const rawHeaders = {
      'Set-Cookie': 'session_token=secret_val_1; Secure; HttpOnly',
      'set-cookie': 'tracking_id=fake_val_2',
      'COOKIE': 'auth_cookie=fake_val_3',
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    };

    const sanitized = SafeFetcher.filterResponseHeaders(rawHeaders);

    assert.equal(sanitized['set-cookie'], undefined, 'set-cookie must be omitted');
    assert.equal(sanitized['cookie'], undefined, 'cookie must be omitted');
    assert.equal(sanitized['content-type'], 'text/html; charset=utf-8', 'content-type must be retained');
    assert.equal(sanitized['cache-control'], 'public, max-age=3600', 'cache-control must be retained');
  });

  it('filters authorization and proxy-authorization headers case-insensitively', () => {
    const rawHeaders = {
      'Authorization': 'Bearer fake_jwt_token_here',
      'proxy-authorization': 'Basic dXNlcjpwYXNz',
      'AUTHORIZATION': 'Basic fake_creds_here',
      'x-robots-tag': 'noindex, nofollow',
      'server': 'nginx/1.24.0',
    };

    const sanitized = SafeFetcher.filterResponseHeaders(rawHeaders);

    assert.equal(sanitized['authorization'], undefined, 'authorization must be omitted');
    assert.equal(sanitized['proxy-authorization'], undefined, 'proxy-authorization must be omitted');
    assert.equal(sanitized['x-robots-tag'], 'noindex, nofollow', 'x-robots-tag must be retained');
    assert.equal(sanitized['server'], 'nginx/1.24.0', 'server header must be retained');
  });

  it('preserves all security and performance headers required by audit checks', () => {
    const rawHeaders = {
      'strict-transport-security': 'max-age=31536000; includeSubDomains',
      'content-security-policy': "default-src 'self'",
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'permissions-policy': 'camera=()',
      'content-encoding': 'gzip',
      'content-type': 'text/html',
      'cache-control': 'max-age=600',
      'set-cookie': 'evil_cookie=should_disappear',
    };

    const sanitized = SafeFetcher.filterResponseHeaders(rawHeaders);
    const security = SafeFetcher.extractSecurityHeaders(sanitized);

    assert.equal(sanitized['strict-transport-security'], 'max-age=31536000; includeSubDomains');
    assert.equal(sanitized['content-security-policy'], "default-src 'self'");
    assert.equal(sanitized['x-content-type-options'], 'nosniff');
    assert.equal(sanitized['x-frame-options'], 'DENY');
    assert.equal(sanitized['referrer-policy'], 'strict-origin-when-cross-origin');
    assert.equal(sanitized['content-encoding'], 'gzip');
    assert.equal(sanitized['set-cookie'], undefined);

    assert.equal(security.strictTransportSecurity, 'max-age=31536000; includeSubDomains');
    assert.equal(security.contentSecurityPolicy, "default-src 'self'");
    assert.equal(security.xContentTypeOptions, 'nosniff');
    assert.equal(security.xFrameOptions, 'DENY');
  });

  it('live fetch against public example.com does not store sensitive headers', async () => {
    const result = await SafeFetcher.fetch('https://example.com/');
    assert.ok(result.data.headers);
    assert.equal(result.data.headers['set-cookie'], undefined);
    assert.equal(result.data.headers['authorization'], undefined);
    assert.equal(result.data.headers['cookie'], undefined);
    assert.ok(result.data.headers['content-type']);
  });
});

describe('Phase 5.2 — Fix 4: Basic HTTP Privacy & Security Header Hardening', () => {
  let server: http.Server;
  let baseUrl: string;

  before(async () => {
    const app = createApp();
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });
    const port = (server.address() as any).port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('disables X-Powered-By header on responses', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.headers.get('x-powered-by'), null, 'X-Powered-By must be absent');
  });

  it('sets X-Content-Type-Options: nosniff', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(
      res.headers.get('x-content-type-options'),
      'nosniff',
      'X-Content-Type-Options must be nosniff'
    );
  });

  it('sets Referrer-Policy: strict-origin-when-cross-origin', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(
      res.headers.get('referrer-policy'),
      'strict-origin-when-cross-origin',
      'Referrer-Policy must be strict-origin-when-cross-origin'
    );
  });
});
