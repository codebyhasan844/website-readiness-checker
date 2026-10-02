import { describe, it, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { SafeFetcher } from '../src/scanner/fetcher';
import { ResourceAnalyzer } from '../src/scanner/resource-analyzer';
import type { FetchResult } from '../src/scanner/fetcher';
import type { ResourceReference } from '../src/scanner/types';

const resource: ResourceReference = {
  type: 'image',
  url: 'https://example.com/image.png',
  isInternal: true,
};

function createFetchResult(url: string): FetchResult {
  return {
    data: {
      requestedUrl: url,
      finalUrl: url,
      statusCode: 200,
      statusText: 'OK',
      headers: { 'cache-control': 'public, max-age=3600' },
      securityHeaders: {},
      contentType: 'image/png',
      contentLength: 24,
      responseBytes: 24,
      durationMs: 1,
      timing: { startTime: 0, endTime: 1, totalMs: 1 },
      redirects: [],
    },
    bodyText: '',
  };
}

function mockHeadFailureThenGet(t: TestContext, methods: string[]): void {
  t.mock.method(SafeFetcher, 'fetch', async (
    url: string,
    options?: Parameters<typeof SafeFetcher.fetch>[1]
  ) => {
    methods.push(options?.method || 'GET');
    if (options?.method === 'HEAD') throw new Error('HEAD is not supported');
    return createFetchResult(url);
  });
}

describe('Resource analyzer request budget', () => {
  it('counts a successful primary HEAD request exactly once', async (t) => {
    const methods: string[] = [];
    t.mock.method(SafeFetcher, 'fetch', async (
      url: string,
      options?: Parameters<typeof SafeFetcher.fetch>[1]
    ) => {
      methods.push(options?.method || 'GET');
      return createFetchResult(url);
    });

    const result = await ResourceAnalyzer.analyzeResources([resource], 0);

    assert.deepEqual(methods, ['HEAD']);
    assert.equal(result.requestsMade, 1);
    assert.equal(result.resources[0].statusCode, 200);
    assert.equal(result.resources[0].contentType, 'image/png');
  });

  it('counts the fallback GET separately and preserves its resource result', async (t) => {
    const methods: string[] = [];
    mockHeadFailureThenGet(t, methods);

    const result = await ResourceAnalyzer.analyzeResources([resource], 0, undefined, 2);

    assert.deepEqual(methods, ['HEAD', 'GET']);
    assert.equal(result.requestsMade, methods.length);
    assert.equal(result.resources[0].statusCode, 200);
    assert.equal(result.resources[0].sizeBytes, 24);
    assert.equal(result.resources[0].cacheControl, 'public, max-age=3600');
  });

  it('falls back to GET when HEAD returns HTTP 405 and counts both requests', async (t) => {
    const methods: string[] = [];
    t.mock.method(SafeFetcher, 'fetch', async (
      url: string,
      options?: Parameters<typeof SafeFetcher.fetch>[1]
    ) => {
      const method = options?.method || 'GET';
      methods.push(method);
      if (method === 'HEAD') {
        return {
          ...createFetchResult(url),
          data: { ...createFetchResult(url).data, statusCode: 405, statusText: 'Method Not Allowed' },
        };
      }
      return createFetchResult(url);
    });

    const result = await ResourceAnalyzer.analyzeResources([resource], 0, undefined, 2);

    assert.deepEqual(methods, ['HEAD', 'GET']);
    assert.equal(result.requestsMade, 2);
    assert.equal(result.resources[0].statusCode, 200);
  });

  it('counts and enforces the remaining budget for redirect hops', async (t) => {
    let requestCount = 0;
    t.mock.method(SafeFetcher, 'fetch', async (
      url: string,
      options?: Parameters<typeof SafeFetcher.fetch>[1]
    ) => {
      options?.onRequest?.(url);
      options?.onRequest?.(`${url}/redirected`);
      requestCount += 2;
      return createFetchResult(url);
    });

    const result = await ResourceAnalyzer.analyzeResources([resource], 0, undefined, 2);

    assert.equal(requestCount, 2);
    assert.equal(result.requestsMade, 2);

    const limited = await ResourceAnalyzer.analyzeResources([resource], 0, undefined, 1);
    assert.equal(limited.requestsMade, 1);
    assert.equal(limited.resources[0].isSkipped, true);
  });

  it('does not perform or count the fallback GET when only the HEAD budget remains', async (t) => {
    const methods: string[] = [];
    mockHeadFailureThenGet(t, methods);

    const result = await ResourceAnalyzer.analyzeResources([resource], 9, undefined, 10);

    assert.deepEqual(methods, ['HEAD']);
    assert.equal(result.requestsMade, 1);
    assert.equal(result.resources[0].isSkipped, true);
    assert.equal(result.resources[0].skippedReason, 'global scan request limit reached');
  });

  it('does not double-count either request in the returned request total', async (t) => {
    const methods: string[] = [];
    mockHeadFailureThenGet(t, methods);

    const result = await ResourceAnalyzer.analyzeResources([resource], 8, undefined, 10);

    assert.deepEqual(methods, ['HEAD', 'GET']);
    assert.equal(result.requestsMade, 2);
    assert.equal(8 + result.requestsMade, 10);
  });
});
