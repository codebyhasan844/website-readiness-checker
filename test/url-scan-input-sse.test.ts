import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { consumeScanSseStream } from '../src/utils/scan-sse';
import type { ScanProgressEvent, ScanResult } from '../src/scanner/types';

const scan: ScanResult = {
  scanId: 'scan-sse-input-test',
  inputUrl: 'https://example.test/',
  normalizedUrl: 'https://example.test/',
  startedAt: '2026-10-02T00:00:00.000Z',
  completedAt: '2026-10-02T00:00:01.000Z',
  totalDurationMs: 1000,
  status: 'completed',
  summary: {
    pagesAttempted: 1,
    pagesCompleted: 1,
    requestsMade: 1,
    totalBytesTransferred: 64,
    internalLinksDiscovered: 0,
    externalLinksDiscovered: 0,
  },
  pages: [],
  sitemaps: [],
  errors: [],
  limits: {
    maxPages: 50,
    maxDepth: 3,
    maxRedirects: 5,
    maxTotalRequests: 150,
    requestTimeoutMs: 8000,
    maxScanDurationMs: 60000,
    maxResponseBytes: 3145728,
    maxHtmlBytes: 2097152,
    maxSitemapUrls: 250,
    allowedPorts: [80, 443],
    maxResourcesPerPage: 5,
  },
};

function createReader(frame?: string): ReadableStreamDefaultReader<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      if (frame) controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  }).getReader();
}

function createHandlers() {
  const events: Array<{ type: string; value?: unknown }> = [];
  return {
    events,
    handlers: {
      onProgress: (value: ScanProgressEvent) => events.push({ type: 'progress', value }),
      onCompleted: (value: ScanResult) => events.push({ type: 'completed', value }),
      onError: (value: string) => events.push({ type: 'error', value }),
      onCancelled: (value: string) => events.push({ type: 'cancelled', value }),
      onServerShutdown: (value: string) => events.push({ type: 'server_shutdown', value }),
    },
  };
}

describe('UrlScanInput SSE terminal handling', () => {
  it('handles cancelled as a terminal event without reporting successful completion', async () => {
    const { events, handlers } = createHandlers();
    await consumeScanSseStream(
      createReader('event: cancelled\ndata: {"message":"Scan cancelled by client."}\n\n'),
      handlers
    );

    assert.deepEqual(events, [{ type: 'cancelled', value: 'Scan cancelled by client.' }]);
  });

  it('handles server_shutdown as a distinct terminal event', async () => {
    const { events, handlers } = createHandlers();
    await consumeScanSseStream(
      createReader('event: server_shutdown\ndata: {"message":"Server is shutting down."}\n\n'),
      handlers
    );

    assert.deepEqual(events, [{ type: 'server_shutdown', value: 'Server is shutting down.' }]);
  });

  it('continues to handle completed and scan_error terminal events', async () => {
    const completed = createHandlers();
    await consumeScanSseStream(
      createReader(`event: completed\ndata: ${JSON.stringify(scan)}\n\n`),
      completed.handlers
    );
    assert.deepEqual(completed.events, [{ type: 'completed', value: scan }]);

    const failed = createHandlers();
    await consumeScanSseStream(
      createReader('event: scan_error\ndata: {"message":"Scan rejected."}\n\n'),
      failed.handlers
    );
    assert.deepEqual(failed.events, [{ type: 'error', value: 'Scan rejected.' }]);
  });

  it('treats a clean stream end without a terminal event as a visible error', async () => {
    const { events, handlers } = createHandlers();
    await consumeScanSseStream(
      createReader('event: progress\ndata: {"stepNumber":2,"message":"Connecting"}\n\n'),
      handlers
    );

    assert.deepEqual(events, [
      {
        type: 'progress',
        value: { stepNumber: 2, message: 'Connecting' },
      },
      {
        type: 'error',
        value: 'The scanner connection ended before the scan completed.',
      },
    ]);
  });

  it('UrlScanInput maps cancellation to idle and shutdown/errors to failed state', () => {
    const source = fs.readFileSync(
      path.resolve('src/components/UrlScanInput.tsx'),
      'utf8'
    );

    assert.ok(source.includes('onCancelled: () =>'));
    assert.ok(source.includes("setScanState('idle')"));
    assert.ok(source.includes('onServerShutdown: () =>'));
    assert.ok(source.includes("setScanState('failed')"));
    assert.ok(source.includes('consumeScanSseStream(reader'));
  });
});
