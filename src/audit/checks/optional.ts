/**
 * Optional Signals Audit Checks
 */

import { ScanResult } from '../../scanner/types';
import { AuditCheck, AuditFinding } from '../types';
import { createFinding } from '../utils';

export const optionalChecks: AuditCheck[] = [
  // 1. Favicon detection
  {
    id: 'opt-favicon',
    name: 'Favicon Icon Presence',
    category: 'seo',
    description: 'Checks for a declared favicon link tag in the document <head>.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const home = scan.pages[0];
      if (!home) return [];

      if (!home.document.hasFavicon) {
        return [
          createFinding({
            checkId: 'opt-favicon',
            category: 'seo',
            severity: 'improvement',
            evidence: {
              summary: 'No declared favicon icon (<link rel="icon">) detected on the homepage.',
              urls: [home.url],
              affectedCount: 1,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'opt-favicon',
          category: 'seo',
          severity: 'passed',
          evidence: {
            summary: 'Favicon icon tag is properly configured.',
            urls: [home.url],
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 2. Open Graph Social Metadata
  {
    id: 'opt-open-graph',
    name: 'Open Graph Social Metadata',
    category: 'seo',
    description: 'Checks for standard social sharing tags (og:title, og:image).',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const home = scan.pages[0];
      if (!home) return [];

      const og = home.document.openGraph || {};
      const hasTitle = Boolean(og['og:title']);
      const hasImage = Boolean(og['og:image']);

      if (!hasTitle || !hasImage) {
        return [
          createFinding({
            checkId: 'opt-open-graph',
            category: 'seo',
            severity: 'improvement',
            evidence: {
              summary: `Homepage is missing key Open Graph tags (${!hasTitle ? 'og:title' : ''}${!hasTitle && !hasImage ? ', ' : ''}${!hasImage ? 'og:image' : ''}).`,
              urls: [home.url],
              affectedCount: 1,
              technicalData: { detectedOgTags: Object.keys(og) },
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'opt-open-graph',
          category: 'seo',
          severity: 'passed',
          evidence: {
            summary: 'Open Graph social preview tags are configured.',
            urls: [home.url],
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 3. Structured data (Schema.org / JSON-LD)
  {
    id: 'opt-structured-data',
    name: 'Structured Data (Schema.org / JSON-LD)',
    category: 'seo',
    description: 'Detects JSON-LD structured data scripts declaring organizational or page metadata.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const home = scan.pages[0];
      if (!home) return [];

      if (!home.document.hasStructuredData) {
        return [
          createFinding({
            checkId: 'opt-structured-data',
            category: 'seo',
            severity: 'improvement',
            evidence: {
              summary: 'No JSON-LD structured data (<script type="application/ld+json">) found on the homepage.',
              urls: [home.url],
              affectedCount: 1,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'opt-structured-data',
          category: 'seo',
          severity: 'passed',
          evidence: {
            summary: 'JSON-LD structured data is present on the homepage.',
            urls: [home.url],
            affectedCount: 0,
          },
        }),
      ];
    },
  },
];
