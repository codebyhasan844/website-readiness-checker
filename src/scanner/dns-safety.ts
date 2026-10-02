/**
 * DNS Safety & Rebinding Guard (Phase 2)
 *
 * Resolves hostnames via Node's DNS resolver and verifies every resolved IP
 * against the SecurityGuard before initiating any outbound network connections.
 */

import dns from 'node:dns/promises';
import net from 'node:net';
import { SecurityGuard } from './security-guard';
import { ScannerException } from './errors';

export interface VerifiedDnsResult {
  hostname: string;
  resolvedIps: string[];
  primaryIp: string;
}

export class DnsSafetyGuard {
  /**
   * Resolves a hostname and asserts that all returned IP records point to
   * legitimate, publicly routable Internet destinations.
   *
   * Throws ScannerException(DNS_FAILURE) if resolution fails.
   * Throws ScannerException(BLOCKED_DESTINATION) if any resolved IP is internal/private.
   */
  public static async resolveAndVerify(hostname: string): Promise<VerifiedDnsResult> {
    // If hostname is already an IP literal, validate directly
    if (SecurityGuard.isDirectIpLiteral(hostname)) {
      const normalizedIp = SecurityGuard.normalizeIp(hostname);
      SecurityGuard.validateIpAddress(normalizedIp);
      return {
        hostname,
        resolvedIps: [normalizedIp],
        primaryIp: normalizedIp,
      };
    }

    let records: Array<{ address: string; family: number }>;
    try {
      records = await dns.lookup(hostname, { all: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new ScannerException(
        'DNS_FAILURE',
        `Could not resolve domain name "${hostname}". Please verify domain is registered and active.`,
        msg,
        hostname
      );
    }

    if (!records || records.length === 0) {
      throw new ScannerException(
        'DNS_FAILURE',
        `No DNS address records found for "${hostname}".`,
        'Empty DNS lookup records array',
        hostname
      );
    }

    const verifiedIps: string[] = [];

    // Verify EVERY resolved address against SSRF rules to prevent DNS rebinding attacks
    for (const record of records) {
      SecurityGuard.validateIpAddress(record.address);
      verifiedIps.push(record.address);
    }

    return {
      hostname,
      resolvedIps: verifiedIps,
      primaryIp: verifiedIps[0],
    };
  }

  /**
   * Creates a pinned DNS lookup function for Undici Agent.
   * Ensures that network connections strictly use pre-verified, publicly routable IP addresses
   * and blocks any subsequent attempts to resolve or connect to private/internal IPs (DNS rebinding / TOCTOU).
   */
  public static createPinnedLookup(dnsResult: VerifiedDnsResult): (
    hostname: string,
    options: any,
    callback: (err: Error | null, addressOrRecords?: any, family?: number) => void
  ) => void {
    return (hostname, options, callback) => {
      try {
        // Enforce SSRF validation on every address returned
        for (const ip of dnsResult.resolvedIps) {
          SecurityGuard.validateIpAddress(ip);
        }

        const records = dnsResult.resolvedIps.map((ip) => ({
          address: ip,
          family: net.isIP(ip) || 4,
        }));

        if (options && options.all) {
          callback(null, records);
        } else {
          const primary = records[0];
          callback(null, primary.address, primary.family);
        }
      } catch (err: unknown) {
        callback(err instanceof Error ? err : new Error(String(err)));
      }
    };
  }
}
