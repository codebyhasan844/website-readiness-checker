/**
 * Website Readiness Checker — Phase 1 Foundation & Premium UI
 * Website Launch & QA Platform
 * Core Promise: One URL. One Scan. One Clear Answer.
 *
 * Strictly Phase 1: Zero crawling, zero URL fetching, zero AI API, clean component architecture.
 */

import React, { useRef, useState } from 'react';
import { useRouter } from './utils/router';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { UrlScanInput } from './components/UrlScanInput';
import { ReportPreviewCard } from './components/ReportPreviewCard';
import { HowItWorks } from './components/HowItWorks';
import { WhatWeCheck } from './components/WhatWeCheck';
import { ErrorStatesShowcase } from './components/ErrorStatesShowcase';
import { ReportPage } from './components/report/ReportPage';
import { Footer } from './components/Footer';
import { ScanResult } from './scanner/types';

export default function App() {
  const { path, scanId, navigate } = useRouter();
  const urlInputRef = useRef<HTMLInputElement>(null);
  const [currentRealScan, setCurrentRealScan] = useState<ScanResult | null>(null);

  const handleFocusUrlInput = () => {
    urlInputRef.current?.focus();
    urlInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleScanComplete = (url: string, rawScan?: ScanResult) => {
    if (rawScan) {
      setCurrentRealScan(rawScan);
      navigate(`/report/${rawScan.scanId}`);
    } else {
      // Navigate to the demo report page
      navigate('/report/scan-demo-7492');
    }
  };

  const isReportRoute = path.startsWith('/report');

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-cyan-500/20 selection:text-cyan-200">
      {/* Accessibility Skip Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-cyan-600 focus:text-white focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-cyan-400 font-medium text-xs font-mono"
      >
        Skip to main content
      </a>

      {/* Top Navigation */}
      <Navbar
        currentPath={path}
        onNavigate={navigate}
        onFocusInput={handleFocusUrlInput}
      />

      {/* Main Content Area */}
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {isReportRoute ? (
          <ReportPage
            scanId={scanId}
            initialRawScan={currentRealScan}
            onNavigateHome={() => navigate('/')}
          />
        ) : (
          <div className="space-y-12 sm:space-y-16 pb-16">
            {/* 1. Hero Section */}
            <Hero />

            {/* 2. Interactive URL Input with full state support */}
            <UrlScanInput
              inputRef={urlInputRef}
              onScanComplete={handleScanComplete}
            />

            {/* 3. Realistic Static Report Preview */}
            <ReportPreviewCard
              onViewFullReport={() => navigate('/report/scan-demo-7492')}
            />

            {/* 4. How It Works (3 Steps) */}
            <HowItWorks />

            {/* 5. What We Check (6 Audit Categories) */}
            <WhatWeCheck />

            {/* 6. Polished Error & Empty States Showcase */}
            <ErrorStatesShowcase />
          </div>
        )}
      </main>

      {/* Footer */}
      <Footer onNavigate={navigate} />
    </div>
  );
}
