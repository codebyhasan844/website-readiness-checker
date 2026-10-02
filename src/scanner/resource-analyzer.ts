/**
 * Resource Analyzer (Phase 2)
 *
 * Samples referenced static resources (CSS, JS, fonts, images) safely using
 * HTTP HEAD or shallow GET requests to record status, content-type, size, and latency.
 * NEVER executes JavaScript or downloads unbounded payloads.
 */

import { SafeFetcher } from './fetcher';
import { SCANNER_LIMITS } from './limits';
import { ScannerException } from './errors';
import { ResourceReference } from './types';

export class ResourceAnalyzer {
  /**
   * Samples referenced resources within strict page and total request limits.
   */
  public static async analyzeResources(
    rawResources: ResourceReference[],
    currentTotalRequests: number,
    resourceCache?: Map<string, ResourceReference>,
    maxTotalBudget: number = SCANNER_LIMITS.maxTotalRequests,
    abortSignal?: AbortSignal
  ): Promise<{ resources: ResourceReference[]; requestsMade: number; bytesTransferred: number }> {
    const analyzed: ResourceReference[] = [];
    let requestsCount = 0;
    let totalBytesTransferred = 0;

    // Take up to maxResourcesPerPage internal/external items
    const candidates = rawResources.slice(0, SCANNER_LIMITS.maxResourcesPerPage);

    for (const res of candidates) {
      if (abortSignal?.aborted) {
        break;
      }

      // 1. Check cache first to avoid re-fetching duplicate static resources across pages
      if (resourceCache && resourceCache.has(res.url)) {
        analyzed.push(resourceCache.get(res.url)!);
        continue;
      }

      if (currentTotalRequests + requestsCount >= maxTotalBudget) {
        // Exceeded overall total request budget or reserved page budget
        const skipped: ResourceReference = {
          ...res,
          isSkipped: true,
          skippedReason: 'global scan request limit reached',
        };
        analyzed.push(skipped);
        continue;
      }

      requestsCount++;
      const startTime = Date.now();
      let firstRequest = true;
      const recordRedirectRequest = (url: string) => {
        if (firstRequest) {
          firstRequest = false;
          return;
        }
        if (currentTotalRequests + requestsCount >= maxTotalBudget) {
          throw new ScannerException(
            'CRAWL_LIMIT',
            'The scan reached its maximum total HTTP request limit.',
            'No request budget remained for the redirect destination.',
            url
          );
        }
        requestsCount++;
      };

      try {
        // Attempt lightweight HEAD first
        const { data } = await SafeFetcher.fetch(res.url, {
          method: 'HEAD',
          maxBytes: 100 * 1024,
          abortSignal,
          onRequest: recordRedirectRequest,
        });

        if (data.statusCode === 405 || data.statusCode === 501) {
          throw new ScannerException(
            'REQUEST_FAILED',
            `The resource server does not support HEAD requests (HTTP ${data.statusCode}).`,
            `HTTP status: ${data.statusCode}`,
            res.url
          );
        }

        totalBytesTransferred += data.responseBytes;

        const record: ResourceReference = {
          ...res,
          statusCode: data.statusCode,
          contentType: data.contentType,
          sizeBytes: data.contentLength,
          durationMs: Date.now() - startTime,
          cacheControl: data.headers['cache-control'] || data.securityHeaders.cacheControl,
        };
        if (resourceCache) resourceCache.set(res.url, record);
        analyzed.push(record);
      } catch (headErr: unknown) {
        if (abortSignal?.aborted) {
          break;
        }

        if (currentTotalRequests + requestsCount >= maxTotalBudget) {
          analyzed.push({
            ...res,
            isSkipped: true,
            skippedReason: 'global scan request limit reached',
          });
          continue;
        }

        requestsCount++;
        firstRequest = true;
        // Fallback: If server rejects HEAD (e.g. 405 Method Not Allowed), attempt shallow GET
        try {
          const { data } = await SafeFetcher.fetch(res.url, {
            method: 'GET',
            maxBytes: 64 * 1024, // 64 KB cap for asset sampling
            abortSignal,
            onRequest: recordRedirectRequest,
          });

          totalBytesTransferred += data.responseBytes;

          const record: ResourceReference = {
            ...res,
            statusCode: data.statusCode,
            contentType: data.contentType,
            sizeBytes: data.responseBytes,
            durationMs: Date.now() - startTime,
            cacheControl: data.headers['cache-control'] || data.securityHeaders.cacheControl,
          };
          if (resourceCache) resourceCache.set(res.url, record);
          analyzed.push(record);
        } catch (getErr: unknown) {
          const record: ResourceReference = {
            ...res,
            error: getErr instanceof Error ? getErr.message : String(getErr),
            durationMs: Date.now() - startTime,
          };
          if (resourceCache) resourceCache.set(res.url, record);
          analyzed.push(record);
        }
      }
    }

    return {
      resources: analyzed,
      requestsMade: requestsCount,
      bytesTransferred: totalBytesTransferred,
    };
  }
}
