import React, { useState, useMemo } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Info,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Server,
  Search,
  ShieldCheck,
  Zap,
  Eye,
  Network,
  Copy,
  Check,
  FileCode,
  ExternalLink,
  Code,
  Layers,
  Link2
} from 'lucide-react';
import { Finding, FindingSeverity, FindingCategory } from '../types';
import { AffectedResource } from '../audit/types';

interface ExtendedFinding extends Partial<Finding> {
  id: string;
  severity: FindingSeverity;
  category: FindingCategory;
  title: string;
  checkId?: string;
  evidence?: any;
  explanation?: string;
  whyItMatters?: string;
  recommendation?: string;
  technicalDetails?: string;
  affectedUrl?: string;
  affectedUrls?: string[];
  affectedResources?: AffectedResource[];
  totalAffectedCount?: number;
}

interface FindingCardProps {
  finding: ExtendedFinding;
  defaultExpanded?: boolean;
}

export const FindingCard: React.FC<FindingCardProps> = ({
  finding,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [showAllUrls, setShowAllUrls] = useState(false);
  const [showAllResources, setShowAllResources] = useState(false);
  const [copiedUrls, setCopiedUrls] = useState(false);
  const [copiedResources, setCopiedResources] = useState(false);

  // Normalize evidence string vs object
  let evidenceSummary = '';
  let evidenceDetails = '';

  if (typeof finding.evidence === 'string') {
    evidenceSummary = finding.evidence;
  } else if (finding.evidence && typeof finding.evidence === 'object') {
    evidenceSummary = finding.evidence.summary || '';
    evidenceDetails = finding.evidence.details || '';
  }

  // Deduplicate page URLs with useMemo
  const uniqueUrls = useMemo(() => {
    let rawUrls: string[] = [];
    if (finding.evidence && typeof finding.evidence === 'object' && Array.isArray(finding.evidence.urls)) {
      rawUrls = finding.evidence.urls;
    }
    if (finding.affectedUrls && finding.affectedUrls.length > 0) {
      rawUrls = finding.affectedUrls;
    } else if (finding.affectedUrl && !rawUrls.includes(finding.affectedUrl)) {
      rawUrls = [finding.affectedUrl, ...rawUrls];
    }
    return Array.from(new Set(rawUrls));
  }, [finding.evidence, finding.affectedUrls, finding.affectedUrl]);

  // Resources with useMemo
  const resources: AffectedResource[] = useMemo(() => {
    return (
      finding.affectedResources ||
      (finding.evidence && Array.isArray(finding.evidence.resources) ? finding.evidence.resources : [])
    );
  }, [finding.affectedResources, finding.evidence]);

  const affectedCount =
    finding.totalAffectedCount ||
    (finding.evidence && typeof finding.evidence === 'object' && finding.evidence.affectedCount) ||
    Math.max(uniqueUrls.length, resources.length) ||
    1;

  const handleCopyUrls = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (uniqueUrls.length === 0) return;
    navigator.clipboard.writeText(uniqueUrls.join('\n'));
    setCopiedUrls(true);
    setTimeout(() => setCopiedUrls(false), 2000);
  };

  const handleCopyResources = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (resources.length === 0) return;
    const formatted = resources
      .map((r) => {
        let line = `Resource: ${r.resourceUrl}`;
        if (r.referencedFrom) line += `\nReferenced on: ${r.referencedFrom}`;
        if (r.statusCode || r.statusText) line += `\nStatus: ${r.statusText || r.statusCode}`;
        return line;
      })
      .join('\n\n');

    navigator.clipboard.writeText(formatted);
    setCopiedResources(true);
    setTimeout(() => setCopiedResources(false), 2000);
  };

  const getSeverityBadge = (severity: FindingSeverity) => {
    switch (severity) {
      case 'critical':
        return {
          label: 'Critical',
          icon: AlertOctagon,
          bg: 'bg-rose-950/40 text-rose-300 border-rose-800/60',
          indicator: 'bg-rose-500',
        };
      case 'important':
        return {
          label: 'Important',
          icon: AlertTriangle,
          bg: 'bg-amber-950/40 text-amber-300 border-amber-800/60',
          indicator: 'bg-amber-500',
        };
      case 'improvement':
        return {
          label: 'Improvement',
          icon: Info,
          bg: 'bg-sky-950/40 text-sky-300 border-sky-800/60',
          indicator: 'bg-sky-500',
        };
      case 'passed':
        return {
          label: 'Passed',
          icon: CheckCircle2,
          bg: 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60',
          indicator: 'bg-emerald-500',
        };
    }
  };

  const getCategoryMeta = (category: FindingCategory) => {
    switch (category) {
      case 'technical':
        return { name: 'Technical QA', icon: Server };
      case 'seo':
        return { name: 'SEO', icon: Search };
      case 'security':
        return { name: 'Security', icon: ShieldCheck };
      case 'performance':
        return { name: 'Performance', icon: Zap };
      case 'accessibility':
        return { name: 'Accessibility', icon: Eye };
      case 'crawlability':
        return { name: 'Crawlability', icon: Network };
      case 'assets':
        return { name: 'Images & Assets', icon: Code };
      default:
        return { name: 'General', icon: Server };
    }
  };

  const badge = getSeverityBadge(finding.severity);
  const cat = getCategoryMeta(finding.category);
  const SeverityIcon = badge.icon;
  const CategoryIcon = cat.icon;

  // DOM Safeguard: Cap at 50 max displayed items to prevent browser freezes on massive inventory
  const MAX_DOM_ITEMS = 50;
  const displayUrls = showAllUrls ? uniqueUrls.slice(0, MAX_DOM_ITEMS) : uniqueUrls.slice(0, 5);
  const displayResources = showAllResources ? resources.slice(0, MAX_DOM_ITEMS) : resources.slice(0, 5);

  return (
    <article
      id={`finding-card-${finding.id}`}
      className={`rounded-xl border transition-all duration-150 ${
        finding.severity === 'critical'
          ? 'border-rose-900/40 bg-neutral-900/80 hover:border-rose-800/70'
          : finding.severity === 'important'
          ? 'border-amber-900/40 bg-neutral-900/80 hover:border-amber-800/70'
          : finding.severity === 'improvement'
          ? 'border-neutral-800 bg-neutral-900/70 hover:border-neutral-700'
          : 'border-neutral-800/80 bg-neutral-900/40 hover:border-neutral-700/80'
      }`}
    >
      {/* Header Row */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left p-4 sm:p-5 flex items-start justify-between gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded-xl"
        aria-expanded={isExpanded}
        aria-controls={`finding-details-${finding.id}`}
      >
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          <div
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${badge.bg}`}
          >
            <SeverityIcon className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-mono font-semibold border ${badge.bg}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${badge.indicator}`} />
                {badge.label.toUpperCase()}
              </span>

              <span className="inline-flex items-center gap-1 rounded-md border border-neutral-700/80 bg-neutral-800/60 px-2 py-0.5 text-[11px] font-medium text-neutral-300">
                <CategoryIcon className="h-3 w-3 text-neutral-400" />
                {cat.name}
              </span>

              {finding.severity !== 'passed' && affectedCount > 1 && (
                <span className="inline-flex items-center rounded-md bg-neutral-800 px-2 py-0.5 text-[11px] font-mono text-neutral-300 border border-neutral-700">
                  {affectedCount} affected {uniqueUrls.length > 0 ? (uniqueUrls.length === 1 ? 'page' : 'pages') : 'items'}
                </span>
              )}
            </div>

            <h3 className="text-sm sm:text-base font-semibold text-neutral-100 leading-snug">
              {finding.title}
            </h3>

            {!isExpanded && evidenceSummary && (
              <p className="mt-1 text-xs text-neutral-400 line-clamp-1 font-mono">
                {evidenceSummary}
              </p>
            )}
          </div>
        </div>

        <div className="pt-1 text-neutral-400 hover:text-neutral-200">
          {isExpanded ? (
            <ChevronUp className="h-5 w-5" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-5 w-5" aria-hidden="true" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div
          id={`finding-details-${finding.id}`}
          className="border-t border-neutral-800/80 px-4 pb-5 pt-4 sm:px-5 space-y-4 text-xs animate-in fade-in duration-150"
        >
          {/* Problem & Evidence */}
          {evidenceSummary && (
            <div className="space-y-1">
              <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-cyan-400" />
                Observed Evidence
              </span>
              <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-3 font-mono text-neutral-300 text-[12px] overflow-x-auto whitespace-pre-wrap">
                {evidenceSummary}
                {evidenceDetails && (
                  <p className="mt-2 text-neutral-400 text-[11px] font-sans">
                    {evidenceDetails}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Why it matters */}
          {(finding.whyItMatters || finding.explanation) && (
            <div className="space-y-1">
              <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-amber-400" />
                Why This Matters for Launch
              </span>
              <p className="text-neutral-300 text-xs sm:text-sm leading-relaxed pl-2 border-l-2 border-amber-500/40">
                {finding.whyItMatters || finding.explanation}
              </p>
            </div>
          )}

          {/* What to fix / Recommendation */}
          {finding.recommendation && (
            <div className="space-y-1">
              <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-emerald-400" />
                Recommended Resolution
              </span>
              <p className="text-neutral-200 text-xs sm:text-sm leading-relaxed pl-2 border-l-2 border-emerald-500/40 font-medium">
                {finding.recommendation}
              </p>
            </div>
          )}

          {/* Developer Handoff: Affected Resources */}
          {resources.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-neutral-800/60">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                  Affected Resources ({resources.length})
                </span>

                <button
                  type="button"
                  onClick={handleCopyResources}
                  className="inline-flex items-center gap-1 text-[11px] font-mono text-cyan-400 hover:text-cyan-300 px-2 py-0.5 rounded bg-neutral-950 border border-neutral-800 hover:border-neutral-700"
                  title="Copy formatted resources for developer ticket"
                >
                  {copiedResources ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy Resources</span>
                    </>
                  )}
                </button>
              </div>

              <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-2.5 space-y-2 max-h-56 overflow-y-auto">
                {displayResources.map((res, i) => (
                  <div
                    key={i}
                    className="p-2 rounded bg-neutral-900/60 border border-neutral-800/70 space-y-1"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-[11px] text-cyan-300 break-all">
                        {res.resourceUrl}
                      </span>
                      {res.statusText && (
                        <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-950/60 border border-rose-800/60 text-rose-300">
                          {res.statusText}
                        </span>
                      )}
                    </div>
                    {res.referencedFrom && (
                      <div className="text-[10px] text-neutral-400 font-mono truncate flex items-center gap-1">
                        <span className="text-neutral-500 shrink-0">On page:</span>
                        <span className="truncate text-neutral-300">{res.referencedFrom}</span>
                      </div>
                    )}
                  </div>
                ))}

                {resources.length > 5 && !showAllResources && (
                  <button
                    type="button"
                    onClick={() => setShowAllResources(true)}
                    className="w-full text-center text-xs font-mono text-cyan-400 hover:text-cyan-300 py-1"
                  >
                    + Show {resources.length - 5} more affected resources
                  </button>
                )}

                {showAllResources && resources.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setShowAllResources(false)}
                    className="w-full text-center text-xs font-mono text-neutral-400 hover:text-neutral-300 py-1"
                  >
                    Show fewer
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Developer Handoff: Affected Pages */}
          {uniqueUrls.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-neutral-800/60">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                  Affected Pages ({uniqueUrls.length})
                </span>

                <button
                  type="button"
                  onClick={handleCopyUrls}
                  className="inline-flex items-center gap-1 text-[11px] font-mono text-cyan-400 hover:text-cyan-300 px-2 py-0.5 rounded bg-neutral-950 border border-neutral-800 hover:border-neutral-700"
                  title="Copy URLs list to clipboard"
                >
                  {copiedUrls ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy URLs</span>
                    </>
                  )}
                </button>
              </div>

              <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-2.5 space-y-1.5 max-h-48 overflow-y-auto">
                {displayUrls.map((u, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-neutral-300 font-mono text-[11px] py-0.5 hover:bg-neutral-900/50 px-1 rounded truncate"
                  >
                    <span className="truncate pr-2">{u}</span>
                  </div>
                ))}

                {uniqueUrls.length > 5 && !showAllUrls && (
                  <button
                    type="button"
                    onClick={() => setShowAllUrls(true)}
                    className="w-full text-center text-xs font-mono text-cyan-400 hover:text-cyan-300 py-1"
                  >
                    + Show {uniqueUrls.length - 5} more affected pages
                  </button>
                )}

                {showAllUrls && uniqueUrls.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setShowAllUrls(false)}
                    className="w-full text-center text-xs font-mono text-neutral-400 hover:text-neutral-300 py-1"
                  >
                    Show fewer
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Technical Diagnostics */}
          {finding.technicalDetails && (
            <div className="space-y-1">
              <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Code className="h-3 w-3 text-neutral-400" />
                Diagnostic Trace
              </span>
              <pre className="rounded-lg border border-neutral-800/90 bg-neutral-950 p-3 font-mono text-[11px] text-neutral-400 whitespace-pre-wrap overflow-x-auto">
                {finding.technicalDetails}
              </pre>
            </div>
          )}
        </div>
      )}
    </article>
  );
};

