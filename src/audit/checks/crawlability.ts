/**
 * Crawlability & Discovery Audit Checks (Category B)
 */

import { ScanResult } from '../../scanner/types';
import { AuditCheck, AuditFinding } from '../types';
import { createFinding } from '../utils';

export const crawlabilityChecks: AuditCheck[] = [
  // 1. Robots.txt exists
  {
    id: 'crawl-robots-txt-exists',
    name: 'Robots.txt Presence',
    category: 'crawlability',
    description: 'Checks whether a robots.txt file exists on the website.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      if (!scan.robots || !scan.robots.exists) {
        return [
          createFinding({
            checkId: 'crawl-robots-txt-exists',
            category: 'crawlability',
            severity: 'important',
            evidence: {
              summary: 'No robots.txt file found at standard root location (/robots.txt).',
              details: scan.robots?.error || 'Server responded with 404 or missing file.',
              urls: [scan.robots?.url || `${scan.normalizedUrl}robots.txt`],
              affectedCount: 1,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'crawl-robots-txt-exists',
          category: 'crawlability',
          severity: 'passed',
          evidence: {
            summary: `Found robots.txt at ${scan.robots.url}.`,
            urls: [scan.robots.url],
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 2. Robots.txt accessible
  {
    id: 'crawl-robots-txt-accessible',
    name: 'Robots.txt HTTP Accessibility',
    category: 'crawlability',
    description: 'Ensures the robots.txt file returns a clean HTTP 200 status code.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      if (!scan.robots || !scan.robots.exists) {
        return [
          createFinding({
            checkId: 'crawl-robots-txt-accessible',
            category: 'crawlability',
            severity: 'passed',
            evidence: {
              summary: 'No robots.txt was declared or present to evaluate HTTP accessibility.',
              affectedCount: 0,
            },
          }),
        ];
      }

      const status = scan.robots.statusCode;
      if (status === 200) {
        return [
          createFinding({
            checkId: 'crawl-robots-txt-accessible',
            category: 'crawlability',
            severity: 'passed',
            evidence: {
              summary: 'Robots.txt responded with HTTP 200 OK.',
              urls: [scan.robots.url],
              affectedCount: 0,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'crawl-robots-txt-accessible',
          category: 'crawlability',
          severity: status && status >= 500 ? 'critical' : 'important',
          evidence: {
            summary: `Robots.txt returned HTTP status code ${status || 'Error'}.`,
            urls: [scan.robots.url],
            affectedCount: 1,
          },
        }),
      ];
    },
  },

  // 3. Sitemap exists
  {
    id: 'crawl-sitemap-exists',
    name: 'XML Sitemap Presence',
    category: 'crawlability',
    description: 'Verifies that at least one XML sitemap is declared or accessible.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const existingSitemaps = scan.sitemaps.filter((s) => s.exists);

      if (existingSitemaps.length === 0) {
        return [
          createFinding({
            checkId: 'crawl-sitemap-exists',
            category: 'crawlability',
            severity: 'important',
            evidence: {
              summary: 'No XML sitemap discovered in robots.txt or standard paths (/sitemap.xml).',
              details: 'Crawlers must rely solely on page-to-page link traversing.',
              affectedCount: 1,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'crawl-sitemap-exists',
          category: 'crawlability',
          severity: 'passed',
          evidence: {
            summary: `Discovered ${existingSitemaps.length} XML sitemap(s).`,
            urls: existingSitemaps.map((s) => s.url),
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 4. Sitemap accessible
  {
    id: 'crawl-sitemap-accessible',
    name: 'XML Sitemap Accessibility',
    category: 'crawlability',
    description: 'Confirms that declared sitemaps respond with HTTP 200 OK.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      if (scan.sitemaps.length === 0) {
        return [
          createFinding({
            checkId: 'crawl-sitemap-accessible',
            category: 'crawlability',
            severity: 'passed',
            evidence: {
              summary: 'No XML sitemaps declared to evaluate accessibility.',
              affectedCount: 0,
            },
          }),
        ];
      }

      const inaccessible = scan.sitemaps.filter((s) => !s.exists || s.statusCode !== 200);

      if (inaccessible.length > 0) {
        return [
          createFinding({
            checkId: 'crawl-sitemap-accessible',
            category: 'crawlability',
            severity: 'important',
            evidence: {
              summary: `${inaccessible.length} declared sitemap(s) could not be retrieved.`,
              details: inaccessible.map((s) => `${s.url} (${s.statusCode || 'Failed'})`).join('; '),
              urls: inaccessible.map((s) => s.url),
              affectedCount: inaccessible.length,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'crawl-sitemap-accessible',
          category: 'crawlability',
          severity: 'passed',
          evidence: {
            summary: 'All declared XML sitemaps responded with HTTP 200 OK.',
            urls: scan.sitemaps.map((s) => s.url),
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 5. Sitemap XML valid
  {
    id: 'crawl-sitemap-valid-xml',
    name: 'XML Sitemap Structure & Content',
    category: 'crawlability',
    description: 'Ensures sitemaps contain valid XML and non-empty URL declarations.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const existing = scan.sitemaps.filter((s) => s.exists && s.statusCode === 200);
      if (existing.length === 0) {
        return [
          createFinding({
            checkId: 'crawl-sitemap-valid-xml',
            category: 'crawlability',
            severity: 'passed',
            evidence: {
              summary: 'No accessible XML sitemaps present to validate XML syntax.',
              affectedCount: 0,
            },
          }),
        ];
      }

      const emptyOrError = existing.filter(
        (s) => s.containedUrls.length === 0 && !s.isIndex
      );

      if (emptyOrError.length > 0) {
        return [
          createFinding({
            checkId: 'crawl-sitemap-valid-xml',
            category: 'crawlability',
            severity: 'improvement',
            evidence: {
              summary: `${emptyOrError.length} sitemap(s) contained no indexable <url> entries.`,
              urls: emptyOrError.map((s) => s.url),
              affectedCount: emptyOrError.length,
            },
          }),
        ];
      }

      const totalUrls = existing.reduce((acc, s) => acc + s.containedUrls.length, 0);
      return [
        createFinding({
          checkId: 'crawl-sitemap-valid-xml',
          category: 'crawlability',
          severity: 'passed',
          evidence: {
            summary: `Valid XML format confirmed across sitemaps (${totalUrls} URLs discovered).`,
            urls: existing.map((s) => s.url),
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 6. Sitemap contains broken URLs
  {
    id: 'crawl-sitemap-broken-urls',
    name: 'Sitemap Contains Broken URLs',
    category: 'crawlability',
    description: 'Checks whether URLs listed in sitemaps return HTTP error codes.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const sitemapUrlSet = new Set<string>();
      for (const s of scan.sitemaps) {
        for (const u of s.containedUrls) {
          sitemapUrlSet.add(u);
        }
      }

      if (sitemapUrlSet.size === 0) {
        return [
          createFinding({
            checkId: 'crawl-sitemap-broken-urls',
            category: 'crawlability',
            severity: 'passed',
            evidence: {
              summary: 'No sitemap URLs declared to check for broken links.',
              affectedCount: 0,
            },
          }),
        ];
      }

      const brokenSitemapPages = scan.pages.filter(
        (p) => sitemapUrlSet.has(p.url) && (p.http.statusCode >= 400 || p.http.statusCode === 0)
      );

      if (brokenSitemapPages.length > 0) {
        return [
          createFinding({
            checkId: 'crawl-sitemap-broken-urls',
            category: 'crawlability',
            severity: 'important',
            evidence: {
              summary: `Found ${brokenSitemapPages.length} broken URL(s) declared in XML sitemaps.`,
              details: `Failing URLs: ${brokenSitemapPages.map((p) => `${p.url} (${p.http.statusCode})`).slice(0, 3).join(', ')}`,
              urls: brokenSitemapPages.map((p) => p.url),
              affectedCount: brokenSitemapPages.length,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'crawl-sitemap-broken-urls',
          category: 'crawlability',
          severity: 'passed',
          evidence: {
            summary: 'All crawled sitemap URLs returned successful HTTP status codes.',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 7. Sitemap contains non-indexable URLs
  {
    id: 'crawl-sitemap-non-indexable',
    name: 'Sitemap Contains Non-Indexable URLs',
    category: 'crawlability',
    description: 'Flags URLs listed in sitemaps that have noindex meta tags or robots disallow rules.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const sitemapUrlSet = new Set<string>();
      for (const s of scan.sitemaps) {
        for (const u of s.containedUrls) {
          sitemapUrlSet.add(u);
        }
      }
      if (sitemapUrlSet.size === 0) {
        return [
          createFinding({
            checkId: 'crawl-sitemap-non-indexable',
            category: 'crawlability',
            severity: 'passed',
            evidence: {
              summary: 'No sitemap URLs declared to check for non-indexable status.',
              affectedCount: 0,
            },
          }),
        ];
      }

      const nonIndexable = scan.pages.filter((p) => {
        if (!sitemapUrlSet.has(p.url)) return false;
        const robotsMeta = (p.document.robotsMeta || '').toLowerCase();
        const xRobots = (p.http.securityHeaders.xRobotsTag || '').toLowerCase();
        return robotsMeta.includes('noindex') || xRobots.includes('noindex');
      });

      if (nonIndexable.length > 0) {
        return [
          createFinding({
            checkId: 'crawl-sitemap-non-indexable',
            category: 'crawlability',
            severity: 'important',
            evidence: {
              summary: `${nonIndexable.length} URL(s) in sitemaps contain "noindex" directives.`,
              details: nonIndexable.map((p) => p.url).slice(0, 3).join(', '),
              urls: nonIndexable.map((p) => p.url),
              affectedCount: nonIndexable.length,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'crawl-sitemap-non-indexable',
          category: 'crawlability',
          severity: 'passed',
          evidence: {
            summary: 'No conflicting "noindex" directives found on sitemap URLs.',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 8. Sitemap protocol mismatch (HTTP/HTTPS)
  {
    id: 'crawl-sitemap-http-mismatch',
    name: 'Sitemap Protocol Mismatch',
    category: 'crawlability',
    description: 'Checks whether sitemap URLs use insecure http:// on an https:// site.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const homeIsHttps = scan.normalizedUrl.startsWith('https://');
      if (!homeIsHttps) {
        return [
          createFinding({
            checkId: 'crawl-sitemap-http-mismatch',
            category: 'crawlability',
            severity: 'passed',
            evidence: {
              summary: 'Site was scanned over HTTP; no protocol mismatch detected with sitemap declarations.',
              affectedCount: 0,
            },
          }),
        ];
      }

      const httpSitemapUrls: string[] = [];
      for (const s of scan.sitemaps) {
        if (s.url.startsWith('http://')) httpSitemapUrls.push(s.url);
        for (const u of s.containedUrls) {
          if (u.startsWith('http://')) httpSitemapUrls.push(u);
        }
      }

      if (httpSitemapUrls.length > 0) {
        return [
          createFinding({
            checkId: 'crawl-sitemap-http-mismatch',
            category: 'crawlability',
            severity: 'important',
            evidence: {
              summary: `Found ${httpSitemapUrls.length} sitemap entries using unencrypted http:// on an HTTPS website.`,
              details: `Examples: ${httpSitemapUrls.slice(0, 3).join(', ')}`,
              urls: httpSitemapUrls.slice(0, 10),
              affectedCount: httpSitemapUrls.length,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'crawl-sitemap-http-mismatch',
          category: 'crawlability',
          severity: 'passed',
          evidence: {
            summary: 'All sitemap declarations match the secure HTTPS protocol.',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 9. Sitemap canonical mismatch
  {
    id: 'crawl-sitemap-canonical-mismatch',
    name: 'Sitemap Canonical URL Alignment',
    category: 'crawlability',
    description: 'Ensures URLs listed in sitemaps match their declared canonical tags.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const sitemapUrlSet = new Set<string>();
      for (const s of scan.sitemaps) {
        for (const u of s.containedUrls) sitemapUrlSet.add(u);
      }
      if (sitemapUrlSet.size === 0) {
        return [
          createFinding({
            checkId: 'crawl-sitemap-canonical-mismatch',
            category: 'crawlability',
            severity: 'passed',
            evidence: {
              summary: 'No sitemap URLs declared to evaluate against canonical tags.',
              affectedCount: 0,
            },
          }),
        ];
      }

      const mismatches: { url: string; canonical: string }[] = [];
      for (const page of scan.pages) {
        if (sitemapUrlSet.has(page.url) && page.document.canonicalUrl) {
          const normCanonical = page.document.canonicalUrl.trim();
          if (normCanonical && normCanonical !== page.url && normCanonical !== page.normalizedUrl) {
            mismatches.push({ url: page.url, canonical: normCanonical });
          }
        }
      }

      if (mismatches.length > 0) {
        return [
          createFinding({
            checkId: 'crawl-sitemap-canonical-mismatch',
            category: 'crawlability',
            severity: 'important',
            evidence: {
              summary: `${mismatches.length} sitemap URL(s) declare a different canonical URL.`,
              details: `Example: ${mismatches[0].url} points canonical to ${mismatches[0].canonical}`,
              urls: mismatches.map((m) => m.url),
              affectedCount: mismatches.length,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'crawl-sitemap-canonical-mismatch',
          category: 'crawlability',
          severity: 'passed',
          evidence: {
            summary: 'Sitemap URLs align with on-page canonical tags.',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 10. Redirect chains
  {
    id: 'crawl-redirect-chains',
    name: 'Redirect Chains & Hops',
    category: 'crawlability',
    description: 'Detects URLs that pass through multiple redirect hops.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const chainedPages = scan.pages.filter((p) => p.http.redirects.length > 1);

      if (chainedPages.length > 0) {
        return [
          createFinding({
            checkId: 'crawl-redirect-chains',
            category: 'crawlability',
            severity: 'improvement',
            evidence: {
              summary: `Found ${chainedPages.length} page(s) with multiple redirect hops (>1).`,
              details: chainedPages.map((p) => `${p.url} (${p.http.redirects.length} hops)`).slice(0, 3).join(', '),
              urls: chainedPages.map((p) => p.url),
              affectedCount: chainedPages.length,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'crawl-redirect-chains',
          category: 'crawlability',
          severity: 'passed',
          evidence: {
            summary: 'No multi-hop redirect chains detected across scanned pages.',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 11. Broken internal links
  {
    id: 'crawl-broken-internal-links',
    name: 'Broken Internal Links',
    category: 'crawlability',
    description: 'Identifies internal anchor links pointing to 4xx or 5xx pages.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const failedPageUrls = new Set(
        scan.pages
          .filter((p) => p.http.statusCode >= 400 || p.http.statusCode === 0)
          .map((p) => p.normalizedUrl)
      );

      const brokenLinks: { source: string; target: string }[] = [];
      for (const page of scan.pages) {
        for (const link of page.links) {
          if (link.isInternal && failedPageUrls.has(link.normalizedDestination)) {
            brokenLinks.push({ source: page.url, target: link.destinationUrl });
          }
        }
      }

      if (brokenLinks.length > 0) {
        return [
          createFinding({
            checkId: 'crawl-broken-internal-links',
            category: 'crawlability',
            severity: 'critical',
            evidence: {
              summary: `Detected ${brokenLinks.length} internal link(s) pointing to non-existent or error pages.`,
              details: `Broken target: ${brokenLinks[0].target} (linked from ${brokenLinks[0].source})`,
              urls: Array.from(new Set(brokenLinks.map((b) => b.source))),
              affectedCount: brokenLinks.length,
              resources: brokenLinks.map((b) => ({
                resourceUrl: b.target,
                referencedFrom: b.source,
                statusText: 'Broken internal destination (4xx/5xx or fetch failed)',
              })),
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'crawl-broken-internal-links',
          category: 'crawlability',
          severity: 'passed',
          evidence: {
            summary: 'All crawled internal links resolve without 4xx or 5xx error status codes.',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 12. Internal links pointing to redirects
  {
    id: 'crawl-links-to-redirects',
    name: 'Internal Links Pointing to Redirects',
    category: 'crawlability',
    description: 'Flags internal hyperlinks pointing to URLs that trigger redirects.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const redirectingUrls = new Set<string>();
      for (const p of scan.pages) {
        for (const hop of p.http.redirects) {
          redirectingUrls.add(hop.requestedUrl);
        }
      }

      const linksToRedirect: { source: string; target: string }[] = [];
      for (const page of scan.pages) {
        for (const link of page.links) {
          if (link.isInternal && redirectingUrls.has(link.normalizedDestination)) {
            linksToRedirect.push({ source: page.url, target: link.destinationUrl });
          }
        }
      }

      if (linksToRedirect.length > 0) {
        return [
          createFinding({
            checkId: 'crawl-links-to-redirects',
            category: 'crawlability',
            severity: 'improvement',
            evidence: {
              summary: `Found ${linksToRedirect.length} internal link(s) pointing to URLs that redirect.`,
              details: `Example: ${linksToRedirect[0].target} (on ${linksToRedirect[0].source})`,
              urls: Array.from(new Set(linksToRedirect.map((l) => l.source))),
              affectedCount: linksToRedirect.length,
              resources: linksToRedirect.map((l) => ({
                resourceUrl: l.target,
                referencedFrom: l.source,
                statusText: 'Internal link targets a redirecting URL',
              })),
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'crawl-links-to-redirects',
          category: 'crawlability',
          severity: 'passed',
          evidence: {
            summary: 'Internal links connect directly to final destination URLs.',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 13. Crawl depth & structure
  {
    id: 'crawl-crawl-depth',
    name: 'Site Crawl Depth & Structure',
    category: 'crawlability',
    description: 'Evaluates the depth level of pages crawled from the homepage.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const deepPages = scan.pages.filter((p) => p.depth > 3);
      const depthBlocked = scan.depthBlockedUrlsCount || 0;

      if (deepPages.length > 0 || depthBlocked > 0) {
        const count = deepPages.length > 0 ? deepPages.length : depthBlocked;
        return [
          createFinding({
            checkId: 'crawl-crawl-depth',
            category: 'crawlability',
            severity: 'improvement',
            evidence: {
              summary: `${count} page or link target(s) require more than 3 clicks to reach from the homepage.`,
              details: depthBlocked > 0
                ? `${depthBlocked} internal link(s) discovered at maximum crawl depth pointing to deeper content.`
                : undefined,
              urls: deepPages.map((p) => p.url),
              affectedCount: count,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'crawl-crawl-depth',
          category: 'crawlability',
          severity: 'passed',
          evidence: {
            summary: 'Site navigation hierarchy is flat and reachable within optimal click depth (<= 3 hops).',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 14. Duplicate URL signals
  {
    id: 'crawl-duplicate-url-signals',
    name: 'Duplicate URL & Slash Signals',
    category: 'crawlability',
    description: 'Identifies potential duplicate URL patterns like slash vs non-slash.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const urlPaths = new Map<string, string>();
      const duplicates: { url1: string; url2: string }[] = [];

      for (const p of scan.pages) {
        try {
          const parsed = new URL(p.url);
          const normalizedPath = parsed.pathname.replace(/\/+$/, '') || '/';
          const key = `${parsed.hostname}${normalizedPath}`;
          if (urlPaths.has(key)) {
            duplicates.push({ url1: urlPaths.get(key)!, url2: p.url });
          } else {
            urlPaths.set(key, p.url);
          }
        } catch {
          // Ignore invalid URL parse
        }
      }

      if (duplicates.length > 0) {
        return [
          createFinding({
            checkId: 'crawl-duplicate-url-signals',
            category: 'crawlability',
            severity: 'improvement',
            evidence: {
              summary: `Detected ${duplicates.length} duplicate URL path variations (e.g. trailing slash discrepancies).`,
              details: `Example: ${duplicates[0].url1} vs ${duplicates[0].url2}`,
              urls: duplicates.map((d) => d.url2),
              affectedCount: duplicates.length,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'crawl-duplicate-url-signals',
          category: 'crawlability',
          severity: 'passed',
          evidence: {
            summary: 'No duplicate URL path variations detected across crawled pages.',
            affectedCount: 0,
          },
        }),
      ];
    },
  },
];
