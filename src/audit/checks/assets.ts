/**
 * Assets & Images Audit Checks (Category D)
 */

import { ScanResult } from '../../scanner/types';
import { AuditCheck, AuditFinding } from '../types';
import { createFinding } from '../utils';

export const assetChecks: AuditCheck[] = [
  // 1. Broken referenced assets
  {
    id: 'asset-broken-resources',
    name: 'Broken Referenced Assets (CSS/JS/Fonts)',
    category: 'assets',
    description: 'Detects referenced CSS, JS, font, or iframe resources returning 4xx or 5xx.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const brokenResources: { pageUrl: string; assetUrl: string; status?: number; error?: string }[] = [];
      let skippedCount = 0;

      for (const p of scan.pages) {
        for (const res of p.resources) {
          if (res.isSkipped) {
            skippedCount++;
            continue;
          }
          if (res.error || (res.statusCode && res.statusCode >= 400)) {
            brokenResources.push({
              pageUrl: p.url,
              assetUrl: res.url,
              status: res.statusCode,
              error: res.error,
            });
          }
        }
      }

      if (brokenResources.length > 0) {
        return [
          createFinding({
            checkId: 'asset-broken-resources',
            category: 'assets',
            severity: 'critical',
            evidence: {
              summary: `${brokenResources.length} referenced resource(s) failed to load.`,
              details: `Failing asset: ${brokenResources[0].assetUrl} (${brokenResources[0].status || brokenResources[0].error})`,
              urls: Array.from(new Set(brokenResources.map((b) => b.pageUrl))),
              affectedCount: brokenResources.length,
              resources: brokenResources.map((b) => ({
                resourceUrl: b.assetUrl,
                referencedFrom: b.pageUrl,
                statusCode: b.status,
                statusText: b.error || (b.status ? `HTTP ${b.status}` : 'Resource Failed'),
              })),
            },
          }),
        ];
      }

      const note = skippedCount > 0 ? ` (${skippedCount} resource(s) skipped due to request budget limit)` : '';
      return [
        createFinding({
          checkId: 'asset-broken-resources',
          category: 'assets',
          severity: 'passed',
          evidence: {
            summary: `All sampled stylesheets, scripts, and fonts loaded successfully${note}.`,
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 2. Missing image alt attributes
  {
    id: 'asset-missing-alt',
    name: 'Image Alt Attributes',
    category: 'assets',
    description: 'Checks whether <img> elements include an alt attribute.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const missingAltImages: { pageUrl: string; src: string }[] = [];

      for (const p of scan.pages) {
        for (const img of p.images) {
          if (!img.hasAlt) {
            missingAltImages.push({ pageUrl: p.url, src: img.src });
          }
        }
      }

      if (missingAltImages.length > 0) {
        return [
          createFinding({
            checkId: 'asset-missing-alt',
            category: 'assets',
            severity: 'important',
            evidence: {
              summary: `Found ${missingAltImages.length} image(s) lacking an alt attribute.`,
              details: `Example: ${missingAltImages[0].src} (on ${missingAltImages[0].pageUrl})`,
              urls: Array.from(new Set(missingAltImages.map((m) => m.pageUrl))),
              affectedCount: missingAltImages.length,
              resources: missingAltImages.map((m) => ({
                resourceUrl: m.src,
                referencedFrom: m.pageUrl,
                statusText: 'Missing alt attribute',
              })),
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'asset-missing-alt',
          category: 'assets',
          severity: 'passed',
          evidence: {
            summary: 'All scanned images provide an alt attribute for accessibility.',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 3. Empty alt on informative images
  {
    id: 'asset-empty-alt',
    name: 'Empty Alt on Informative Images',
    category: 'assets',
    description: 'Checks for non-decorative images that have blank alt text.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const emptyAltImages: { pageUrl: string; src: string }[] = [];

      for (const p of scan.pages) {
        for (const img of p.images) {
          // If hasAlt is true but altText is blank, and image does not look like a 1x1 spacer/icon
          if (img.hasAlt && img.altText.trim() === '') {
            const isTiny = (img.width && parseInt(img.width, 10) <= 2) || (img.height && parseInt(img.height, 10) <= 2);
            if (!isTiny) {
              emptyAltImages.push({ pageUrl: p.url, src: img.src });
            }
          }
        }
      }

      if (emptyAltImages.length > 0) {
        return [
          createFinding({
            checkId: 'asset-empty-alt',
            category: 'assets',
            severity: 'improvement',
            evidence: {
              summary: `Found ${emptyAltImages.length} image(s) with empty alt="" text.`,
              details: `Review if images are decorative or informative: ${emptyAltImages[0].src}`,
              urls: Array.from(new Set(emptyAltImages.map((m) => m.pageUrl))),
              affectedCount: emptyAltImages.length,
              resources: emptyAltImages.map((m) => ({
                resourceUrl: m.src,
                referencedFrom: m.pageUrl,
                statusText: 'Empty alt text',
              })),
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'asset-empty-alt',
          category: 'assets',
          severity: 'passed',
          evidence: {
            summary: 'No empty alt attributes detected on informative images.',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 4. Oversized image file weights
  {
    id: 'asset-oversized-images',
    name: 'Oversized Image File Weights',
    category: 'assets',
    description: 'Identifies image assets that exceed 1 MB.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const oversized: { pageUrl: string; src: string; sizeBytes: number }[] = [];
      let sampledImagesCount = 0;

      for (const p of scan.pages) {
        for (const res of p.resources) {
          if (!res.isSkipped && res.type === 'image' && res.sizeBytes !== undefined) {
            sampledImagesCount++;
            if (res.sizeBytes > 1024 * 1024) {
              oversized.push({ pageUrl: p.url, src: res.url, sizeBytes: res.sizeBytes });
            }
          }
        }
      }

      if (oversized.length > 0) {
        return [
          createFinding({
            checkId: 'asset-oversized-images',
            category: 'assets',
            severity: 'important',
            evidence: {
              summary: `${oversized.length} image(s) exceed 1 MB in file weight.`,
              details: `Heaviest: ${oversized[0].src} (${Math.round(oversized[0].sizeBytes / 1024)} KB)`,
              urls: Array.from(new Set(oversized.map((o) => o.pageUrl))),
              affectedCount: oversized.length,
              resources: oversized.map((o) => ({
                resourceUrl: o.src,
                referencedFrom: o.pageUrl,
                statusText: `${Math.round(o.sizeBytes / 1024)} KB (> 1MB)`,
              })),
            },
          }),
        ];
      }

      if (sampledImagesCount > 0) {
        return [
          createFinding({
            checkId: 'asset-oversized-images',
            category: 'assets',
            severity: 'passed',
            evidence: {
              summary: `All ${sampledImagesCount} sampled image assets are under 1 MB file weight.`,
              affectedCount: 0,
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'asset-oversized-images',
          category: 'assets',
          severity: 'passed',
          evidence: {
            summary: 'No oversized image assets (> 1 MB) detected.',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 5. Insecure HTTP asset references
  {
    id: 'asset-http-mixed-content',
    name: 'Insecure HTTP Asset References',
    category: 'assets',
    description: 'Detects resources loaded over HTTP on an HTTPS page.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const mixedContent: { pageUrl: string; assetUrl: string }[] = [];

      for (const p of scan.pages) {
        if (p.url.startsWith('https://')) {
          for (const res of p.resources) {
            if (res.url.startsWith('http://')) {
              mixedContent.push({ pageUrl: p.url, assetUrl: res.url });
            }
          }
          for (const img of p.images) {
            if (img.src.startsWith('http://')) {
              mixedContent.push({ pageUrl: p.url, assetUrl: img.src });
            }
          }
        }
      }

      if (mixedContent.length > 0) {
        return [
          createFinding({
            checkId: 'asset-http-mixed-content',
            category: 'assets',
            severity: 'critical',
            evidence: {
              summary: `Detected ${mixedContent.length} insecure HTTP asset(s) loaded on HTTPS pages.`,
              details: `Mixed content asset: ${mixedContent[0].assetUrl} on ${mixedContent[0].pageUrl}`,
              urls: Array.from(new Set(mixedContent.map((m) => m.pageUrl))),
              affectedCount: mixedContent.length,
              resources: mixedContent.map((m) => ({
                resourceUrl: m.assetUrl,
                referencedFrom: m.pageUrl,
                statusText: 'Insecure HTTP asset on HTTPS page',
              })),
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'asset-http-mixed-content',
          category: 'assets',
          severity: 'passed',
          evidence: {
            summary: 'No insecure mixed HTTP content detected on HTTPS pages.',
            affectedCount: 0,
          },
        }),
      ];
    },
  },

  // 6. Missing explicit image dimensions
  {
    id: 'asset-missing-dimensions',
    name: 'Image Explicit Width and Height',
    category: 'assets',
    description: 'Checks whether <img> elements define width and height attributes.',
    evaluate: (scan: ScanResult): AuditFinding[] => {
      const missingDimensions: { pageUrl: string; src: string }[] = [];

      for (const p of scan.pages) {
        for (const img of p.images) {
          if (!img.width || !img.height) {
            missingDimensions.push({ pageUrl: p.url, src: img.src });
          }
        }
      }

      if (missingDimensions.length > 0) {
        return [
          createFinding({
            checkId: 'asset-missing-dimensions',
            category: 'assets',
            severity: 'improvement',
            evidence: {
              summary: `${missingDimensions.length} image(s) lack explicit width and height attributes.`,
              details: `Example: ${missingDimensions[0].src} on ${missingDimensions[0].pageUrl}`,
              urls: Array.from(new Set(missingDimensions.map((m) => m.pageUrl))),
              affectedCount: missingDimensions.length,
              resources: missingDimensions.map((m) => ({
                resourceUrl: m.src,
                referencedFrom: m.pageUrl,
                statusText: 'Missing width or height attribute',
              })),
            },
          }),
        ];
      }

      return [
        createFinding({
          checkId: 'asset-missing-dimensions',
          category: 'assets',
          severity: 'passed',
          evidence: {
            summary: 'Scanned images specify width and height dimensions to prevent layout shifts.',
            affectedCount: 0,
          },
        }),
      ];
    },
  },
];
