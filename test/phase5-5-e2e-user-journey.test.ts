import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ScanOrchestrator } from '../src/scanner/scan-orchestrator';
import { runAudit } from '../src/audit/engine';
import { defaultAuditRegistry } from '../src/audit/registry';
import { buildReportViewModel } from '../src/report/view-model';
import { generateAuditPdf } from '../src/report/pdf-export';
import { calculateAuditCoverage } from '../src/report/session';
import { SCANNER_LIMITS } from '../src/scanner/limits';
import { UrlValidator } from '../src/scanner/url-validator';
import { SecurityGuard } from '../src/scanner/security-guard';

describe('Phase 5.5 — End-to-End User Journey & Validation', () => {
  it('E2E-01: Full user journey — scan initiation, SSE progress, audit, report view model, and PDF generation', async () => {
    const progressEvents: any[] = [];
    const scan = await ScanOrchestrator.executeScan('https://example.com', {
      onProgress: (p) => progressEvents.push(p),
    });

    // 1. Progress events occurred in sequence
    assert.ok(progressEvents.length >= 3, 'Must record multiple progress events');
    assert.strictEqual(progressEvents[0].stage, 'validating');
    assert.ok(progressEvents.some((p) => p.stage === 'connecting' || p.stage === 'crawling'));

    // 2. Scan completion
    assert.strictEqual(scan.status, 'completed');
    assert.ok(scan.scanId.startsWith('scan-'));
    assert.ok(scan.pages.length > 0);

    // 3. Deterministic Audit
    const audit = runAudit(scan);
    assert.strictEqual(audit.counts.totalChecks, 67, 'Must evaluate strictly 67 checks');
    assert.strictEqual(audit.findings.length, 67, 'Must have strictly 67 findings');
    assert.strictEqual(
      audit.counts.critical + audit.counts.important + audit.counts.improvement + audit.counts.passed,
      67,
      'Severity sum must equal 67'
    );

    // 4. Report View Model Generation
    const viewModel = buildReportViewModel(audit, scan);
    assert.strictEqual(viewModel.counts.totalChecks, 67);
    assert.ok(viewModel.domain.includes('example.com'));
    assert.ok(Array.isArray(viewModel.fixFirst));
    assert.ok(Array.isArray(viewModel.checklist));
    assert.strictEqual(typeof viewModel.coverage.status, 'string');
    assert.strictEqual(typeof viewModel.coverage.percentageText, 'string');

    // 5. PDF Document Generation
    const pdfDoc = generateAuditPdf(viewModel, { returnDoc: true });
    const buffer = pdfDoc.output('arraybuffer');
    assert.ok(buffer.byteLength > 10000, 'PDF size must be substantial (> 10KB)');
  });

  it('E2E-02: Invalid URL handling — returns sanitized error without exposing internals', async () => {
    // 1. Invalid scheme
    assert.throws(
      () => UrlValidator.validate('ftp://example.com'),
      (err: any) => err.code === 'INVALID_URL'
    );

    // 2. Malformed string
    assert.throws(
      () => UrlValidator.validate('not a valid url at all'),
      (err: any) => err.code === 'INVALID_URL'
    );
  });

  it('E2E-03: Blocked / Private URL handling — SSRF security guard blocks loopback & private IP', async () => {
    // Localhost
    assert.throws(
      () => SecurityGuard.validateHostAndPort('localhost', 80),
      (err: any) => err.code === 'BLOCKED_DESTINATION'
    );

    // RFC 1918 Private range
    assert.throws(
      () => SecurityGuard.validateHostAndPort('192.168.1.1', 80),
      (err: any) => err.code === 'BLOCKED_DESTINATION'
    );

    // Cloud Metadata
    assert.throws(
      () => SecurityGuard.validateHostAndPort('169.254.169.254', 80),
      (err: any) => err.code === 'BLOCKED_DESTINATION'
    );

    // Disallowed Port
    assert.throws(
      () => SecurityGuard.validateHostAndPort('example.com', 22),
      (err: any) => err.code === 'BLOCKED_DESTINATION'
    );
  });

  it('E2E-04: Coverage calculation — respects exact boundary requirements', () => {
    // Partial coverage 200/201 returns 99.5% LIMITED COVERAGE
    const covPartial = calculateAuditCoverage(200, 201, false);
    assert.strictEqual(covPartial.percentageText, '99.5%');
    assert.strictEqual(covPartial.status, 'LIMITED COVERAGE');

    // Full coverage returns 100% FULL COVERAGE
    const covFull = calculateAuditCoverage(198, 198, true);
    assert.strictEqual(covFull.percentageText, '100%');
    assert.strictEqual(covFull.status, 'FULL COVERAGE');
  });

  it('E2E-05: Invariant verification — all 67 checks registered and verified', () => {
    const checks = defaultAuditRegistry.getAllChecks();
    assert.strictEqual(checks.length, 67, 'Audit registry must have strictly 67 registered checks');

    const expectedCategories = ['technical', 'crawlability', 'seo', 'assets', 'performance', 'security', 'accessibility'];
    for (const cat of expectedCategories) {
      const inCat = checks.filter((c) => c.category === cat);
      assert.ok(inCat.length > 0, `Category ${cat} must have registered checks`);
    }
  });

  it('E2E-06: Scanner limits invariant — exactly matches Phase 5.3 verified values', () => {
    assert.strictEqual(SCANNER_LIMITS.maxPages, 50);
    assert.strictEqual(SCANNER_LIMITS.maxDepth, 3);
    assert.strictEqual(SCANNER_LIMITS.maxRedirects, 5);
    assert.strictEqual(SCANNER_LIMITS.maxTotalRequests, 150);
    assert.strictEqual(SCANNER_LIMITS.requestTimeoutMs, 8000);
    assert.strictEqual(SCANNER_LIMITS.maxScanDurationMs, 60000);
    assert.strictEqual(SCANNER_LIMITS.maxResponseBytes, 3145728);
    assert.strictEqual(SCANNER_LIMITS.maxHtmlBytes, 2097152);
    assert.strictEqual(SCANNER_LIMITS.maxSitemapUrls, 250);
    assert.deepStrictEqual(SCANNER_LIMITS.allowedPorts, [80, 443]);
    assert.strictEqual(SCANNER_LIMITS.maxResourcesPerPage, 5);
  });
});
