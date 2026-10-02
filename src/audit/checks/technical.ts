/**
 * Technical / Launch Audit Checks (Category A)
 */

import { ScanResult } from '../../scanner/types';
import { AuditCheck, AuditFinding } from '../types';
import { createFinding } from '../utils';

export const technicalChecks: AuditCheck[] = [
  // 1. Website reachable
  {
    id: 'tech-website-reachable',
    name: 'Website Reachability',
    category: 'technical',
    description: 'Verifies whether the target domain responds without DNS or fatal connection failure.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      if (scan.pages.length === 0 || scan.status === 'failed') {
        const errorMsg = scan.errors.map((e) => e.message).join('; ') || 'Server failed to connect';
        return [
          createFinding({
            checkId: 'tech-website-reachable',
            category: 'technical',
            severity: 'critical',
            evidence: {
              summary: 'Target website server was completely unreachable during scan.',
              details: `Error encountered: ${errorMsg}`,
              urls: [scan.inputUrl],
              affectedCount: 1,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'tech-website-reachable',
          category: 'technical',
          severity: 'passed',
          evidence: {
            summary: `Website successfully reached at ${scan.normalizedUrl}.`,
            urls: [scan.normalizedUrl],
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 2. Homepage HTTP status
  {
    id: 'tech-homepage-status',
    name: 'Homepage HTTP Status Code',
    category: 'technical',
    description: 'Ensures the root homepage returns an HTTP 200 OK status.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const home = scan.pages[0];
      if (!home) return [];

      const status = home.http.statusCode;
      if (status === 200) {
        return [
          createFinding({
            checkId: 'tech-homepage-status',
            category: 'technical',
            severity: 'passed',
            evidence: {
              summary: `Homepage returned successful HTTP 200 OK.`,
              urls: [home.url],
              affectedCount: 0,
              technicalData: { statusCode: status },
            },
          }),
        ];
      }

      const severity = status >= 500 ? 'critical' : 'important';
      return [
        createFinding({
          checkId: 'tech-homepage-status',
          category: 'technical',
          severity,
          evidence: {
            summary: `Homepage returned unexpected status code: ${status} ${home.http.statusText}.`,
            details: `Expected HTTP 200 OK, but received HTTP ${status}.`,
            urls: [home.url],
            affectedCount: 1,
            technicalData: { statusCode: status, statusText: home.http.statusText },
          },
        }),
      ];
    },
  },

  // 3. HTTPS available
  {
    id: 'tech-https-available',
    name: 'HTTPS Encryption Protocol',
    category: 'technical',
    description: 'Ensures the website serves traffic over secure HTTPS protocol.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const home = scan.pages[0];
      if (!home) return [];

      const isHttps = home.http.finalUrl.startsWith('https://');
      if (isHttps) {
        return [
          createFinding({
            checkId: 'tech-https-available',
            category: 'technical',
            severity: 'passed',
            evidence: {
              summary: `Website is served securely over HTTPS protocol (${home.http.finalUrl}).`,
              urls: [home.http.finalUrl],
              affectedCount: 0,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'tech-https-available',
          category: 'technical',
          severity: 'critical',
          evidence: {
            summary: 'Website is served over unencrypted HTTP protocol.',
            details: `Final loaded URL: ${home.http.finalUrl}`,
            urls: [home.http.finalUrl],
            affectedCount: 1,
          },
        }),
      ];
    },
  },

  // 4. HTTP to HTTPS redirect
  {
    id: 'tech-http-to-https-redirect',
    name: 'HTTP to HTTPS Redirection',
    category: 'technical',
    description: 'Ensures incoming HTTP traffic redirects automatically to HTTPS.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const home = scan.pages[0];
      if (!home) {
        return [
          createFinding({
            checkId: 'tech-http-to-https-redirect',
            category: 'technical',
            severity: 'improvement',
            evidence: {
              summary: 'HTTP to HTTPS redirect could not be evaluated (no pages loaded).',
              urls: [scan.inputUrl],
              affectedCount: 0,
            },
          }),
        ];
      }

      const inputWasHttp = scan.inputUrl.startsWith('http://');
      const finalIsHttps = home.http?.finalUrl?.startsWith('https://') ?? false;

      if (inputWasHttp && finalIsHttps) {
        const hasRedirect = home.http?.redirects?.some(
          (r) => r.requestedUrl.startsWith('http://') && r.destinationUrl.startsWith('https://')
        ) ?? false;
        return [
          createFinding({
            checkId: 'tech-http-to-https-redirect',
            category: 'technical',
            severity: 'passed',
            evidence: {
              summary: `HTTP requests automatically redirect to secure HTTPS (${hasRedirect ? 'verified via redirect hop' : 'confirmed'}).`,
              urls: [scan.inputUrl, home.http.finalUrl],
              affectedCount: 0,
            },
          }),
        ];
      }

      if (inputWasHttp && !finalIsHttps) {
        return [
          createFinding({
            checkId: 'tech-http-to-https-redirect',
            category: 'technical',
            severity: 'important',
            evidence: {
              summary: 'Insecure HTTP requests do not redirect to HTTPS.',
              details: `Requested ${scan.inputUrl}, but stayed on unencrypted ${home.http.finalUrl}`,
              urls: [scan.inputUrl],
              affectedCount: 1,
            },
          }),
        ];
      }

      // If the scan was initiated directly via HTTPS, the scanner did not probe HTTP port 80.
      // Do NOT claim a verified redirect; report unverified without false PASS.
      return [
        createFinding({
          checkId: 'tech-http-to-https-redirect',
          category: 'technical',
          severity: 'improvement',
          evidence: {
            summary: 'HTTP to HTTPS redirect was not verified (scan was performed directly against HTTPS endpoint).',
            details: 'The scanner connected directly to the HTTPS URL without testing port 80. Ensure all HTTP (port 80) traffic redirects to HTTPS (port 443).',
            urls: [scan.inputUrl],
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 5. Homepage blocked by robots
  {
    id: 'tech-homepage-robots-block',
    name: 'Homepage Blocked by Robots.txt',
    category: 'technical',
    description: 'Ensures robots.txt does not block crawlers from indexing the homepage.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      if (!scan.robots || !scan.robots.exists) {
        return [
          createFinding({
            checkId: 'tech-homepage-robots-block',
            category: 'technical',
            severity: 'passed',
            evidence: {
              summary: 'No blocking robots.txt directives detected for homepage.',
              affectedCount: 0,
            },
          }),
        ];
      }

      const allAgentsDisallowRoot = scan.robots.directives.some((group) => {
        const isTargetAgent = group.userAgent === '*' || group.userAgent.toLowerCase().includes('googlebot');
        return isTargetAgent && group.disallows.some((d) => d === '/' || d === '/*');
      });

      if (allAgentsDisallowRoot) {
        return [
          createFinding({
            checkId: 'tech-homepage-robots-block',
            category: 'technical',
            severity: 'critical',
            evidence: {
              summary: 'Robots.txt contains "Disallow: /", blocking crawlers from indexing the entire website.',
              details: 'Directives in robots.txt prevent search engines from accessing any content.',
              urls: [scan.robots.url],
              affectedCount: 1,
              technicalData: { directives: scan.robots.directives },
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'tech-homepage-robots-block',
          category: 'technical',
          severity: 'passed',
          evidence: {
            summary: 'Robots.txt allows search engine crawlers to access the homepage.',
            urls: [scan.robots.url],
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 6. Homepage noindex
  {
    id: 'tech-homepage-noindex',
    name: 'Homepage Meta Robots Noindex',
    category: 'technical',
    description: 'Ensures the homepage does not declare a meta robots noindex tag.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const home = scan.pages[0];
      if (!home) return [];

      const robotsMeta = (home.document.robotsMeta || '').toLowerCase();
      if (robotsMeta.includes('noindex')) {
        return [
          createFinding({
            checkId: 'tech-homepage-noindex',
            category: 'technical',
            severity: 'critical',
            evidence: {
              summary: 'Homepage contains a <meta name="robots" content="noindex"> tag.',
              details: `Declared tag: <meta name="robots" content="${home.document.robotsMeta}">`,
              urls: [home.url],
              affectedCount: 1,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'tech-homepage-noindex',
          category: 'technical',
          severity: 'passed',
          evidence: {
            summary: 'Homepage is free of restrictive meta noindex directives.',
            urls: [home.url],
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 7. X-Robots-Tag blocking indexing
  {
    id: 'tech-x-robots-noindex',
    name: 'X-Robots-Tag HTTP Header Blocking',
    category: 'technical',
    description: 'Ensures HTTP response headers do not block search engines with noindex.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const blockedPages = scan.pages.filter((p) => {
        const header = (p.http.securityHeaders.xRobotsTag || '').toLowerCase();
        return header.includes('noindex');
      });

      if (blockedPages.length > 0) {
        return [
          createFinding({
            checkId: 'tech-x-robots-noindex',
            category: 'technical',
            severity: blockedPages.some((p) => p.depth === 0) ? 'critical' : 'important',
            evidence: {
              summary: `${blockedPages.length} page(s) returned an "X-Robots-Tag: noindex" header.`,
              details: `Pages: ${blockedPages.map((p) => p.url).slice(0, 3).join(', ')}`,
              urls: blockedPages.map((p) => p.url),
              affectedCount: blockedPages.length,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'tech-x-robots-noindex',
          category: 'technical',
          severity: 'passed',
          evidence: {
            summary: 'No pages returned blocking X-Robots-Tag headers.',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 8. Redirect loop
  {
    id: 'tech-redirect-loop',
    name: 'Redirect Loop Detection',
    category: 'technical',
    description: 'Verifies that requests do not encounter circular redirect loops.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const loopErrors = scan.errors.filter((e) => e.code === 'REDIRECT_LIMIT');
      const loopedPages = scan.pages.filter((p) => {
        const visited = new Set<string>();
        for (const hop of p.http.redirects) {
          if (visited.has(hop.destinationUrl)) return true;
          visited.add(hop.destinationUrl);
        }
        return false;
      });

      if (loopErrors.length > 0 || loopedPages.length > 0) {
        const loopUrls = [
          ...loopErrors.map((e) => e.targetUrl || scan.inputUrl),
          ...loopedPages.map((p) => p.url),
        ];
        return [
          createFinding({
            checkId: 'tech-redirect-loop',
            category: 'technical',
            severity: 'critical',
            evidence: {
              summary: 'Detected redirect loop preventing content retrieval.',
              details: loopErrors[0]?.message || 'Recursive redirect chain detected.',
              urls: loopUrls,
              affectedCount: loopUrls.length,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'tech-redirect-loop',
          category: 'technical',
          severity: 'passed',
          evidence: {
            summary: 'No circular redirect loops detected across scanned pages.',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 9. Server 5xx internal errors
  {
    id: 'tech-server-5xx-errors',
    name: 'Server 5xx Internal Errors',
    category: 'technical',
    description: 'Checks for pages returning internal server error codes (500, 502, 503, 504).',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const fiveHundredPages = scan.pages.filter((p) => p.http.statusCode >= 500);

      if (fiveHundredPages.length > 0) {
        return [
          createFinding({
            checkId: 'tech-server-5xx-errors',
            category: 'technical',
            severity: 'critical',
            evidence: {
              summary: `${fiveHundredPages.length} internal page(s) returned HTTP 5xx server errors.`,
              details: `Failing URLs: ${fiveHundredPages.map((p) => `${p.url} (${p.http.statusCode})`).slice(0, 3).join(', ')}`,
              urls: fiveHundredPages.map((p) => p.url),
              affectedCount: fiveHundredPages.length,
              technicalData: {
                pages: fiveHundredPages.map((p) => ({ url: p.url, status: p.http.statusCode })),
              },
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'tech-server-5xx-errors',
          category: 'technical',
          severity: 'passed',
          evidence: {
            summary: 'All scanned pages resolved without HTTP 5xx server errors.',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 10. References to staging or localhost
  {
    id: 'tech-staging-localhost-refs',
    name: 'References to Staging or Localhost',
    category: 'technical',
    description: 'Checks if pages reference development URLs (localhost, 127.0.0.1, staging, test).',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const isDevOrStagingUrl = (u: string) => {
        try {
          const parsed = new URL(u, scan.normalizedUrl || 'https://example.com');
          const host = parsed.hostname.toLowerCase();
          if (
            host === 'localhost' ||
            host === '127.0.0.1' ||
            host.endsWith('.localhost') ||
            host.endsWith('.local') ||
            host.endsWith('.internal')
          ) {
            return true;
          }
          // Subdomain / prefix indicators for staging/dev/test environments (e.g. dev.example.com, staging.example.com, test.example.com)
          if (/^(?:[a-z0-9-]+\.)*(staging|dev|test)\.[a-z0-9.-]+/i.test(host)) {
            return true;
          }
          if (/^(staging-|dev-|test-)[a-z0-9.-]+/i.test(host)) {
            return true;
          }
        } catch {
          if (/https?:\/\/(?:[a-z0-9-]+\.)*(localhost|127\.0\.0\.1|staging\.|dev\.|test\.)/i.test(u)) {
            return true;
          }
        }
        return false;
      };

      const taintedPages: { pageUrl: string; badUrls: string[] }[] = [];

      for (const page of scan.pages) {
        const badLinks = page.links
          .map((l) => l.destinationUrl)
          .filter((u) => isDevOrStagingUrl(u));
        const badResources = page.resources
          .map((r) => r.url)
          .filter((u) => isDevOrStagingUrl(u));
        const allBad = [...badLinks, ...badResources];

        if (allBad.length > 0) {
          taintedPages.push({ pageUrl: page.url, badUrls: allBad });
        }
      }

      if (taintedPages.length > 0) {
        const totalBad = taintedPages.reduce((acc, t) => acc + t.badUrls.length, 0);
        return [
          createFinding({
            checkId: 'tech-staging-localhost-refs',
            category: 'technical',
            severity: 'important',
            evidence: {
              summary: `Found ${totalBad} reference(s) to development or localhost domains on ${taintedPages.length} page(s).`,
              details: `Examples: ${taintedPages[0].badUrls.slice(0, 3).join(', ')}`,
              urls: taintedPages.map((t) => t.pageUrl),
              affectedCount: taintedPages.length,
              technicalData: { taintedPages },
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'tech-staging-localhost-refs',
          category: 'technical',
          severity: 'passed',
          evidence: {
            summary: 'No references to localhost, dev, or staging environments detected.',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 11. Critical internal pages unreachable
  {
    id: 'tech-critical-pages-unreachable',
    name: 'Critical Internal Pages Reachability',
    category: 'technical',
    description: 'Checks whether primary internal navigation links resolve successfully.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const failedPages = scan.pages.filter(
        (p) => p.depth > 0 && (p.http.statusCode === 0 || p.http.statusCode >= 400)
      );

      if (failedPages.length > 0) {
        return [
          createFinding({
            checkId: 'tech-critical-pages-unreachable',
            category: 'technical',
            severity: 'important',
            evidence: {
              summary: `${failedPages.length} internal linked page(s) failed to load or returned error status codes.`,
              details: `Failing URLs: ${failedPages.map((p) => `${p.url} (${p.http.statusCode || 'Connection Failed'})`).slice(0, 3).join(', ')}`,
              urls: failedPages.map((p) => p.url),
              affectedCount: failedPages.length,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'tech-critical-pages-unreachable',
          category: 'technical',
          severity: 'passed',
          evidence: {
            summary: 'All crawled internal pages responded successfully without HTTP error codes.',
            affectedCount: 0,
          },
        }),
      ];
    },
  },
];
