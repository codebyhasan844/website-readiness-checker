/**
 * Redirect Handler & Loop Detector (Phase 2)
 *
 * Enforces strict redirect count limits, loop detection, and full SSRF
 * revalidation at every intermediate redirect hop.
 */

import { SCANNER_LIMITS } from './limits';
import { ScannerException } from './errors';
import { UrlValidator, ValidatedUrl } from './url-validator';
import { SecurityGuard } from './security-guard';
import { DnsSafetyGuard } from './dns-safety';
import { RawRedirectHop } from './types';

export interface RedirectValidationResult {
  nextUrl: ValidatedUrl;
  chain: RawRedirectHop[];
}

export class RedirectHandler {
  private chain: RawRedirectHop[] = [];
  private visitedUrls = new Set<string>();

  constructor(initialUrl: string) {
    this.visitedUrls.add(initialUrl);
  }

  /**
   * Evaluates a redirect response header (Location), checks for loops and limits,
   * re-validates URL, host, port, SSRF, and DNS safety, and records the hop.
   */
  public async handleRedirect(
    currentUrl: string,
    statusCode: number,
    locationHeader: string | null | undefined
  ): Promise<ValidatedUrl> {
    if (!locationHeader) {
      throw new ScannerException(
        'REQUEST_FAILED',
        'Redirect status received without a Location header.',
        `Status ${statusCode}`,
        currentUrl
      );
    }

    // 1. Max redirect count check
    if (this.chain.length >= SCANNER_LIMITS.maxRedirects) {
      throw new ScannerException(
        'REDIRECT_LIMIT',
        `Redirect limit exceeded (${SCANNER_LIMITS.maxRedirects} hops).`,
        `Reached max redirects limit: ${SCANNER_LIMITS.maxRedirects}`,
        currentUrl
      );
    }

    // 2. Resolve relative Location against current URL
    let nextValidated: ValidatedUrl;
    try {
      const resolved = new URL(locationHeader, currentUrl).toString();
      nextValidated = UrlValidator.validate(resolved);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new ScannerException(
        'INVALID_URL',
        'Invalid redirect destination URL received from target server.',
        `Invalid location header: "${locationHeader}" (${msg})`,
        currentUrl
      );
    }

    // 3. Loop detection
    if (this.visitedUrls.has(nextValidated.normalizedUrl)) {
      throw new ScannerException(
        'REDIRECT_LIMIT',
        'Redirect loop detected.',
        `Loop detected returning to: ${nextValidated.normalizedUrl}`,
        currentUrl
      );
    }

    // 4. SSRF host & port check on destination
    try {
      SecurityGuard.validateHostAndPort(nextValidated.hostname, nextValidated.port);
    } catch (err) {
      throw new ScannerException(
        'REDIRECT_BLOCKED',
        'Redirect destination was blocked by security policy (prohibited address or port).',
        err instanceof Error ? err.message : String(err),
        nextValidated.normalizedUrl
      );
    }

    // 5. DNS resolution safety check on destination
    try {
      await DnsSafetyGuard.resolveAndVerify(nextValidated.hostname);
    } catch (err) {
      throw new ScannerException(
        'REDIRECT_BLOCKED',
        'Redirect destination domain resolved to a blocked private/internal network address.',
        err instanceof Error ? err.message : String(err),
        nextValidated.normalizedUrl
      );
    }

    // Record hop
    this.chain.push({
      requestedUrl: currentUrl,
      destinationUrl: nextValidated.normalizedUrl,
      statusCode,
    });
    this.visitedUrls.add(nextValidated.normalizedUrl);

    return nextValidated;
  }

  public getChain(): RawRedirectHop[] {
    return [...this.chain];
  }
}
