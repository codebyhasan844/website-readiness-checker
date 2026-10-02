import React, { useState } from 'react';
import {
  AlertCircle,
  WifiOff,
  AlertTriangle,
  XCircle,
  RefreshCw,
  HelpCircle,
  ArrowRight
} from 'lucide-react';
import { UIErrorType } from '../types';

export const ErrorStatesShowcase: React.FC = () => {
  const [selectedState, setSelectedState] = useState<UIErrorType>('invalid_url');

  const errorStates = [
    {
      id: 'invalid_url' as UIErrorType,
      title: 'Invalid URL',
      badge: 'Input Validation',
      headline: 'Enter a valid website URL.',
      description: 'The supplied target is missing a valid scheme, hostname, or contains invalid characters.',
      actionText: 'Re-enter Target URL',
      icon: AlertCircle,
      color: 'rose',
      details: 'Error Code: E_INVALID_URL_FORMAT\nExpected format: https://domain.tld or https://sub.domain.tld\nObserved: "invalid-target-without-domain"',
    },
    {
      id: 'scan_failed' as UIErrorType,
      title: 'Scan Failed',
      badge: 'Execution Error',
      headline: 'Something went wrong while checking this website.',
      description: 'An unexpected runtime error occurred while processing the audit pipeline.',
      actionText: 'Retry Scan',
      icon: XCircle,
      color: 'rose',
      details: 'Error Code: E_PIPELINE_TERMINATION\nReason: Worker process terminated unexpectedly during analysis phase.\nDiagnostic ID: err_9921_trace',
    },
    {
      id: 'website_unreachable' as UIErrorType,
      title: 'Website Unreachable',
      badge: 'Network Issue',
      headline: 'The website could not be reached.',
      description: 'The target server failed to answer DNS queries, refused connections, or timed out before returning headers.',
      actionText: 'Check Server Status & Retry',
      icon: WifiOff,
      color: 'amber',
      details: 'Diagnostic Trace:\n- DNS lookup for target: SERVFAIL\n- Port 443 Handshake: ETIMEDOUT after 10000ms\n- Edge Proxy: No HTTP response generated',
    },
    {
      id: 'partial_result' as UIErrorType,
      title: 'Partial Result',
      badge: 'Degraded Scan',
      headline: 'Some checks could not be completed.',
      description: 'Core HTTP checks finished successfully, but secondary deep inspection tasks timed out or were blocked by rate limiting.',
      actionText: 'Review Completed Checks',
      icon: AlertTriangle,
      color: 'amber',
      details: 'Scan Health: DEGRADED (18/24 checks completed)\nSkipped Modules:\n- Asset Size Analysis (WAF Challenge Detected)\n- Full Route Traversal (Rate limit ceiling reached)',
    },
  ];

  const current = errorStates.find((s) => s.id === selectedState)!;
  const CurrentIcon = current.icon;

  return (
    <section
      id="error-states-section"
      className="mt-20 sm:mt-28 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8"
      aria-label="Error and Empty States UI Showcase"
    >
      <div className="text-center max-w-2xl mx-auto mb-8">
        <span className="text-xs font-mono font-medium uppercase tracking-widest text-cyan-400">
          State Modeling
        </span>
        <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Polished Error &amp; Empty States
        </h2>
        <p className="mt-3 text-sm text-neutral-400">
          The scanner UI accounts for edge-case failures gracefully with clear error hierarchy and recovery actions.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
        {errorStates.map((state) => (
          <button
            key={state.id}
            type="button"
            onClick={() => setSelectedState(state.id)}
            className={`px-3.5 py-2 rounded-lg text-xs font-mono font-medium transition-all ${
              selectedState === state.id
                ? 'bg-neutral-800 text-cyan-400 border border-cyan-500/50 shadow-sm'
                : 'bg-neutral-900/60 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
            }`}
          >
            {state.title}
          </button>
        ))}
      </div>

      {/* State Display Card */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 sm:p-8 backdrop-blur-sm max-w-2xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-5">
          <div
            className={`h-14 w-14 rounded-2xl border flex items-center justify-center shrink-0 ${
              current.color === 'rose'
                ? 'border-rose-800/60 bg-rose-950/40 text-rose-400'
                : 'border-amber-800/60 bg-amber-950/40 text-amber-400'
            }`}
          >
            <CurrentIcon className="h-7 w-7" />
          </div>

          <div className="space-y-3 flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span
                className={`text-[11px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${
                  current.color === 'rose'
                    ? 'border-rose-800/60 bg-rose-950/40 text-rose-300'
                    : 'border-amber-800/60 bg-amber-950/40 text-amber-300'
                }`}
              >
                {current.badge}
              </span>
              <span className="text-[11px] font-mono text-neutral-400">UI State Mock</span>
            </div>

            <h3 className="text-lg sm:text-xl font-bold text-white">
              {current.headline}
            </h3>

            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
              {current.description}
            </p>

            {/* Diagnostic trace */}
            <div className="mt-4 text-left">
              <span className="text-[10px] font-mono uppercase text-neutral-400 block mb-1">
                Diagnostic Details
              </span>
              <pre className="rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-[11px] font-mono text-neutral-400 whitespace-pre-wrap overflow-x-auto">
                {current.details}
              </pre>
            </div>

            {/* Recovery Action Button */}
            <div className="pt-2 flex justify-center sm:justify-start">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 px-4 py-2 text-xs font-semibold text-white border border-neutral-700 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>{current.actionText}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
