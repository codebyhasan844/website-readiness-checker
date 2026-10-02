import React, { useState } from 'react';
import { ShieldCheck, Menu, X, ArrowUpRight, Terminal } from 'lucide-react';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onFocusInput?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPath, onNavigate, onFocusInput }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (sectionId: string) => {
    setMobileMenuOpen(false);
    if (currentPath !== '/') {
      onNavigate('/');
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const el = document.getElementById(sectionId);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header
      id="main-navbar"
      className="sticky top-0 z-50 w-full border-b border-neutral-800/80 bg-neutral-950/85 backdrop-blur-md transition-colors"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo & Name */}
        <button
          id="nav-logo-btn"
          type="button"
          onClick={() => {
            setMobileMenuOpen(false);
            onNavigate('/');
          }}
          className="group flex items-center gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded-md p-1 -m-1"
          aria-label="Website Readiness Checker Home"
        >
          <div className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 shadow-inner group-hover:border-cyan-500/50 transition-colors">
            <ShieldCheck className="h-5 w-5 text-cyan-400" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-neutral-100 text-base">
                Website Readiness Checker
              </span>
              <span className="hidden sm:inline-flex items-center rounded-md border border-cyan-500/30 bg-cyan-950/40 px-1.5 py-0.5 text-[10px] font-mono font-medium text-cyan-300">
                Launch &amp; QA
              </span>
            </div>
            <span className="hidden md:block text-[11px] text-neutral-400 font-normal">
              Website Launch &amp; QA Platform
            </span>
          </div>
        </button>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-6" aria-label="Main Navigation">
          <button
            id="nav-link-how-it-works"
            type="button"
            onClick={() => handleNavClick('how-it-works')}
            className="text-sm font-medium text-neutral-400 hover:text-neutral-100 transition-colors"
          >
            How It Works
          </button>
          <button
            id="nav-link-what-we-check"
            type="button"
            onClick={() => handleNavClick('what-we-check')}
            className="text-sm font-medium text-neutral-400 hover:text-neutral-100 transition-colors"
          >
            What We Check
          </button>
          <button
            id="nav-link-sample-report"
            type="button"
            onClick={() => onNavigate('/report/scan-demo-7492')}
            className={`text-sm font-medium flex items-center gap-1.5 transition-colors ${
              currentPath.startsWith('/report')
                ? 'text-cyan-400 font-semibold'
                : 'text-neutral-400 hover:text-neutral-100'
            }`}
          >
            <Terminal className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Sample Report</span>
          </button>
        </nav>

        {/* CTA Button */}
        <div className="hidden md:flex items-center gap-3">
          <button
            id="nav-cta-scan-btn"
            type="button"
            onClick={() => {
              if (currentPath !== '/') {
                onNavigate('/');
                setTimeout(() => onFocusInput?.(), 100);
              } else {
                onFocusInput?.();
              }
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900 px-3.5 py-2 text-xs font-semibold text-neutral-100 hover:bg-neutral-800 hover:border-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 transition-all shadow-sm"
          >
            <span>Scan Website</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-neutral-400" aria-hidden="true" />
          </button>
        </div>

        {/* Mobile menu trigger */}
        <div className="flex md:hidden">
          <button
            id="mobile-menu-toggle-btn"
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="inline-flex items-center justify-center rounded-lg p-2 text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-menu"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          id="mobile-nav-menu"
          className="border-b border-neutral-800 bg-neutral-950 px-4 pt-3 pb-5 md:hidden space-y-3 animate-in fade-in slide-in-from-top-2"
        >
          <div className="flex flex-col space-y-2">
            <button
              id="mobile-link-how-it-works"
              type="button"
              onClick={() => handleNavClick('how-it-works')}
              className="text-left px-3 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-900 rounded-md"
            >
              How It Works
            </button>
            <button
              id="mobile-link-what-we-check"
              type="button"
              onClick={() => handleNavClick('what-we-check')}
              className="text-left px-3 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-900 rounded-md"
            >
              What We Check
            </button>
            <button
              id="mobile-link-sample-report"
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onNavigate('/report/scan-demo-7492');
              }}
              className="text-left px-3 py-2 text-sm font-medium text-cyan-400 hover:bg-neutral-900 rounded-md flex items-center justify-between"
            >
              <span>Sample Report (Interactive)</span>
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
          <div className="pt-2">
            <button
              id="mobile-link-scan-btn"
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                if (currentPath !== '/') {
                  onNavigate('/');
                  setTimeout(() => onFocusInput?.(), 100);
                } else {
                  onFocusInput?.();
                }
              }}
              className="w-full text-center rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500 transition-colors"
            >
              Scan Website Now
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
