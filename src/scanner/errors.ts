/**
 * Structured Scanner Error Model (Phase 2)
 *
 * Provides safe, user-friendly error categories and explanations without
 * leaking internal IP addresses, infrastructure topology, or stack traces.
 */

export type ScanErrorCode =
  | 'INVALID_URL'
  | 'BLOCKED_DESTINATION'
  | 'DNS_FAILURE'
  | 'CONNECTION_TIMEOUT'
  | 'REQUEST_FAILED'
  | 'REDIRECT_LIMIT'
  | 'REDIRECT_BLOCKED'
  | 'RESPONSE_TOO_LARGE'
  | 'CRAWL_LIMIT'
  | 'SCAN_TIMEOUT'
  | 'PARSE_ERROR'
  | 'UNSUPPORTED_CONTENT'
  | 'RATE_LIMITED';

export interface ScanError {
  code: ScanErrorCode;
  message: string;
  context?: string;
  targetUrl?: string;
  timestamp: string;
}

export class ScannerException extends Error {
  public readonly code: ScanErrorCode;
  public readonly context?: string;
  public readonly targetUrl?: string;

  constructor(code: ScanErrorCode, message: string, context?: string, targetUrl?: string) {
    super(message);
    this.name = 'ScannerException';
    this.code = code;
    this.context = context;
    this.targetUrl = targetUrl;
  }

  public toScanError(): ScanError {
    return {
      code: this.code,
      message: this.message,
      context: this.context,
      targetUrl: this.targetUrl,
      timestamp: new Date().toISOString(),
    };
  }
}

export function abortErrorFromSignal(signal: AbortSignal, targetUrl?: string): ScannerException {
  if (signal.reason instanceof ScannerException) {
    return signal.reason;
  }

  return new ScannerException(
    'REQUEST_FAILED',
    'Request aborted due to scan cancellation.',
    'Client disconnected or scan cancelled',
    targetUrl
  );
}

export function awaitWithAbort<T>(
  operation: () => Promise<T>,
  signal?: AbortSignal,
  targetUrl?: string
): Promise<T> {
  if (!signal) return operation();
  if (signal.aborted) {
    return Promise.reject(abortErrorFromSignal(signal, targetUrl));
  }

  let pendingOperation: Promise<T>;
  try {
    pendingOperation = operation();
  } catch (error: unknown) {
    return Promise.reject(error);
  }

  return new Promise<T>((resolve, reject) => {
    const cleanup = () => signal.removeEventListener('abort', onAbort);
    const onAbort = () => {
      cleanup();
      reject(abortErrorFromSignal(signal, targetUrl));
    };

    signal.addEventListener('abort', onAbort, { once: true });
    pendingOperation.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error: unknown) => {
        cleanup();
        reject(error);
      }
    );
  });
}

export function createHttpStatusScanError(
  statusCode: number,
  statusText: string,
  targetUrl: string
): ScanError | null {
  if (statusCode < 400) return null;

  return new ScannerException(
    'REQUEST_FAILED',
    `The target page returned HTTP ${statusCode}${statusText ? ` ${statusText}` : ''}.`,
    `HTTP status: ${statusCode}`,
    targetUrl
  ).toScanError();
}

/**
 * Maps raw system errors to sanitized user-facing scanner errors.
 */
export function sanitizeScannerError(err: unknown, targetUrl?: string): ScanError {
  const timestamp = new Date().toISOString();

  if (err instanceof ScannerException) {
    return err.toScanError();
  }

  const errStr = err instanceof Error ? err.message : String(err);

  if (errStr.includes('ENOTFOUND') || errStr.includes('EAI_AGAIN') || errStr.includes('getaddrinfo')) {
    return {
      code: 'DNS_FAILURE',
      message: 'The website domain could not be resolved via public DNS.',
      context: 'Host lookup failed or domain does not exist.',
      targetUrl,
      timestamp,
    };
  }

  if (errStr.includes('ECONNREFUSED')) {
    return {
      code: 'REQUEST_FAILED',
      message: 'The target server refused the connection on the requested port.',
      context: 'Port 80/443 closed or server inactive.',
      targetUrl,
      timestamp,
    };
  }

  if (errStr.includes('ETIMEDOUT') || errStr.includes('AbortError') || errStr.includes('timeout')) {
    return {
      code: 'CONNECTION_TIMEOUT',
      message: 'The target server took too long to answer before connection timeout.',
      context: 'Request exceeded per-request timeout limit.',
      targetUrl,
      timestamp,
    };
  }

  if (errStr.includes('CERT_') || errStr.includes('DEPTH_ZERO_SELF_SIGNED_CERT') || errStr.includes('UNABLE_TO_VERIFY_LEAF_SIGNATURE')) {
    return {
      code: 'REQUEST_FAILED',
      message: 'TLS handshake failed due to an invalid, self-signed, or expired SSL certificate.',
      context: errStr,
      targetUrl,
      timestamp,
    };
  }

  return {
    code: 'REQUEST_FAILED',
    message: 'An unexpected network error occurred while communicating with the target website.',
    context: 'Standard network failure.',
    targetUrl,
    timestamp,
  };
}
