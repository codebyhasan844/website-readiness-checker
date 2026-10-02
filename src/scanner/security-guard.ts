/**
 * SSRF & Network Security Guard (Phase 2)
 *
 * Enforces strict SSRF protection, IP range boundaries, port policies, and destination safety.
 * Protects against loopback, private ranges, cloud metadata, link-local, multicast,
 * alternate IP encodings, and dangerous ports.
 */

import net from 'node:net';
import { SCANNER_LIMITS } from './limits';
import { ScannerException } from './errors';

export class SecurityGuard {
  private static readonly BLOCKED_HOSTNAMES = new Set([
    'localhost',
    'metadata.google.internal',
    'metadata.google',
    'metadata',
    'instance-data',
    '169.254.169.254',
  ]);

  private static readonly BLOCKED_HOSTNAME_SUFFIXES = [
    '.localhost',
    '.local',
    '.internal',
    '.lan',
    '.home',
    '.corp',
    '.invalid',
    '.test',
  ];

  /**
   * Validates a hostname and port before DNS resolution.
   * Throws ScannerException(BLOCKED_DESTINATION) on violation.
   */
  public static validateHostAndPort(hostname: string, port: number): void {
    const lowerHost = (hostname || '').toLowerCase().trim();

    // 1. Port check
    if (!SCANNER_LIMITS.allowedPorts.includes(port)) {
      throw new ScannerException(
        'BLOCKED_DESTINATION',
        `Port ${port} is not permitted. Only ports 80 (HTTP) and 443 (HTTPS) are allowed.`,
        `Blocked port: ${port}`,
        hostname
      );
    }

    // 2. Exact blocked hostnames
    if (this.BLOCKED_HOSTNAMES.has(lowerHost)) {
      throw new ScannerException(
        'BLOCKED_DESTINATION',
        'The requested destination is a restricted or private internal address.',
        `Blocked hostname: ${lowerHost}`,
        hostname
      );
    }

    // 3. Blocked suffixes (.local, .internal, etc.)
    for (const suffix of this.BLOCKED_HOSTNAME_SUFFIXES) {
      if (lowerHost.endsWith(suffix)) {
        throw new ScannerException(
          'BLOCKED_DESTINATION',
          'Internal, local, and private domains cannot be scanned.',
          `Blocked domain suffix: ${suffix}`,
          hostname
        );
      }
    }

    // 4. Check if hostname is an IP literal or alternative IP representation
    if (this.isDirectIpLiteral(lowerHost)) {
      this.validateIpAddress(lowerHost);
    }
  }

  /**
   * Checks whether a string is a standard or alternate IP literal (e.g. numeric DWORD, hex, dotted quad).
   */
  public static isDirectIpLiteral(host: string): boolean {
    if (net.isIP(host)) return true;

    // Decimal integer IP (e.g. 2130706433 for 127.0.0.1)
    if (/^\d+$/.test(host)) return true;

    // Hex IP (e.g. 0x7f000001)
    if (/^0x[0-9a-f]+$/i.test(host)) return true;

    // Octal IP components (e.g. 0177.0.0.1)
    if (/^0[0-7]+(\.0[0-7]+)*$/.test(host)) return true;

    return false;
  }

  /**
   * Parses an IP string or alternate representation into standard dotted-decimal or IPv6 format.
   */
  public static normalizeIp(rawIp: string): string {
    const trimmed = rawIp.trim().toLowerCase();

    // Standard decimal integer (e.g. 2130706433)
    if (/^\d+$/.test(trimmed)) {
      const num = parseInt(trimmed, 10);
      if (num >= 0 && num <= 0xffffffff) {
        return [
          (num >>> 24) & 255,
          (num >>> 16) & 255,
          (num >>> 8) & 255,
          num & 255,
        ].join('.');
      }
    }

    // Hex integer (e.g. 0x7f000001)
    if (/^0x[0-9a-f]+$/i.test(trimmed)) {
      const num = parseInt(trimmed, 16);
      if (num >= 0 && num <= 0xffffffff) {
        return [
          (num >>> 24) & 255,
          (num >>> 16) & 255,
          (num >>> 8) & 255,
          num & 255,
        ].join('.');
      }
    }

    return trimmed;
  }

  /**
   * Validates that an IP address (IPv4 or IPv6) is a publicly routable, safe address.
   * Throws ScannerException(BLOCKED_DESTINATION) if the IP is private, loopback,
   * link-local, multicast, or reserved.
   */
  public static validateIpAddress(rawIp: string): void {
    const ip = this.normalizeIp(rawIp);
    const ipVersion = net.isIP(ip);

    if (ipVersion === 0) {
      // If it failed standard IP check after normalization, reject as invalid destination
      throw new ScannerException(
        'BLOCKED_DESTINATION',
        'Invalid or unroutable IP address destination.',
        `Failed net.isIP validation: ${rawIp}`
      );
    }

    if (ipVersion === 4) {
      this.validateIPv4(ip);
    } else if (ipVersion === 6) {
      this.validateIPv6(ip);
    }
  }

  /**
   * Validates IPv4 against SSRF blocklist ranges.
   */
  public static validateIPv4(ip: string): void {
    const parts = ip.split('.').map((p) => parseInt(p, 10));
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      throw new ScannerException('BLOCKED_DESTINATION', 'Malformed IPv4 address.');
    }

    const [b0, b1, b2, b3] = parts;

    // 0.0.0.0/8 (Current network / default route)
    if (b0 === 0) {
      throw new ScannerException('BLOCKED_DESTINATION', 'Access to current network (0.0.0.0/8) is forbidden.');
    }

    // 127.0.0.0/8 (Loopback)
    if (b0 === 127) {
      throw new ScannerException('BLOCKED_DESTINATION', 'Access to localhost/loopback addresses is forbidden.');
    }

    // 10.0.0.0/8 (Private RFC 1918)
    if (b0 === 10) {
      throw new ScannerException('BLOCKED_DESTINATION', 'Access to private network (10.0.0.0/8) is forbidden.');
    }

    // 172.16.0.0/12 (Private RFC 1918: 172.16.0.0 - 172.31.255.255)
    if (b0 === 172 && b1 >= 16 && b1 <= 31) {
      throw new ScannerException('BLOCKED_DESTINATION', 'Access to private network (172.16.0.0/12) is forbidden.');
    }

    // 192.168.0.0/16 (Private RFC 1918)
    if (b0 === 192 && b1 === 168) {
      throw new ScannerException('BLOCKED_DESTINATION', 'Access to private network (192.168.0.0/16) is forbidden.');
    }

    // 198.18.0.0/15 (Benchmarking)
    if (b0 === 198 && (b1 === 18 || b1 === 19)) {
      throw new ScannerException('BLOCKED_DESTINATION', 'Access to benchmarking network (198.18.0.0/15) is forbidden.');
    }

    // 169.254.0.0/16 (Link-Local / Cloud Metadata endpoint 169.254.169.254)
    if (b0 === 169 && b1 === 254) {
      throw new ScannerException('BLOCKED_DESTINATION', 'Access to link-local / cloud metadata (169.254.0.0/16) is forbidden.');
    }

    // 100.64.0.0/10 (Carrier-Grade NAT: 100.64.0.0 - 100.127.255.255)
    if (b0 === 100 && b1 >= 64 && b1 <= 127) {
      throw new ScannerException('BLOCKED_DESTINATION', 'Access to shared / carrier-grade NAT space is forbidden.');
    }

    // 192.0.0.0/24 (IETF Protocol Assignments)
    if (b0 === 192 && b1 === 0 && b2 === 0) {
      throw new ScannerException('BLOCKED_DESTINATION', 'Access to IETF protocol assignment block is forbidden.');
    }

    // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (TEST-NET-1, TEST-NET-2, TEST-NET-3)
    if (
      (b0 === 192 && b1 === 0 && b2 === 2) ||
      (b0 === 198 && b1 === 51 && b2 === 100) ||
      (b0 === 203 && b1 === 0 && b2 === 113)
    ) {
      throw new ScannerException('BLOCKED_DESTINATION', 'Access to documentation test networks is forbidden.');
    }

    // 224.0.0.0/4 (Multicast 224.0.0.0 - 239.255.255.255)
    if (b0 >= 224 && b0 <= 239) {
      throw new ScannerException('BLOCKED_DESTINATION', 'Access to multicast addresses is forbidden.');
    }

    // 240.0.0.0/4 (Reserved / Future use)
    if (b0 >= 240) {
      throw new ScannerException('BLOCKED_DESTINATION', 'Access to reserved network space is forbidden.');
    }

    // 255.255.255.255 (Broadcast)
    if (b0 === 255 && b1 === 255 && b2 === 255 && b3 === 255) {
      throw new ScannerException('BLOCKED_DESTINATION', 'Access to broadcast address is forbidden.');
    }
  }

  /**
   * Validates IPv6 against SSRF blocklist ranges.
   */
  public static validateIPv6(ip: string): void {
    const lower = ip.toLowerCase();
    const words = this.expandIPv6Words(lower);
    const isLoopback = Boolean(
      words &&
      words.slice(0, 7).every((word) => word === 0) &&
      words[7] === 1
    );
    const isUnspecified = Boolean(words && words.every((word) => word === 0));

    // 1. Loopback (::1) and Unspecified (::)
    if (isLoopback || isUnspecified) {
      throw new ScannerException('BLOCKED_DESTINATION', 'Access to IPv6 loopback / unspecified address is forbidden.');
    }

    // 2. IPv4-mapped IPv6: apply IPv4 policy to dotted and hexadecimal forms.
    if (
      words &&
      words.slice(0, 5).every((word) => word === 0) &&
      words[5] === 0xffff
    ) {
      const high = words[6];
      const low = words[7];
      const ipv4Part = [
        high >> 8,
        high & 0xff,
        low >> 8,
        low & 0xff,
      ].join('.');
      this.validateIPv4(ipv4Part);
      return;
    }

    // 3. IPv4-compatible IPv6: apply the same policy to its embedded IPv4 value.
    if (words && words.slice(0, 6).every((word) => word === 0)) {
      const high = words[6];
      const low = words[7];
      const ipv4Part = [
        high >> 8,
        high & 0xff,
        low >> 8,
        low & 0xff,
      ].join('.');
      this.validateIPv4(ipv4Part);
      return;
    }

    // 4. Unique Local Address (fc00::/7 -> fc00:: to fdff::)
    if (lower.startsWith('fc') || lower.startsWith('fd')) {
      throw new ScannerException('BLOCKED_DESTINATION', 'Access to unique local IPv6 range (fc00::/7) is forbidden.');
    }

    // 5. Link-Local Unicast (fe80::/10 -> fe80:: to febf::)
    if (
      lower.startsWith('fe8') ||
      lower.startsWith('fe9') ||
      lower.startsWith('fea') ||
      lower.startsWith('feb')
    ) {
      throw new ScannerException('BLOCKED_DESTINATION', 'Access to link-local IPv6 range (fe80::/10) is forbidden.');
    }

    // 6. Deprecated site-local unicast (fec0::/10)
    if (words && (words[0] & 0xffc0) === 0xfec0) {
      throw new ScannerException('BLOCKED_DESTINATION', 'Access to deprecated site-local IPv6 range (fec0::/10) is forbidden.');
    }

    // 7. Multicast (ff00::/8)
    if (lower.startsWith('ff')) {
      throw new ScannerException('BLOCKED_DESTINATION', 'Access to multicast IPv6 range (ff00::/8) is forbidden.');
    }

    // 8. Documentation (2001:db8::/32)
    if (lower.startsWith('2001:db8:') || lower.startsWith('2001:0db8:')) {
      throw new ScannerException('BLOCKED_DESTINATION', 'Access to documentation IPv6 range is forbidden.');
    }
  }

  private static expandIPv6Words(ip: string): number[] | null {
    let address = ip;
    if (address.includes('.')) {
      const lastColon = address.lastIndexOf(':');
      const ipv4Part = address.slice(lastColon + 1);
      if (!net.isIPv4(ipv4Part)) return null;
      const octets = ipv4Part.split('.').map(Number);
      const ipv4Words = [
        ((octets[0] << 8) | octets[1]).toString(16),
        ((octets[2] << 8) | octets[3]).toString(16),
      ];
      address = `${address.slice(0, lastColon + 1)}${ipv4Words.join(':')}`;
    }

    const compressionIndex = address.indexOf('::');
    let words: string[];
    if (compressionIndex >= 0) {
      const left = address.slice(0, compressionIndex).split(':').filter(Boolean);
      const right = address.slice(compressionIndex + 2).split(':').filter(Boolean);
      const zeroCount = 8 - left.length - right.length;
      if (zeroCount < 1) return null;
      words = [...left, ...Array(zeroCount).fill('0'), ...right];
    } else {
      words = address.split(':');
    }

    if (words.length !== 8 || words.some((word) => !/^[\da-f]{1,4}$/.test(word))) {
      return null;
    }
    return words.map((word) => parseInt(word, 16));
  }
}
