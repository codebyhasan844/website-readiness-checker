/**
 * Controlled Safe HTTP Fetcher (Phase 2)
 *
 * Implements bounded, secure network requests with strict byte streaming caps,
 * abort timeouts, manual redirect tracking with SSRF revalidation, and raw
 * timing telemetry collection.
 */

import { fetch as uFetch, Agent } from 'undici';
import { SCANNER_LIMITS } from './limits';
import {
  abortErrorFromSignal,
  awaitWithAbort,
  ScannerException,
  sanitizeScannerError,
} from './errors';
import { UrlValidator, ValidatedUrl } from './url-validator';
import { SecurityGuard } from './security-guard';
import { DnsSafetyGuard } from './dns-safety';
import { RedirectHandler } from './redirect-handler';
import { HTTPResponseData, SecurityHeadersData } from './types';

const SENSITIVE_RESPONSE_HEADERS = new Set([
  'set-cookie',
  'cookie',
  'authorization',
  'proxy-authorization',
]);

export interface FetchResult {
  data: HTTPResponseData;
  bodyText: string;
}

export class SafeFetcher {
  /**
   * Fetches an HTTP/HTTPS resource securely, adhering to all limits and security policies.
   */
  public static async fetch(
    targetUrl: string,
    options: {
      accept?: string;
      maxBytes?: number;
      method?: 'GET' | 'HEAD';
      abortSignal?: AbortSignal;
      onRequest?: (url: string) => void;
    } = {}
  ): Promise<FetchResult> {
    const method = options.method || 'GET';
    const maxBytes = options.maxBytes || SCANNER_LIMITS.maxResponseBytes;

    let currentValidated: ValidatedUrl = UrlValidator.validate(targetUrl);

    if (options.abortSignal?.aborted) {
      throw abortErrorFromSignal(options.abortSignal, currentValidated.normalizedUrl);
    }

    // 1. Initial Security & DNS verification
    SecurityGuard.validateHostAndPort(currentValidated.hostname, currentValidated.port);
    let currentDns = await awaitWithAbort(
      () => DnsSafetyGuard.resolveAndVerify(currentValidated.hostname),
      options.abortSignal,
      currentValidated.normalizedUrl
    );

    const redirectHandler = new RedirectHandler(currentValidated.normalizedUrl);
    const overallStartTime = Date.now();

    while (true) {
      if (options.abortSignal?.aborted) {
        throw abortErrorFromSignal(options.abortSignal, currentValidated.normalizedUrl);
      }

      options.onRequest?.(currentValidated.normalizedUrl);

      const hopStartTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, SCANNER_LIMITS.requestTimeoutMs);

      // Link external abort signal if provided and track listener for cleanup
      let abortListener: (() => void) | undefined;
      if (options.abortSignal) {
        if (options.abortSignal.aborted) {
          controller.abort();
        } else {
          abortListener = () => controller.abort();
          options.abortSignal.addEventListener('abort', abortListener);
        }
      }

      const cleanupRequest = () => {
        clearTimeout(timeoutId);
        if (abortListener && options.abortSignal) {
          options.abortSignal.removeEventListener('abort', abortListener);
        }
      };

      // Pin connection to verified DNS IP records to prevent DNS rebinding TOCTOU
      const dispatcher = new Agent({
        connect: {
          lookup: DnsSafetyGuard.createPinnedLookup(currentDns),
        },
      });

      let response: any;
      try {
        response = await uFetch(currentValidated.normalizedUrl, {
          method,
          headers: {
            'User-Agent': 'WebsiteReadinessChecker/2.0 (+https://readiness-checker.dev/bot)',
            Accept: options.accept || 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-US,en;q=0.9',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
          },
          redirect: 'manual', // Manual redirects for SSRF control
          signal: controller.signal as any,
          dispatcher,
        });
      } catch (err: unknown) {
        await dispatcher.destroy().catch(() => {});
        cleanupRequest();
        if (controller.signal.aborted) {
          if (options.abortSignal?.aborted) {
            throw abortErrorFromSignal(options.abortSignal, currentValidated.normalizedUrl);
          }
          throw new ScannerException(
            'CONNECTION_TIMEOUT',
            `Request to ${currentValidated.hostname} timed out after ${SCANNER_LIMITS.requestTimeoutMs}ms.`,
            'Timeout exceeded',
            currentValidated.normalizedUrl
          );
        }
        throw sanitizeScannerError(err, currentValidated.normalizedUrl);
      }

      try {
        const hopEndTime = Date.now();
        const statusCode = response.status;

        // Handle 3xx Redirects
        if ([301, 302, 303, 307, 308].includes(statusCode)) {
          const locationHeader = response.headers.get('location');
          currentValidated = await awaitWithAbort(
            () => redirectHandler.handleRedirect(
              currentValidated.normalizedUrl,
              statusCode,
              locationHeader
            ),
            options.abortSignal,
            currentValidated.normalizedUrl
          );
          currentDns = await awaitWithAbort(
            () => DnsSafetyGuard.resolveAndVerify(currentValidated.hostname),
            options.abortSignal,
            currentValidated.normalizedUrl
          );
          // Continue redirect loop to next destination
          continue;
        }

        // Final response arrived (2xx, 4xx, 5xx, etc.)
        const rawHeadersRecord: Record<string, string> = {};
        response.headers.forEach((value: string, key: string) => {
          rawHeadersRecord[key.toLowerCase()] = value;
        });

        const headersRecord = this.filterResponseHeaders(rawHeadersRecord);
        const securityHeaders = this.extractSecurityHeaders(headersRecord);
        const contentType = (headersRecord['content-type'] || '').toLowerCase();
        const contentLengthHeader = headersRecord['content-length'];
        const declaredContentLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : undefined;

        // Check declared length against limit before reading body
        if (declaredContentLength && declaredContentLength > maxBytes) {
          throw new ScannerException(
            'RESPONSE_TOO_LARGE',
            `Response payload size (${declaredContentLength} bytes) exceeds maximum limit of ${maxBytes} bytes.`,
            `Content-Length: ${declaredContentLength}`,
            currentValidated.normalizedUrl
          );
        }

        // Read response body safely with byte accumulator
        let bodyText = '';
        let bytesRead = 0;

        if (method !== 'HEAD' && response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true });

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              if (value) {
                bytesRead += value.byteLength;
                if (bytesRead > maxBytes) {
                  // Cancel reader stream immediately
                  await reader.cancel();
                  throw new ScannerException(
                    'RESPONSE_TOO_LARGE',
                    `Streamed response exceeded maximum limit of ${maxBytes} bytes.`,
                    `Bytes read: ${bytesRead}`,
                    currentValidated.normalizedUrl
                  );
                }
                bodyText += decoder.decode(value, { stream: true });
              }
            }
            bodyText += decoder.decode(); // Flush stream
          } catch (err: unknown) {
            if (controller.signal.aborted) {
              if (options.abortSignal?.aborted) {
                throw abortErrorFromSignal(options.abortSignal, currentValidated.normalizedUrl);
              }
              throw new ScannerException(
                'CONNECTION_TIMEOUT',
                `Request to ${currentValidated.hostname} timed out after ${SCANNER_LIMITS.requestTimeoutMs}ms.`,
                'Timeout exceeded',
                currentValidated.normalizedUrl
              );
            }
            if (err instanceof ScannerException) throw err;
            throw new ScannerException(
              'REQUEST_FAILED',
              'Failed to read response body stream.',
              err instanceof Error ? err.message : String(err),
              currentValidated.normalizedUrl
            );
          }
        }

        const overallEndTime = Date.now();

        const responseData: HTTPResponseData = {
          requestedUrl: targetUrl,
          finalUrl: currentValidated.normalizedUrl,
          statusCode,
          statusText: response.statusText || String(statusCode),
          headers: headersRecord,
          securityHeaders,
          contentType,
          contentLength: declaredContentLength || bytesRead,
          responseBytes: bytesRead,
          durationMs: overallEndTime - overallStartTime,
          timing: {
            startTime: overallStartTime,
            endTime: overallEndTime,
            firstByteMs: hopEndTime - hopStartTime,
            totalMs: overallEndTime - overallStartTime,
          },
          redirects: redirectHandler.getChain(),
        };

        return {
          data: responseData,
          bodyText,
        };
      } finally {
        await dispatcher.destroy().catch(() => {});
        cleanupRequest();
      }
    }
  }

  /**
   * Filters out sensitive origin response headers (set-cookie, cookie, authorization, proxy-authorization).
   * Case-insensitive matching ensures no sensitive credentials or session tokens are stored in ScanResult.
   */
  public static filterResponseHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();
      if (!SENSITIVE_RESPONSE_HEADERS.has(lowerKey)) {
        sanitized[lowerKey] = value;
      }
    }
    return sanitized;
  }

  /**
   * Extracts recognized HTTP security headers as raw key-value pairs without evaluating them.
   */
  public static extractSecurityHeaders(headers: Record<string, string>): SecurityHeadersData {
    return {
      strictTransportSecurity: headers['strict-transport-security'],
      contentSecurityPolicy: headers['content-security-policy'],
      xContentTypeOptions: headers['x-content-type-options'],
      xFrameOptions: headers['x-frame-options'],
      referrerPolicy: headers['referrer-policy'],
      permissionsPolicy: headers['permissions-policy'],
      xRobotsTag: headers['x-robots-tag'],
      cacheControl: headers['cache-control'],
      contentEncoding: headers['content-encoding'],
      contentType: headers['content-type'],
      server: headers['server'],
    };
  }
}
