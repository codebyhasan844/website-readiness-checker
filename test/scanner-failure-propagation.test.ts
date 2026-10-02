import { describe, it, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { DnsSafetyGuard } from '../src/scanner/dns-safety';
import { ScannerException } from '../src/scanner/errors';
import { ResourceAnalyzer } from '../src/scanner/resource-analyzer';
import { RobotsHandler } from '../src/scanner/robots';
import { SafeFetcher } from '../src/scanner/fetcher';
import { ScanOrchestrator } from '../src/scanner/scan-orchestrator';
import { SCANNER_LIMITS } from '../src/scanner/limits';
import { SitemapHandler } from '../src/scanner/sitemap';
import type { HTTPResponseData, ResourceReference } from '../src/scanner/types';

const baseUrl = 'https://example.com/';

function createResponseData(
  url: string,
  statusCode = 200,
  statusText = 'OK'
): HTTPResponseData {
  return {
    requestedUrl: url,
    finalUrl: url,
    statusCode,
    statusText,
    headers: { 'content-type': 'text/html' },
    securityHeaders: {},
    contentType: 'text/html',
    responseBytes: 64,
    durationMs: 1,
    timing: { startTime: 0, endTime: 1, totalMs: 1 },
    redirects: [],
  };
}

function mockPipeline(t: TestContext, homepageHtml: string): void {
  t.mock.method(DnsSafetyGuard, 'resolveAndVerify', async (hostname: string) => ({
    hostname,
    resolvedIps: ['93.184.216.34'],
    primaryIp: '93.184.216.34',
  }));
  t.mock.method(SafeFetcher, 'fetch', async (url: string) => ({
    data: createResponseData(url),
    bodyText: homepageHtml,
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

describe('Scanner page failure propagation', () => {
  it('keeps a fully successful crawl completed', async (t) => {
    mockPipeline(t, '<html><head><title>Home</title></head><body></body></html>');

    const scan = await ScanOrchestrator.executeScan(baseUrl);

    assert.equal(scan.status, 'completed');
    assert.equal(scan.pages.length, 1);
    assert.deepEqual(scan.errors, []);
    assert.deepEqual(scan.pages[0].scanErrors, []);
  });

  it('counts redirect hops and refuses hops beyond the execution request budget', async (t) => {
    const previousLimit = SCANNER_LIMITS.maxTotalRequests;
    SCANNER_LIMITS.maxTotalRequests = 2;
    t.after(() => {
      SCANNER_LIMITS.maxTotalRequests = previousLimit;
    });

    t.mock.method(DnsSafetyGuard, 'resolveAndVerify', async (hostname: string) => ({
      hostname,
      resolvedIps: ['93.184.216.34'],
      primaryIp: '93.184.216.34',
    }));
    t.mock.method(SafeFetcher, 'fetch', async (
      url: string,
      options?: Parameters<typeof SafeFetcher.fetch>[1]
    ) => {
      options?.onRequest?.(url);
      options?.onRequest?.(`${url}redirected`);
      return {
        data: createResponseData(url),
        bodyText: '<html><head><title>Home</title></head><body></body></html>',
      };
    });
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

    const scan = await ScanOrchestrator.executeScan(baseUrl);

    assert.equal(scan.status, 'completed');
    assert.equal(scan.summary.requestsMade, 2);

    SCANNER_LIMITS.maxTotalRequests = 1;
    const limitedScan = await ScanOrchestrator.executeScan(baseUrl);

    assert.equal(limitedScan.status, 'failed');
    assert.equal(limitedScan.errors[0]?.code, 'CRAWL_LIMIT');
    assert.equal(limitedScan.summary.requestsMade, 1);
  });

  it('marks a crawl partial and preserves the failed page and its error', async (t) => {
    t.mock.method(DnsSafetyGuard, 'resolveAndVerify', async (hostname: string) => ({
      hostname,
      resolvedIps: ['93.184.216.34'],
      primaryIp: '93.184.216.34',
    }));
    t.mock.method(SafeFetcher, 'fetch', async (url: string) => {
      if (url.endsWith('/unavailable')) {
        throw new ScannerException(
          'CONNECTION_TIMEOUT',
          'The target page timed out.',
          'Mocked timeout',
          url
        );
      }
      return {
        data: createResponseData(url),
        bodyText: '<html><head><title>Home</title></head><body><a href="/unavailable">Unavailable</a></body></html>',
      };
    });
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

    const scan = await ScanOrchestrator.executeScan(baseUrl);
    const failedPage = scan.pages.find((page) => page.url.endsWith('/unavailable'));

    assert.equal(scan.status, 'partial');
    assert.ok(failedPage, 'failed page should remain identifiable in the page inventory');
    assert.equal(failedPage.http.statusCode, 0);
    assert.equal(failedPage.scanErrors[0]?.code, 'CONNECTION_TIMEOUT');
    assert.equal(failedPage.scanErrors[0]?.targetUrl, 'https://example.com/unavailable');
    assert.equal(scan.errors[0]?.code, 'CONNECTION_TIMEOUT');
    assert.equal(scan.errors[0]?.targetUrl, 'https://example.com/unavailable');
  });

  it('marks HTTP 4xx/5xx pages as failures while preserving 2xx/3xx page metadata', async (t) => {
    t.mock.method(DnsSafetyGuard, 'resolveAndVerify', async (hostname: string) => ({
      hostname,
      resolvedIps: ['93.184.216.34'],
      primaryIp: '93.184.216.34',
    }));
    t.mock.method(SafeFetcher, 'fetch', async (url: string) => {
      if (url === baseUrl) {
        return {
          data: createResponseData(url),
          bodyText:
            '<html><head><title>Home</title></head><body><a href="/redirect">Redirect</a><a href="/missing">Missing</a><a href="/server-error">Server error</a></body></html>',
        };
      }

      const response = url.endsWith('/redirect')
        ? createResponseData(url, 302, 'Found')
        : url.endsWith('/missing')
        ? createResponseData(url, 404, 'Not Found')
        : createResponseData(url, 503, 'Service Unavailable');
      return { data: response, bodyText: '<html><body></body></html>' };
    });
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

    const scan = await ScanOrchestrator.executeScan(baseUrl);
    const redirect = scan.pages.find((page) => page.url.endsWith('/redirect'));
    const missing = scan.pages.find((page) => page.url.endsWith('/missing'));
    const serverError = scan.pages.find((page) => page.url.endsWith('/server-error'));

    assert.equal(scan.status, 'partial');
    assert.equal(redirect?.http.statusCode, 302);
    assert.deepEqual(redirect?.scanErrors, []);
    assert.equal(missing?.http.statusCode, 404);
    assert.equal(missing?.http.statusText, 'Not Found');
    assert.equal(missing?.scanErrors[0]?.code, 'REQUEST_FAILED');
    assert.equal(missing?.scanErrors[0]?.context, 'HTTP status: 404');
    assert.equal(serverError?.http.statusCode, 503);
    assert.equal(serverError?.scanErrors[0]?.context, 'HTTP status: 503');
    assert.deepEqual(
      scan.errors.map((error) => error.context).sort(),
      ['HTTP status: 404', 'HTTP status: 503']
    );
  });

  it('keeps fatal startup failures failed', async () => {
    const scan = await ScanOrchestrator.executeScan('javascript:alert(1)');

    assert.equal(scan.status, 'failed');
    assert.equal(scan.errors[0]?.code, 'INVALID_URL');
    assert.deepEqual(scan.pages, []);
  });
});
