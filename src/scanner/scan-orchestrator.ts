/**
 * Central Scan Orchestrator (Phase 2)
 *
 * Coordinates the entire deterministic scan pipeline:
 * 1. URL Validation & Normalization
 * 2. SSRF & Port Security Guard
 * 3. DNS Safety & Rebinding Protection
 * 4. Controlled Homepage Fetch & Redirect Resolution
 * 5. Document, Headings, Links, & Resource Parsing
 * 6. Robots.txt & Sitemap Discovery
 * 7. Bounded Internal Crawling
 * 8. Safe Asset Sampling
 * 9. Assembly of Strongly Typed Raw ScanResult
 */

import crypto from 'node:crypto';
import { SCANNER_LIMITS } from './limits';
import { UrlValidator, ValidatedUrl } from './url-validator';
import { SecurityGuard } from './security-guard';
import { DnsSafetyGuard } from './dns-safety';
import { SafeFetcher } from './fetcher';
import { HtmlParser } from './parser';
import { RobotsHandler } from './robots';
import { SitemapHandler } from './sitemap';
import { ResourceAnalyzer } from './resource-analyzer';
import { BoundedCrawler } from './crawler';
import {
  ScanResult,
  PageScanResult,
  ScanProgressEvent,
  ScanError,
  ProgressStage,
} from './types';
import {
  abortErrorFromSignal,
  awaitWithAbort,
  ScannerException,
  sanitizeScannerError,
} from './errors';

export interface ScanOrchestratorOptions {
  onProgress?: (event: ScanProgressEvent) => void;
  abortSignal?: AbortSignal;
  sessionId?: string;
  batchIndex?: number;
  alreadyScannedUrls?: string[];
  seedUrls?: string[];
  allDiscoveredUrls?: string[];
}

export class ScanOrchestrator {
  /**
   * Executes a full, bounded, secure scan for a website URL.
   */
  public static async executeScan(
    rawInputUrl: string,
    options: ScanOrchestratorOptions = {}
  ): Promise<ScanResult> {
    const startedAt = new Date().toISOString();
    const startTimeMs = Date.now();
    const maxDurationMs = SCANNER_LIMITS.maxScanDurationMs;
    const executionController = new AbortController();
    let executionTimeout: ScannerException | undefined;
    const expireExecution = () => {
      if (executionTimeout) return;
      executionTimeout = new ScannerException(
        'SCAN_TIMEOUT',
        'The scan exceeded its maximum execution time.',
        `Execution exceeded ${maxDurationMs} ms`
      );
      executionController.abort(executionTimeout);
    };
    const isExecutionTimedOut = () => {
      if (!executionTimeout && Date.now() - startTimeMs >= maxDurationMs) {
        expireExecution();
      }
      return Boolean(executionTimeout);
    };
    const timeoutId = setTimeout(expireExecution, maxDurationMs);
    const callerSignal = options.abortSignal;
    const forwardCallerAbort = () => executionController.abort(callerSignal?.reason);

    if (callerSignal?.aborted) {
      forwardCallerAbort();
    } else {
      callerSignal?.addEventListener('abort', forwardCallerAbort, { once: true });
    }

    try {
      const result = await this.executeScanInternal(
        rawInputUrl,
        { ...options, abortSignal: executionController.signal },
        startedAt,
        startTimeMs,
        isExecutionTimedOut,
        () => executionTimeout
      );

      if (callerSignal?.aborted) {
        throw abortErrorFromSignal(executionController.signal);
      }

      if (isExecutionTimedOut()) {
        const timeoutError = executionTimeout!.toScanError();
        const errors = result.errors.some((error) => error.code === 'SCAN_TIMEOUT')
          ? result.errors
          : [...result.errors, timeoutError];
        return {
          ...result,
          completedAt: new Date().toISOString(),
          totalDurationMs: Date.now() - startTimeMs,
          status: result.pages.length > 0 ? 'partial' : 'failed',
          errors,
        };
      }

      if (result.status === 'failed') {
        return {
          ...result,
          totalDurationMs: Date.now() - startTimeMs,
        };
      }

      return result;
    } finally {
      clearTimeout(timeoutId);
      callerSignal?.removeEventListener('abort', forwardCallerAbort);
    }
  }

  private static async executeScanInternal(
    rawInputUrl: string,
    options: ScanOrchestratorOptions,
    startedAt: string,
    startTimeMs: number,
    isExecutionTimedOut: () => boolean,
    getExecutionTimeout: () => ScannerException | undefined
  ): Promise<ScanResult> {
    const scanId = `scan-${crypto.randomUUID()}`;
    const errors: ScanError[] = [];

    let requestsMade = 0;
    let totalBytesTransferred = 0;
    const recordRequest = (targetUrl: string) => {
      if (requestsMade >= SCANNER_LIMITS.maxTotalRequests) {
        throw new ScannerException(
          'CRAWL_LIMIT',
          'The scan reached its maximum total HTTP request limit.',
          'No request budget remained for this request.',
          targetUrl
        );
      }
      requestsMade++;
    };

    const emitProgress = (
      stage: ProgressStage,
      message: string,
      stepNumber: number,
      extra: Partial<ScanProgressEvent> = {}
    ) => {
      if (options.onProgress) {
        options.onProgress({
          stage,
          message,
          stepNumber,
          totalSteps: 7,
          timestamp: new Date().toISOString(),
          ...extra,
        });
      }
    };

    // Stage 1: Validating URL
    emitProgress('validating', 'Validating URL syntax, scheme, and format', 1);
    let validatedUrl: ValidatedUrl;
    try {
      validatedUrl = UrlValidator.validate(rawInputUrl);
    } catch (err: unknown) {
      const scanErr = sanitizeScannerError(err, rawInputUrl);
      errors.push(scanErr);
      return this.buildFailedResult(scanId, rawInputUrl, rawInputUrl, startedAt, errors);
    }

    // Stage 2: Security & DNS Resolution
    emitProgress(
      'connecting',
      `Checking security boundaries and verifying DNS for ${validatedUrl.hostname}`,
      2,
      { currentUrl: validatedUrl.normalizedUrl }
    );
    try {
      SecurityGuard.validateHostAndPort(validatedUrl.hostname, validatedUrl.port);
      if (isExecutionTimedOut()) throw getExecutionTimeout();
      await awaitWithAbort(
        () => DnsSafetyGuard.resolveAndVerify(validatedUrl.hostname),
        options.abortSignal,
        validatedUrl.normalizedUrl
      );
      if (isExecutionTimedOut()) throw getExecutionTimeout();
    } catch (err: unknown) {
      const scanErr = getExecutionTimeout()?.toScanError() ||
        sanitizeScannerError(err, validatedUrl.normalizedUrl);
      errors.push(scanErr);
      return this.buildFailedResult(
        scanId,
        rawInputUrl,
        validatedUrl.normalizedUrl,
        startedAt,
        errors,
        requestsMade,
        totalBytesTransferred
      );
    }

    const isContinuationBatch = Boolean(
      (options.batchIndex && options.batchIndex > 1) ||
      (options.alreadyScannedUrls && options.alreadyScannedUrls.length > 0)
    );

    const resourceCache = new Map<string, import('./types').ResourceReference>();
    let targetCanonicalUrl = validatedUrl.normalizedUrl;
    let robotsResult: import('./types').RobotsResult | undefined;
    let sitemapsResult: import('./types').SitemapResult[] = [];
    const pages: PageScanResult[] = [];

    if (!isContinuationBatch) {
      // Stage 3: Fetching Homepage
      emitProgress(
        'fetching_homepage',
        `Connecting to target server and retrieving homepage`,
        3,
        { currentUrl: validatedUrl.normalizedUrl }
      );
      let homepageFetch;
      try {
        if (isExecutionTimedOut()) throw getExecutionTimeout();
        homepageFetch = await SafeFetcher.fetch(validatedUrl.normalizedUrl, {
          accept: 'text/html,application/xhtml+xml',
          maxBytes: SCANNER_LIMITS.maxHtmlBytes,
          abortSignal: options.abortSignal,
          onRequest: recordRequest,
        });
        if (isExecutionTimedOut()) throw getExecutionTimeout();
        totalBytesTransferred += homepageFetch.data.responseBytes;
      } catch (err: unknown) {
        const scanErr = getExecutionTimeout()?.toScanError() ||
          sanitizeScannerError(err, validatedUrl.normalizedUrl);
        errors.push(scanErr);
        return this.buildFailedResult(
          scanId,
          rawInputUrl,
          validatedUrl.normalizedUrl,
          startedAt,
          errors,
          requestsMade,
          totalBytesTransferred
        );
      }

      const homepageData = homepageFetch.data;
      targetCanonicalUrl = homepageData.finalUrl;
      const homepageHtml = homepageFetch.bodyText;

      // Parse Homepage
      const isHtml =
        homepageData.contentType.includes('text/html') ||
        homepageData.contentType.includes('application/xhtml');

      const homepageParsed = isHtml
        ? HtmlParser.parse(homepageHtml, homepageData.finalUrl)
        : {
            document: {},
            headings: { h1Count: 0, items: [] },
            links: [],
            images: [],
            resources: [],
          };

      // Analyze initial homepage resources
      const { resources: analyzedHomeResources, requestsMade: homeResReqs, bytesTransferred: homeResBytes } =
        await ResourceAnalyzer.analyzeResources(
          homepageParsed.resources,
          requestsMade,
          resourceCache,
          SCANNER_LIMITS.maxTotalRequests - SCANNER_LIMITS.maxPages,
          options.abortSignal
        );
      isExecutionTimedOut();
      requestsMade += homeResReqs;
      totalBytesTransferred += homeResBytes;

      const homepagePageResult: PageScanResult = {
        url: validatedUrl.normalizedUrl,
        normalizedUrl: homepageData.finalUrl,
        depth: 0,
        discoveredFrom: ['user-input'],
        http: homepageData,
        document: homepageParsed.document,
        headings: homepageParsed.headings,
        links: homepageParsed.links,
        images: homepageParsed.images,
        resources: analyzedHomeResources,
        totalResourcesDiscovered: homepageParsed.resources.length,
        scanErrors: [],
      };

      pages.push(homepagePageResult);

      // Stage 4: Discovering Robots & Sitemaps
      emitProgress(
        'discovering_pages',
        'Discovering robots.txt rules and XML sitemaps',
        4,
        {
          pagesDiscovered: homepageParsed.links.filter((l) => l.isInternal).length + 1,
          pagesCrawled: 1,
        }
      );

      try {
        if (!options.abortSignal?.aborted) {
          robotsResult = await RobotsHandler.fetchRobots(
            homepageData.finalUrl,
            options.abortSignal,
            recordRequest
          );
          totalBytesTransferred += robotsResult.responseBytes ?? robotsResult.contentLength ?? 0;

          // Discover sitemaps
          sitemapsResult = await SitemapHandler.discoverSitemaps(
            homepageData.finalUrl,
            robotsResult.sitemapDeclarations,
            options.abortSignal,
            recordRequest
          );
          for (const s of sitemapsResult) {
            totalBytesTransferred += s.responseBytes || 0;
          }
        }
      } catch (err: unknown) {
        // Non-fatal error; record and continue
        errors.push(sanitizeScannerError(err, homepageData.finalUrl));
      }

      // Stage 5: Crawling Pages
      emitProgress(
        'crawling_pages',
        'Crawling internal linked pages within depth limits',
        5,
        {
          pagesDiscovered: homepageParsed.links.filter((l) => l.isInternal).length + 1,
          pagesCrawled: 1,
        }
      );

      const crawler = new BoundedCrawler(homepageData.finalUrl, resourceCache);

      // If pre-scanned URLs are passed from an earlier batch, mark them so they aren't re-crawled
      if (options.alreadyScannedUrls && options.alreadyScannedUrls.length > 0) {
        crawler.markAlreadyScanned(options.alreadyScannedUrls);
      }

      // If previously discovered URLs are provided, register them into inventory
      if (options.allDiscoveredUrls && options.allDiscoveredUrls.length > 0) {
        crawler.trackDiscovered(options.allDiscoveredUrls);
      }

      // If seed URLs are provided for this batch, enqueue them first
      if (options.seedUrls && options.seedUrls.length > 0) {
        crawler.enqueue(options.seedUrls, 1, 'batch-seed');
      }

      // Enqueue internal links from homepage
      const internalHomepageLinks = homepageParsed.links
        .filter((l) => l.isInternal)
        .map((l) => l.normalizedDestination);
      crawler.enqueue(internalHomepageLinks, 1, 'homepage-link');

      // Also enqueue URLs discovered from sitemaps (excluding sitemap indexes)
      for (const sitemap of sitemapsResult) {
        if (sitemap.isIndex) continue;
        const sitemapUrls = sitemap.containedUrls.slice(0, SCANNER_LIMITS.maxSitemapUrls);
        crawler.enqueue(sitemapUrls, 1, 'sitemap');
      }

      const {
        pages: crawledPages,
        requestsMade: crawlReqs,
        bytesTransferred: crawlBytes,
        discoveredUrls: allDiscoveredUrls,
        remainingUrls: allRemainingUrls,
        depthBlockedUrlsCount,
      } = await crawler.crawl(
        pages,
        requestsMade,
        (crawlProgress) => {
          emitProgress(
            'crawling_pages',
            `Crawling internal pages (${crawlProgress.pagesCompleted}/${SCANNER_LIMITS.maxPages})`,
            5,
            {
              pagesDiscovered: crawlProgress.pagesAttempted + crawlProgress.queueLength,
              pagesCrawled: crawlProgress.pagesCompleted,
              currentUrl: crawlProgress.currentUrl,
            }
          );
        },
        options.abortSignal,
        startTimeMs
      );

      requestsMade = crawlReqs;
      totalBytesTransferred += crawlBytes;
      errors.push(...crawledPages.flatMap((page) => page.scanErrors));

      // Stage 6: Analyzing Resources
      emitProgress('analyzing_resources', 'Aggregating resource facts and response timings', 6, {
        pagesCrawled: crawledPages.length,
      });

      // Stage 7: Preparing Raw Results
      emitProgress('preparing_results', 'Finalizing raw scan telemetry and facts', 7, {
        pagesCrawled: crawledPages.length,
      });

      const endTimeMs = Date.now();
      const totalDurationMs = endTimeMs - startTimeMs;

      // Count links
      let totalInternalLinks = 0;
      let totalExternalLinks = 0;
      for (const p of crawledPages) {
        for (const l of p.links) {
          if (l.isInternal) totalInternalLinks++;
          else totalExternalLinks++;
        }
      }

      const scanStatus =
        errors.length > 0 && crawledPages.length === 0
          ? 'failed'
          : errors.length > 0
          ? 'partial'
          : 'completed';

      const canonicalize = (u: string) =>
        UrlValidator.resolveAndNormalizeLink(u, targetCanonicalUrl) || u;
      const cumulativeScannedUrls = Array.from(
        new Set([
          ...(options.alreadyScannedUrls || []).map(canonicalize),
          ...crawledPages.map((p) => canonicalize(p.normalizedUrl)),
        ])
      );

      return {
        scanId,
        inputUrl: rawInputUrl,
        normalizedUrl: targetCanonicalUrl,
        startedAt,
        completedAt: new Date().toISOString(),
        totalDurationMs,
        status: scanStatus,
        summary: {
          pagesAttempted: crawledPages.length,
          pagesCompleted: crawledPages.filter((p) => p.http.statusCode >= 200 && p.http.statusCode < 400).length,
          requestsMade,
          totalBytesTransferred,
          internalLinksDiscovered: totalInternalLinks,
          externalLinksDiscovered: totalExternalLinks,
        },
        pages: crawledPages,
        robots: robotsResult,
        sitemaps: sitemapsResult,
        errors,
        limits: SCANNER_LIMITS,
        sessionId: options.sessionId || scanId,
        batchIndex: options.batchIndex || 1,
        discoveredUrls: allDiscoveredUrls,
        alreadyScannedUrls: cumulativeScannedUrls,
        remainingUrls: allRemainingUrls,
        depthBlockedUrlsCount,
      };
    } else {
      // Continuation Batch: Skip redundant homepage and sitemap fetching
      emitProgress(
        'crawling_pages',
        `Resuming audit batch ${options.batchIndex || 2} for remaining pages`,
        3,
        { currentUrl: targetCanonicalUrl }
      );

      const crawler = new BoundedCrawler(targetCanonicalUrl, resourceCache);

      // Pre-mark all previously analyzed pages as visited so they are never rescanned
      if (options.alreadyScannedUrls && options.alreadyScannedUrls.length > 0) {
        crawler.markAlreadyScanned(options.alreadyScannedUrls);
      }

      // Register all existing discovered inventory
      if (options.allDiscoveredUrls && options.allDiscoveredUrls.length > 0) {
        crawler.trackDiscovered(options.allDiscoveredUrls);
      }

      // Priority: Enqueue the seed URLs for this specific continuation batch FIRST
      if (options.seedUrls && options.seedUrls.length > 0) {
        crawler.enqueue(options.seedUrls, 1, 'batch-seed');
      }

      const {
        pages: crawledPages,
        requestsMade: crawlReqs,
        bytesTransferred: crawlBytes,
        discoveredUrls: allDiscoveredUrls,
        remainingUrls: allRemainingUrls,
        depthBlockedUrlsCount,
      } = await crawler.crawl(
        pages,
        requestsMade,
        (crawlProgress) => {
          emitProgress(
            'crawling_pages',
            `Crawling batch ${options.batchIndex || 2} pages (${crawlProgress.pagesCompleted}/${SCANNER_LIMITS.maxPages})`,
            5,
            {
              pagesDiscovered: crawlProgress.pagesAttempted + crawlProgress.queueLength,
              pagesCrawled: crawlProgress.pagesCompleted,
              currentUrl: crawlProgress.currentUrl,
            }
          );
        },
        options.abortSignal,
        startTimeMs
      );

      requestsMade = crawlReqs;
      totalBytesTransferred += crawlBytes;
      errors.push(...crawledPages.flatMap((page) => page.scanErrors));

      emitProgress('analyzing_resources', 'Aggregating resource facts and response timings', 6, {
        pagesCrawled: crawledPages.length,
      });
      emitProgress('preparing_results', 'Finalizing raw scan telemetry and facts', 7, {
        pagesCrawled: crawledPages.length,
      });

      const endTimeMs = Date.now();
      const totalDurationMs = endTimeMs - startTimeMs;

      let totalInternalLinks = 0;
      let totalExternalLinks = 0;
      for (const p of crawledPages) {
        for (const l of p.links) {
          if (l.isInternal) totalInternalLinks++;
          else totalExternalLinks++;
        }
      }

      const scanStatus =
        errors.length > 0 && crawledPages.length === 0
          ? 'failed'
          : errors.length > 0
          ? 'partial'
          : 'completed';

      const canonicalize = (u: string) =>
        UrlValidator.resolveAndNormalizeLink(u, targetCanonicalUrl) || u;
      const cumulativeScannedUrls = Array.from(
        new Set([
          ...(options.alreadyScannedUrls || []).map(canonicalize),
          ...crawledPages.map((p) => canonicalize(p.normalizedUrl)),
        ])
      );

      return {
        scanId,
        inputUrl: rawInputUrl,
        normalizedUrl: targetCanonicalUrl,
        startedAt,
        completedAt: new Date().toISOString(),
        totalDurationMs,
        status: scanStatus,
        summary: {
          pagesAttempted: crawledPages.length,
          pagesCompleted: crawledPages.filter((p) => p.http.statusCode >= 200 && p.http.statusCode < 400).length,
          requestsMade,
          totalBytesTransferred,
          internalLinksDiscovered: totalInternalLinks,
          externalLinksDiscovered: totalExternalLinks,
        },
        pages: crawledPages,
        robots: undefined,
        sitemaps: [],
        errors,
        limits: SCANNER_LIMITS,
        sessionId: options.sessionId || scanId,
        batchIndex: options.batchIndex || 2,
        discoveredUrls: allDiscoveredUrls,
        alreadyScannedUrls: cumulativeScannedUrls,
        remainingUrls: allRemainingUrls,
        depthBlockedUrlsCount,
      };
    }
  }

  private static buildFailedResult(
    scanId: string,
    inputUrl: string,
    normalizedUrl: string,
    startedAt: string,
    errors: ScanError[],
    requestsMade = 0,
    totalBytesTransferred = 0
  ): ScanResult {
    return {
      scanId,
      inputUrl,
      normalizedUrl,
      startedAt,
      completedAt: new Date().toISOString(),
      totalDurationMs: 0,
      status: 'failed',
      summary: {
        pagesAttempted: 0,
        pagesCompleted: 0,
        requestsMade,
        totalBytesTransferred,
        internalLinksDiscovered: 0,
        externalLinksDiscovered: 0,
      },
      pages: [],
      sitemaps: [],
      errors,
      limits: SCANNER_LIMITS,
    };
  }
}
