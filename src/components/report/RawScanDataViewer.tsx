/**
 * Raw Scan Data Viewer (Phase 2)
 *
 * Renders the observable facts and technical measurements collected by the
 * Secure Scanner Engine without making audit judgments, scoring, or severity classifications.
 */

import React, { useState } from 'react';
import {
  Globe,
  FileText,
  Shield,
  Clock,
  Layers,
  Link as LinkIcon,
  Image as ImageIcon,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Server,
  Code,
  FileCode
} from 'lucide-react';
import { ScanResult, PageScanResult } from '../../scanner/types';

interface RawScanDataViewerProps {
  scan: ScanResult;
}

export const RawScanDataViewer: React.FC<RawScanDataViewerProps> = ({ scan }) => {
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'pages' | 'robots' | 'sitemaps' | 'headers' | 'json'>('pages');

  const currentPage: PageScanResult | undefined = scan.pages[selectedPageIndex] || scan.pages[0];

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Raw Facts Header Banner */}
      <div className="rounded-xl border border-cyan-900/60 bg-gradient-to-r from-cyan-950/40 via-neutral-900 to-neutral-900 p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono uppercase bg-cyan-900/50 text-cyan-300 border border-cyan-700/50">
                Phase 2 Raw Telemetry
              </span>
              <span className="text-xs font-mono text-neutral-400">
                Scan ID: {scan.scanId}
              </span>
            </div>
            <h2 className="mt-2 text-xl font-bold font-mono text-white flex items-center gap-2">
              <Globe className="h-5 w-5 text-cyan-400" />
              <span>{scan.normalizedUrl}</span>
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              Started {new Date(scan.startedAt).toLocaleString()} • Duration: {scan.totalDurationMs}ms • Status: <span className="font-mono text-cyan-300 uppercase">{scan.status}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-center">
            <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-2.5">
              <span className="block text-[11px] text-neutral-400">Pages Crawled</span>
              <span className="font-mono text-lg font-bold text-cyan-400">
                {scan.summary.pagesCompleted}/{scan.summary.pagesAttempted}
              </span>
            </div>
            <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-2.5">
              <span className="block text-[11px] text-neutral-400">Requests</span>
              <span className="font-mono text-lg font-bold text-neutral-200">
                {scan.summary.requestsMade}
              </span>
            </div>
            <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-2.5 col-span-2 sm:col-span-1">
              <span className="block text-[11px] text-neutral-400">Links Found</span>
              <span className="font-mono text-lg font-bold text-neutral-200">
                {scan.summary.internalLinksDiscovered + scan.summary.externalLinksDiscovered}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-2 overflow-x-auto text-xs font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('pages')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
            activeTab === 'pages'
              ? 'bg-cyan-950/80 border border-cyan-800/80 text-cyan-300'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Pages Crawled ({scan.pages.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('robots')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
            activeTab === 'robots'
              ? 'bg-cyan-950/80 border border-cyan-800/80 text-cyan-300'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
          }`}
        >
          <Server className="h-3.5 w-3.5" />
          <span>Robots.txt ({scan.robots?.exists ? 'Found' : 'Not Found'})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sitemaps')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
            activeTab === 'sitemaps'
              ? 'bg-cyan-950/80 border border-cyan-800/80 text-cyan-300'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
          }`}
        >
          <FileCode className="h-3.5 w-3.5" />
          <span>Sitemaps ({scan.sitemaps.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('headers')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
            activeTab === 'headers'
              ? 'bg-cyan-950/80 border border-cyan-800/80 text-cyan-300'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
          }`}
        >
          <Shield className="h-3.5 w-3.5" />
          <span>HTTP Security Headers</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('json')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ml-auto ${
            activeTab === 'json'
              ? 'bg-neutral-800 text-white'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Code className="h-3.5 w-3.5" />
          <span>Raw JSON</span>
        </button>
      </div>

      {/* TAB 1: Pages Crawled */}
      {activeTab === 'pages' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Page List Sidebar */}
          <div className="lg:col-span-4 space-y-2">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">
              Discovered Documents
            </span>
            <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
              {scan.pages.map((p, idx) => (
                <button
                  key={p.normalizedUrl + idx}
                  type="button"
                  onClick={() => setSelectedPageIndex(idx)}
                  className={`w-full text-left p-3 rounded-lg border text-xs transition-all ${
                    idx === selectedPageIndex
                      ? 'bg-cyan-950/40 border-cyan-700/60 text-white'
                      : 'bg-neutral-900/60 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-medium truncate">
                      {p.normalizedUrl.replace(/^https?:\/\/[^/]+/, '') || '/'}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                        p.http.statusCode >= 200 && p.http.statusCode < 300
                          ? 'bg-emerald-950 text-emerald-400'
                          : 'bg-rose-950 text-rose-400'
                      }`}
                    >
                      {p.http.statusCode || 'ERR'}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-neutral-400">
                    <span>Depth: {p.depth}</span>
                    <span>•</span>
                    <span>{p.http.durationMs}ms</span>
                    <span>•</span>
                    <span>{p.headings.items.length} Headings</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Selected Page Details */}
          {currentPage && (
            <div className="lg:col-span-8 space-y-4">
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5 space-y-4">
                <div>
                  <span className="text-[11px] font-mono text-cyan-400">Document URL</span>
                  <h3 className="text-base font-mono text-white break-all">{currentPage.normalizedUrl}</h3>
                </div>

                {/* HTTP Facts */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="rounded border border-neutral-800 bg-neutral-950 p-2.5">
                    <span className="text-neutral-400 block text-[11px]">HTTP Status</span>
                    <span className="font-mono font-bold text-white">{currentPage.http.statusCode} {currentPage.http.statusText}</span>
                  </div>
                  <div className="rounded border border-neutral-800 bg-neutral-950 p-2.5">
                    <span className="text-neutral-400 block text-[11px]">Content Type</span>
                    <span className="font-mono text-white truncate block">{currentPage.http.contentType || 'N/A'}</span>
                  </div>
                  <div className="rounded border border-neutral-800 bg-neutral-950 p-2.5">
                    <span className="text-neutral-400 block text-[11px]">Payload Size</span>
                    <span className="font-mono text-white">{(currentPage.http.responseBytes / 1024).toFixed(1)} KB</span>
                  </div>
                  <div className="rounded border border-neutral-800 bg-neutral-950 p-2.5">
                    <span className="text-neutral-400 block text-[11px]">Response Time</span>
                    <span className="font-mono text-white">{currentPage.http.durationMs} ms</span>
                  </div>
                </div>

                {/* Document Metadata */}
                <div className="border-t border-neutral-800 pt-4 space-y-2 text-xs">
                  <h4 className="font-semibold text-neutral-300">Document Metadata</h4>
                  <div className="space-y-1.5 font-mono text-[11px]">
                    <div className="p-2 rounded bg-neutral-950 border border-neutral-800/80">
                      <span className="text-neutral-400 block">Title:</span>
                      <span className="text-neutral-200">{currentPage.document.title || '<No Title Detected>'}</span>
                    </div>
                    <div className="p-2 rounded bg-neutral-950 border border-neutral-800/80">
                      <span className="text-neutral-400 block">Meta Description:</span>
                      <span className="text-neutral-200">{currentPage.document.metaDescription || '<No Description Detected>'}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="p-2 rounded bg-neutral-950 border border-neutral-800/80">
                        <span className="text-neutral-400 block">Canonical:</span>
                        <span className="text-neutral-200 truncate block">{currentPage.document.canonicalUrl || 'None'}</span>
                      </div>
                      <div className="p-2 rounded bg-neutral-950 border border-neutral-800/80">
                        <span className="text-neutral-400 block">Robots Meta:</span>
                        <span className="text-neutral-200 truncate block">{currentPage.document.robotsMeta || 'None'}</span>
                      </div>
                      <div className="p-2 rounded bg-neutral-950 border border-neutral-800/80">
                        <span className="text-neutral-400 block">Language:</span>
                        <span className="text-neutral-200 truncate block">{currentPage.document.language || 'None'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Headings Hierarchy */}
                <div className="border-t border-neutral-800 pt-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-neutral-300">Headings Structure ({currentPage.headings.items.length})</h4>
                    <span className="font-mono text-[11px] text-cyan-400">H1 count: {currentPage.headings.h1Count}</span>
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {currentPage.headings.items.length === 0 ? (
                      <p className="text-neutral-400 text-xs italic">No heading elements detected.</p>
                    ) : (
                      currentPage.headings.items.map((h, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs font-mono">
                          <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 text-[10px]">
                            H{h.level}
                          </span>
                          <span className="text-neutral-200">{h.text}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Links and Images Summary */}
                <div className="border-t border-neutral-800 pt-4 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <h4 className="font-semibold text-neutral-300 mb-1 flex items-center gap-1.5">
                      <LinkIcon className="h-3.5 w-3.5 text-cyan-400" />
                      <span>Links ({currentPage.links.length})</span>
                    </h4>
                    <p className="text-neutral-400 text-[11px]">
                      Internal: {currentPage.links.filter((l) => l.isInternal).length} • External: {currentPage.links.filter((l) => !l.isInternal).length}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-neutral-300 mb-1 flex items-center gap-1.5">
                      <ImageIcon className="h-3.5 w-3.5 text-cyan-400" />
                      <span>Images ({currentPage.images.length})</span>
                    </h4>
                    <p className="text-neutral-400 text-[11px]">
                      With Alt: {currentPage.images.filter((i) => i.hasAlt).length} • Missing Alt: {currentPage.images.filter((i) => !i.hasAlt).length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Robots.txt */}
      {activeTab === 'robots' && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Robots.txt Directives</h3>
              <p className="text-xs font-mono text-neutral-400">{scan.robots?.url}</p>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-xs font-mono ${
                scan.robots?.exists ? 'bg-emerald-950 text-emerald-400' : 'bg-neutral-800 text-neutral-400'
              }`}
            >
              {scan.robots?.exists ? 'EXISTS (200 OK)' : 'NOT FOUND'}
            </span>
          </div>

          {scan.robots?.rawText ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 rounded-lg border border-neutral-800 bg-neutral-950 space-y-2">
                  <span className="text-xs font-semibold text-neutral-300">Declared Sitemaps</span>
                  {scan.robots.sitemapDeclarations.length === 0 ? (
                    <p className="text-xs text-neutral-400 italic">No Sitemap declarations found.</p>
                  ) : (
                    <ul className="space-y-1 text-xs font-mono text-cyan-300">
                      {scan.robots.sitemapDeclarations.map((sm, i) => (
                        <li key={i} className="break-all">• {sm}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="p-3 rounded-lg border border-neutral-800 bg-neutral-950 space-y-2">
                  <span className="text-xs font-semibold text-neutral-300">Directive Groups</span>
                  <p className="text-xs text-neutral-400">
                    {scan.robots.directives.length} User-agent blocks parsed.
                  </p>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-neutral-400 block mb-1">Raw Robots.txt Content</span>
                <pre className="p-3 rounded-lg border border-neutral-800 bg-neutral-950 font-mono text-xs text-neutral-300 overflow-x-auto max-h-64">
                  {scan.robots.rawText}
                </pre>
              </div>
            </div>
          ) : (
            <p className="text-xs text-neutral-400 italic">
              No robots.txt file was found at standard location /robots.txt.
            </p>
          )}
        </div>
      )}

      {/* TAB 3: Sitemaps */}
      {activeTab === 'sitemaps' && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">XML Sitemaps Discovered ({scan.sitemaps.length})</h3>

          {scan.sitemaps.length === 0 ? (
            <p className="text-xs text-neutral-400 italic">No XML sitemaps discovered.</p>
          ) : (
            <div className="space-y-3">
              {scan.sitemaps.map((sm, i) => (
                <div key={i} className="p-3.5 rounded-lg border border-neutral-800 bg-neutral-950 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-cyan-300 break-all">{sm.url}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 uppercase">
                      {sm.discoveredFrom}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-400 flex items-center gap-4">
                    <span>Status: {sm.statusCode || 'ERR'}</span>
                    <span>•</span>
                    <span>Is Index: {sm.isIndex ? 'Yes' : 'No'}</span>
                    <span>•</span>
                    <span>URLs Extracted: {sm.containedUrls.length}</span>
                  </div>
                  {sm.containedUrls.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-neutral-900">
                      <span className="text-[11px] text-neutral-400 block mb-1">Sample Contained URLs:</span>
                      <ul className="space-y-1 text-xs font-mono text-neutral-300 max-h-32 overflow-y-auto">
                        {sm.containedUrls.slice(0, 10).map((u, j) => (
                          <li key={j} className="truncate">• {u}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: HTTP Security Headers */}
      {activeTab === 'headers' && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white">HTTP Security Headers Telemetry</h3>
            <p className="text-xs text-neutral-400">
              Raw header values observed on homepage HTTP response. (Audit evaluation occurs in Phase 3).
            </p>
          </div>

          <div className="space-y-2 font-mono text-xs">
            {Object.entries(currentPage?.http.securityHeaders || {}).map(([key, val]) => (
              <div
                key={key}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-lg border border-neutral-800 bg-neutral-950 gap-1.5"
              >
                <span className="text-neutral-400 font-medium">{key}:</span>
                <span className={`text-right break-all ${val ? 'text-cyan-300' : 'text-neutral-400 italic'}`}>
                  {val || '<Absent from response>'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: Raw JSON */}
      {activeTab === 'json' && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-300">Raw ScanResult Data Model</span>
            <span className="text-xs font-mono text-neutral-400">Size: ~{(JSON.stringify(scan).length / 1024).toFixed(1)} KB</span>
          </div>
          <pre className="p-3 rounded-lg border border-neutral-800 bg-neutral-950 font-mono text-xs text-neutral-300 overflow-x-auto max-h-[600px]">
            {JSON.stringify(scan, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
