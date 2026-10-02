import React from 'react';
import {
  Server,
  Search,
  ShieldCheck,
  Zap,
  Eye,
  Network,
  Info,
  Check
} from 'lucide-react';
import { CATEGORY_DEFINITIONS } from '../data/mockData';

export const WhatWeCheck: React.FC = () => {
  const iconMap: Record<string, React.ElementType> = {
    Server,
    Search,
    ShieldCheck,
    Zap,
    Eye,
    Network,
  };

  const categorySubItems: Record<string, string[]> = {
    technical: ['HTTP status & redirect chains', 'DNS resolution & latency', 'Edge SSL/TLS handshakes', 'Mixed content alerts'],
    seo: ['Title & meta description validity', 'Canonical tag consistency', 'H1-H6 semantic hierarchy', 'OpenGraph social metadata'],
    security: ['HSTS & max-age policies', 'Content-Security-Policy (CSP)', 'X-Content-Type-Options: nosniff', 'TLS certificate expiration'],
    performance: ['Payload size & page weight', 'Critical CSS & script blocks', 'Image compression formats', 'Render-blocking assets'],
    accessibility: ['HTML root lang declaration', 'Color contrast baselines', 'Form input labels & ARIA', 'Image alt attribute presence'],
    crawlability: ['Robots.txt syntax & disallow rules', 'XML Sitemap discovery & structure', 'Internal anchor health', 'Noindex / nofollow leak prevention'],
  };

  return (
    <section
      id="what-we-check"
      className="mt-20 sm:mt-28 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24"
      aria-label="Audit Categories Checked"
    >
      <div className="text-center max-w-2xl mx-auto mb-12">
        <span className="text-xs font-mono font-medium uppercase tracking-widest text-cyan-400">
          Launch Readiness Scope
        </span>
        <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-white">
          What We Check
        </h2>
        <p className="mt-3 text-sm text-neutral-400">
          Comprehensive technical verification grouped into six core disciplines.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {CATEGORY_DEFINITIONS.map((cat) => {
          const Icon = iconMap[cat.iconName] || Server;
          const subItems = categorySubItems[cat.id] || [];

          return (
            <div
              key={cat.id}
              className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-6 flex flex-col justify-between hover:border-neutral-700 transition-colors group"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="h-10 w-10 rounded-lg border border-neutral-800 bg-neutral-950 flex items-center justify-center group-hover:border-cyan-500/40 transition-colors">
                    <Icon className="h-5 w-5 text-cyan-400" aria-hidden="true" />
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 border border-neutral-800 px-2 py-0.5 rounded bg-neutral-950">
                    {cat.badge}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-neutral-100 mb-1.5">
                  {cat.title}
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed mb-4">
                  {cat.summary}
                </p>

                {/* Sub items */}
                <ul className="space-y-2 border-t border-neutral-800/80 pt-4">
                  {subItems.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-neutral-300">
                      <Check className="h-3.5 w-3.5 text-cyan-400 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      {/* Clear product positioning note */}
      <div className="mt-8 rounded-lg border border-neutral-800 bg-neutral-950/60 p-4 flex items-center justify-center gap-2.5 text-xs text-neutral-400 text-center">
        <Info className="h-4 w-4 text-cyan-400 shrink-0" aria-hidden="true" />
        <span>
          <strong>Automated Launch Audit:</strong> 67 deterministic checks evaluated across live site crawls with verifiable evidence and zero AI hallucinations.
        </span>
      </div>
    </section>
  );
};
