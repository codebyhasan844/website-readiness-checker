/**
 * Performance Signals Audit Checks (Category E)
 */

import { ScanResult } from '../../scanner/types';
import { AuditCheck, AuditFinding } from '../types';
import { createFinding } from '../utils';

export const performanceChecks: AuditCheck[] = [
  // 1. Initial HTML response time
  {
    id: 'perf-html-response-time',
    name: 'Initial HTML Server Response Time',
    category: 'performance',
    description: 'Evaluates the Time to First Byte (TTFB) / HTML download latency.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const home = scan.pages[0];
      if (!home) return [];

      const durationMs = home.http.timing?.totalMs || home.http.durationMs || 0;

      if (durationMs > 2500) {
        return [
          createFinding({
            checkId: 'perf-html-response-time',
            category: 'performance',
            severity: 'important',
            evidence: {
              summary: `Homepage HTML response took ${durationMs}ms (threshold: < 1000ms).`,
              details: `Initial connection and transfer exceeded recommended performance boundaries.`,
              urls: [home.url],
              affectedCount: 1,
              technicalData: { durationMs },
            },
          }),
        ];
      }

      if (durationMs > 1200) {
        return [
          createFinding({
            checkId: 'perf-html-response-time',
            category: 'performance',
            severity: 'improvement',
            evidence: {
              summary: `Homepage HTML response took ${durationMs}ms (moderately slow).`,
              urls: [home.url],
              affectedCount: 1,
              technicalData: { durationMs },
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'perf-html-response-time',
          category: 'performance',
          severity: 'passed',
          evidence: {
            summary: `Homepage responded quickly in ${durationMs}ms.`,
            urls: [home.url],
            affectedCount: 0,
            technicalData: { durationMs },
          },
        }),
      ];
    },
  },

  // 2. HTML document payload size
  {
    id: 'perf-html-payload-size',
    name: 'HTML Document Payload Size',
    category: 'performance',
    description: 'Evaluates the raw uncompressed byte weight of the HTML document.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const largePages = scan.pages.filter((p) => p.http.responseBytes > 250 * 1024);

      if (largePages.length > 0) {
        return [
          createFinding({
            checkId: 'perf-html-payload-size',
            category: 'performance',
            severity: 'improvement',
            evidence: {
              summary: `${largePages.length} page(s) have an HTML payload exceeding 250 KB.`,
              details: `Largest: ${largePages[0].url} (${Math.round(largePages[0].http.responseBytes / 1024)} KB)`,
              urls: largePages.map((p) => p.url),
              affectedCount: largePages.length,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'perf-html-payload-size',
          category: 'performance',
          severity: 'passed',
          evidence: {
            summary: 'HTML document payload sizes remain lean (< 250 KB).',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 3. Total scanned page weight
  {
    id: 'perf-total-page-weight',
    name: 'Total Scanned Page Weight',
    category: 'performance',
    description: 'Sums the weight of HTML document and sampled static resources.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const heavyPages: { url: string; totalBytes: number }[] = [];

      for (const p of scan.pages) {
        let total = p.http.responseBytes;
        for (const res of p.resources) {
          if (res.sizeBytes) total += res.sizeBytes;
        }
        if (total > 3 * 1024 * 1024) {
          // > 3 MB
          heavyPages.push({ url: p.url, totalBytes: total });
        }
      }

      if (heavyPages.length > 0) {
        return [
          createFinding({
            checkId: 'perf-total-page-weight',
            category: 'performance',
            severity: 'important',
            evidence: {
              summary: `${heavyPages.length} page(s) exceed 3 MB in known resource weight.`,
              details: `Heaviest: ${heavyPages[0].url} (${(heavyPages[0].totalBytes / (1024 * 1024)).toFixed(1)} MB)`,
              urls: heavyPages.map((h) => h.url),
              affectedCount: heavyPages.length,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'perf-total-page-weight',
          category: 'performance',
          severity: 'passed',
          evidence: {
            summary: 'Overall page asset weight stays within healthy bandwidth limits (< 3 MB).',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 4. High resource request count
  {
    id: 'perf-excessive-resources',
    name: 'High Resource Request Count',
    category: 'performance',
    description: 'Counts the number of external stylesheets, scripts, and font requests.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const highRequestPages = scan.pages.filter(
        (p) => (p.totalResourcesDiscovered ?? p.resources.length) > 60
      );

      if (highRequestPages.length > 0) {
        return [
          createFinding({
            checkId: 'perf-excessive-resources',
            category: 'performance',
            severity: 'improvement',
            evidence: {
              summary: `${highRequestPages.length} page(s) initiate more than 60 separate resource requests.`,
              details: `Highest: ${highRequestPages[0].url} (${highRequestPages[0].totalResourcesDiscovered ?? highRequestPages[0].resources.length} resources)`,
              urls: highRequestPages.map((h) => h.url),
              affectedCount: highRequestPages.length,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'perf-excessive-resources',
          category: 'performance',
          severity: 'passed',
          evidence: {
            summary: 'Resource request counts are well-contained (< 60 requests per page).',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 5. Large JavaScript bundles
  {
    id: 'perf-large-javascript',
    name: 'Large JavaScript Bundles',
    category: 'performance',
    description: 'Identifies individual JavaScript assets exceeding 500 KB.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const largeScripts: { pageUrl: string; scriptUrl: string; sizeBytes: number }[] = [];

      for (const p of scan.pages) {
        for (const res of p.resources) {
          if (!res.isSkipped && res.type === 'javascript' && res.sizeBytes && res.sizeBytes > 500 * 1024) {
            largeScripts.push({ pageUrl: p.url, scriptUrl: res.url, sizeBytes: res.sizeBytes });
          }
        }
      }

      if (largeScripts.length > 0) {
        return [
          createFinding({
            checkId: 'perf-large-javascript',
            category: 'performance',
            severity: 'improvement',
            evidence: {
              summary: `Found ${largeScripts.length} JavaScript asset(s) exceeding 500 KB.`,
              details: `Largest: ${largeScripts[0].scriptUrl} (${Math.round(largeScripts[0].sizeBytes / 1024)} KB)`,
              urls: largeScripts.map((s) => s.pageUrl),
              affectedCount: largeScripts.length,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'perf-large-javascript',
          category: 'performance',
          severity: 'passed',
          evidence: {
            summary: 'All sampled JavaScript files remain below 500 KB.',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 6. HTTP response compression
  {
    id: 'perf-compression-missing',
    name: 'HTTP Response Compression',
    category: 'performance',
    description: 'Checks whether text-based responses are served with modern compression.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const home = scan.pages[0];
      if (!home) return [];

      const isCompressible =
        home.http.contentType.includes('text/') ||
        home.http.contentType.includes('application/javascript') ||
        home.http.contentType.includes('application/json') ||
        home.http.contentType.includes('application/xml') ||
        home.http.contentType.includes('image/svg');

      if (!isCompressible || home.http.responseBytes <= 1024) {
        return [
          createFinding({
            checkId: 'perf-compression-missing',
            category: 'performance',
            severity: 'passed',
            evidence: {
              summary: 'Payload is under 1KB or non-compressible; HTTP compression is not required.',
              urls: [home.url],
              affectedCount: 0,
            },
          }),
        ];
      }

      const encoding = (home.http.securityHeaders.contentEncoding || '').toLowerCase();
      const hasCompression = encoding.includes('gzip') || encoding.includes('br') || encoding.includes('deflate');

      if (!hasCompression) {
        return [
          createFinding({
            checkId: 'perf-compression-missing',
            category: 'performance',
            severity: 'improvement',
            evidence: {
              summary: 'Homepage HTML was not served with gzip or brotli compression headers.',
              details: `Content-Encoding: ${home.http.securityHeaders.contentEncoding || 'none declared'}`,
              urls: [home.url],
              affectedCount: 1,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'perf-compression-missing',
          category: 'performance',
          severity: 'passed',
          evidence: {
            summary: `HTTP compression enabled (${encoding}).`,
            urls: [home.url],
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 7. Static asset cache headers
  {
    id: 'perf-cache-control',
    name: 'Static Asset Cache Headers',
    category: 'performance',
    description: 'Checks whether static resources include effective Cache-Control headers.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const sampledStaticAssets: { pageUrl: string; assetUrl: string; cacheControl?: string }[] = [];
      const missingCache: { pageUrl: string; assetUrl: string }[] = [];

      for (const p of scan.pages) {
        for (const res of p.resources) {
          if (!res.isSkipped && ['css', 'javascript', 'font'].includes(res.type) && res.statusCode === 200) {
            sampledStaticAssets.push({ pageUrl: p.url, assetUrl: res.url, cacheControl: res.cacheControl });
            const cc = (res.cacheControl || '').toLowerCase();
            if (!cc || cc.includes('no-store') || cc.includes('max-age=0')) {
              missingCache.push({ pageUrl: p.url, assetUrl: res.url });
            }
          }
        }
      }

      if (missingCache.length > 0) {
        return [
          createFinding({
            checkId: 'perf-cache-control',
            category: 'performance',
            severity: 'improvement',
            evidence: {
              summary: `${missingCache.length} sampled static asset(s) lack effective browser caching policies.`,
              details: `Example: ${missingCache[0].assetUrl} (on ${missingCache[0].pageUrl})`,
              urls: Array.from(new Set(missingCache.map((m) => m.pageUrl))),
              affectedCount: missingCache.length,
              resources: missingCache.map((m) => ({
                resourceUrl: m.assetUrl,
                referencedFrom: m.pageUrl,
                statusText: 'Missing or zero max-age Cache-Control',
              })),
            },
          }),
        ];
      }

      if (sampledStaticAssets.length > 0) {
        return [
          createFinding({
            checkId: 'perf-cache-control',
            category: 'performance',
            severity: 'passed',
            evidence: {
              summary: `All ${sampledStaticAssets.length} sampled static assets specify effective Cache-Control directives.`,
              affectedCount: 0,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'perf-cache-control',
          category: 'performance',
          severity: 'passed',
          evidence: {
            summary: 'No static assets lacking Cache-Control headers detected.',
            affectedCount: 0,
          },
        }),
      ];
    },
  },
];
