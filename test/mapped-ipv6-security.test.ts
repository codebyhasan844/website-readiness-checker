import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DnsSafetyGuard, VerifiedDnsResult } from '../src/scanner/dns-safety';
import { SecurityGuard } from '../src/scanner/security-guard';

describe('IPv4-mapped IPv6 security validation', () => {
  it('blocks hexadecimal mapped IPv4 loopback and private ranges', () => {
    for (const address of [
      '::ffff:7f00:1',
      '::ffff:c0a8:101',
      '0:0:0:0:0:ffff:c0a8:0101',
      '0000:0000:0000:0000:0000:ffff:c0a8:0101',
      '0000:0000:0000:0000:0000:0000:0000:0001',
    ]) {
      assert.throws(
        () => SecurityGuard.validateIpAddress(address),
        (error: { code?: string }) => error.code === 'BLOCKED_DESTINATION',
        `${address} must receive the existing embedded IPv4 range checks`
      );
    }
  });

  it('allows public mapped IPv4 addresses consistently in dotted and hexadecimal forms', () => {
    assert.doesNotThrow(() => SecurityGuard.validateIpAddress('::ffff:8.8.8.8'));
    assert.doesNotThrow(() => SecurityGuard.validateIpAddress('::ffff:808:808'));
    assert.doesNotThrow(() =>
      SecurityGuard.validateIpAddress('0:0:0:0:0:ffff:0808:0808')
    );
  });

  it('applies IPv4 destination policy to IPv4-compatible IPv6 addresses', () => {
    for (const address of [
      '::7f00:1',
      '::c0a8:101',
      '0:0:0:0:0:0:c0a8:0101',
      '::ffff:0:0',
    ]) {
      assert.throws(
        () => SecurityGuard.validateIpAddress(address),
        (error: { code?: string }) => error.code === 'BLOCKED_DESTINATION',
        `${address} must not bypass the embedded IPv4 block policy`
      );
    }

    assert.doesNotThrow(() => SecurityGuard.validateIpAddress('::808:808'));
  });

  it('blocks the full deprecated IPv6 site-local range', () => {
    for (const address of ['fec0::1', 'fed0::1', 'feff::1']) {
      assert.throws(
        () => SecurityGuard.validateIpAddress(address),
        (error: { code?: string }) => error.code === 'BLOCKED_DESTINATION',
        `${address} must be blocked as site-local IPv6`
      );
    }
  });

  it('rejects blocked IPv6 encodings again through the pinned DNS lookup', async () => {
    for (const address of ['::ffff:c0a8:101', '::c0a8:101', 'fec0::1']) {
      const verifiedDns: VerifiedDnsResult = {
        hostname: 'blocked.attacker.invalid',
        resolvedIps: [address],
        primaryIp: address,
      };
      const lookup = DnsSafetyGuard.createPinnedLookup(verifiedDns);

      const error = await new Promise<Error | null>((resolve) => {
        lookup('blocked.attacker.invalid', { all: true }, (err) => resolve(err));
      });

      assert.ok(error && 'code' in error, `${address} must be rejected`);
      assert.equal(error.code, 'BLOCKED_DESTINATION');
    }
  });
});
