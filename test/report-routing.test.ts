import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchRouteScan,
  getOrCreateAuditSessionForScan,
  getInitialScanForRoute,
  ReportPage,
  shouldFetchRouteScan,
} from '../src/components/report/ReportPage';
import { DEMO_REPORT } from '../src/data/mockData';
import { ScanResult } from '../src/scanner/types';
import { SCANNER_LIMITS } from '../src/scanner/limits';

function createScan(scanId: string, url: string): ScanResult {
  return {
    scanId,
    inputUrl: url,
    normalizedUrl: url,
    startedAt: '2026-10-02T00:00:00.000Z',
    completedAt: '2026-10-02T00:00:01.000Z',
    totalDurationMs: 1000,
    status: 'completed',
    summary: {
      pagesAttempted: 1,
      pagesCompleted: 1,
      requestsMade: 1,
      totalBytesTransferred: 1000,
      internalLinksDiscovered: 0,
      externalLinksDiscovered: 0,
    },
    pages: [],
    sitemaps: [],
    errors: [],
    limits: SCANNER_LIMITS,
  };
}

describe('Report route scan selection', () => {
  it('accepts an initial result only when its scan ID matches the route', () => {
    const matchingScan = createScan('scan-requested-42', 'https://requested.example.test/');

    assert.equal(
      getInitialScanForRoute('scan-requested-42', matchingScan),
      matchingScan
    );
  });

  it('rejects a mismatched initial result and fetches the requested non-demo scan', () => {
    const staleScan = createScan('scan-stale-41', 'https://stale.example.test/');

    assert.equal(getInitialScanForRoute('scan-requested-42', staleScan), null);
    assert.equal(shouldFetchRouteScan('scan-requested-42', staleScan), true);
  });

  it('preserves the existing route lookup when no initial result is available', () => {
    assert.equal(getInitialScanForRoute('scan-requested-42', null), null);
    assert.equal(shouldFetchRouteScan('scan-requested-42', null), true);
    assert.equal(shouldFetchRouteScan('scan-demo-7492', null), false);
  });

  it('does not render a mismatched initial scan as the requested report', () => {
    const staleScan = createScan('scan-stale-41', 'https://stale.example.test/');
    const markup = renderToStaticMarkup(
      createElement(ReportPage, {
        scanId: 'scan-requested-42',
        initialRawScan: staleScan,
        onNavigateHome: () => {},
      })
    );

    assert.equal(markup.includes('scan-stale-41'), false);
    assert.equal(markup.includes('stale.example.test'), false);
  });

  it('continues rendering a matching initial scan as the real report', () => {
    const matchingScan = createScan(
      'scan-requested-42',
      'https://requested.example.test/'
    );
    const markup = renderToStaticMarkup(
      createElement(ReportPage, {
        scanId: 'scan-requested-42',
        initialRawScan: matchingScan,
        onNavigateHome: () => {},
      })
    );

    assert.equal(markup.includes('requested.example.test'), true);
  });

  it('does not render the demo report for a missing real scan route', () => {
    const markup = renderToStaticMarkup(
      createElement(ReportPage, {
        scanId: 'scan-missing-404',
        onNavigateHome: () => {},
      })
    );

    assert.match(markup, /Scan result unavailable/);
    assert.match(markup, /requested scan result could not be loaded/i);
    assert.equal(markup.includes(DEMO_REPORT.url), false);
    assert.equal(markup.includes(DEMO_REPORT.id), false);
  });

  it('renders the demo report on its intentional demo route', () => {
    const markup = renderToStaticMarkup(
      createElement(ReportPage, {
        scanId: DEMO_REPORT.id,
        onNavigateHome: () => {},
      })
    );

    assert.equal(markup.includes(DEMO_REPORT.url), true);
  });

  it('uses the initialized scan batch instead of the empty session shell', () => {
    const scan = createScan('scan-session-init-42', 'https://session.example.test/');
    scan.pages = [{
      url: scan.normalizedUrl,
      normalizedUrl: scan.normalizedUrl,
      depth: 0,
      discoveredFrom: ['homepage'],
      http: {
        requestedUrl: scan.normalizedUrl,
        finalUrl: scan.normalizedUrl,
        statusCode: 200,
        statusText: 'OK',
        headers: {},
        securityHeaders: {},
        contentType: 'text/html',
        responseBytes: 100,
        durationMs: 10,
        timing: { startTime: 0, endTime: 10, totalMs: 10 },
        redirects: [],
      },
      document: {},
      headings: { h1Count: 0, items: [] },
      links: [],
      images: [],
      resources: [],
      scanErrors: [],
    }];
    scan.discoveredUrls = [scan.normalizedUrl];

    const session = getOrCreateAuditSessionForScan(scan);

    assert.equal(session.batches.length, 1);
    assert.deepEqual(session.allAnalyzedUrls, [scan.normalizedUrl]);
    assert.equal(session.coverage.status, 'FULL COVERAGE');
    assert.notEqual(session.coverage.message, 'Audit session initialized. Ready for batch analysis.');
  });

  it('loads a real scan through the route API helper and rejects missing or failed lookups', async () => {
    const realScan = createScan('scan-route-api-42', 'https://api-result.example.test/');
    let requestedUrl = '';
    const loadedScan = await fetchRouteScan(realScan.scanId, async (input) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify(realScan), { status: 200 });
    });

    assert.equal(requestedUrl, `/api/scan/${realScan.scanId}`);
    assert.deepEqual(loadedScan, realScan);

    await assert.rejects(
      fetchRouteScan('scan-not-found', async () => new Response('', { status: 404 })),
      /status 404/
    );
    await assert.rejects(
      fetchRouteScan('scan-network-error', async () => {
        throw new Error('network unavailable');
      }),
      /network unavailable/
    );
    await assert.rejects(
      fetchRouteScan(realScan.scanId, async () =>
        new Response(JSON.stringify(createScan('scan-mismatched', realScan.inputUrl)), { status: 200 })
      ),
      /different scan/
    );
  });
});
