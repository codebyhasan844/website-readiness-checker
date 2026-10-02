/**
 * URL Validator & Normalizer (Phase 2)
 *
 * Provides deterministic URL parsing, normalization, and strict scheme validation.
 * Accepts only public HTTP and HTTPS schemes.
 */

import { ScannerException } from './errors';

export interface ValidatedUrl {
  /** The original raw user string */
  originalInput: string;
  /** Normalized URL string (lowercase hostname, no fragment, normalized port) */
  normalizedUrl: string;
  /** Parsed Node/WHATWG URL object */
  parsed: URL;
  /** Hostname (lowercase) */
  hostname: string;
  /** Protocol (http: or https:) */
  protocol: 'http:' | 'https:';
  /** Port number (defaults to 80 for http, 443 for https) */
  port: number;
  /** Pathname and search without hash fragment */
  pathAndQuery: string;
}

export class UrlValidator {
  /**
   * Validates and normalizes user input into a deterministic ValidatedUrl structure.
   * Throws ScannerException(INVALID_URL) on invalid inputs.
   */
  public static validate(input: string): ValidatedUrl {
    const raw = (input || '').trim();
    if (!raw) {
      throw new ScannerException('INVALID_URL', 'URL cannot be empty.', 'Empty input');
    }

    // Reject obvious malicious pseudo-schemes early
    const lowerRaw = raw.toLowerCase();
    if (
      lowerRaw.startsWith('javascript:') ||
      lowerRaw.startsWith('data:') ||
      lowerRaw.startsWith('file:') ||
      lowerRaw.startsWith('blob:') ||
      lowerRaw.startsWith('ftp:') ||
      lowerRaw.startsWith('ssh:') ||
      lowerRaw.startsWith('tel:') ||
      lowerRaw.startsWith('mailto:')
    ) {
      throw new ScannerException(
        'INVALID_URL',
        'Only HTTP and HTTPS website URLs are supported.',
        `Unsupported scheme: ${raw.split(':')[0]}`,
        raw
      );
    }

    // Prepend https:// if scheme is missing
    let target = raw;
    if (!/^https?:\/\//i.test(target)) {
      target = `https://${target}`;
    }

    let parsed: URL;
    try {
      parsed = new URL(target);
    } catch {
      throw new ScannerException(
        'INVALID_URL',
        'Enter a valid website URL.',
        'URL constructor failed to parse string',
        raw
      );
    }

    // Protocol check
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new ScannerException(
        'INVALID_URL',
        'Only HTTP and HTTPS website URLs are supported.',
        `Unsupported protocol: ${parsed.protocol}`,
        raw
      );
    }

    // Hostname check
    const hostname = parsed.hostname.toLowerCase().trim();
    if (!hostname || hostname.includes(' ') || !hostname.includes('.')) {
      // Must have at least a dot and non-empty components
      throw new ScannerException(
        'INVALID_URL',
        'Enter a valid website URL with a domain name (e.g. https://yourwebsite.com).',
        `Invalid hostname: "${hostname}"`,
        raw
      );
    }

    // Port check
    let port = parsed.port ? parseInt(parsed.port, 10) : parsed.protocol === 'https:' ? 443 : 80;
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new ScannerException(
        'INVALID_URL',
        'Invalid port number specified in URL.',
        `Port: ${parsed.port}`,
        raw
      );
    }

    // Normalize URL
    // 1. Lowercase hostname
    // 2. Remove default ports (:80 on http, :443 on https)
    // 3. Remove fragment (#hash)
    // 4. Normalize root path to "/" if empty
    // 5. Strip username and password (userinfo) to prevent credential leakage
    parsed.hash = '';
    parsed.username = '';
    parsed.password = '';
    if ((parsed.protocol === 'https:' && port === 443) || (parsed.protocol === 'http:' && port === 80)) {
      parsed.port = '';
    }

    const normalizedUrl = parsed.toString();

    return {
      originalInput: raw,
      normalizedUrl,
      parsed,
      hostname,
      protocol: parsed.protocol as 'http:' | 'https:',
      port,
      pathAndQuery: `${parsed.pathname || '/'}${parsed.search}`,
    };
  }

  /**
   * Resolves a relative or absolute link against a base URL and normalizes it for crawling.
   * Returns null if unresolvable, unsupported scheme, or invalid.
   */
  public static resolveAndNormalizeLink(linkHref: string, baseUrl: string): string | null {
    if (!linkHref || typeof linkHref !== 'string') return null;
    const trimmed = linkHref.trim();
    if (
      !trimmed ||
      trimmed.startsWith('#') ||
      trimmed.startsWith('javascript:') ||
      trimmed.startsWith('mailto:') ||
      trimmed.startsWith('tel:') ||
      trimmed.startsWith('data:')
    ) {
      return null;
    }

    try {
      const resolved = new URL(trimmed, baseUrl);
      if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
        return null;
      }
      // Strip fragment
      resolved.hash = '';
      // Strip userinfo
      resolved.username = '';
      resolved.password = '';
      // Strip default ports
      if (
        (resolved.protocol === 'https:' && resolved.port === '443') ||
        (resolved.protocol === 'http:' && resolved.port === '80')
      ) {
        resolved.port = '';
      }

      // Canonicalize origin to base URL if same-site (e.g. apex vs www, http vs https)
      try {
        const base = new URL(baseUrl);
        const resolvedHost = resolved.hostname.toLowerCase();
        const baseHost = base.hostname.toLowerCase();
        const cleanResolved = resolvedHost.replace(/^www\./, '');
        const cleanBase = baseHost.replace(/^www\./, '');

        if (cleanResolved === cleanBase) {
          resolved.hostname = baseHost;
          if (base.protocol === 'https:' && resolved.protocol === 'http:') {
            resolved.protocol = 'https:';
          }
        }
      } catch {
        // Leave resolved hostname as-is if baseUrl parsing fails
      }

      return resolved.toString();
    } catch {
      return null;
    }
  }

  /**
   * Helper to canonicalize a URL against a canonical base URL.
   */
  public static canonicalize(targetUrl: string, baseUrl?: string): string {
    if (!baseUrl) return targetUrl;
    return this.resolveAndNormalizeLink(targetUrl, baseUrl) || targetUrl;
  }

  /**
   * Tests if a target URL belongs to the same site/domain as the base URL.
   */
  public static isSameSite(targetUrl: string, baseUrl: string): boolean {
    try {
      const target = new URL(targetUrl);
      const base = new URL(baseUrl);

      const targetHost = target.hostname.toLowerCase();
      const baseHost = base.hostname.toLowerCase();

      if (targetHost === baseHost) return true;

      // Handle www vs non-www
      const cleanTarget = targetHost.replace(/^www\./, '');
      const cleanBase = baseHost.replace(/^www\./, '');
      return cleanTarget === cleanBase;
    } catch {
      return false;
    }
  }
}
