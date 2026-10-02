/**
 * Automated Test Suite for Phase 4 — Premium Report & User Experience
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildReportViewModel } from '../src/report/view-model';
import { selectFixFirstFindings } from '../src/report/fix-first';
import { generateLaunchChecklist } from '../src/report/checklist';
import { compareAuditResults } from '../src/report/comparison';
import { AuditResult, AuditFinding } from '../src/audit/types';
import { ScanResult } from '../src/scanner/types';
import { SCANNER_LIMITS } from '../src/scanner/limits';

function createMockAuditResult(overrides: Partial<AuditResult> = {}): AuditResult {
  return {
    scanId: 'scan-test-401',
    url: 'https://example.com/',
    readiness: 'REVIEW REQUIRED',
    readinessReason: 'Important security and on-page issues detected.',
    counts: {
      critical: 0,
      important: 2,
      improvement: 1,
      passed: 21,
      totalChecks: 24,
    },
    findings: [
      {
        id: 'f-sec-headers',
        checkId: 'security-headers',
        category: 'security',
        severity: 'important',
        title: 'Missing Essential Security Headers',
        evidence: {
          summary: 'Missing Content-Security-Policy and Permissions-Policy',
          affectedCount: 1,
          urls: ['https://example.com/'],
        },
        explanation: 'Leaves application exposed to clickjacking and script injection.',
        whyItMatters: 'Security headers provide defense-in-depth protection.',
        recommendation: 'Configure strict security headers.',
        confidence: 'high',
      },
      {
        id: 'f-meta-desc',
        checkId: 'seo-meta-description',
        category: 'seo',
        severity: 'important',
        title: 'Missing Meta Description',
        evidence: {
          summary: '5 pages missing description',
          affectedCount: 5,
          urls: [
            'https://example.com/about',
            'https://example.com/team',
            'https://example.com/pricing',
            'https://example.com/contact',
            'https://example.com/terms',
          ],
        },
        explanation: 'Search engines display auto-generated snippets.',
        whyItMatters: 'Reduces search click-through rate.',
        recommendation: 'Add unique meta descriptions.',
        confidence: 'high',
      },
      {
        id: 'f-img-dimensions',
        checkId: 'images-dimensions',
        category: 'assets',
        severity: 'improvement',
        title: 'Images Missing Explicit Dimensions',
        evidence: {
          summary: '2 images lack width/height',
          affectedCount: 2,
          urls: ['https://example.com/logo.png', 'https://example.com/hero.jpg'],
        },
        explanation: 'May cause Cumulative Layout Shift.',
        whyItMatters: 'Improves visual stability during page render.',
        recommendation: 'Add width and height attributes to <img> tags.',
        confidence: 'high',
      },
      {
        id: 'f-https-pass',
        checkId: 'https-enforcement',
        category: 'security',
        severity: 'passed',
        title: 'HTTPS Encryption Active',
        evidence: {
          summary: 'Connection secured over TLS with valid certificate',
        },
        explanation: 'Verified HTTPS protocol.',
        whyItMatters: 'Protects user data in transit.',
        recommendation: 'Maintain automatic certificate renewal.',
        confidence: 'high',
      },
    ],
    generatedAt: '2026-03-30T10:00:00.000Z',
    unsupportedChecks: [
      {
        id: 'unsupported-js-runtime',
        name: 'Client-Side JavaScript Runtime Exceptions',
        category: 'technical',
        reason: 'Requires full browser JavaScript engine.',
      },
    ],
    ...overrides,
  };
}

function createMockScanResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    scanId: 'scan-test-401',
    inputUrl: 'https://example.com/',
    normalizedUrl: 'https://example.com/',
    startedAt: '2026-03-30T09:59:58.000Z',
    completedAt: '2026-03-30T10:00:00.000Z',
    totalDurationMs: 2000,
    status: 'completed',
    summary: {
      pagesAttempted: 5,
      pagesCompleted: 5,
      requestsMade: 12,
      totalBytesTransferred: 420000,
      internalLinksDiscovered: 20,
      externalLinksDiscovered: 4,
    },
    pages: [],
    sitemaps: [],
    errors: [],
    limits: SCANNER_LIMITS,
    ...overrides,
  };
}

describe('Phase 4: Report View-Model Adapter', () => {
  it('correctly maps AuditResult and ScanResult into ReportViewModel without mutating audit facts', () => {
    const audit = createMockAuditResult();
    const scan = createMockScanResult();

    const vm = buildReportViewModel(audit, scan);

    assert.equal(vm.scanId, 'scan-test-401');
    assert.equal(vm.domain, 'example.com');
    assert.equal(vm.readiness, 'REVIEW REQUIRED');
    assert.equal(vm.counts.critical, 0);
    assert.equal(vm.counts.important, 2);
    assert.equal(vm.counts.improvement, 1);
    assert.equal(vm.counts.passed, 21);
    assert.equal(vm.metrics.totalChecksEvaluated, 24);
    assert.equal(vm.metrics.totalIssuesDetected, 3);
    assert.equal(vm.metrics.requestsMadeCount, 12);
    assert.equal(vm.metrics.totalBytesTransferred, 420000);
    assert.equal(vm.isPartial, false);
    assert.equal(vm.findings.length, 4);
    assert.equal(vm.findings[1].affectedUrls.length, 5);
  });

  it('correctly detects partial scan state and preserves diagnostic reason', () => {
    const audit = createMockAuditResult();
    const scan = createMockScanResult({
      status: 'partial',
      pages: [{} as any],
      errors: [
        {
          code: 'CONNECTION_TIMEOUT',
          message: 'Connection timed out on subpage /dashboard',
          targetUrl: 'https://example.com/dashboard',
          timestamp: '2026-03-30T10:00:00.000Z',
        },
      ],
    });

    const vm = buildReportViewModel(audit, scan);
    assert.equal(vm.isPartial, true);
    assert.match(vm.statusText, /Partial Scan/);
    assert.equal(vm.metrics.isPartialScan, true);
    assert.equal(vm.metrics.partialScanReason, 'Connection timed out on subpage /dashboard');
  });
});

describe('Phase 4: Deterministic Fix First Selector', () => {
  it('prioritizes critical over important and higher affected volume first', () => {
    const findings: AuditFinding[] = [
      {
        id: 'f-imp-small',
        checkId: 'check-imp-small',
        category: 'seo',
        severity: 'important',
        title: 'Important Issue Small Impact',
        evidence: { summary: '1 page affected', affectedCount: 1 },
        explanation: '',
        whyItMatters: '',
        recommendation: 'Fix it',
        confidence: 'high',
      },
      {
        id: 'f-crit-big',
        checkId: 'check-crit-big',
        category: 'technical',
        severity: 'critical',
        title: 'Critical Issue High Impact',
        evidence: { summary: '10 pages affected', affectedCount: 10 },
        explanation: '',
        whyItMatters: '',
        recommendation: 'Fix immediately',
        confidence: 'high',
      },
      {
        id: 'f-imp-big',
        checkId: 'check-imp-big',
        category: 'security',
        severity: 'important',
        title: 'Important Issue High Impact',
        evidence: { summary: '20 pages affected', affectedCount: 20 },
        explanation: '',
        whyItMatters: '',
        recommendation: 'Fix soon',
        confidence: 'high',
      },
      {
        id: 'f-passed',
        checkId: 'check-pass',
        category: 'seo',
        severity: 'passed',
        title: 'Passed Check',
        evidence: { summary: 'Passed' },
        explanation: '',
        whyItMatters: '',
        recommendation: '',
        confidence: 'high',
      },
    ];

    const fixFirst = selectFixFirstFindings(findings);

    // Passed checks must never appear in Fix First
    assert.equal(fixFirst.length, 3);
    // Rank 1 must be critical issue
    assert.equal(fixFirst[0].id, 'f-crit-big');
    assert.equal(fixFirst[0].rank, 1);
    // Rank 2 must be important with higher affected count (20 > 1)
    assert.equal(fixFirst[1].id, 'f-imp-big');
    assert.equal(fixFirst[1].rank, 2);
    // Rank 3 must be important with lower affected count
    assert.equal(fixFirst[2].id, 'f-imp-small');
    assert.equal(fixFirst[2].rank, 3);
  });

  it('uses stable deterministic tie-breaker when severities and counts match', () => {
    const findings: AuditFinding[] = [
      {
        id: 'f-b',
        checkId: 'check-b',
        category: 'seo',
        severity: 'important',
        title: 'Issue B',
        evidence: { summary: '1 page affected', affectedCount: 1 },
        explanation: '',
        whyItMatters: '',
        recommendation: 'Fix B',
        confidence: 'high',
      },
      {
        id: 'f-a',
        checkId: 'check-a',
        category: 'security',
        severity: 'important',
        title: 'Issue A',
        evidence: { summary: '1 page affected', affectedCount: 1 },
        explanation: '',
        whyItMatters: '',
        recommendation: 'Fix A',
        confidence: 'high',
      },
    ];

    const sorted = selectFixFirstFindings(findings);
    assert.equal(sorted[0].checkId, 'check-a');
    assert.equal(sorted[1].checkId, 'check-b');
  });
});

describe('Phase 4: Launch Checklist Generator', () => {
  it('generates dynamic items accurately reflecting scan findings', () => {
    const audit = createMockAuditResult();
    const checklist = generateLaunchChecklist(audit);

    assert(checklist.length >= 5);
    // Should have security review pending because of missing headers
    const secItem = checklist.find((c) => c.category === 'security');
    assert(secItem);
    assert.equal(secItem.status, 'pending');

    // Re-scan verification item should always be present
    const rescanItem = checklist.find((c) => c.id === 'chk-rescan-verification');
    assert(rescanItem);
  });

  it('marks items cleared when all checks in that category pass', () => {
    const audit = createMockAuditResult({
      readiness: 'READY',
      counts: { critical: 0, important: 0, improvement: 0, passed: 24, totalChecks: 24 },
      findings: [
        {
          id: 'f-https-pass',
          checkId: 'https-enforcement',
          category: 'security',
          severity: 'passed',
          title: 'HTTPS Active',
          evidence: { summary: 'OK' },
          explanation: '',
          whyItMatters: '',
          recommendation: '',
          confidence: 'high',
        },
      ],
    });

    const checklist = generateLaunchChecklist(audit);
    const secItem = checklist.find((c) => c.id === 'chk-security-headers');
    assert(secItem);
    assert.equal(secItem.status, 'resolved');
    assert.equal(secItem.severity, 'passed');
  });
});

describe('Phase 4: Deterministic Audit Comparison Engine', () => {
  it('classifies resolved, still-open, new, and changed findings accurately', () => {
    const previousAudit = createMockAuditResult({
      scanId: 'scan-prev-100',
      findings: [
        {
          id: 'p-1',
          checkId: 'check-broken-links',
          category: 'technical',
          severity: 'critical',
          title: 'Broken Internal Links',
          evidence: { summary: '3 broken links', affectedCount: 3 },
          explanation: '',
          whyItMatters: '',
          recommendation: '',
          confidence: 'high',
        },
        {
          id: 'p-2',
          checkId: 'check-tls',
          category: 'security',
          severity: 'important',
          title: 'Weak TLS',
          evidence: { summary: 'TLS 1.0 enabled', affectedCount: 1 },
          explanation: '',
          whyItMatters: '',
          recommendation: '',
          confidence: 'high',
        },
        {
          id: 'p-3',
          checkId: 'check-titles',
          category: 'seo',
          severity: 'important',
          title: 'Missing Titles',
          evidence: { summary: '2 pages missing title', affectedCount: 2 },
          explanation: '',
          whyItMatters: '',
          recommendation: '',
          confidence: 'high',
        },
      ],
    });

    const currentAudit = createMockAuditResult({
      scanId: 'scan-curr-101',
      findings: [
        // check-broken-links is missing -> Resolved!
        // check-tls is present with exact same severity & count -> Still Open!
        {
          id: 'c-2',
          checkId: 'check-tls',
          category: 'security',
          severity: 'important',
          title: 'Weak TLS',
          evidence: { summary: 'TLS 1.0 enabled', affectedCount: 1 },
          explanation: '',
          whyItMatters: '',
          recommendation: '',
          confidence: 'high',
        },
        // check-titles has affectedCount changed from 2 to 6 -> Changed!
        {
          id: 'c-3',
          checkId: 'check-titles',
          category: 'seo',
          severity: 'important',
          title: 'Missing Titles',
          evidence: { summary: '6 pages missing title', affectedCount: 6 },
          explanation: '',
          whyItMatters: '',
          recommendation: '',
          confidence: 'high',
        },
        // check-viewport was never in previous -> New regression!
        {
          id: 'c-4',
          checkId: 'check-viewport',
          category: 'accessibility',
          severity: 'critical',
          title: 'Missing Mobile Viewport',
          evidence: { summary: 'No viewport meta tag', affectedCount: 1 },
          explanation: '',
          whyItMatters: '',
          recommendation: '',
          confidence: 'high',
        },
      ],
    });

    const comparison = compareAuditResults(previousAudit, currentAudit);

    assert.equal(comparison.hasPrevious, true);
    // Resolved: check-broken-links
    assert.equal(comparison.resolved.length, 1);
    assert.equal(comparison.resolved[0].checkId, 'check-broken-links');

    // Still Open: check-tls
    assert.equal(comparison.stillOpen.length, 1);
    assert.equal(comparison.stillOpen[0].checkId, 'check-tls');

    // Changed: check-titles (count shifted 2 -> 6)
    assert.equal(comparison.changed.length, 1);
    assert.equal(comparison.changed[0].checkId, 'check-titles');
    assert.equal(comparison.changed[0].previousAffectedCount, 2);
    assert.equal(comparison.changed[0].currentAffectedCount, 6);

    // New: check-viewport
    assert.equal(comparison.newFindings.length, 1);
    assert.equal(comparison.newFindings[0].checkId, 'check-viewport');
  });

  it('handles initial scan with no previous scan gracefully', () => {
    const currentAudit = createMockAuditResult();
    const comparison = compareAuditResults(null, currentAudit);

    assert.equal(comparison.hasPrevious, false);
    assert.equal(comparison.resolved.length, 0);
    assert.equal(comparison.newFindings.length, 0);
    assert(comparison.stillOpen.length > 0);
  });
});
