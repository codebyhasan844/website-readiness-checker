/**
 * Sitemap Discovery & XML Parser (Phase 2)
 *
 * Discovers and inspects XML sitemaps declared in robots.txt or at /sitemap.xml.
 * Extracts contained URLs up to conservative limits without making audit judgments.
 */

import { SafeFetcher } from './fetcher';
import { SCANNER_LIMITS } from './limits';
import { SitemapResult } from './types';
import { UrlValidator } from './url-validator';

export class SitemapHandler {
  /**
   * Discovers sitemaps from robots.txt declarations and standard /sitemap.xml path.
   */
  public static async discoverSitemaps(
    baseUrl: string,
    robotsSitemaps: string[] = [],
    abortSignal?: AbortSignal,
    onRequest?: (url: string) => void
  ): Promise<SitemapResult[]> {
    const candidates: Array<{ url: string; source: SitemapResult['discoveredFrom'] }> = [];
    const seen = new Set<string>();

    // 1. Robots.txt declarations
    for (const url of robotsSitemaps) {
      if (!seen.has(url)) {
        seen.add(url);
        candidates.push({ url, source: 'robots.txt' });
      }
    }

    // 2. Standard /sitemap.xml
    try {
      const standardUrl = new URL('/sitemap.xml', baseUrl).toString();
      if (!seen.has(standardUrl)) {
        seen.add(standardUrl);
        candidates.push({ url: standardUrl, source: 'standard_path' });
      }
    } catch {
      // ignore
    }

    const results: SitemapResult[] = [];

    // Check candidate sitemaps up to max 3 sitemaps to avoid excessive requests
    for (const candidate of candidates.slice(0, 3)) {
      if (abortSignal?.aborted) break;
      try {
        const { data, bodyText } = await SafeFetcher.fetch(candidate.url, {
          accept: 'application/xml,text/xml,application/xhtml+xml,text/plain',
          maxBytes: 1024 * 1024, // 1 MB cap
          abortSignal,
          onRequest,
        });

        if (data.statusCode < 200 || data.statusCode >= 300) {
          results.push({
            url: candidate.url,
            discoveredFrom: candidate.source,
            exists: false,
            statusCode: data.statusCode,
            contentType: data.contentType,
            responseBytes: data.responseBytes,
            isIndex: false,
            containedUrls: [],
          });
          continue;
        }

        const isHtml =
          data.contentType.includes('text/html') ||
          /^\s*<!DOCTYPE\s+html/i.test(bodyText) ||
          /^\s*<html\b/i.test(bodyText);

        const isXml =
          data.contentType.includes('xml') ||
          /^\s*<\?xml/i.test(bodyText) ||
          /<urlset\b|<sitemapindex\b/i.test(bodyText);

        if (isHtml || !isXml) {
          results.push({
            url: candidate.url,
            discoveredFrom: candidate.source,
            exists: false,
            statusCode: data.statusCode,
            contentType: data.contentType,
            responseBytes: data.responseBytes,
            isIndex: false,
            containedUrls: [],
            error: isHtml
              ? 'Origin returned HTML page instead of XML sitemap'
              : 'Response did not contain valid XML sitemap markup (<urlset> or <sitemapindex>)',
          });
          continue;
        }

        const parsed = this.parseSitemapXml(bodyText);

        results.push({
          url: candidate.url,
          discoveredFrom: candidate.source,
          exists: true,
          statusCode: data.statusCode,
          contentType: data.contentType,
          responseBytes: data.responseBytes,
          isIndex: parsed.isIndex,
          containedUrls: parsed.urls
            .slice(0, SCANNER_LIMITS.maxSitemapUrls)
            .map((u) => UrlValidator.resolveAndNormalizeLink(u, baseUrl) || u),
        });
      } catch (err: unknown) {
        results.push({
          url: candidate.url,
          discoveredFrom: candidate.source,
          exists: false,
          isIndex: false,
          containedUrls: [],
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return results;
  }

  /**
   * Parses XML sitemap text extracting <loc> values and detecting sitemap indexes.
   */
  public static parseSitemapXml(xmlText: string): { isIndex: boolean; urls: string[] } {
    const urls: string[] = [];
    const isIndex = /<sitemapindex\b/i.test(xmlText);

    const locRegex = /<loc>([\s\S]*?)<\/loc>/gi;
    let match: RegExpExecArray | null;

    while ((match = locRegex.exec(xmlText)) !== null) {
      const loc = match[1].trim();
      if (loc && !urls.includes(loc)) {
        urls.push(loc);
      }
    }

    return {
      isIndex,
      urls,
    };
  }
}
