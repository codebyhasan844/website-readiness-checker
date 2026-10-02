import http from 'node:http';
import { describe, it, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { DnsSafetyGuard } from '../src/scanner/dns-safety';
import { ResourceAnalyzer } from '../src/scanner/resource-analyzer';
import { RobotsHandler } from '../src/scanner/robots';
import { SafeFetcher } from '../src/scanner/fetcher';
import { ScannerException } from '../src/scanner/errors';
import { ScanOrchestrator } from '../src/scanner/scan-orchestrator';
import { SCANNER_LIMITS } from '../src/scanner/limits';
import { SecurityGuard } from '../src/scanner/security-guard';
import { SitemapHandler } from '../src/scanner/sitemap';
import type { HTTPResponseData, ResourceReference } from '../src/scanner/types';

const baseUrl = 'https://example.com/';

function createResponseData(url: string): HTTPResponseData {
  return {
    requestedUrl: url,
    finalUrl: url,
    statusCode: 200,
    statusText: 'OK',
    headers: { 'content-type': 'text/html' },
    securityHeaders: {},
    contentType: 'text/html',
    responseBytes: 64,
    durationMs: 1,
    timing: { startTime: 0, endTime: 1, totalMs: 1 },
    redirects: [],
  };
}

function mockCommonStages(t: TestContext): void {
  t.mock.method(DnsSafetyGuard, 'resolveAndVerify', async (hostname: string) => ({
    hostname,
    resolvedIps: ['93.184.216.34'],
    primaryIp: '93.184.216.34',
  }));
  t.mock.method(ResourceAnalyzer, 'analyzeResources', async (resources: ResourceReference[]) => ({
    resources,
    requestsMade: 0,
    bytesTransferred: 0,
  }));
  t.mock.method(RobotsHandler, 'fetchRobots', async (url: string) => ({
    url: new URL('/robots.txt', url).toString(),
    exists: false,
    directives: [],
    sitemapDeclarations: [],
  }));
  t.mock.method(SitemapHandler, 'discoverSitemaps', async () => []);
}

async function listenLocally(server: http.Server): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return (server.address() as { port: number }).port;
}

async function closeLocally(server: http.Server): Promise<void> {
  server.closeAllConnections();
  if (!server.listening) return;
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

function mockLocalScannerDns(t: TestContext): void {
  t.mock.method(SecurityGuard, 'validateHostAndPort', () => {});
  t.mock.method(DnsSafetyGuard, 'resolveAndVerify', async (hostname: string) => ({
    hostname,
    resolvedIps: ['127.0.0.1'],
    primaryIp: '127.0.0.1',
  }));
  const localLookup: ReturnType<typeof DnsSafetyGuard.createPinnedLookup> = (
    _hostname,
    options,
    callback
  ) => {
    const records = [{ address: '127.0.0.1', family: 4 }];
    if (options?.all) callback(null, records);
    else callback(null, records[0].address, records[0].family);
  };
  t.mock.method(DnsSafetyGuard, 'createPinnedLookup', () => localLookup);
}

describe('scan execution duration limit', () => {
  it('terminates a DNS operation when the execution deadline expires', async (t) => {
    const previousLimit = SCANNER_LIMITS.maxScanDurationMs;
    SCANNER_LIMITS.maxScanDurationMs = 50;
    t.after(() => {
      SCANNER_LIMITS.maxScanDurationMs = previousLimit;
    });
    t.mock.timers.enable({ apis: ['setTimeout'] });
    t.mock.method(DnsSafetyGuard, 'resolveAndVerify', () => new Promise(() => {}));
    const fetch = t.mock.method(SafeFetcher, 'fetch', async () => {
      throw new Error('Homepage fetch must not run after the stalled DNS check.');
    });

    const scanPromise = ScanOrchestrator.executeScan(baseUrl);
    await Promise.resolve();
    t.mock.timers.tick(50);
    const scan = await scanPromise;

    assert.equal(fetch.mock.callCount(), 0);
    assert.equal(scan.status, 'failed');
    assert.equal(scan.errors[0]?.code, 'SCAN_TIMEOUT');
  });

  it('counts time spent in DNS before crawler entry against the execution budget', async (t) => {
    const previousLimit = SCANNER_LIMITS.maxScanDurationMs;
    SCANNER_LIMITS.maxScanDurationMs = 10000;
    t.after(() => {
      SCANNER_LIMITS.maxScanDurationMs = previousLimit;
    });
    let now = 1000;
    t.mock.method(Date, 'now', () => now);
    t.mock.method(DnsSafetyGuard, 'resolveAndVerify', async (hostname: string) => {
      now += SCANNER_LIMITS.maxScanDurationMs;
      return { hostname, resolvedIps: ['93.184.216.34'], primaryIp: '93.184.216.34' };
    });
    const fetch = t.mock.method(SafeFetcher, 'fetch', async () => {
      throw new Error('Homepage fetch must not run after the deadline.');
    });

    const scan = await ScanOrchestrator.executeScan(baseUrl);

    assert.equal(fetch.mock.callCount(), 0);
    assert.equal(scan.status, 'failed');
    assert.equal(scan.errors[0]?.code, 'SCAN_TIMEOUT');
    assert.equal(scan.totalDurationMs, 10000);
  });

  it('does not reset the crawler budget and preserves pages completed before timeout', async (t) => {
    const previousLimit = SCANNER_LIMITS.maxScanDurationMs;
    SCANNER_LIMITS.maxScanDurationMs = 10000;
    t.after(() => {
      SCANNER_LIMITS.maxScanDurationMs = previousLimit;
    });
    let now = 1000;
    t.mock.method(Date, 'now', () => now);
    t.mock.method(DnsSafetyGuard, 'resolveAndVerify', async (hostname: string) => ({
      hostname,
      resolvedIps: ['93.184.216.34'],
      primaryIp: '93.184.216.34',
    }));
    t.mock.method(ResourceAnalyzer, 'analyzeResources', async (resources: ResourceReference[]) => ({
      resources,
      requestsMade: 0,
      bytesTransferred: 0,
    }));
    t.mock.method(SitemapHandler, 'discoverSitemaps', async () => []);
    t.mock.method(RobotsHandler, 'fetchRobots', async (url: string) => {
      now = 10999;
      return {
        url: new URL('/robots.txt', url).toString(),
        exists: false,
        directives: [],
        sitemapDeclarations: [],
      };
    });
    const childFetches: string[] = [];
    t.mock.method(SafeFetcher, 'fetch', async (url: string) => {
      if (url !== baseUrl) {
        childFetches.push(url);
        now = 11001;
      }
      const bodyText = url === baseUrl
        ? '<html><body><a href="/first">First</a><a href="/second">Second</a></body></html>'
        : '<html><body></body></html>';
      return { data: createResponseData(url), bodyText };
    });

    const scan = await ScanOrchestrator.executeScan(baseUrl);

    assert.deepEqual(childFetches, ['https://example.com/first']);
    assert.equal(scan.status, 'partial');
    assert.equal(scan.pages.length, 2);
    assert.ok(scan.errors.some((error) => error.code === 'SCAN_TIMEOUT'));
    assert.equal(scan.pages[0]?.scanErrors.length, 0);
  });

  it('allows a normal execution to complete successfully', async (t) => {
    mockCommonStages(t);
    t.mock.method(SafeFetcher, 'fetch', async (url: string) => ({
      data: createResponseData(url),
      bodyText: '<html><head><title>Home</title></head><body></body></html>',
    }));

    const scan = await ScanOrchestrator.executeScan(baseUrl);

    assert.equal(scan.status, 'completed');
    assert.equal(scan.pages.length, 1);
    assert.deepEqual(scan.errors, []);
  });

  it('propagates caller cancellation instead of returning a successful partial execution', async (t) => {
    const controller = new AbortController();
    t.mock.method(DnsSafetyGuard, 'resolveAndVerify', async (hostname: string) => ({
      hostname,
      resolvedIps: ['93.184.216.34'],
      primaryIp: '93.184.216.34',
    }));
    t.mock.method(SafeFetcher, 'fetch', async (url: string) => ({
      data: createResponseData(url),
      bodyText: '<html><head><title>Home</title></head><body></body></html>',
    }));
    t.mock.method(ResourceAnalyzer, 'analyzeResources', async (resources: ResourceReference[]) => {
      controller.abort();
      return { resources, requestsMade: 0, bytesTransferred: 0 };
    });

    await assert.rejects(
      ScanOrchestrator.executeScan(baseUrl, { abortSignal: controller.signal }),
      (error: { code?: string }) => error.code === 'REQUEST_FAILED'
    );
  });

  it('reports elapsed time for a failed DNS execution', async (t) => {
    let now = 1000;
    t.mock.method(Date, 'now', () => now);
    t.mock.method(DnsSafetyGuard, 'resolveAndVerify', async () => {
      now += 250;
      throw new ScannerException(
        'DNS_FAILURE',
        'The website domain could not be resolved.',
        'Deterministic DNS failure'
      );
    });

    const scan = await ScanOrchestrator.executeScan(baseUrl);

    assert.equal(scan.status, 'failed');
    assert.equal(scan.errors[0]?.code, 'DNS_FAILURE');
    assert.equal(scan.totalDurationMs, 250);
  });

  it('aborts a stalled homepage body when the execution deadline expires', async (t) => {
    const previousDuration = SCANNER_LIMITS.maxScanDurationMs;
    const previousRequestTimeout = SCANNER_LIMITS.requestTimeoutMs;
    SCANNER_LIMITS.maxScanDurationMs = 300;
    SCANNER_LIMITS.requestTimeoutMs = 5000;
    t.after(() => {
      SCANNER_LIMITS.maxScanDurationMs = previousDuration;
      SCANNER_LIMITS.requestTimeoutMs = previousRequestTimeout;
    });

    let bodyStarted!: () => void;
    const bodyStartedPromise = new Promise<void>((resolve) => {
      bodyStarted = resolve;
    });
    const server = http.createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.flushHeaders();
      response.write('<html>');
      bodyStarted();
    });
    t.after(() => closeLocally(server));
    const port = await listenLocally(server);
    mockLocalScannerDns(t);

    const scanPromise = ScanOrchestrator.executeScan(`http://127.0.0.1:${port}/`);
    await bodyStartedPromise;
    const scan = await scanPromise;

    assert.equal(scan.status, 'failed');
    assert.equal(scan.errors[0]?.code, 'SCAN_TIMEOUT');
    assert.equal(scan.summary.requestsMade, 1);
  });

  it('aborts stalled resource analysis on the execution deadline while preserving the homepage', async (t) => {
    const previousDuration = SCANNER_LIMITS.maxScanDurationMs;
    const previousRequestTimeout = SCANNER_LIMITS.requestTimeoutMs;
    SCANNER_LIMITS.maxScanDurationMs = 300;
    SCANNER_LIMITS.requestTimeoutMs = 5000;
    t.after(() => {
      SCANNER_LIMITS.maxScanDurationMs = previousDuration;
      SCANNER_LIMITS.requestTimeoutMs = previousRequestTimeout;
    });

    let resourceStarted!: () => void;
    const resourceStartedPromise = new Promise<void>((resolve) => {
      resourceStarted = resolve;
    });
    const server = http.createServer((request, response) => {
      if (request.url === '/') {
        response.writeHead(200, { 'content-type': 'text/html' });
        response.end('<html><head><link rel="stylesheet" href="/asset.css"></head><body></body></html>');
      } else {
        resourceStarted();
      }
    });
    t.after(() => closeLocally(server));
    const port = await listenLocally(server);
    mockLocalScannerDns(t);

    const scanPromise = ScanOrchestrator.executeScan(`http://127.0.0.1:${port}/`);
    await resourceStartedPromise;
    const scan = await scanPromise;

    assert.equal(scan.status, 'partial');
    assert.equal(scan.pages.length, 1);
    assert.ok(scan.errors.some((error) => error.code === 'SCAN_TIMEOUT'));
    assert.equal(scan.summary.requestsMade, 2);
  });
});
