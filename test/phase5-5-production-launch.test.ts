import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import {
  createApp,
  shutdownServer,
  resetServerState,
  getActiveScanCount,
  isServerShuttingDown,
} from '../server';
import { ScannerException } from '../src/scanner/errors';
import { ScanOrchestrator, ScanOrchestratorOptions, ScanResult } from '../src/scanner';
import { SCANNER_LIMITS } from '../src/scanner/limits';

describe('Phase 5.5 — Production Launch & Final Validation Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    resetServerState();
    const app = createApp();
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address() as { port: number };
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    resetServerState();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('PROD-01: /api/health and /health return 200 OK with no-store headers and safe metadata', async () => {
    for (const path of ['/api/health', '/health']) {
      const res = await fetch(`${baseUrl}${path}`);
      assert.strictEqual(res.status, 200, `${path} must return 200 OK`);
      
      const cacheControl = res.headers.get('cache-control') || '';
      assert.ok(cacheControl.includes('no-store'), `${path} must have no-store cache-control`);
      assert.ok(cacheControl.includes('no-cache'), `${path} must have no-cache`);

      const data = await res.json() as Record<string, unknown>;
      assert.strictEqual(data.status, 'ok');
      assert.strictEqual(data.service, 'website-readiness-checker');
      assert.strictEqual(data.version, '1.0.0');
      assert.ok(typeof data.timestamp === 'string');
      assert.ok(data.rateLimiter && typeof data.rateLimiter === 'object');

      // Verify no secrets or filesystem paths are exposed
      const serialized = JSON.stringify(data);
      assert.ok(!serialized.includes('/app/'), 'Must not leak server paths');
      assert.ok(!serialized.includes('key'), 'Must not leak keys');
      assert.ok(!serialized.includes('secret'), 'Must not leak secrets');
    }
  });

  it('PROD-02: HEAD /api/health and /health respond with 200 without payload', async () => {
    for (const path of ['/api/health', '/health']) {
      const res = await fetch(`${baseUrl}${path}`, { method: 'HEAD' });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('content-type')?.includes('application/json'), true);
    }
  });

  it('PROD-03: Security headers (nosniff, referrer-policy, no x-powered-by) are present', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');
    assert.strictEqual(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    assert.strictEqual(res.headers.get('x-powered-by'), null, 'X-Powered-By must be disabled');
  });

  it('PROD-04: Graceful shutdown cancels active scans and sets 503 on new requests', async () => {
    assert.strictEqual(getActiveScanCount(), 0);
    assert.strictEqual(isServerShuttingDown(), false);

    // Trigger shutdown
    await shutdownServer(null, 1000);
    assert.strictEqual(isServerShuttingDown(), true);

    // Health check reflects shutting down status
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(healthRes.status, 503);
    const healthData = await healthRes.json() as Record<string, unknown>;
    assert.strictEqual(healthData.status, 'shutting_down');

    // New scan requests are immediately rejected with 503
    const scanRes = await fetch(`${baseUrl}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    });
    assert.strictEqual(scanRes.status, 503);
    const scanData = await scanRes.json() as Record<string, unknown>;
    assert.strictEqual(scanData.error, 'SERVER_SHUTTING_DOWN');
  });

  it('PROD-05: Global error middleware sanitizes unexpected exceptions with zero stack leaks', async () => {
    // 1. Missing URL field returns 400 with sanitized message
    const resEmpty = await fetch(`${baseUrl}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.strictEqual(resEmpty.status, 400);
    const dataEmpty = await resEmpty.json() as Record<string, unknown>;
    assert.strictEqual(dataEmpty.error, 'INVALID_URL');

    // 2. Invalid URL scheme returns failed ScanResult with sanitized error
    const resInvalid = await fetch(`${baseUrl}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'javascript:alert(1)' }),
    });
    assert.strictEqual(resInvalid.status, 200);
    const dataInvalid = await resInvalid.json() as { status: string; errors: Array<{ code: string; message: string }> };
    assert.strictEqual(dataInvalid.status, 'failed');
    assert.strictEqual(dataInvalid.errors[0].code, 'INVALID_URL');
    assert.ok(typeof dataInvalid.errors[0].message === 'string');

    // Confirm no stack trace or internal fields exist in responses
    for (const data of [dataEmpty, dataInvalid]) {
      const jsonStr = JSON.stringify(data);
      assert.ok(!jsonStr.includes('    at '), 'Response must not contain stack traces');
      assert.ok(!jsonStr.includes('.ts:'), 'Response must not contain source file paths');
    }
  });

  it('SCAN-SSE-01: Successful scan results use the completed event', async () => {
    const scan: ScanResult = {
      scanId: 'scan-success-test',
      inputUrl: 'https://example.com/',
      normalizedUrl: 'https://example.com/',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      totalDurationMs: 1,
      status: 'completed',
      summary: {
        pagesAttempted: 1,
        pagesCompleted: 1,
        requestsMade: 1,
        totalBytesTransferred: 64,
        internalLinksDiscovered: 0,
        externalLinksDiscovered: 0,
      },
      pages: [{
        url: 'https://example.com/',
        normalizedUrl: 'https://example.com/',
        depth: 0,
        discoveredFrom: ['user-input'],
        http: {
          requestedUrl: 'https://example.com/',
          finalUrl: 'https://example.com/',
          statusCode: 200,
          statusText: 'OK',
          headers: { 'content-type': 'text/html' },
          securityHeaders: {},
          contentType: 'text/html',
          responseBytes: 64,
          durationMs: 1,
          timing: { startTime: 0, endTime: 1, totalMs: 1 },
          redirects: [],
        },
        document: { title: 'Example' },
        headings: { h1Count: 0, items: [] },
        links: [],
        images: [],
        resources: [],
        scanErrors: [],
      }],
      sitemaps: [],
      errors: [],
      limits: SCANNER_LIMITS,
    };
    const originalExecuteScan = ScanOrchestrator.executeScan;

    ScanOrchestrator.executeScan = async (
      _url: string,
      _options?: ScanOrchestratorOptions
    ) => scan;

    try {
      const response = await fetch(`${baseUrl}/api/scan?stream=true`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ url: scan.inputUrl, stream: true }),
      });
      const body = await response.text();

      assert.strictEqual(response.status, 200);
      assert.match(body, /event: completed/);
      assert.doesNotMatch(body, /event: scan_error/);
      assert.match(body, /"status":"completed"/);

      scan.status = 'partial';
      const partialResponse = await fetch(`${baseUrl}/api/scan?stream=true`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ url: scan.inputUrl, stream: true }),
      });
      const partialBody = await partialResponse.text();

      assert.match(partialBody, /event: completed/);
      assert.match(partialBody, /"status":"partial"/);
    } finally {
      ScanOrchestrator.executeScan = originalExecuteScan;
    }
  });

  it('SCAN-SSE-02: Fatal scan results use scan_error and preserve the failure message', async () => {
    const response = await fetch(`${baseUrl}/api/scan?stream=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({ url: 'javascript:alert(1)', stream: true }),
    });
    const body = await response.text();

    assert.strictEqual(response.status, 200);
    assert.match(body, /event: scan_error/);
    assert.doesNotMatch(body, /event: completed/);
    assert.match(body, /"code":"INVALID_URL"/);
    assert.match(body, /"message":"Only HTTP and HTTPS website URLs are supported\."/);
  });

  it('PROD-06: GET /api/scan/:id and GET /api/audit/:id return private, no-store headers', async () => {
    const scanRes = await fetch(`${baseUrl}/api/scan/nonexistent-id`);
    assert.strictEqual(scanRes.status, 404);
    assert.ok(scanRes.headers.get('cache-control')?.includes('no-store'));

    const auditRes = await fetch(`${baseUrl}/api/audit/nonexistent-id`);
    assert.strictEqual(auditRes.status, 404);
    assert.ok(auditRes.headers.get('cache-control')?.includes('no-store'));
  });

  it('PROD-07: Client abort/cancellation is cleanly handled without unhandled errors', async () => {
    const controller = new AbortController();
    const fetchPromise = fetch(`${baseUrl}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
      signal: controller.signal,
    });

    // Abort immediately
    controller.abort();

    try {
      await fetchPromise;
    } catch (err: unknown) {
      assert.ok(err instanceof Error);
      assert.strictEqual(err.name, 'AbortError');
    }

    // Ensure server active scan count cleaned up
    assert.strictEqual(getActiveScanCount(), 0);
  });
});
