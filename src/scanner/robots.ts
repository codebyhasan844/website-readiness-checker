/**
 * Robots.txt Retriever & Parser (Phase 2)
 *
 * Safely fetches and parses /robots.txt files.
 * Extracts directives and sitemap declarations without making audit or validity judgments.
 */

import { SafeFetcher } from './fetcher';
import { RobotsResult, RobotsDirectiveGroup } from './types';

export class RobotsHandler {
  /**
   * Attempts to fetch and parse /robots.txt for a given base website URL.
   */
  public static async fetchRobots(
    baseUrl: string,
    abortSignal?: AbortSignal,
    onRequest?: (url: string) => void
  ): Promise<RobotsResult> {
    let robotsUrl: string;
    try {
      const parsed = new URL('/robots.txt', baseUrl);
      robotsUrl = parsed.toString();
    } catch {
      return {
        url: `${baseUrl.replace(/\/$/, '')}/robots.txt`,
        exists: false,
        directives: [],
        sitemapDeclarations: [],
        error: 'Could not construct valid robots.txt URL',
      };
    }

    try {
      const { data, bodyText } = await SafeFetcher.fetch(robotsUrl, {
        accept: 'text/plain',
        maxBytes: 512 * 1024, // 512 KB cap for robots.txt
        abortSignal,
        onRequest,
      });

      if (data.statusCode < 200 || data.statusCode >= 300) {
        return {
          url: robotsUrl,
          exists: false,
          statusCode: data.statusCode,
          contentType: data.contentType,
          responseBytes: data.responseBytes,
          directives: [],
          sitemapDeclarations: [],
        };
      }

      // Check for HTML soft-404 fallback
      const isHtmlFallback =
        data.contentType.includes('text/html') ||
        /^\s*<!DOCTYPE\s+html/i.test(bodyText) ||
        /^\s*<html\b/i.test(bodyText);

      if (isHtmlFallback) {
        return {
          url: robotsUrl,
          exists: false,
          statusCode: data.statusCode,
          contentType: data.contentType,
          responseBytes: data.responseBytes,
          directives: [],
          sitemapDeclarations: [],
          error: 'Origin returned HTML page instead of plain text robots.txt',
        };
      }

      const { directives, sitemapDeclarations } = this.parseRobotsText(bodyText);

      return {
        url: robotsUrl,
        exists: true,
        statusCode: data.statusCode,
        contentType: data.contentType,
        contentLength: data.responseBytes,
        responseBytes: data.responseBytes,
        rawText: bodyText.slice(0, 10000), // Retain reasonable snapshot
        directives,
        sitemapDeclarations,
      };
    } catch (err: unknown) {
      return {
        url: robotsUrl,
        exists: false,
        directives: [],
        sitemapDeclarations: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Parses line-by-line robots.txt text into directive groups and sitemap URLs.
   */
  public static parseRobotsText(text: string): {
    directives: RobotsDirectiveGroup[];
    sitemapDeclarations: string[];
  } {
    const lines = text.split(/\r?\n/);
    const groups: RobotsDirectiveGroup[] = [];
    const sitemaps: string[] = [];

    let currentAgents: string[] = [];
    let currentAllows: string[] = [];
    let currentDisallows: string[] = [];

    const flushGroup = () => {
      if (currentAgents.length > 0) {
        for (const agent of currentAgents) {
          groups.push({
            userAgent: agent,
            allows: [...currentAllows],
            disallows: [...currentDisallows],
          });
        }
        currentAgents = [];
        currentAllows = [];
        currentDisallows = [];
      }
    };

    for (const rawLine of lines) {
      // Strip comments (# ...)
      const line = rawLine.split('#')[0].trim();
      if (!line) continue;

      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;

      const field = line.slice(0, colonIdx).trim().toLowerCase();
      const value = line.slice(colonIdx + 1).trim();

      if (field === 'sitemap') {
        if (value && !sitemaps.includes(value)) {
          sitemaps.push(value);
        }
        continue;
      }

      if (field === 'user-agent') {
        // If we already collected rules for the previous agent group, flush them
        if (currentAllows.length > 0 || currentDisallows.length > 0) {
          flushGroup();
        }
        if (value) currentAgents.push(value);
        continue;
      }

      if (currentAgents.length > 0) {
        if (field === 'disallow') {
          if (value) currentDisallows.push(value);
        } else if (field === 'allow') {
          if (value) currentAllows.push(value);
        }
      }
    }

    flushGroup();

    return {
      directives: groups,
      sitemapDeclarations: sitemaps,
    };
  }
}
