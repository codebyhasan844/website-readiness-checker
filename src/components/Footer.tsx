import React from 'react';
import { ShieldCheck, Terminal, Heart } from 'lucide-react';

interface FooterProps {
  onNavigate: (path: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="mt-28 border-t border-neutral-800/80 bg-neutral-950 py-12 text-xs text-neutral-400">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand info */}
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900">
              <ShieldCheck className="h-4 w-4 text-cyan-400" />
            </div>
            <div>
              <span className="font-bold text-neutral-200">Website Readiness Checker</span>
              <span className="block text-[11px] text-neutral-400">
                Website Launch &amp; QA Platform
              </span>
            </div>
          </div>

          {/* Core Promise reminder */}
          <div className="text-center font-mono text-[11px] text-neutral-400">
            One URL. One Scan. One Clear Answer.
          </div>

          {/* Quick links */}
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/report/scan-demo-7492')}
              className="text-neutral-400 hover:text-cyan-400 transition-colors flex items-center gap-1 font-mono"
            >
              <Terminal className="h-3 w-3" aria-hidden="true" />
              <span>Demo Report</span>
            </button>
          </div>
        </div>

        {/* Technical boundary notice */}
        <div className="mt-8 pt-6 border-t border-neutral-900 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-neutral-400">
          <p>
            Deterministic Launch &amp; QA Engine • Bounded Crawler • Verifiable Evidence
          </p>
          <p className="font-mono">
            Zero AI hallucinations • 67 automated checks evaluated server-side.
          </p>
        </div>
      </div>
    </footer>
  );
};
