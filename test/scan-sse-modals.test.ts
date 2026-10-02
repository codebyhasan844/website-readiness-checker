import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { consumeScanSseStream, handleScanSseFrame } from '../src/utils/scan-sse';
import type { ScanProgressEvent, ScanResult } from '../src/scanner/types';

const scan: ScanResult = {
  scanId: 'scan-modal-test',
  inputUrl: 'https://example.com/',
  normalizedUrl: 'https://example.com/',
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

function createHandlers() {
  const events: Array<{ type: string; value: unknown }> = [];
  return {
    events,
    handlers: {
      onProgress: (value: ScanProgressEvent) => events.push({ type: 'progress', value }),
      onCompleted: (value: ScanResult) => events.push({ type: 'completed', value }),
      onError: (value: string) => events.push({ type: 'scan_error', value }),
      onCancelled: (value: string) => events.push({ type: 'cancelled', value }),
    },
  };
}

function readModal(name: string): string {
  return fs.readFileSync(
    path.resolve(`src/components/report/${name}.tsx`),
    'utf8'
  );
}

function createClosedReader(): ReadableStreamDefaultReader<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.close();
    },
  }).getReader();
}

describe('Report modal server SSE contract', () => {
  it('ReScanModal consumes named completed events carrying a raw ScanResult', () => {
    const source = readModal('ReScanModal');
    const { events, handlers } = createHandlers();

    const terminal = handleScanSseFrame(
      `event: completed\ndata: ${JSON.stringify(scan)}`,
      handlers
    );

    assert.equal(terminal, true);
    assert.deepEqual(events, [{ type: 'completed', value: scan }]);
    assert.ok(source.includes('consumeScanSseStream(reader'));
    assert.ok(source.includes('onScanComplete(scan)'));
  });

  it('ReScanModal preserves partial status from the completed payload', () => {
    const partialScan = { ...scan, status: 'partial' as const };
    const { events, handlers } = createHandlers();

    handleScanSseFrame(
      `event: completed\ndata: ${JSON.stringify(partialScan)}`,
      handlers
    );

    assert.equal(events[0].type, 'completed');
    assert.equal((events[0].value as ScanResult).status, 'partial');
  });

  it('ReScanModal routes named scan_error events to visible failure handling', () => {
    const source = readModal('ReScanModal');
    const { events, handlers } = createHandlers();

    const terminal = handleScanSseFrame(
      'event: scan_error\ndata: {"code":"DNS_FAILURE","message":"Domain could not be resolved."}',
      handlers
    );

    assert.equal(terminal, true);
    assert.deepEqual(events, [{ type: 'scan_error', value: 'Domain could not be resolved.' }]);
    assert.ok(source.includes('onError: (message) =>'));
    assert.ok(source.includes('setIsScanning(false)'));
    assert.ok(source.includes('setErrorMessage(message)'));
  });

  it('ContinueAuditModal passes completed partial results to existing batch handling', () => {
    const source = readModal('ContinueAuditModal');
    const partialScan = { ...scan, status: 'partial' as const };
    const { events, handlers } = createHandlers();

    const terminal = handleScanSseFrame(
      `event: completed\ndata: ${JSON.stringify(partialScan)}`,
      handlers
    );

    assert.equal(terminal, true);
    assert.deepEqual(events, [{ type: 'completed', value: partialScan }]);
    assert.ok(source.includes('onBatchComplete(scan)'));
    assert.ok(source.includes('consumeScanSseStream(reader'));
  });

  it('ContinueAuditModal routes named scan_error events to visible failure handling', () => {
    const source = readModal('ContinueAuditModal');
    const { events, handlers } = createHandlers();

    const terminal = handleScanSseFrame(
      'event: scan_error\ndata: {"code":"REQUEST_FAILED","message":"Page could not be fetched."}',
      handlers
    );

    assert.equal(terminal, true);
    assert.deepEqual(events, [{ type: 'scan_error', value: 'Page could not be fetched.' }]);
    assert.ok(source.includes('onError: (message) =>'));
    assert.ok(source.includes('setIsAuditing(false)'));
    assert.ok(source.includes('setErrorMessage(message)'));
  });

  it('both modals stop progress on cancellation without invoking completion', () => {
    const { events, handlers } = createHandlers();

    const terminal = handleScanSseFrame(
      'event: cancelled\ndata: {"message":"Scan cancelled by client."}',
      handlers
    );

    assert.equal(terminal, true);
    assert.deepEqual(events, [{ type: 'cancelled', value: 'Scan cancelled by client.' }]);
    assert.ok(readModal('ReScanModal').includes('onCancelled: (message) =>'));
    assert.ok(readModal('ContinueAuditModal').includes('onCancelled: (message) =>'));
  });

  it('both modals report clean EOF as an error without invoking completion', async () => {
    for (const [name, activeState, completeCallback] of [
      ['ReScanModal', 'setIsScanning(false)', 'onScanComplete(scan)'],
      ['ContinueAuditModal', 'setIsAuditing(false)', 'onBatchComplete(scan)'],
    ]) {
      const source = readModal(name);
      const { events, handlers } = createHandlers();
      await consumeScanSseStream(createClosedReader(), handlers);

      assert.deepEqual(events, [{
        type: 'scan_error',
        value: 'The scanner connection ended before the scan completed.',
      }]);
      assert.ok(source.includes(activeState));
      assert.ok(source.includes('setErrorMessage(message)'));
      assert.ok(source.includes(completeCallback));
      assert.equal(events.some((event) => event.type === 'completed'), false);
    }
  });

  it('both modals use their existing error handler for server shutdown', () => {
    for (const name of ['ReScanModal', 'ContinueAuditModal']) {
      const source = readModal(name);
      const { events, handlers } = createHandlers();
      const terminal = handleScanSseFrame(
        'event: server_shutdown\ndata: {"message":"Scanner is unavailable."}',
        handlers
      );

      assert.equal(terminal, true);
      assert.deepEqual(events, [{ type: 'cancelled', value: 'Scanner is unavailable.' }]);
      assert.ok(source.includes('onCancelled: (message) =>'));
      assert.ok(source.includes('setErrorMessage(message)'));
    }
  });
});
