import React from 'react';
import {
  Server,
  Search,
  ShieldCheck,
  Zap,
  Eye,
  Network,
  Sparkles,
  Info
} from 'lucide-react';

const AUDIT_AREAS = [
  { name: 'Technical QA', icon: Server, desc: 'HTTP signals, DNS & uptime' },
  { name: 'SEO', icon: Search, desc: 'Headings, meta & canonicals' },
  { name: 'Security', icon: ShieldCheck, desc: 'Headers & TLS encryption' },
  { name: 'Performance', icon: Zap, desc: 'Asset weight & initial load' },
  { name: 'Accessibility', icon: Eye, desc: 'Semantic tags & contrast' },
  { name: 'Crawlability', icon: Network, desc: 'Robots.txt & XML sitemap' },
];

export const Hero: React.FC = () => {
  return (
    <section id="hero-section" className="relative pt-12 pb-8 sm:pt-20 sm:pb-12 overflow-hidden">
      {/* Subtle background ambient radial gradient */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-30"
        aria-hidden="true"
      >
        <div className="h-[420px] w-[680px] rounded-full bg-gradient-to-tr from-cyan-950/40 via-sky-900/20 to-transparent blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
        {/* Tagline Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/40 px-3.5 py-1.5 text-xs font-mono font-medium text-cyan-300 shadow-sm mb-6">
          <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
          <span>One URL. One Scan. One Clear Answer.</span>
        </div>

        {/* Primary Headline */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-neutral-100 leading-[1.15] max-w-4xl mx-auto">
          Know if your website is{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-300">
            ready to ship.
          </span>
        </h1>

        {/* Supporting Text */}
        <p className="mt-5 text-base sm:text-lg text-neutral-300 max-w-2xl mx-auto leading-relaxed">
          Run one comprehensive website check and uncover the technical issues that could hold your launch back.
        </p>

        {/* Audit categories - explicitly marked as product positioning preview */}
        <div className="mt-10 pt-6 border-t border-neutral-800/80">
          <div className="flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-wider text-neutral-400 mb-4">
            <span>Unified Audit Categories</span>
            <span className="text-neutral-600">•</span>
            <span className="text-neutral-400">Architectural Coverage</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 max-w-4xl mx-auto">
            {AUDIT_AREAS.map((area) => {
              const Icon = area.icon;
              return (
                <div
                  key={area.name}
                  className="flex flex-col items-center justify-center p-3 rounded-lg border border-neutral-800/90 bg-neutral-900/60 hover:bg-neutral-900 hover:border-neutral-700 transition-colors text-center group"
                >
                  <div className="p-2 rounded-md bg-neutral-950/80 border border-neutral-800 mb-2 group-hover:border-cyan-500/40 transition-colors">
                    <Icon className="h-4 w-4 text-cyan-400" aria-hidden="true" />
                  </div>
                  <span className="text-xs font-semibold text-neutral-200">{area.name}</span>
                  <span className="text-[10px] text-neutral-400 mt-0.5 leading-tight">{area.desc}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-neutral-400">
            <Info className="h-3.5 w-3.5 text-cyan-400 shrink-0" aria-hidden="true" />
            <span>Deterministic launch engine: 67 automated checks evaluated across technical QA, SEO, security, performance, accessibility, and crawlability.</span>
          </div>
        </div>
      </div>
    </section>
  );
};
