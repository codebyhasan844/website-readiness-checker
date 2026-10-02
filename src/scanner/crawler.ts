/**
 * Bounded Internal Crawler (Phase 2)
 *
 * Implements a strict, queue-based crawler restricted to the target website scope.
 * Governed by hard caps on pages, depth, total requests, and total scan duration.
 */

import { SCANNER_LIMITS } from './limits';
import { UrlValidator } from './url-validator';
import { SafeFetcher } from './fetcher';
import { HtmlParser } from './parser';
import { ResourceAnalyzer } from './resource-analyzer';
import { PageScanResult, ScanError } from './types';
import { createHttpStatusScanError, sanitizeScannerError, ScannerException } from './errors';

export interface CrawlQueueItem {
  url: string;
  normalizedUrl: string;
  depth: number;
  discoveredFrom: string[];
}

export interface CrawlerProgressCallback {
  (progress: {
    pagesAttempted: number;
    pagesCompleted: number;
    currentUrl: string;
    queueLength: number;
  }): void;
}

export class BoundedCrawler {
  private baseNormalizedUrl: string;
  private visited = new Set<string>();
  private allDiscoveredUrls = new Set<string>();
  private queue: CrawlQueueItem[] = [];
  private totalRequestsMade = 0;
  private totalBytesTransferred = 0;
  private depthBlockedCount = 0;
  private scanStartTime = 0;
  private resourceCache: Map<string, import('./types').ResourceReference>;

  constructor(baseNormalizedUrl: string, resourceCache?: Map<string, import('./types').ResourceReference>) {
    this.baseNormalizedUrl = baseNormalizedUrl;
    this.resourceCache = resourceCache || new Map();
    this.allDiscoveredUrls.add(baseNormalizedUrl);
  }

  /**
   * Pre-marks URLs as visited (e.g. from previous batches in the same session)
   * so they are never rescanned.
   */
  public markAlreadyScanned(urls: string[]): void {
    for (const u of urls) {
      if (!u) continue;
      const normalized = UrlValidator.resolveAndNormalizeLink(u, this.baseNormalizedUrl);
      if (normalized) {
        this.visited.add(normalized);
        this.allDiscoveredUrls.add(normalized);
      }
    }
  }

  /**
   * Registers discovered inventory URLs without adding them to the immediate crawl queue.
   */
  public trackDiscovered(urls?: string[]): void {
    if (!urls || !Array.isArray(urls)) return;
    for (const u of urls) {
      if (!u) continue;
      const normalized = UrlValidator.resolveAndNormalizeLink(u, this.baseNormalizedUrl);
      if (normalized && UrlValidator.isSameSite(normalized, this.baseNormalizedUrl)) {
        this.allDiscoveredUrls.add(normalized);
      }
    }
  }

  /**
   * Enqueues discovered links into the crawl queue if they meet same-site and depth criteria.
   */
  public enqueue(
    candidateUrls: string[],
    depth: number,
    discoveredFrom: string
  ): void {
    if (depth > SCANNER_LIMITS.maxDepth) {
      this.depthBlockedCount += candidateUrls.length;
      return;
    }

    for (const rawUrl of candidateUrls) {
      const normalized = UrlValidator.resolveAndNormalizeLink(rawUrl, this.baseNormalizedUrl);
      if (!normalized) continue;

      // Must be same-site
      if (!UrlValidator.isSameSite(normalized, this.baseNormalizedUrl)) continue;

      // Track all discovered same-site URLs for inventory
      this.allDiscoveredUrls.add(normalized);

      // Skip already visited or already queued
      if (this.visited.has(normalized)) continue;
      if (this.queue.some((item) => item.normalizedUrl === normalized)) continue;

      // Cap queue size to avoid runaway memory, but allow enough to explore up to 250 links
      // Use continue instead of break so remaining candidate links are still recorded in allDiscoveredUrls
      if (this.queue.length >= 250) continue;

      this.queue.push({
        url: rawUrl,
        normalizedUrl: normalized,
        depth,
        discoveredFrom: [discoveredFrom],
      });
    }
  }

  /**
   * Returns current count of queued URLs waiting to be crawled.
   */
  public getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Returns all same-site URLs observed across homepage, sitemaps, and crawled pages.
   */
  public getDiscoveredUrls(): string[] {
    return Array.from(this.allDiscoveredUrls);
  }

  /**
   * Returns discovered URLs that have not yet been analyzed.
   */
  public getRemainingUrls(): string[] {
    return Array.from(this.allDiscoveredUrls).filter((u) => !this.visited.has(u));
  }

  /**
   * Runs the bounded crawl loop starting from the queue.
   */
  public async crawl(
    initialPages: PageScanResult[] = [],
    existingRequestsCount = 0,
    onProgress?: CrawlerProgressCallback,
    abortSignal?: AbortSignal,
    executionStartedAtMs = Date.now()
  ): Promise<{
    pages: PageScanResult[];
    requestsMade: number;
    bytesTransferred: number;
    discoveredUrls: string[];
    remainingUrls: string[];
    depthBlockedUrlsCount: number;
  }> {
    const pages: PageScanResult[] = [...initialPages];
    this.totalRequestsMade = existingRequestsCount;
    this.scanStartTime = executionStartedAtMs;

    // Mark existing pages as visited
    for (const p of initialPages) {
      this.visited.add(p.normalizedUrl);
      this.allDiscoveredUrls.add(p.normalizedUrl);
      const statusError = createHttpStatusScanError(
        p.http.statusCode,
        p.http.statusText,
        p.normalizedUrl
      );
      if (statusError && !p.scanErrors.some((error) =>
        error.code === statusError.code &&
        error.targetUrl === statusError.targetUrl &&
        error.context === statusError.context
      )) {
        p.scanErrors.push(statusError);
      }
    }

    while (this.queue.length > 0) {
      // Check limits and cancellation
      if (abortSignal?.aborted) break;
      if (pages.length >= SCANNER_LIMITS.maxPages) break;
      if (this.totalRequestsMade >= SCANNER_LIMITS.maxTotalRequests) break;
      if (Date.now() - this.scanStartTime >= SCANNER_LIMITS.maxScanDurationMs) break;

      const item = this.queue.shift();
      if (!item) break;

      if (this.visited.has(item.normalizedUrl)) continue;
      this.visited.add(item.normalizedUrl);

      if (onProgress) {
        onProgress({
          pagesAttempted: pages.length + 1,
          pagesCompleted: pages.length,
          currentUrl: item.normalizedUrl,
          queueLength: this.queue.length,
        });
      }

      try {
        const { data, bodyText } = await SafeFetcher.fetch(item.normalizedUrl, {
          accept: 'text/html,application/xhtml+xml',
          maxBytes: SCANNER_LIMITS.maxHtmlBytes,
          abortSignal,
          onRequest: (url) => {
            if (this.totalRequestsMade >= SCANNER_LIMITS.maxTotalRequests) {
              throw new ScannerException(
                'CRAWL_LIMIT',
                'The scan reached its maximum total HTTP request limit.',
                'No request budget remained for the redirect destination.',
                url
              );
            }
            this.totalRequestsMade++;
          },
        });

        this.totalBytesTransferred += data.responseBytes;

        const isHtml = data.contentType.includes('text/html') || data.contentType.includes('application/xhtml');
        const parsed = isHtml
          ? HtmlParser.parse(bodyText, data.finalUrl)
          : {
              document: {},
              headings: { h1Count: 0, items: [] },
              links: [],
              images: [],
              resources: [],
            };

        // Reserve request budget for remaining pages in the batch to reach maxPages
        const remainingPagesToScan = Math.max(0, SCANNER_LIMITS.maxPages - (pages.length + 1));
        const maxAllowedBudgetForResources = Math.max(
          this.totalRequestsMade,
          SCANNER_LIMITS.maxTotalRequests - remainingPagesToScan
        );

        // Sample resources safely with deduplication and page-reserved request budget
        const { resources: analyzedResources, requestsMade: resReqs, bytesTransferred: resBytes } =
          await ResourceAnalyzer.analyzeResources(
            parsed.resources,
            this.totalRequestsMade,
            this.resourceCache,
            maxAllowedBudgetForResources,
            abortSignal
          );
        this.totalRequestsMade += resReqs;
        this.totalBytesTransferred += resBytes;

        const canonicalFinalUrl =
          UrlValidator.resolveAndNormalizeLink(data.finalUrl, this.baseNormalizedUrl) || data.finalUrl;
        this.visited.add(canonicalFinalUrl);

        const pageResult: PageScanResult = {
          url: item.url,
          normalizedUrl: canonicalFinalUrl,
          depth: item.depth,
          discoveredFrom: item.discoveredFrom,
          http: data,
          document: parsed.document,
          headings: parsed.headings,
          links: parsed.links,
          images: parsed.images,
          resources: analyzedResources,
          totalResourcesDiscovered: parsed.resources.length,
          scanErrors: [],
        };
        const statusError = createHttpStatusScanError(
          data.statusCode,
          data.statusText,
          canonicalFinalUrl
        );
        if (statusError) pageResult.scanErrors.push(statusError);

        pages.push(pageResult);

        // Queue internal links discovered on this page for deeper crawl
        if (item.depth < SCANNER_LIMITS.maxDepth) {
          const internalLinks = parsed.links
            .filter((l) => l.isInternal)
            .map((l) => l.normalizedDestination);
          this.enqueue(internalLinks, item.depth + 1, `page-link-depth-${item.depth}`);
        } else {
          const internalLinks = parsed.links.filter((l) => l.isInternal);
          this.depthBlockedCount += internalLinks.length;
        }
      } catch (err: unknown) {
        const scanError: ScanError = sanitizeScannerError(err, item.normalizedUrl);

        // Record failed page entry so crawler does not hide failures
        pages.push({
          url: item.url,
          normalizedUrl: item.normalizedUrl,
          depth: item.depth,
          discoveredFrom: item.discoveredFrom,
          http: {
            requestedUrl: item.url,
            finalUrl: item.normalizedUrl,
            statusCode: 0,
            statusText: 'Request Failed',
            headers: {},
            securityHeaders: {},
            contentType: '',
            responseBytes: 0,
            durationMs: 0,
            timing: { startTime: 0, endTime: 0, totalMs: 0 },
            redirects: [],
          },
          document: {},
          headings: { h1Count: 0, items: [] },
          links: [],
          images: [],
          resources: [],
          totalResourcesDiscovered: 0,
          scanErrors: [scanError],
        });
      }
    }

    return {
      pages,
      requestsMade: this.totalRequestsMade,
      bytesTransferred: this.totalBytesTransferred,
      discoveredUrls: this.getDiscoveredUrls(),
      remainingUrls: this.getRemainingUrls(),
      depthBlockedUrlsCount: this.depthBlockedCount,
    };
  }
}
