/**
 * Centralized Scanner Limits (Phase 2)
 *
 * All scanner components MUST import and adhere to these centralized boundaries.
 * Arbitrary timeouts, page counts, or byte sizes must never be scattered throughout code.
 */

export interface ScannerLimits {
  /** Maximum number of internal pages to crawl during a single scan */
  maxPages: number;
  /** Maximum crawl depth from the homepage (0 = homepage only, 1 = direct links, 2 = secondary links) */
  maxDepth: number;
  /** Maximum consecutive redirects allowed per request */
  maxRedirects: number;
  /** Maximum total HTTP requests (pages + robots + sitemaps + sample resources) across entire scan */
  maxTotalRequests: number;
  /** Per-request network timeout in milliseconds */
  requestTimeoutMs: number;
  /** Maximum duration of one scan execution (each continuation batch has its own duration) */
  maxScanDurationMs: number;
  /** Maximum bytes read for any single HTTP response (e.g. 3 MB) */
  maxResponseBytes: number;
  /** Maximum bytes parsed for an HTML document (e.g. 2 MB) */
  maxHtmlBytes: number;
  /** Maximum URLs extracted from XML sitemaps */
  maxSitemapUrls: number;
  /** Allowed network ports (strictly 80 for HTTP, 443 for HTTPS) */
  allowedPorts: number[];
  /** Maximum number of sample resources to analyze per page */
  maxResourcesPerPage: number;
}

export const SCANNER_LIMITS: ScannerLimits = {
  maxPages: 50,
  maxDepth: 3,
  maxRedirects: 5,
  maxTotalRequests: 150,
  requestTimeoutMs: 8000,
  maxScanDurationMs: 60000,
  maxResponseBytes: 3 * 1024 * 1024, // 3 MB
  maxHtmlBytes: 2 * 1024 * 1024,     // 2 MB
  maxSitemapUrls: 250,
  allowedPorts: [80, 443],
  maxResourcesPerPage: 5,
};
