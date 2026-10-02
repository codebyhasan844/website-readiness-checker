/**
 * SEO Audit Checks (Category C)
 */

import { ScanResult } from '../../scanner/types';
import { AuditCheck, AuditFinding } from '../types';
import { createFinding } from '../utils';

export const seoChecks: AuditCheck[] = [
  // 1. Missing title
  {
    id: 'seo-missing-title',
    name: 'Page Title Element',
    category: 'seo',
    description: 'Verifies the presence of a <title> tag on each HTML page.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const missingTitlePages = scan.pages.filter(
        (p) => !p.document.title && p.http.statusCode === 200
      );

      if (missingTitlePages.length > 0) {
        return [
          createFinding({
            checkId: 'seo-missing-title',
            category: 'seo',
            severity: 'critical',
            evidence: {
              summary: `${missingTitlePages.length} page(s) are missing a <title> tag.`,
              urls: missingTitlePages.map((p) => p.url),
              affectedCount: missingTitlePages.length,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'seo-missing-title',
          category: 'seo',
          severity: 'passed',
          evidence: {
            summary: 'All indexable pages contain a <title> tag.',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 2. Empty title
  {
    id: 'seo-empty-title',
    name: 'Empty Page Title',
    category: 'seo',
    description: 'Checks for title tags that are blank or whitespace-only.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const emptyTitlePages = scan.pages.filter(
        (p) => p.document.title !== undefined && p.document.title.trim() === ''
      );

      if (emptyTitlePages.length > 0) {
        return [
          createFinding({
            checkId: 'seo-empty-title',
            category: 'seo',
            severity: 'critical',
            evidence: {
              summary: `${emptyTitlePages.length} page(s) have an empty or whitespace-only title tag.`,
              urls: emptyTitlePages.map((p) => p.url),
              affectedCount: emptyTitlePages.length,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'seo-empty-title',
          category: 'seo',
          severity: 'passed',
          evidence: {
            summary: 'All detected page titles contain non-empty text content.',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 3. Duplicate titles
  {
    id: 'seo-duplicate-titles',
    name: 'Duplicate Page Titles',
    category: 'seo',
    description: 'Finds multiple distinct pages sharing identical title tags.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const titleMap = new Map<string, string[]>();
      for (const p of scan.pages) {
        if (p.document.title && p.document.title.trim()) {
          const t = p.document.title.trim();
          const list = titleMap.get(t) || [];
          list.push(p.url);
          titleMap.set(t, list);
        }
      }

      const duplicates: { title: string; urls: string[] }[] = [];
      for (const [title, urls] of titleMap.entries()) {
        if (urls.length > 1) {
          duplicates.push({ title, urls });
        }
      }

      if (duplicates.length > 0) {
        const affectedPages = duplicates.reduce((acc, d) => acc + d.urls.length, 0);
        return [
          createFinding({
            checkId: 'seo-duplicate-titles',
            category: 'seo',
            severity: 'important',
            evidence: {
              summary: `Found ${duplicates.length} duplicate title group(s) across ${affectedPages} pages.`,
              details: `Duplicate: "${duplicates[0].title}" shared by ${duplicates[0].urls.length} pages`,
              urls: duplicates.flatMap((d) => d.urls),
              affectedCount: affectedPages,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'seo-duplicate-titles',
          category: 'seo',
          severity: 'passed',
          evidence: {
            summary: 'All crawled pages feature unique titles.',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 4. Title length
  {
    id: 'seo-title-length',
    name: 'Page Title Length',
    category: 'seo',
    description: 'Checks whether titles fall within recommended display lengths (30 - 65 characters).',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const tooLong = scan.pages.filter(
        (p) => p.document.title && p.document.title.trim().length > 65
      );
      const tooShort = scan.pages.filter(
        (p) => p.document.title && p.document.title.trim().length > 0 && p.document.title.trim().length < 30
      );

      if (tooLong.length > 0 || tooShort.length > 0) {
        return [
          createFinding({
            checkId: 'seo-title-length',
            category: 'seo',
            severity: 'improvement',
            evidence: {
              summary: `${tooLong.length} title(s) exceed 65 characters; ${tooShort.length} title(s) under 30 characters.`,
              details: tooLong[0]
                ? `Long title: "${tooLong[0].document.title}" (${tooLong[0].document.title?.length} chars on ${tooLong[0].url})`
                : `Short title: "${tooShort[0]?.document.title}" (${tooShort[0]?.document.title?.length} chars)`,
              urls: [...tooLong.map((p) => p.url), ...tooShort.map((p) => p.url)],
              affectedCount: tooLong.length + tooShort.length,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'seo-title-length',
          category: 'seo',
          severity: 'passed',
          evidence: {
            summary: 'Page titles meet optimal length recommendations (30-65 characters).',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 5. Missing meta description
  {
    id: 'seo-missing-description',
    name: 'Meta Description Presence',
    category: 'seo',
    description: 'Checks for the presence of a <meta name="description"> tag.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const missing = scan.pages.filter(
        (p) => !p.document.metaDescription && p.http.statusCode === 200
      );

      if (missing.length > 0) {
        return [
          createFinding({
            checkId: 'seo-missing-description',
            category: 'seo',
            severity: 'important',
            evidence: {
              summary: `${missing.length} page(s) lack a meta description tag.`,
              urls: missing.map((p) => p.url),
              affectedCount: missing.length,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'seo-missing-description',
          category: 'seo',
          severity: 'passed',
          evidence: {
            summary: 'All indexable pages contain a meta description tag.',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 6. Empty meta description
  {
    id: 'seo-empty-description',
    name: 'Empty Meta Description',
    category: 'seo',
    description: 'Flags meta descriptions that exist but have blank content.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const empty = scan.pages.filter(
        (p) => p.document.metaDescription !== undefined && p.document.metaDescription.trim() === ''
      );

      if (empty.length > 0) {
        return [
          createFinding({
            checkId: 'seo-empty-description',
            category: 'seo',
            severity: 'important',
            evidence: {
              summary: `${empty.length} page(s) declare an empty meta description.`,
              urls: empty.map((p) => p.url),
              affectedCount: empty.length,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'seo-empty-description',
          category: 'seo',
          severity: 'passed',
          evidence: {
            summary: 'No empty or blank meta descriptions found.',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 7. Duplicate meta descriptions
  {
    id: 'seo-duplicate-descriptions',
    name: 'Duplicate Meta Descriptions',
    category: 'seo',
    description: 'Detects multiple pages sharing identical meta descriptions.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const descMap = new Map<string, string[]>();
      for (const p of scan.pages) {
        if (p.document.metaDescription && p.document.metaDescription.trim()) {
          const d = p.document.metaDescription.trim();
          const list = descMap.get(d) || [];
          list.push(p.url);
          descMap.set(d, list);
        }
      }

      const dupes = Array.from(descMap.entries()).filter(([, urls]) => urls.length > 1);

      if (dupes.length > 0) {
        const totalAffected = dupes.reduce((acc, [, urls]) => acc + urls.length, 0);
        return [
          createFinding({
            checkId: 'seo-duplicate-descriptions',
            category: 'seo',
            severity: 'important',
            evidence: {
              summary: `Found ${dupes.length} duplicate meta description(s) across ${totalAffected} pages.`,
              details: `Duplicate: "${dupes[0][0].slice(0, 80)}..." on ${dupes[0][1].length} pages`,
              urls: dupes.flatMap(([, urls]) => urls),
              affectedCount: totalAffected,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'seo-duplicate-descriptions',
          category: 'seo',
          severity: 'passed',
          evidence: {
            summary: 'All crawled pages contain distinct meta descriptions.',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 8. Meta description length
  {
    id: 'seo-description-length',
    name: 'Meta Description Length',
    category: 'seo',
    description: 'Evaluates whether meta descriptions fit standard limits (70 - 160 characters).',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const tooLong = scan.pages.filter(
        (p) => p.document.metaDescription && p.document.metaDescription.trim().length > 160
      );
      const tooShort = scan.pages.filter(
        (p) =>
          p.document.metaDescription &&
          p.document.metaDescription.trim().length > 0 &&
          p.document.metaDescription.trim().length < 70
      );

      if (tooLong.length > 0 || tooShort.length > 0) {
        return [
          createFinding({
            checkId: 'seo-description-length',
            category: 'seo',
            severity: 'improvement',
            evidence: {
              summary: `${tooLong.length} description(s) exceed 160 characters; ${tooShort.length} description(s) under 70 characters.`,
              details: tooLong[0]
                ? `Longest: ${tooLong[0].document.metaDescription?.length} characters on ${tooLong[0].url}`
                : `Shortest: ${tooShort[0]?.document.metaDescription?.length} characters on ${tooShort[0]?.url}`,
              urls: [...tooLong.map((p) => p.url), ...tooShort.map((p) => p.url)],
              affectedCount: tooLong.length + tooShort.length,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'seo-description-length',
          category: 'seo',
          severity: 'passed',
          evidence: {
            summary: 'Meta descriptions fall within recommended length ranges (70-160 characters).',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 9. Missing H1
  {
    id: 'seo-missing-h1',
    name: 'Primary Heading (H1) Presence',
    category: 'seo',
    description: 'Checks if the page contains at least one <h1> heading.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const missingH1 = scan.pages.filter((p) => p.headings.h1Count === 0 && p.http.statusCode === 200);

      if (missingH1.length > 0) {
        return [
          createFinding({
            checkId: 'seo-missing-h1',
            category: 'seo',
            severity: 'important',
            evidence: {
              summary: `${missingH1.length} page(s) do not contain an <h1> heading.`,
              urls: missingH1.map((p) => p.url),
              affectedCount: missingH1.length,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'seo-missing-h1',
          category: 'seo',
          severity: 'passed',
          evidence: {
            summary: 'All scanned pages contain an <h1> primary heading.',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 10. Multiple H1
  {
    id: 'seo-multiple-h1',
    name: 'Multiple H1 Headings',
    category: 'seo',
    description: 'Flags pages containing more than one <h1> heading.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const multipleH1 = scan.pages.filter((p) => p.headings.h1Count > 1);

      if (multipleH1.length > 0) {
        return [
          createFinding({
            checkId: 'seo-multiple-h1',
            category: 'seo',
            severity: 'improvement',
            evidence: {
              summary: `${multipleH1.length} page(s) contain multiple <h1> headings.`,
              details: `Example: ${multipleH1[0].url} has ${multipleH1[0].headings.h1Count} H1 elements.`,
              urls: multipleH1.map((p) => p.url),
              affectedCount: multipleH1.length,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'seo-multiple-h1',
          category: 'seo',
          severity: 'passed',
          evidence: {
            summary: 'Pages cleanly use exactly one <h1> heading for main page title.',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 11. Heading hierarchy issues
  {
    id: 'seo-heading-hierarchy',
    name: 'Heading Level Hierarchy',
    category: 'seo',
    description: 'Checks for heading levels that skip steps (e.g. H1 directly to H3 or H4).',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const skippedHierarchyPages: { url: string; jump: string }[] = [];

      for (const page of scan.pages) {
        let prevLevel = 0;
        for (const item of page.headings.items) {
          if (prevLevel > 0 && item.level > prevLevel + 1) {
            skippedHierarchyPages.push({
              url: page.url,
              jump: `H${prevLevel} jumped to H${item.level}`,
            });
            break;
          }
          prevLevel = item.level;
        }
      }

      if (skippedHierarchyPages.length > 0) {
        return [
          createFinding({
            checkId: 'seo-heading-hierarchy',
            category: 'seo',
            severity: 'improvement',
            evidence: {
              summary: `${skippedHierarchyPages.length} page(s) skip heading levels in the document outline.`,
              details: `Example on ${skippedHierarchyPages[0].url}: ${skippedHierarchyPages[0].jump}`,
              urls: skippedHierarchyPages.map((s) => s.url),
              affectedCount: skippedHierarchyPages.length,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'seo-heading-hierarchy',
          category: 'seo',
          severity: 'passed',
          evidence: {
            summary: 'Heading levels progress sequentially without skipped levels.',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 12. Missing canonical
  {
    id: 'seo-missing-canonical',
    name: 'Canonical URL Tag',
    category: 'seo',
    description: 'Checks for the presence of a <link rel="canonical"> tag.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const missingCanonical = scan.pages.filter(
        (p) => !p.document.canonicalUrl && p.http.statusCode === 200
      );

      if (missingCanonical.length > 0) {
        return [
          createFinding({
            checkId: 'seo-missing-canonical',
            category: 'seo',
            severity: 'important',
            evidence: {
              summary: `${missingCanonical.length} page(s) lack a declared canonical URL tag.`,
              urls: missingCanonical.map((p) => p.url),
              affectedCount: missingCanonical.length,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'seo-missing-canonical',
          category: 'seo',
          severity: 'passed',
          evidence: {
            summary: 'All crawled indexable pages declare a canonical URL tag.',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 13. Invalid canonical
  {
    id: 'seo-invalid-canonical',
    name: 'Canonical URL Validity',
    category: 'seo',
    description: 'Validates that canonical tags specify valid HTTP/S URLs (absolute or resolvable relative).',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const invalidCanonicals: { url: string; canonical: string }[] = [];

      for (const p of scan.pages) {
        if (p.document.canonicalUrl) {
          const raw = p.document.canonicalUrl.trim();
          if (!raw) {
            invalidCanonicals.push({ url: p.url, canonical: '(empty string)' });
            continue;
          }
          try {
            // Resolve relative canonical URLs against the page URL per RFC 6596
            const parsed = new URL(raw, p.url);
            if (!['http:', 'https:'].includes(parsed.protocol)) {
              invalidCanonicals.push({ url: p.url, canonical: raw });
            }
          } catch {
            invalidCanonicals.push({ url: p.url, canonical: raw });
          }
        }
      }

      if (invalidCanonicals.length > 0) {
        return [
          createFinding({
            checkId: 'seo-invalid-canonical',
            category: 'seo',
            severity: 'critical',
            evidence: {
              summary: `${invalidCanonicals.length} page(s) feature malformed or unresolvable canonical URLs.`,
              details: `Invalid canonical tag: "${invalidCanonicals[0].canonical}" on ${invalidCanonicals[0].url}`,
              urls: invalidCanonicals.map((i) => i.url),
              affectedCount: invalidCanonicals.length,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'seo-invalid-canonical',
          category: 'seo',
          severity: 'passed',
          evidence: {
            summary: 'All declared canonical tags contain valid, resolvable HTTP/S URLs.',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 14. Canonical protocol / domain alignment
  {
    id: 'seo-canonical-mismatch',
    name: 'Canonical Protocol / Domain Alignment',
    category: 'seo',
    description: 'Checks whether canonical tags match the actual HTTPS protocol of the page.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const mismatches: { url: string; canonical: string }[] = [];

      for (const p of scan.pages) {
        if (p.document.canonicalUrl && p.url.startsWith('https://')) {
          try {
            const resolved = new URL(p.document.canonicalUrl.trim(), p.url);
            if (resolved.protocol === 'http:') {
              mismatches.push({ url: p.url, canonical: p.document.canonicalUrl });
            }
          } catch {
            // Handled in seo-invalid-canonical
          }
        }
      }

      if (mismatches.length > 0) {
        return [
          createFinding({
            checkId: 'seo-canonical-mismatch',
            category: 'seo',
            severity: 'important',
            evidence: {
              summary: `${mismatches.length} HTTPS page(s) declare an insecure http:// canonical URL.`,
              details: `Example: ${mismatches[0].url} declares ${mismatches[0].canonical}`,
              urls: mismatches.map((m) => m.url),
              affectedCount: mismatches.length,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'seo-canonical-mismatch',
          category: 'seo',
          severity: 'passed',
          evidence: {
            summary: 'Canonical protocol aligns with current HTTPS domain configuration.',
            affectedCount: 0,
          },
        }),
      ];
    },
  },
];
