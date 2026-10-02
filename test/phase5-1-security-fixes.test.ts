/**
 * PHASE 5.1 FOCUSED REGRESSION TEST SUITE:
 * 1. DNS Rebinding / TOCTOU Protection
 * 2. X-Forwarded-For Rate-Limit Spoofing Protection
 * 3. Client Disconnect / Scan Cancellation
 * 4. URL Userinfo Stripping
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { UrlValidator } from '../src/scanner/url-validator';
import { SecurityGuard } from '../src/scanner/security-guard';
import { DnsSafetyGuard, VerifiedDnsResult } from '../src/scanner/dns-safety';
import { SafeFetcher } from '../src/scanner/fetcher';
import { BoundedCrawler } from '../src/scanner/crawler';
import { ResourceAnalyzer } from '../src/scanner/resource-analyzer';
import { MemoryRateLimiter } from '../src/scanner/rate-limiter';
import { getClientIp } from '../server';

describe('Phase 5.1 — Fix 1: DNS Rebinding / TOCTOU Protection', () => {
  it('pins Undici connection to pre-verified public IP and rejects private IPs', (t, done) => {
    const verifiedPublicDns: VerifiedDnsResult = {
      hostname: 'example.com',
      resolvedIps: ['93.184.216.34'],
      primaryIp: '93.184.216.34',
    };

    const lookup = DnsSafetyGuard.createPinnedLookup(verifiedPublicDns);

    // Should return the pinned public IP when Undici queries DNS
    lookup('example.com', { all: true }, (err, records) => {
      assert.ifError(err);
      assert.ok(Array.isArray(records));
      assert.equal(records[0].address, '93.184.216.34');
      assert.equal(records[0].family, 4);

      // Single lookup format
      lookup('example.com', {}, (errSingle, addr, fam) => {
        assert.ifError(errSingle);
        assert.equal(addr, '93.184.216.34');
        assert.equal(fam, 4);
        done();
      });
    });
  });

  it('rejects connection if resolved IP attempts rebinding to private or loopback range', (t, done) => {
    // Simulated malicious DNS rebinding result
    const maliciousReboundDns: VerifiedDnsResult = {
      hostname: 'rebind.attacker.invalid',
      resolvedIps: ['127.0.0.1'],
      primaryIp: '127.0.0.1',
    };

    const lookup = DnsSafetyGuard.createPinnedLookup(maliciousReboundDns);

    lookup('rebind.attacker.invalid', { all: true }, (err) => {
      assert.ok(err, 'Lookup must return error when IP is private');
      assert.match(err.message, /localhost|loopback|forbidden|private/i);
      done();
    });
  });

  it('handles IPv6 public addresses correctly in pinned lookup', (t, done) => {
    const verifiedIpv6Dns: VerifiedDnsResult = {
      hostname: 'ipv6.example.com',
      resolvedIps: ['2606:4700:10::ac42:93f3'],
      primaryIp: '2606:4700:10::ac42:93f3',
    };

    const lookup = DnsSafetyGuard.createPinnedLookup(verifiedIpv6Dns);

    lookup('ipv6.example.com', { all: true }, (err, records) => {
      assert.ifError(err);
      assert.equal(records[0].address, '2606:4700:10::ac42:93f3');
      assert.equal(records[0].family, 6);
      done();
    });
  });
});

describe('Phase 5.1 — Fix 2: X-Forwarded-For Rate-Limit Spoofing Protection', () => {
  const originalTrustProxy = process.env.TRUST_PROXY;

  afterEach(() => {
    if (originalTrustProxy !== undefined) {
      process.env.TRUST_PROXY = originalTrustProxy;
    } else {
      delete process.env.TRUST_PROXY;
    }
  });

  it('uses socket remoteAddress by default and ignores spoofed X-Forwarded-For', () => {
    delete process.env.TRUST_PROXY;

    const mockReq = {
      headers: {
        'x-forwarded-for': '203.0.113.199, 198.51.100.1',
      },
      socket: {
        remoteAddress: '198.51.100.50',
      },
    } as any;

    const clientIp = getClientIp(mockReq);
    assert.equal(clientIp, '198.51.100.50', 'Must use direct peer address when trust proxy is off');
  });

  it('normalizes IPv4-mapped IPv6 socket addresses', () => {
    delete process.env.TRUST_PROXY;

    const mockReq = {
      headers: {},
      socket: {
        remoteAddress: '::ffff:198.51.100.77',
      },
    } as any;

    const clientIp = getClientIp(mockReq);
    assert.equal(clientIp, '198.51.100.77', 'Must strip ::ffff: prefix');
  });

  it('spoofed X-Forwarded-For headers from the same client IP do not bypass rate limiting', () => {
    delete process.env.TRUST_PROXY;

    const limiter = new MemoryRateLimiter({
      maxConcurrentScans: 5,
      maxScansPerWindow: 3,
      windowMs: 60000,
    });

    const realSocketIp = '198.51.100.99';

    // Simulate 3 requests with different spoofed X-Forwarded-For headers from the same socket
    for (let i = 1; i <= 3; i++) {
      const req = {
        headers: { 'x-forwarded-for': `1.2.3.${i}` },
        socket: { remoteAddress: realSocketIp },
      } as any;
      const ip = getClientIp(req);
      assert.equal(ip, realSocketIp);
      const release = limiter.acquire(ip);
      release();
    }

    // 4th request from the same socket with another spoofed header must be rejected
    const fourthReq = {
      headers: { 'x-forwarded-for': '9.9.9.9' },
      socket: { remoteAddress: realSocketIp },
    } as any;
    const fourthIp = getClientIp(fourthReq);
    assert.throws(
      () => limiter.acquire(fourthIp),
      /rate limit exceeded/i,
      'Must reject 4th scan from same client despite rotating X-Forwarded-For'
    );
  });

  it('trusts X-Forwarded-For when TRUST_PROXY is explicitly enabled', () => {
    process.env.TRUST_PROXY = 'true';

    const mockReq = {
      headers: {
        'x-forwarded-for': '203.0.113.88, 10.0.0.1',
      },
      socket: {
        remoteAddress: '10.0.0.1',
      },
    } as any;

    const clientIp = getClientIp(mockReq);
    assert.equal(clientIp, '203.0.113.88', 'Must use forwarded IP when TRUST_PROXY is active');
  });
});

describe('MemoryRateLimiter expired client history cleanup', () => {
  it('cleans multiple expired clients while retaining active rate limits', (t) => {
    let now = 1000;
    t.mock.method(Date, 'now', () => now);
    const limiter = new MemoryRateLimiter({
      maxConcurrentScans: 1,
      maxScansPerWindow: 2,
      windowMs: 100,
    });

    for (const clientKey of ['expired-a', 'expired-b']) {
      const release = limiter.acquire(clientKey);
      release();
    }

    now = 1040;
    for (let i = 0; i < 2; i++) {
      const release = limiter.acquire('active');
      release();
    }

    now = 1101;
    const freshRelease = limiter.acquire('fresh');
    freshRelease();
    assert.equal(limiter.getStats().trackedClients, 2);
    assert.throws(
      () => limiter.acquire('active'),
      /rate limit exceeded/i,
      'The active client remains limited because both requests are inside the window'
    );
    assert.equal(limiter.getStats().trackedClients, 2);
  });
});

describe('Phase 5.1 — Fix 3: Client Disconnect / Scan Cancellation', () => {
  it('SafeFetcher.fetch immediately aborts when abortSignal is triggered', async () => {
    const controller = new AbortController();
    controller.abort(); // Pre-aborted

    await assert.rejects(
      async () => {
        await SafeFetcher.fetch('https://example.com/', {
          abortSignal: controller.signal,
        });
      },
      (err: any) => {
        return (
          err.code === 'REQUEST_FAILED' ||
          err.code === 'CONNECTION_TIMEOUT' ||
          /aborted|cancelled/i.test(err.message)
        );
      }
    );
  });

  it('BoundedCrawler stops immediately when abortSignal is aborted', async () => {
    const crawler = new BoundedCrawler('https://example.com/');
    crawler.enqueue(
      ['https://example.com/p1', 'https://example.com/p2', 'https://example.com/p3'],
      1,
      'test'
    );

    const controller = new AbortController();
    controller.abort(); // Trigger abort

    const result = await crawler.crawl([], 0, undefined, controller.signal);
    // Should stop without processing the queue
    assert.equal(result.pages.length, 0, 'Crawler must halt when abortSignal is triggered');
    assert.equal(result.requestsMade, 0, 'No requests should be made when aborted');
  });

  it('ResourceAnalyzer stops immediately when abortSignal is aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const resources = [
      { url: 'https://example.com/style.css', type: 'css' as const, isInternal: true },
      { url: 'https://example.com/script.js', type: 'javascript' as const, isInternal: true },
    ];

    const result = await ResourceAnalyzer.analyzeResources(
      resources,
      0,
      undefined,
      150,
      controller.signal
    );

    assert.equal(result.requestsMade, 0, 'No requests should be made when aborted');
    assert.equal(result.resources.length, 0, 'No resources analyzed when aborted');
  });
});

describe('Phase 5.1 — Fix 4: URL Userinfo Stripping', () => {
  it('strips username-only userinfo during URL validation', () => {
    const res = UrlValidator.validate('https://admin@example.com/dashboard');
    assert.equal(res.normalizedUrl, 'https://example.com/dashboard');
    assert.ok(!res.normalizedUrl.includes('admin@'));
    assert.equal(res.parsed.username, '');
    assert.equal(res.parsed.password, '');
  });

  it('strips username and password userinfo during URL validation', () => {
    const res = UrlValidator.validate('https://username:secretPassword123@example.com/app');
    assert.equal(res.normalizedUrl, 'https://example.com/app');
    assert.ok(!res.normalizedUrl.includes('secretPassword123'));
    assert.ok(!res.normalizedUrl.includes('username:'));
    assert.equal(res.parsed.username, '');
    assert.equal(res.parsed.password, '');
  });

  it('strips percent-encoded userinfo', () => {
    const res = UrlValidator.validate('https://user%3A1:p%40ssword@example.com/path?query=val');
    assert.equal(res.normalizedUrl, 'https://example.com/path?query=val');
    assert.ok(!res.normalizedUrl.includes('user%3A1'));
    assert.ok(!res.normalizedUrl.includes('p%40ssword'));
    assert.equal(res.parsed.username, '');
    assert.equal(res.parsed.password, '');
  });

  it('preserves normal URLs without userinfo intact', () => {
    const res = UrlValidator.validate('https://example.com/normal-page?param=1');
    assert.equal(res.normalizedUrl, 'https://example.com/normal-page?param=1');
    assert.equal(res.hostname, 'example.com');
  });

  it('strips userinfo combined with non-default allowed port, path, and query', () => {
    const res = UrlValidator.validate('http://operator:token@example.com:80/status?v=2');
    assert.equal(res.normalizedUrl, 'http://example.com/status?v=2');
    assert.ok(!res.normalizedUrl.includes('operator'));
    assert.ok(!res.normalizedUrl.includes('token'));
  });

  it('strips userinfo during relative and absolute link normalization', () => {
    const resolved = UrlValidator.resolveAndNormalizeLink(
      'https://user:pass@example.com/subpage',
      'https://example.com/'
    );
    assert.equal(resolved, 'https://example.com/subpage');
    assert.ok(!resolved?.includes('user:pass'));
  });
});
