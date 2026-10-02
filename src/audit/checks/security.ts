/**
 * Security Headers Audit Checks (Category F)
 */

import { ScanResult } from '../../scanner/types';
import { AuditCheck, AuditFinding } from '../types';
import { createFinding } from '../utils';

export const securityChecks: AuditCheck[] = [
  // 1. Strict-Transport-Security (HSTS)
  {
    id: 'sec-hsts-missing',
    name: 'Strict-Transport-Security (HSTS)',
    category: 'security',
    description: 'Checks for the Strict-Transport-Security HTTP header on HTTPS websites.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const home = scan.pages[0];
      if (!home) return [];

      const isHttps = home.http.finalUrl.startsWith('https://');
      if (!isHttps) {
        return [
          createFinding({
            checkId: 'sec-hsts-missing',
            category: 'security',
            severity: 'passed',
            evidence: {
              summary: 'Strict-Transport-Security is only applicable to HTTPS websites; site was scanned over HTTP.',
              urls: [home.url],
              affectedCount: 0,
            },
          }),
        ];
      }

      const hsts = home.http.securityHeaders.strictTransportSecurity;
      if (!hsts) {
        return [
          createFinding({
            checkId: 'sec-hsts-missing',
            category: 'security',
            severity: 'important',
            evidence: {
              summary: 'Strict-Transport-Security (HSTS) header is missing on HTTPS responses.',
              urls: [home.url],
              affectedCount: 1,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'sec-hsts-missing',
          category: 'security',
          severity: 'passed',
          evidence: {
            summary: `HSTS header present (${hsts}).`,
            urls: [home.url],
            affectedCount: 0,
            technicalData: { strictTransportSecurity: hsts },
          },
        }),
      ];
    },
  },

  // 2. Content-Security-Policy (CSP)
  {
    id: 'sec-content-security-policy',
    name: 'Content-Security-Policy (CSP)',
    category: 'security',
    description: 'Checks whether a Content-Security-Policy header is configured.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const home = scan.pages[0];
      if (!home) return [];

      const csp = home.http.securityHeaders.contentSecurityPolicy;
      if (!csp) {
        return [
          createFinding({
            checkId: 'sec-content-security-policy',
            category: 'security',
            severity: 'important',
            evidence: {
              summary: 'No Content-Security-Policy (CSP) header detected on the website.',
              urls: [home.url],
              affectedCount: 1,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'sec-content-security-policy',
          category: 'security',
          severity: 'passed',
          evidence: {
            summary: 'Content-Security-Policy header is configured.',
            urls: [home.url],
            affectedCount: 0,
            technicalData: { contentSecurityPolicy: csp },
          },
        }),
      ];
    },
  },

  // 3. X-Content-Type-Options
  {
    id: 'sec-x-content-type-options',
    name: 'X-Content-Type-Options Header',
    category: 'security',
    description: 'Checks for "X-Content-Type-Options: nosniff" to prevent MIME sniffing.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const home = scan.pages[0];
      if (!home) return [];

      const val = (home.http.securityHeaders.xContentTypeOptions || '').toLowerCase();
      if (!val.includes('nosniff')) {
        return [
          createFinding({
            checkId: 'sec-x-content-type-options',
            category: 'security',
            severity: 'improvement',
            evidence: {
              summary: 'X-Content-Type-Options header is missing or not set to "nosniff".',
              urls: [home.url],
              affectedCount: 1,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'sec-x-content-type-options',
          category: 'security',
          severity: 'passed',
          evidence: {
            summary: 'X-Content-Type-Options: nosniff is properly configured.',
            urls: [home.url],
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 4. Clickjacking Frame Protection
  {
    id: 'sec-frame-protection',
    name: 'Clickjacking Frame Protection',
    category: 'security',
    description: 'Checks for X-Frame-Options or CSP frame-ancestors to prevent clickjacking.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const home = scan.pages[0];
      if (!home) return [];

      const xfo = home.http.securityHeaders.xFrameOptions;
      const csp = (home.http.securityHeaders.contentSecurityPolicy || '').toLowerCase();
      const hasFrameAncestors = csp.includes('frame-ancestors');

      if (!xfo && !hasFrameAncestors) {
        return [
          createFinding({
            checkId: 'sec-frame-protection',
            category: 'security',
            severity: 'important',
            evidence: {
              summary: 'No framing restriction headers (X-Frame-Options or CSP frame-ancestors) detected.',
              urls: [home.url],
              affectedCount: 1,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'sec-frame-protection',
          category: 'security',
          severity: 'passed',
          evidence: {
            summary: `Frame protection configured (${xfo ? `X-Frame-Options: ${xfo}` : 'CSP frame-ancestors'}).`,
            urls: [home.url],
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 5. Referrer-Policy
  {
    id: 'sec-referrer-policy',
    name: 'Referrer-Policy Header',
    category: 'security',
    description: 'Checks whether a Referrer-Policy header controls referrer leakage.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const home = scan.pages[0];
      if (!home) return [];

      const ref = home.http.securityHeaders.referrerPolicy;
      if (!ref) {
        return [
          createFinding({
            checkId: 'sec-referrer-policy',
            category: 'security',
            severity: 'improvement',
            evidence: {
              summary: 'Referrer-Policy header is missing on server responses.',
              urls: [home.url],
              affectedCount: 1,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'sec-referrer-policy',
          category: 'security',
          severity: 'passed',
          evidence: {
            summary: `Referrer-Policy header present (${ref}).`,
            urls: [home.url],
            affectedCount: 0,
            technicalData: { referrerPolicy: ref },
          },
        }),
      ];
    },
  },

  // 6. Permissions-Policy
  {
    id: 'sec-permissions-policy',
    name: 'Permissions-Policy Header',
    category: 'security',
    description: 'Checks for the Permissions-Policy header restricting sensitive browser features.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const home = scan.pages[0];
      if (!home) return [];

      const perm = home.http.securityHeaders.permissionsPolicy;
      if (!perm) {
        return [
          createFinding({
            checkId: 'sec-permissions-policy',
            category: 'security',
            severity: 'improvement',
            evidence: {
              summary: 'Permissions-Policy header is missing.',
              urls: [home.url],
              affectedCount: 1,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'sec-permissions-policy',
          category: 'security',
          severity: 'passed',
          evidence: {
            summary: 'Permissions-Policy header is configured.',
            urls: [home.url],
            affectedCount: 0,
          },
        }),
      ];
    },
  },
];
