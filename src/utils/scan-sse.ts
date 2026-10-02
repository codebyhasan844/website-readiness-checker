import type { ScanProgressEvent, ScanResult } from '../scanner/types';

interface ScanSseHandlers {
  onProgress: (progress: ScanProgressEvent) => void;
  onCompleted: (scan: ScanResult) => void;
  onError: (message: string) => void;
  onCancelled: (message: string) => void;
  onServerShutdown?: (message: string) => void;
}

function isScanResult(value: unknown): value is ScanResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as { scanId?: unknown; status?: unknown };
  return (
    typeof result.scanId === 'string' &&
    ['queued', 'running', 'completed', 'partial', 'failed'].includes(String(result.status))
  );
}

function getMessage(value: unknown, fallback: string): string {
  if (value && typeof value === 'object' && 'message' in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}

export function handleScanSseFrame(frame: string, handlers: ScanSseHandlers): boolean {
  let eventType = '';
  const dataLines: string[] = [];

  for (const line of frame.split(/\r?\n/)) {
    if (line.startsWith('event:')) {
      eventType = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (!eventType || dataLines.length === 0) return false;

  let data: unknown;
  try {
    data = JSON.parse(dataLines.join('\n'));
  } catch {
    return false;
  }

  if (eventType === 'progress') {
    handlers.onProgress(data as ScanProgressEvent);
    return false;
  }
  if (eventType === 'completed') {
    if (isScanResult(data)) {
      handlers.onCompleted(data);
    } else {
      handlers.onError('The scanner returned an invalid completion response.');
    }
    return true;
  }
  if (eventType === 'scan_error') {
    handlers.onError(getMessage(data, 'The scan could not be completed.'));
    return true;
  }
  if (eventType === 'cancelled') {
    handlers.onCancelled(getMessage(data, 'The scan was cancelled by the server.'));
    return true;
  }
  if (eventType === 'server_shutdown') {
    const message = getMessage(data, 'The scanner is shutting down.');
    if (handlers.onServerShutdown) handlers.onServerShutdown(message);
    else handlers.onCancelled(message);
    return true;
  }

  return false;
}

export async function consumeScanSseStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  handlers: ScanSseHandlers
): Promise<void> {
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let terminalEventReceived = false;

  const processFrames = (chunk: string): void => {
    buffer += chunk;
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() || '';

    for (const frame of frames) {
      if (handleScanSseFrame(frame, handlers)) {
        terminalEventReceived = true;
        return;
      }
    }
  };

  try {
    while (!terminalEventReceived) {
      const { done, value } = await reader.read();
      if (done) {
        processFrames(decoder.decode());
        if (!terminalEventReceived && buffer.trim()) {
          terminalEventReceived = handleScanSseFrame(buffer, handlers);
        }
        break;
      }

      processFrames(decoder.decode(value, { stream: true }));
    }
  } finally {
    reader.releaseLock();
  }

  if (!terminalEventReceived) {
    handlers.onError('The scanner connection ended before the scan completed.');
  }
}
