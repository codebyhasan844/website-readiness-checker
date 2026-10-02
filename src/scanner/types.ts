/**
 * Raw Scan Data Models (Phase 2 - Secure Scanner Engine)
 *
 * Strictly captures observable facts, measurements, and headers.
 * NEVER makes audit judgments, severity assignments, or quality scores.
 */

import type { ScannerLimits } from './limits';
import type { ScanError } from './errors';

export type { ScannerLimits, ScanError };

export type ScanStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'partial'
  | 'failed';

export type ProgressStage =
  | 'validating'
  | 'connecting'
  | 'fetching_homepage'
  | 'discovering_pages'
  | 'crawling_pages'
  | 'analyzing_resources'
  | 'preparing_results';

export interface ScanProgressEvent {
  stage: ProgressStage;
  message: string;
  stepNumber: number;
  totalSteps: number;
  pagesDiscovered?: number;
  pagesCrawled?: number;
  currentUrl?: string;
  timestamp: string;
}

export interface SecurityHeadersData {
  strictTransportSecurity?: string;
  contentSecurityPolicy?: string;
  xContentTypeOptions?: string;
  xFrameOptions?: string;
  referrerPolicy?: string;
  permissionsPolicy?: string;
  xRobotsTag?: string;
  cacheControl?: string;
  contentEncoding?: string;
  contentType?: string;
  server?: string;
}

export interface RawRedirectHop {
  requestedUrl: string;
  destinationUrl: string;
  statusCode: number;
  headers?: Record<string, string>;
}

export interface HTTPResponseData {
  requestedUrl: string;
  finalUrl: string;
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  securityHeaders: SecurityHeadersData;
  contentType: string;
  contentLength?: number;
  responseBytes: number;
  durationMs: number;
  timing: {
    startTime: number;
    endTime: number;
    dnsLookupMs?: number;
    tcpHandshakeMs?: number;
    tlsHandshakeMs?: number;
    firstByteMs?: number;
    totalMs: number;
  };
  redirects: RawRedirectHop[];
}

export interface HeadingItem {
  level: number; // 1 to 6
  text: string;
}

export interface HeadingsData {
  h1Count: number;
  items: HeadingItem[];
}

export interface LinkResult {
  sourceUrl: string;
  destinationUrl: string;
  normalizedDestination: string;
  anchorText: string;
  isInternal: boolean;
  rel?: string;
  target?: string;
}

export interface ImageResult {
  sourceUrl: string;
  src: string;
  hasAlt: boolean;
  altText: string;
  width?: string;
  height?: string;
  loading?: string;
  imageType?: string;
}

export interface ResourceReference {
  type: 'css' | 'javascript' | 'font' | 'image' | 'iframe';
  url: string;
  isInternal: boolean;
  statusCode?: number;
  contentType?: string;
  sizeBytes?: number;
  durationMs?: number;
  error?: string;
  cacheControl?: string;
  isSkipped?: boolean;
  skippedReason?: string;
}

export interface PageDocumentData {
  title?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  robotsMeta?: string;
  language?: string;
  charset?: string;
  viewport?: string;
  openGraph?: Record<string, string>;
  twitterCard?: Record<string, string>;
  hasFavicon?: boolean;
  hasStructuredData?: boolean;
  duplicateIds?: string[];
  unlabeledFormControls?: number;
  iframesWithoutTitle?: number;
  emptyLinksCount?: number;
}

export interface PageScanResult {
  url: string;
  normalizedUrl: string;
  depth: number;
  discoveredFrom: string[]; // e.g. ["homepage-link", "sitemap", "internal-link"]
  http: HTTPResponseData;
  document: PageDocumentData;
  headings: HeadingsData;
  links: LinkResult[];
  images: ImageResult[];
  resources: ResourceReference[];
  totalResourcesDiscovered?: number;
  scanErrors: ScanError[];
}

export interface RobotsDirectiveGroup {
  userAgent: string;
  allows: string[];
  disallows: string[];
}

export interface RobotsResult {
  url: string;
  exists: boolean;
  statusCode?: number;
  contentType?: string;
  contentLength?: number;
  responseBytes?: number;
  rawText?: string;
  directives: RobotsDirectiveGroup[];
  sitemapDeclarations: string[];
  error?: string;
}

export interface SitemapResult {
  url: string;
  discoveredFrom: 'robots.txt' | 'standard_path' | 'sitemap_index';
  exists: boolean;
  statusCode?: number;
  contentType?: string;
  responseBytes?: number;
  isIndex: boolean;
  containedUrls: string[];
  error?: string;
}

export interface ScanResult {
  scanId: string;
  inputUrl: string;
  normalizedUrl: string;
  startedAt: string;
  completedAt?: string;
  totalDurationMs?: number;
  status: ScanStatus;
  summary: {
    pagesAttempted: number;
    pagesCompleted: number;
    requestsMade: number;
    totalBytesTransferred: number;
    internalLinksDiscovered: number;
    externalLinksDiscovered: number;
  };
  pages: PageScanResult[];
  robots?: RobotsResult;
  sitemaps: SitemapResult[];
  errors: ScanError[];
  limits: ScannerLimits;
  sessionId?: string;
  batchIndex?: number;
  discoveredUrls?: string[];
  alreadyScannedUrls?: string[];
  remainingUrls?: string[];
  depthBlockedUrlsCount?: number;
}
