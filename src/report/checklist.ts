/**
 * Launch Checklist Generator (Phase 4)
 *
 * Dynamically builds the "Before You Launch" QA checklist based purely on
 * actual findings evaluated during the scan.
 *
 * Strictly NO generic fake tasks: every item reflects verified findings or clean passes.
 */

import { AuditFinding, AuditResult } from '../audit/types';
import { LaunchChecklistItem } from './types';

export function generateLaunchChecklist(
  audit: AuditResult
): LaunchChecklistItem[] {
  const items: LaunchChecklistItem[] = [];

  // Group findings by category/purpose
  const criticalFindings = audit.findings.filter((f) => f.severity === 'critical');
  const importantFindings = audit.findings.filter((f) => f.severity === 'important');

  // 1. Critical Launch Blockers Check
  if (criticalFindings.length > 0) {
    items.push({
      id: 'chk-critical-blockers',
      title: `Resolve ${criticalFindings.length} Critical Launch Blocker${criticalFindings.length > 1 ? 's' : ''}`,
      category: 'technical',
      severity: 'critical',
      status: 'pending',
      recommendation: `Fix high-impact blockers immediately: ${criticalFindings.map((c) => c.title).slice(0, 2).join(', ')}${criticalFindings.length > 2 ? '...' : ''}`,
      affectedCount: criticalFindings.length,
    });
  }

  // 2. Indexability & Crawlability (Robots / Sitemap / Meta Robots)
  const crawlIssues = audit.findings.filter(
    (f) =>
      (f.category === 'crawlability' || f.category === 'technical') &&
      (f.checkId.includes('robots') || f.checkId.includes('sitemap') || f.checkId.includes('noindex')) &&
      (f.severity === 'critical' || f.severity === 'important')
  );
  if (crawlIssues.length > 0) {
    items.push({
      id: 'chk-indexing-alignment',
      title: 'Verify Search Indexing & Sitemap Alignment',
      category: 'crawlability',
      severity: crawlIssues[0].severity,
      status: 'pending',
      recommendation: crawlIssues[0].recommendation,
      affectedCount: crawlIssues.length,
    });
  } else {
    items.push({
      id: 'chk-indexing-alignment',
      title: 'Search Indexing & Crawl Directives Verified',
      category: 'crawlability',
      severity: 'passed',
      status: 'resolved',
      recommendation: 'Robots.txt and sitemap directives are accessible and indexable.',
      affectedCount: 0,
    });
  }

  // 3. Broken Links & Redirects
  const linkIssues = audit.findings.filter(
    (f) =>
      (f.checkId.includes('broken-internal-links') || f.checkId.includes('redirect-chains')) &&
      (f.severity === 'critical' || f.severity === 'important')
  );
  if (linkIssues.length > 0) {
    items.push({
      id: 'chk-link-integrity',
      title: 'Audit & Repair Internal Links & Redirect Hops',
      category: 'crawlability',
      severity: linkIssues[0].severity,
      status: 'pending',
      recommendation: linkIssues[0].recommendation,
      affectedCount: linkIssues.reduce((sum, f) => sum + (f.evidence.affectedCount || 1), 0),
    });
  } else {
    items.push({
      id: 'chk-link-integrity',
      title: 'Internal Navigation & Link Integrity Verified',
      category: 'crawlability',
      severity: 'passed',
      status: 'resolved',
      recommendation: 'Zero broken internal links or redirect loops detected.',
      affectedCount: 0,
    });
  }

  // 4. Primary SEO Signals (Title, H1, Meta Description, Canonicals)
  const seoIssues = audit.findings.filter(
    (f) =>
      f.category === 'seo' &&
      (f.severity === 'critical' || f.severity === 'important')
  );
  if (seoIssues.length > 0) {
    items.push({
      id: 'chk-seo-basics',
      title: `Correct ${seoIssues.length} Core On-Page SEO Element${seoIssues.length > 1 ? 's' : ''}`,
      category: 'seo',
      severity: seoIssues[0].severity,
      status: 'pending',
      recommendation: seoIssues[0].recommendation,
      affectedCount: seoIssues.length,
    });
  } else {
    items.push({
      id: 'chk-seo-basics',
      title: 'Core Meta Tags & Document Hierarchy in Place',
      category: 'seo',
      severity: 'passed',
      status: 'resolved',
      recommendation: 'Document titles, descriptions, H1 headings, and canonicals conform to standards.',
      affectedCount: 0,
    });
  }

  // 5. Security Headers & Protocol Protection
  const secIssues = audit.findings.filter(
    (f) =>
      (f.category === 'security' || f.checkId.includes('https')) &&
      (f.severity === 'critical' || f.severity === 'important')
  );
  if (secIssues.length > 0) {
    items.push({
      id: 'chk-security-headers',
      title: 'Review HTTP Security & Encryption Headers',
      category: 'security',
      severity: secIssues[0].severity,
      status: 'pending',
      recommendation: secIssues[0].recommendation,
      affectedCount: secIssues.length,
    });
  } else {
    items.push({
      id: 'chk-security-headers',
      title: 'HTTPS & Security Headers Configured',
      category: 'security',
      severity: 'passed',
      status: 'resolved',
      recommendation: 'HTTPS is active and baseline protective security headers are declared.',
      affectedCount: 0,
    });
  }

  // 6. Mobile & Accessibility Essentials
  const a11yIssues = audit.findings.filter(
    (f) =>
      f.category === 'accessibility' &&
      (f.severity === 'critical' || f.severity === 'important')
  );
  if (a11yIssues.length > 0) {
    items.push({
      id: 'chk-mobile-a11y',
      title: 'Address Essential Mobile Viewport & Accessibility Signals',
      category: 'accessibility',
      severity: a11yIssues[0].severity,
      status: 'pending',
      recommendation: a11yIssues[0].recommendation,
      affectedCount: a11yIssues.length,
    });
  } else {
    items.push({
      id: 'chk-mobile-a11y',
      title: 'Mobile Viewport & Screen Reader Baselines Validated',
      category: 'accessibility',
      severity: 'passed',
      status: 'resolved',
      recommendation: 'Mobile viewport, document language, and input labeling standards are met.',
      affectedCount: 0,
    });
  }

  // 7. Verification Re-scan
  items.push({
    id: 'chk-rescan-verification',
    title: 'Run Final Pre-Launch Verification Re-scan',
    category: 'technical',
    severity: 'improvement',
    status: audit.readiness === 'READY' ? 'resolved' : 'pending',
    recommendation: 'Re-scan after deploying changes to verify all items pass in production.',
    affectedCount: 0,
  });

  return items;
}
