/**
 * Deterministic HTML & Resource Parser (Phase 2)
 *
 * Extracts structured raw document metadata, headings, links, images,
 * and external asset references from HTML payloads.
 * Strictly extracts factual values without computing quality scores or severities.
 */

import { UrlValidator } from './url-validator';
import {
  PageDocumentData,
  HeadingsData,
  HeadingItem,
  LinkResult,
  ImageResult,
  ResourceReference,
} from './types';

export interface ParsedHtmlResult {
  document: PageDocumentData;
  headings: HeadingsData;
  links: LinkResult[];
  images: ImageResult[];
  resources: ResourceReference[];
}

export class HtmlParser {
  /**
   * Strips HTML comments, script tags, and style tags to prevent false extractions.
   */
  public static stripNonContent(html: string): string {
    if (!html) return '';
    return html
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  }

  /**
   * Decodes basic HTML entities and trims excessive whitespace.
   */
  public static cleanText(text: string): string {
    if (!text) return '';
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Parses raw HTML string and extracts document, heading, link, image, and resource facts.
   */
  public static parse(html: string, pageUrl: string): ParsedHtmlResult {
    const document = this.extractDocumentData(html);
    const headings = this.extractHeadings(html);
    const links = this.extractLinks(html, pageUrl);
    const images = this.extractImages(html, pageUrl);
    const resources = this.extractResources(html, pageUrl);

    return {
      document,
      headings,
      links,
      images,
      resources,
    };
  }

  /**
   * Extracts <title>, <meta>, <link rel="canonical">, <html lang>, etc.
   */
  public static extractDocumentData(html: string): PageDocumentData {
    const result: PageDocumentData = {};

    // 1. Language on <html lang="...">
    const htmlLangMatch = html.match(/<html[^>]*\slang=["']([^"']+)["']/i);
    if (htmlLangMatch) {
      result.language = htmlLangMatch[1].trim();
    }

    // 2. <title>...</title>
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
      result.title = this.cleanText(titleMatch[1]);
    }

    // 3. Meta description
    const metaDescMatch =
      html.match(/<meta[^>]*\bname=["']description["'][^>]*\bcontent=["']([^"']*)["']/i) ||
      html.match(/<meta[^>]*\bcontent=["']([^"']*)["'][^>]*\bname=["']description["']/i);
    if (metaDescMatch) {
      result.metaDescription = this.cleanText(metaDescMatch[1]);
    }

    // 4. Canonical URL
    const canonicalMatch =
      html.match(/<link[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']*)["']/i) ||
      html.match(/<link[^>]*\bhref=["']([^"']*)["'][^>]*\brel=["']canonical["']/i);
    if (canonicalMatch) {
      result.canonicalUrl = canonicalMatch[1].trim();
    }

    // 5. Robots meta tag
    const robotsMetaMatch =
      html.match(/<meta[^>]*\bname=["']robots["'][^>]*\bcontent=["']([^"']*)["']/i) ||
      html.match(/<meta[^>]*\bcontent=["']([^"']*)["'][^>]*\bname=["']robots["']/i);
    if (robotsMetaMatch) {
      result.robotsMeta = robotsMetaMatch[1].trim().toLowerCase();
    }

    // 6. Charset
    const charsetMatch =
      html.match(/<meta[^>]*\bcharset=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*\bcontent=["'][^"']*charset=([^"';\s]+)["']/i);
    if (charsetMatch) {
      result.charset = charsetMatch[1].trim().toLowerCase();
    }

    // 7. Viewport
    const viewportMatch =
      html.match(/<meta[^>]*\bname=["']viewport["'][^>]*\bcontent=["']([^"']*)["']/i) ||
      html.match(/<meta[^>]*\bcontent=["']([^"']*)["'][^>]*\bname=["']viewport["']/i);
    if (viewportMatch) {
      result.viewport = viewportMatch[1].trim();
    }

    // 8. Open Graph & Twitter Card tags
    const og: Record<string, string> = {};
    const twitter: Record<string, string> = {};

    const metaTagRegex = /<meta\s+([^>]+)>/gi;
    let match: RegExpExecArray | null;
    while ((match = metaTagRegex.exec(html)) !== null) {
      const tagAttrs = match[1];
      const propMatch = tagAttrs.match(/property=["'](og:[^"']+)["']/i);
      const nameMatch = tagAttrs.match(/name=["'](twitter:[^"']+)["']/i);
      const contentMatch = tagAttrs.match(/content=["']([^"']*)["']/i);

      if (propMatch && contentMatch) {
        og[propMatch[1].toLowerCase()] = contentMatch[1];
      }
      if (nameMatch && contentMatch) {
        twitter[nameMatch[1].toLowerCase()] = contentMatch[1];
      }
    }

    if (Object.keys(og).length > 0) result.openGraph = og;
    if (Object.keys(twitter).length > 0) result.twitterCard = twitter;

    // 9. Favicon detection
    result.hasFavicon = /<link[^>]*\brel=["'][^"']*icon[^"']*["']/i.test(html);

    // 10. Structured Data (JSON-LD)
    result.hasStructuredData = /<script[^>]*\btype=["']application\/ld\+json["']/i.test(html);

    // 11. Duplicate ID attributes
    const idRegex = /\bid=["']([^"']+)["']/gi;
    const idCounts = new Map<string, number>();
    let idMatch: RegExpExecArray | null;
    while ((idMatch = idRegex.exec(html)) !== null) {
      const idVal = idMatch[1].trim();
      if (idVal) {
        idCounts.set(idVal, (idCounts.get(idVal) || 0) + 1);
      }
    }
    const dupes: string[] = [];
    for (const [idVal, count] of idCounts.entries()) {
      if (count > 1) {
        dupes.push(idVal);
      }
    }
    if (dupes.length > 0) {
      result.duplicateIds = dupes;
    }

    // 12. Unlabeled form controls (<input>, <textarea>, <select> without label/aria/title/placeholder)
    const stripped = this.stripNonContent(html);

    // Collect IDs explicitly labeled via <label for="...">
    const labeledIds = new Set<string>();
    const labelForRegex = /<label\b[^>]*\bfor=["']([^"']+)["']/gi;
    let labelForMatch: RegExpExecArray | null;
    while ((labelForMatch = labelForRegex.exec(stripped)) !== null) {
      labeledIds.add(labelForMatch[1].trim());
    }

    // Collect wrapping <label>...</label> ranges
    const labelRanges: Array<{ start: number; end: number }> = [];
    const wrappingLabelRegex = /<label\b[^>]*>[\s\S]*?<\/label>/gi;
    let wrapMatch: RegExpExecArray | null;
    while ((wrapMatch = wrappingLabelRegex.exec(stripped)) !== null) {
      labelRanges.push({ start: wrapMatch.index, end: wrapMatch.index + wrapMatch[0].length });
    }

    const inputRegex = /<(?:input|textarea|select)\b([^>]*)>/gi;
    let inputMatch: RegExpExecArray | null;
    let unlabeled = 0;
    while ((inputMatch = inputRegex.exec(stripped)) !== null) {
      const attrs = inputMatch[1];
      const typeMatch = attrs.match(/\btype=["']([^"']+)["']/i);
      const inputType = typeMatch ? typeMatch[1].toLowerCase() : 'text';
      if (['hidden', 'submit', 'button', 'reset', 'image'].includes(inputType)) continue;

      const idMatch = attrs.match(/\bid=["']([^"']+)["']/i);
      const inputId = idMatch ? idMatch[1].trim() : '';
      const hasLabelFor = Boolean(inputId && labeledIds.has(inputId));
      const matchIndex = inputMatch.index;
      const isWrapped = labelRanges.some((r) => matchIndex >= r.start && matchIndex < r.end);

      const hasAria = /\baria-label(?:ledby)?=["']([^"']+)["']/i.test(attrs);
      const hasTitle = /\btitle=["']([^"']+)["']/i.test(attrs);
      const hasPlaceholder = /\bplaceholder=["']([^"']+)["']/i.test(attrs);

      if (!hasLabelFor && !isWrapped && !hasAria && !hasTitle && !hasPlaceholder) {
        unlabeled++;
      }
    }
    result.unlabeledFormControls = unlabeled;

    // 13. Missing iframe titles
    const iframeTagRegex = /<iframe\b([^>]*)>/gi;
    let iframeMatch: RegExpExecArray | null;
    let missingIframeTitles = 0;
    while ((iframeMatch = iframeTagRegex.exec(stripped)) !== null) {
      const attrs = iframeMatch[1];
      if (!/\btitle=["'][^"']+["']/i.test(attrs)) {
        missingIframeTitles++;
      }
    }
    result.iframesWithoutTitle = missingIframeTitles;

    // 14. Empty links/buttons count (only anchors that actually declare an href)
    const anchorRegex = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
    let anchorMatch: RegExpExecArray | null;
    let emptyLinks = 0;
    while ((anchorMatch = anchorRegex.exec(stripped)) !== null) {
      const attrs = anchorMatch[1];
      // Skip anchor bookmarks (no href attribute)
      if (!/\bhref\s*=/i.test(attrs)) continue;

      const innerContent = anchorMatch[2];
      const text = this.cleanText(innerContent.replace(/<[^>]+>/g, ''));
      const hasAria = /\baria-label(?:ledby)?=["']([^"']+)["']/i.test(attrs);
      const hasImg = /<img\b[^>]*\balt=["'][^"']+["']/i.test(innerContent);
      if (!text && !hasAria && !hasImg) {
        emptyLinks++;
      }
    }
    result.emptyLinksCount = emptyLinks;

    return result;
  }

  /**
   * Extracts H1 through H6 headings with levels and clean text.
   */
  public static extractHeadings(html: string): HeadingsData {
    const items: HeadingItem[] = [];
    const stripped = this.stripNonContent(html);
    const headingRegex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;

    let match: RegExpExecArray | null;
    while ((match = headingRegex.exec(stripped)) !== null) {
      const level = parseInt(match[1], 10);
      const text = this.cleanText(match[2].replace(/<[^>]+>/g, ''));
      if (text) {
        items.push({ level, text });
      }
    }

    const h1Count = items.filter((h) => h.level === 1).length;

    return {
      h1Count,
      items,
    };
  }

  /**
   * Extracts anchor links (<a href="...">...</a>) and classifies them as internal vs external.
   */
  public static extractLinks(html: string, pageUrl: string): LinkResult[] {
    const links: LinkResult[] = [];
    const stripped = this.stripNonContent(html);
    const linkRegex = /<a\s+([^>]+)>([\s\S]*?)<\/a>/gi;

    let match: RegExpExecArray | null;
    while ((match = linkRegex.exec(stripped)) !== null) {
      const attrs = match[1];
      const rawText = match[2];

      const hrefMatch = attrs.match(/\bhref=["']([^"']+)["']/i);
      if (!hrefMatch) continue;

      const rawHref = hrefMatch[1].trim();
      const normalizedDest = UrlValidator.resolveAndNormalizeLink(rawHref, pageUrl);
      if (!normalizedDest) continue;

      const anchorText = this.cleanText(rawText.replace(/<[^>]+>/g, ''));
      const isInternal = UrlValidator.isSameSite(normalizedDest, pageUrl);

      const relMatch = attrs.match(/\brel=["']([^"']+)["']/i);
      const targetMatch = attrs.match(/\btarget=["']([^"']+)["']/i);

      links.push({
        sourceUrl: pageUrl,
        destinationUrl: rawHref,
        normalizedDestination: normalizedDest,
        anchorText,
        isInternal,
        rel: relMatch ? relMatch[1] : undefined,
        target: targetMatch ? targetMatch[1] : undefined,
      });
    }

    return links;
  }

  /**
   * Extracts image elements (<img src="..." alt="...">).
   */
  public static extractImages(html: string, pageUrl: string): ImageResult[] {
    const images: ImageResult[] = [];
    const stripped = this.stripNonContent(html);
    const imgRegex = /<img\s+([^>]+)>/gi;

    let match: RegExpExecArray | null;
    while ((match = imgRegex.exec(stripped)) !== null) {
      const attrs = match[1];

      const srcMatch = attrs.match(/\bsrc=["']([^"']+)["']/i);
      if (!srcMatch) continue;

      const src = srcMatch[1].trim();
      const hasAlt = /\balt\s*=/i.test(attrs);
      const altMatch = attrs.match(/\balt=["']([^"']*)["']/i);
      const altText = altMatch ? this.cleanText(altMatch[1]) : '';

      const widthMatch = attrs.match(/\bwidth=["']([^"']+)["']/i);
      const heightMatch = attrs.match(/\bheight=["']([^"']+)["']/i);
      const loadingMatch = attrs.match(/\bloading=["']([^"']+)["']/i);

      let imageType: string | undefined;
      const extMatch = src.match(/\.([a-z0-9]+)(?:[?#]|$)/i);
      if (extMatch) {
        imageType = extMatch[1].toLowerCase();
      }

      images.push({
        sourceUrl: pageUrl,
        src,
        hasAlt,
        altText,
        width: widthMatch ? widthMatch[1] : undefined,
        height: heightMatch ? heightMatch[1] : undefined,
        loading: loadingMatch ? loadingMatch[1] : undefined,
        imageType,
      });
    }

    return images;
  }

  /**
   * Extracts referenced stylesheet, script, font, image, and iframe URLs.
   */
  public static extractResources(html: string, pageUrl: string): ResourceReference[] {
    const resources: ResourceReference[] = [];
    const seenUrls = new Set<string>();
    const withoutComments = html.replace(/<!--[\s\S]*?-->/g, '');

    const addResource = (rawUrl: string, type: ResourceReference['type']) => {
      const resolved = UrlValidator.resolveAndNormalizeLink(rawUrl, pageUrl);
      if (!resolved || seenUrls.has(resolved)) return;
      seenUrls.add(resolved);

      resources.push({
        type,
        url: resolved,
        isInternal: UrlValidator.isSameSite(resolved, pageUrl),
      });
    };

    // 1. CSS stylesheets: <link rel="stylesheet" href="...">
    const cssRegex = /<link[^>]*\brel=["'][^"']*stylesheet[^"']*["'][^>]*\bhref=["']([^"']+)["']/gi;
    let match: RegExpExecArray | null;
    while ((match = cssRegex.exec(withoutComments)) !== null) {
      addResource(match[1], 'css');
    }

    // 2. JavaScript files: <script src="...">
    const jsRegex = /<script[^>]*\bsrc=["']([^"']+)["']/gi;
    while ((match = jsRegex.exec(withoutComments)) !== null) {
      addResource(match[1], 'javascript');
    }

    // 3. Iframes: <iframe src="...">
    const iframeRegex = /<iframe[^>]*\bsrc=["']([^"']+)["']/gi;
    while ((match = iframeRegex.exec(withoutComments)) !== null) {
      addResource(match[1], 'iframe');
    }

    // 4. Preloaded fonts: <link rel="preload" as="font" href="...">
    const fontRegex = /<link[^>]*\bas=["']font["'][^>]*\bhref=["']([^"']+)["']/gi;
    while ((match = fontRegex.exec(withoutComments)) !== null) {
      addResource(match[1], 'font');
    }

    // 5. Images: <img src="...">
    const imgRegex = /<img[^>]*\bsrc=["']([^"']+)["']/gi;
    while ((match = imgRegex.exec(withoutComments)) !== null) {
      addResource(match[1], 'image');
    }

    return resources;
  }
}
