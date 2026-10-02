/**
 * Master Registry of All Audit Checks (Phase 3)
 */

import { AuditCheck, UnsupportedCheck } from '../types';
import { technicalChecks } from './technical';
import { crawlabilityChecks } from './crawlability';
import { seoChecks } from './seo';
import { assetChecks } from './assets';
import { performanceChecks } from './performance';
import { securityChecks } from './security';
import { accessibilityChecks } from './accessibility';
import { optionalChecks } from './optional';

export const ALL_AUDIT_CHECKS: AuditCheck[] = [
  ...technicalChecks,
  ...crawlabilityChecks,
  ...seoChecks,
  ...assetChecks,
  ...performanceChecks,
  ...securityChecks,
  ...accessibilityChecks,
  ...optionalChecks,
];

export const UNSUPPORTED_CHECKS: UnsupportedCheck[] = [
  {
    id: 'tech-ssl-cert-validity',
    name: 'SSL/TLS Certificate Validity & Expiration',
    category: 'technical',
    reason:
      'Not evaluated because the current Node HTTP/fetch scanner abstraction does not expose internal TLS certificate chain fields (expiration date, issuer, SANs).',
  },
  {
    id: 'crawl-external-links-deep',
    name: 'External Outbound Link Deep Crawling',
    category: 'crawlability',
    reason:
      'Not evaluated by design: crawling is strictly bounded to the target same-site domain to prevent SSRF vulnerabilities and runaway requests.',
  },
  {
    id: 'perf-core-web-vitals',
    name: 'Browser Core Web Vitals (LCP, INP, CLS)',
    category: 'performance',
    reason:
      'Not evaluated because the scanner is a secure, high-speed HTTP streaming engine rather than a headless browser rendering engine.',
  },
];
