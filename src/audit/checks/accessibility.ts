/**
 * Accessibility & Mobile Audit Checks (Category G)
 */

import { ScanResult } from '../../scanner/types';
import { AuditCheck, AuditFinding } from '../types';
import { createFinding } from '../utils';

export const accessibilityChecks: AuditCheck[] = [
  // 1. Missing mobile viewport
  {
    id: 'a11y-missing-viewport',
    name: 'Mobile Viewport Meta Tag',
    category: 'accessibility',
    description: 'Verifies the presence of a responsive viewport meta tag.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const missingViewportPages = scan.pages.filter(
        (p) => !p.document.viewport && p.http.statusCode === 200
      );

      if (missingViewportPages.length > 0) {
        return [
          createFinding({
            checkId: 'a11y-missing-viewport',
            category: 'accessibility',
            severity: 'critical',
            evidence: {
              summary: `${missingViewportPages.length} page(s) lack a mobile viewport meta tag.`,
              urls: missingViewportPages.map((p) => p.url),
              affectedCount: missingViewportPages.length,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'a11y-missing-viewport',
          category: 'accessibility',
          severity: 'passed',
          evidence: {
            summary: 'All scanned pages declare a responsive viewport tag.',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 2. Missing language attribute
  {
    id: 'a11y-missing-language',
    name: 'HTML Language Attribute',
    category: 'accessibility',
    description: 'Checks if the <html> tag declares a valid lang attribute.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const missingLangPages = scan.pages.filter(
        (p) => !p.document.language && p.http.statusCode === 200
      );

      if (missingLangPages.length > 0) {
        return [
          createFinding({
            checkId: 'a11y-missing-language',
            category: 'accessibility',
            severity: 'important',
            evidence: {
              summary: `${missingLangPages.length} page(s) do not declare a lang attribute on the <html> tag.`,
              urls: missingLangPages.map((p) => p.url),
              affectedCount: missingLangPages.length,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'a11y-missing-language',
          category: 'accessibility',
          severity: 'passed',
          evidence: {
            summary: 'All indexable pages specify a document language (e.g., lang="en").',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 3. Duplicate IDs
  {
    id: 'a11y-duplicate-ids',
    name: 'Duplicate HTML ID Attributes',
    category: 'accessibility',
    description: 'Scans for repeated id attributes across elements on the same page.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const pagesWithDupes = scan.pages.filter(
        (p) => p.document.duplicateIds && p.document.duplicateIds.length > 0
      );

      if (pagesWithDupes.length > 0) {
        const totalDupes = pagesWithDupes.reduce(
          (acc, p) => acc + (p.document.duplicateIds?.length || 0),
          0
        );
        return [
          createFinding({
            checkId: 'a11y-duplicate-ids',
            category: 'accessibility',
            severity: 'important',
            evidence: {
              summary: `Found ${totalDupes} duplicate id attribute(s) across ${pagesWithDupes.length} page(s).`,
              details: `Duplicate IDs on ${pagesWithDupes[0].url}: ${pagesWithDupes[0].document.duplicateIds?.slice(0, 3).join(', ')}`,
              urls: pagesWithDupes.map((p) => p.url),
              affectedCount: pagesWithDupes.length,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'a11y-duplicate-ids',
          category: 'accessibility',
          severity: 'passed',
          evidence: {
            summary: 'All scanned elements use unique ID attributes.',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 4. Accessible form control labels
  {
    id: 'a11y-unlabeled-form-controls',
    name: 'Accessible Form Control Labels',
    category: 'accessibility',
    description: 'Checks for form inputs and textareas that lack accessible labels.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const pagesWithUnlabeled = scan.pages.filter(
        (p) => p.document.unlabeledFormControls && p.document.unlabeledFormControls > 0
      );

      if (pagesWithUnlabeled.length > 0) {
        const totalUnlabeled = pagesWithUnlabeled.reduce(
          (acc, p) => acc + (p.document.unlabeledFormControls || 0),
          0
        );
        return [
          createFinding({
            checkId: 'a11y-unlabeled-form-controls',
            category: 'accessibility',
            severity: 'important',
            evidence: {
              summary: `Found ${totalUnlabeled} form control(s) without accessible labels across ${pagesWithUnlabeled.length} page(s).`,
              details: `Example: ${pagesWithUnlabeled[0].url} has ${pagesWithUnlabeled[0].document.unlabeledFormControls} unlabeled input(s).`,
              urls: pagesWithUnlabeled.map((p) => p.url),
              affectedCount: totalUnlabeled,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'a11y-unlabeled-form-controls',
          category: 'accessibility',
          severity: 'passed',
          evidence: {
            summary: 'Form controls are properly labeled for screen reader accessibility.',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 5. Missing iframe titles
  {
    id: 'a11y-missing-iframe-titles',
    name: 'Iframe Title Attributes',
    category: 'accessibility',
    description: 'Checks whether <iframe> elements include a title attribute.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const pagesWithMissingIframeTitles = scan.pages.filter(
        (p) => p.document.iframesWithoutTitle && p.document.iframesWithoutTitle > 0
      );

      if (pagesWithMissingIframeTitles.length > 0) {
        const totalMissing = pagesWithMissingIframeTitles.reduce(
          (acc, p) => acc + (p.document.iframesWithoutTitle || 0),
          0
        );
        return [
          createFinding({
            checkId: 'a11y-missing-iframe-titles',
            category: 'accessibility',
            severity: 'improvement',
            evidence: {
              summary: `Found ${totalMissing} embedded iframe(s) missing a descriptive title attribute.`,
              urls: pagesWithMissingIframeTitles.map((p) => p.url),
              affectedCount: totalMissing,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'a11y-missing-iframe-titles',
          category: 'accessibility',
          severity: 'passed',
          evidence: {
            summary: 'All embedded iframes provide descriptive title attributes.',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 6. Empty links and interactive controls
  {
    id: 'a11y-empty-links',
    name: 'Empty Links and Interactive Controls',
    category: 'accessibility',
    description: 'Identifies anchor links that contain no text, aria-label, or image alt.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const pagesWithEmptyLinks = scan.pages.filter(
        (p) => p.document.emptyLinksCount && p.document.emptyLinksCount > 0
      );

      if (pagesWithEmptyLinks.length > 0) {
        const totalEmpty = pagesWithEmptyLinks.reduce(
          (acc, p) => acc + (p.document.emptyLinksCount || 0),
          0
        );
        return [
          createFinding({
            checkId: 'a11y-empty-links',
            category: 'accessibility',
            severity: 'important',
            evidence: {
              summary: `Found ${totalEmpty} empty hyperlink(s) lacking readable text or aria-labels.`,
              details: `Example: ${pagesWithEmptyLinks[0].url} contains ${pagesWithEmptyLinks[0].document.emptyLinksCount} empty link(s).`,
              urls: pagesWithEmptyLinks.map((p) => p.url),
              affectedCount: totalEmpty,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'a11y-empty-links',
          category: 'accessibility',
          severity: 'passed',
          evidence: {
            summary: 'All interactive links feature accessible descriptive text or aria labels.',
            affectedCount: 0,
          },
        }),
      ];
    },
  },
];
