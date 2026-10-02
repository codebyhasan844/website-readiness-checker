/**
 * Structured Vector PDF Export Generator (Phase 4)
 *
 * Generates a clean, professional, multi-page PDF audit document
 * using jsPDF and jspdf-autotable.
 *
 * Strictly vector text & structured tables: Zero screenshots, zero canvas rasterization.
 * Supports page numbering, page breaks, text wrapping, and launch checklist.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ReportViewModel } from './types';
import { formatCoveragePercentage } from './session';

export function generateAuditPdf(model: ReportViewModel, options?: { returnDoc?: boolean }): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  // Color Palette
  const brandDark: [number, number, number] = [17, 24, 39]; // Neutral 900
  const brandCyan: [number, number, number] = [8, 145, 178]; // Cyan 600
  const colorRose: [number, number, number] = [225, 29, 72];
  const colorAmber: [number, number, number] = [217, 119, 6];
  const colorEmerald: [number, number, number] = [16, 185, 129];
  const colorTextMuted: [number, number, number] = [107, 114, 128];

  let y = margin;

  // 1. Header Banner
  doc.setFillColor(...brandDark);
  doc.rect(margin, y, contentWidth, 54, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('WEBSITE READINESS CHECKER', margin + 14, y + 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(165, 243, 252);
  doc.text('One URL. One Scan. One Clear Answer.', margin + 14, y + 40);

  doc.setFontSize(8);
  doc.setTextColor(209, 213, 219);
  doc.text(`Report ID: ${model.scanId}`, pageWidth - margin - 14, y + 24, { align: 'right' });
  doc.text(`Generated: ${new Date(model.startedAt).toLocaleDateString()}`, pageWidth - margin - 14, y + 40, { align: 'right' });

  y += 68;

  // 2. Target Website & Readiness State Card
  doc.setFillColor(249, 250, 251);
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(margin, y, contentWidth, 70, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(17, 24, 39);
  const displayUrl = model.url.length > 55 ? `${model.url.slice(0, 52)}...` : model.url;
  doc.text(displayUrl, margin + 14, y + 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...colorTextMuted);
  doc.text(`Audited Domain: ${model.domain} | Scan Duration: ${(model.durationMs / 1000).toFixed(2)}s | Pages Analyzed: ${model.metrics.pagesScannedCount}`, margin + 14, y + 40);

  const cov = model.coverage;
  const pct = cov
    ? cov.percentageText || formatCoveragePercentage(cov.analyzedCount, cov.discoveredCount)
    : '100%';
  const coverageText = cov
    ? `Coverage: ${pct} (${cov.status}) | Remaining: ${cov.remainingCount} pages | Inventory: ${cov.discoveredCount} pages`
    : `Coverage Status: ${model.statusText}`;
  doc.text(coverageText, margin + 14, y + 54);

  // Verdict Badge
  const verdictColor =
    model.readiness === 'READY'
      ? colorEmerald
      : model.readiness === 'NOT READY'
      ? colorRose
      : colorAmber;

  doc.setFillColor(...verdictColor);
  doc.roundedRect(pageWidth - margin - 140, y + 16, 126, 36, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(model.readiness, pageWidth - margin - 77, y + 38, { align: 'center' });

  y += 84;

  // 3. Summary Counts Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text('AUDIT FINDINGS SUMMARY', margin, y);
  y += 10;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Critical Blockers', 'Important Issues', 'Suggested Improvements', 'Passed Checks', 'Total Evaluated']],
    body: [
      [
        String(model.counts.critical),
        String(model.counts.important),
        String(model.counts.improvement),
        String(model.counts.passed),
        String(model.counts.totalChecks),
      ],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: brandDark,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 8,
    },
    bodyStyles: {
      halign: 'center',
      fontStyle: 'bold',
      fontSize: 11,
      textColor: [17, 24, 39],
    },
    columnStyles: {
      0: { textColor: colorRose },
      1: { textColor: colorAmber },
      2: { textColor: brandCyan },
      3: { textColor: colorEmerald },
    },
  });

  // @ts-expect-error - lastAutoTable injected by jspdf-autotable
  y = doc.lastAutoTable.finalY + 20;

  // 4. Fix First Priority Action Items (if any)
  if (model.fixFirst.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    doc.text(`FIX FIRST PRIORITIES (${model.fixFirst.length} Items)`, margin, y);
    y += 10;

    const fixFirstRows = model.fixFirst.map((item) => [
      `#0${item.rank}`,
      item.severity.toUpperCase(),
      item.category.toUpperCase(),
      item.title,
      item.recommendation,
      String(item.affectedCount),
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Rank', 'Severity', 'Category', 'Finding Title', 'Action Plan', 'Impact']],
      body: fixFirstRows,
      theme: 'striped',
      headStyles: {
        fillColor: [55, 65, 81],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [31, 41, 55],
      },
      columnStyles: {
        0: { cellWidth: 32, fontStyle: 'bold', halign: 'center' },
        1: { cellWidth: 55, fontStyle: 'bold' },
        2: { cellWidth: 65 },
        3: { cellWidth: 120, fontStyle: 'bold' },
        4: { overflow: 'linebreak' },
        5: { cellWidth: 40, halign: 'center' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          const val = String(data.cell.raw);
          if (val === 'CRITICAL') data.cell.styles.textColor = colorRose;
          else if (val === 'IMPORTANT') data.cell.styles.textColor = colorAmber;
        }
      },
    });

    // @ts-expect-error - lastAutoTable
    y = doc.lastAutoTable.finalY + 20;
  }

  // 5. Dynamic Launch Checklist
  if (y > pageHeight - 160) {
    doc.addPage();
    y = margin;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text('BEFORE YOU LAUNCH — QA CHECKLIST', margin, y);
  y += 10;

  const checklistRows = model.checklist.map((item) => [
    item.status === 'resolved' ? '[ PASS ]' : '[ TODO ]',
    item.title,
    item.category.toUpperCase(),
    item.recommendation,
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Status', 'Pre-Launch Verification Item', 'Category', 'Guidance']],
    body: checklistRows,
    theme: 'grid',
    headStyles: {
      fillColor: brandDark,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [31, 41, 55],
    },
    columnStyles: {
      0: { cellWidth: 45, fontStyle: 'bold', halign: 'center' },
      1: { cellWidth: 155, fontStyle: 'bold' },
      2: { cellWidth: 65 },
      3: { overflow: 'linebreak' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 0) {
        if (String(data.cell.raw) === '[ PASS ]') {
          data.cell.styles.textColor = colorEmerald;
        } else {
          data.cell.styles.textColor = colorRose;
        }
      }
    },
  });

  // @ts-expect-error - lastAutoTable
  y = doc.lastAutoTable.finalY + 20;

  // 6. Complete Detailed Findings
  if (y > pageHeight - 180) {
    doc.addPage();
    y = margin;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text('DETAILED AUDIT FINDINGS', margin, y);
  y += 10;

  // Show all non-passed findings first, then a summary of passed
  const nonPassed = model.findings.filter((f) => f.severity !== 'passed');
  const findingRows = nonPassed.map((f) => {
    const urls = f.affectedUrls || f.evidence.urls || [];
    let evidenceText = f.evidence.summary || 'Issue observed during scan.';

    if (urls.length === 1) {
      if (!evidenceText.includes(urls[0])) {
        evidenceText += `\n\nAffected URL: ${urls[0]}`;
      }
    } else if (urls.length > 1) {
      const maxShown = 3;
      const sample = urls.slice(0, maxShown);
      const remaining = urls.length - maxShown;
      evidenceText += `\n\nAffected Pages (${urls.length} total):\n• ${sample.join('\n• ')}${
        remaining > 0 ? `\n• +${remaining} more pages` : ''
      }`;
    }

    return [
      f.severity.toUpperCase(),
      f.category.toUpperCase(),
      f.title,
      evidenceText,
      f.recommendation,
    ];
  });

  if (findingRows.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Severity', 'Category', 'Finding Title', 'Observed Evidence', 'Recommended Remediation']],
      body: findingRows,
      theme: 'striped',
      headStyles: {
        fillColor: brandDark,
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [31, 41, 55],
      },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'bold' },
        1: { cellWidth: 60 },
        2: { cellWidth: 105, fontStyle: 'bold' },
        3: { cellWidth: 140, overflow: 'linebreak' },
        4: { overflow: 'linebreak' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 0) {
          const val = String(data.cell.raw);
          if (val === 'CRITICAL') data.cell.styles.textColor = colorRose;
          else if (val === 'IMPORTANT') data.cell.styles.textColor = colorAmber;
          else if (val === 'IMPROVEMENT') data.cell.styles.textColor = brandCyan;
        }
      },
    });

    // @ts-expect-error - lastAutoTable
    y = doc.lastAutoTable.finalY + 16;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...colorEmerald);
    doc.text(
      `All ${model.counts.passed} registered checks evaluated successfully with zero issues detected.`,
      margin,
      y
    );
    y += 24;
  }

  if (model.counts.passed > 0 && findingRows.length > 0) {
    if (y > pageHeight - 80) {
      doc.addPage();
      y = margin;
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...colorEmerald);
    doc.text(
      `✓ ${model.counts.passed} additional checks passed evaluation across all analyzed pages (no issues detected).`,
      margin,
      y
    );
  }

  // 7. Add Page Numbers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...colorTextMuted);
    doc.text(
      `Website Readiness Checker • Confidential Audit Report • Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 18,
      { align: 'center' }
    );
  }

  // Save the document unless returnDoc is requested
  if (!options?.returnDoc) {
    const safeFilename = `${model.domain.replace(/[^a-z0-9]/gi, '_')}_readiness_audit.pdf`;
    doc.save(safeFilename);
  }

  return doc;
}
