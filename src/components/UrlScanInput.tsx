import React, { useState, useRef } from 'react';
import {
  Globe,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  SlidersHorizontal,
  ExternalLink,
  ShieldAlert,
  Zap,
  Activity
} from 'lucide-react';
import { ScanState, ScanSimulationStep } from '../types';
import { SCAN_SIMULATION_STEPS } from '../data/mockData';
import { ScanResult, ScanProgressEvent } from '../scanner/types';
import { consumeScanSseStream } from '../utils/scan-sse';

interface UrlScanInputProps {
  onScanComplete?: (url: string, rawScan?: ScanResult) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

const REAL_SCAN_STAGES: ScanSimulationStep[] = [
  {
    id: 'validating',
    stepNumber: 1,
    label: 'Validating URL',
    description: 'Verifying syntax, scheme, and normalizing host parameters',
    status: 'waiting',
  },
  {
    id: 'connecting',
    stepNumber: 2,
    label: 'Connecting & Verifying DNS',
    description: 'Enforcing SSRF boundaries, safe ports (80/443), and DNS rebinding protection',
    status: 'waiting',
  },
  {
    id: 'fetching_homepage',
    stepNumber: 3,
    label: 'Fetching homepage',
    description: 'Connecting to target server, handling redirects, and recording security headers',
    status: 'waiting',
  },
  {
    id: 'discovering_pages',
    stepNumber: 4,
    label: 'Discovering pages',
    description: 'Checking robots.txt directives and parsing XML sitemaps',
    status: 'waiting',
  },
  {
    id: 'crawling_pages',
    stepNumber: 5,
    label: 'Crawling pages',
    description: 'Crawling internal linked pages within depth and limit boundaries',
    status: 'waiting',
  },
  {
    id: 'analyzing_resources',
    stepNumber: 6,
    label: 'Analyzing resources',
    description: 'Sampling referenced CSS, JS, font, and image response facts safely',
    status: 'waiting',
  },
  {
    id: 'preparing_results',
    stepNumber: 7,
    label: 'Preparing results',
    description: 'Assembling strongly typed raw facts, links, and timing telemetry',
    status: 'waiting',
  },
];

export const UrlScanInput: React.FC<UrlScanInputProps> = ({ onScanComplete, inputRef }) => {
  const [url, setUrl] = useState('https://yourwebsite.com');
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDisabled, setIsDisabled] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [steps, setSteps] = useState<ScanSimulationStep[]>(REAL_SCAN_STAGES);
  const [showStateTester, setShowStateTester] = useState(false);
  const [isEngineMode, setIsEngineMode] = useState<'real' | 'simulation'>('real');
  const [liveTelemetry, setLiveTelemetry] = useState<{
    stageMessage: string;
    currentUrl?: string;
    pagesCrawled?: number;
    pagesDiscovered?: number;
  }>({ stageMessage: '' });
  const [completedScan, setCompletedScan] = useState<ScanResult | null>(null);

  const localInputRef = useRef<HTMLInputElement>(null);
  const activeInputRef = inputRef || localInputRef;

  // Simple client-side format check before sending to server
  const isValidUrlFormat = (val: string): boolean => {
    if (!val.trim()) return false;
    try {
      const parsed = new URL(val.startsWith('http://') || val.startsWith('https://') ? val : `https://${val}`);
      return parsed.hostname.includes('.') && parsed.hostname.length > 3;
    } catch {
      return false;
    }
  };

  const isCurrentInputValid = isValidUrlFormat(url);

  // Execute REAL Phase 2 Server Scanner with SSE Streaming
  const startRealScan = async () => {
    if (isDisabled) return;

    if (!isCurrentInputValid) {
      setScanState('failed');
      setErrorMessage('Enter a valid website URL. Example: https://yourwebsite.com');
      return;
    }

    setErrorMessage(null);
    setScanState('scanning');
    setCurrentStepIndex(0);
    setCompletedScan(null);
    setLiveTelemetry({ stageMessage: 'Initiating scan engine...' });

    // Initialize 7 real steps
    setSteps(
      REAL_SCAN_STAGES.map((s, idx) => ({
        ...s,
        status: idx === 0 ? 'in_progress' : 'waiting',
      }))
    );

    try {
      const response = await fetch('/api/scan?stream=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ url, stream: true }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setScanState('failed');
        setErrorMessage(
          errorData.message ||
            `Scan rejected (${response.status}): ${response.statusText}`
        );
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Streaming response body not supported by browser.');
      }

      await consumeScanSseStream(reader, {
        onProgress: (progress: ScanProgressEvent) => {
          const stepIdx = Math.max(0, Math.min(progress.stepNumber - 1, REAL_SCAN_STAGES.length - 1));
          setCurrentStepIndex(stepIdx);
          setLiveTelemetry({
            stageMessage: progress.message,
            currentUrl: progress.currentUrl,
            pagesCrawled: progress.pagesCrawled,
            pagesDiscovered: progress.pagesDiscovered,
          });

          setSteps((prev) =>
            prev.map((s, idx) => {
              if (idx < stepIdx) return { ...s, status: 'completed' };
              if (idx === stepIdx) return { ...s, status: 'in_progress' };
              return { ...s, status: 'waiting' };
            })
          );
        },
        onCompleted: (finalResult: ScanResult) => {
          setCompletedScan(finalResult);
          setSteps((prev) => prev.map((s) => ({ ...s, status: 'completed' })));
          setScanState('completed');
        },
        onError: (message: string) => {
          setScanState('failed');
          setErrorMessage(message || 'Scan stopped due to security or network restriction.');
        },
        onCancelled: () => {
          setCompletedScan(null);
          setErrorMessage(null);
          setLiveTelemetry({ stageMessage: '' });
          setCurrentStepIndex(0);
          setSteps(REAL_SCAN_STAGES.map((step) => ({ ...step, status: 'waiting' })));
          setScanState('idle');
        },
        onServerShutdown: () => {
          setScanState('failed');
          setErrorMessage('The scanner is temporarily unavailable because the server is shutting down.');
        },
      });
    } catch (err: unknown) {
      // Fallback: If server is unavailable (e.g. preview mode without express proxy), notify clearly
      setScanState('failed');
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to connect to backend scanner service.'
      );
    }
  };

  // Run mock scanning progression for Phase 1 simulation mode
  const startMockScan = (forceFailure = false) => {
    if (isDisabled) return;

    if (!isCurrentInputValid) {
      setScanState('failed');
      setErrorMessage('Enter a valid website URL. Example: https://yourwebsite.com');
      return;
    }

    setErrorMessage(null);
    setScanState('validating');
    setCurrentStepIndex(0);
    setCompletedScan(null);

    setSteps(
      SCAN_SIMULATION_STEPS.map((s, idx) => ({
        ...s,
        status: idx === 0 ? 'in_progress' : 'waiting',
      }))
    );

    setTimeout(() => {
      setScanState('scanning');
      advanceMockStep(0, forceFailure);
    }, 600);
  };

  const advanceMockStep = (stepIdx: number, forceFailure: boolean) => {
    if (forceFailure && stepIdx === 2) {
      setSteps((prev) =>
        prev.map((s, idx) =>
          idx === stepIdx
            ? { ...s, status: 'in_progress' }
            : idx < stepIdx
            ? { ...s, status: 'completed' }
            : s
        )
      );
      setTimeout(() => {
        setScanState('failed');
        setErrorMessage('Simulation: Website could not be reached (TCP Timeout). This demonstrates the error state.');
      }, 700);
      return;
    }

    if (stepIdx >= SCAN_SIMULATION_STEPS.length) {
      setScanState('completed');
      return;
    }

    setCurrentStepIndex(stepIdx);
    setSteps((prev) =>
      prev.map((s, idx) => {
        if (idx < stepIdx) return { ...s, status: 'completed' };
        if (idx === stepIdx) return { ...s, status: 'in_progress' };
        return { ...s, status: 'waiting' };
      })
    );

    const stepDelay = stepIdx === 4 ? 800 : 650;
    setTimeout(() => {
      if (stepIdx + 1 < SCAN_SIMULATION_STEPS.length) {
        advanceMockStep(stepIdx + 1, forceFailure);
      } else {
        setSteps((prev) => prev.map((s) => ({ ...s, status: 'completed' })));
        setScanState('completed');
      }
    }, stepDelay);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
    if (errorMessage) setErrorMessage(null);
    if (scanState !== 'idle') setScanState('idle');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEngineMode === 'real') {
      startRealScan();
    } else {
      startMockScan(false);
    }
  };

  // State tester actions for QA inspection
  const setTestState = (state: 'idle' | 'valid' | 'invalid' | 'disabled' | 'error' | 'loading' | 'completed') => {
    setIsDisabled(false);
    setErrorMessage(null);

    switch (state) {
      case 'idle':
        setUrl('https://yourwebsite.com');
        setScanState('idle');
        break;
      case 'valid':
        setUrl('https://production-ready-app.dev');
        setScanState('idle');
        break;
      case 'invalid':
        setUrl('invalid-domain-without-tld');
        setScanState('failed');
        setErrorMessage('Enter a valid website URL.');
        break;
      case 'disabled':
        setUrl('https://yourwebsite.com');
        setIsDisabled(true);
        setScanState('idle');
        break;
      case 'error':
        setUrl('https://unreachable-host.internal');
        setScanState('failed');
        setErrorMessage('The website could not be reached.');
        break;
      case 'loading':
        setUrl('https://demo-launch-store.io');
        startMockScan(false);
        break;
      case 'completed':
        setUrl('https://demo-launch-store.io');
        setScanState('completed');
        setSteps(SCAN_SIMULATION_STEPS.map((s) => ({ ...s, status: 'completed' })));
        break;
    }
  };

  return (
    <div id="url-scan-wrapper" className="w-full max-w-3xl mx-auto px-4 sm:px-0">
      {/* Primary Input Card */}
      <div
        className={`relative rounded-xl border p-2 sm:p-2.5 transition-all duration-200 bg-neutral-900/90 shadow-2xl ${
          scanState === 'failed' || errorMessage
            ? 'border-rose-500/70 shadow-rose-950/20'
            : scanState === 'scanning' || scanState === 'validating'
            ? 'border-cyan-500/80 shadow-cyan-950/30'
            : isCurrentInputValid && url !== 'https://yourwebsite.com'
            ? 'border-emerald-500/60 shadow-emerald-950/10'
            : 'border-neutral-700/80 hover:border-neutral-600 focus-within:border-cyan-500/80'
        }`}
      >
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Accessible label for screen readers */}
          <label htmlFor="target-url-input" className="sr-only">
            Target Website URL to check
          </label>

          {/* Input field with icon */}
          <div className="relative flex-1 flex items-center min-w-0">
            <div className="pointer-events-none pl-3.5 pr-2 flex items-center text-neutral-400">
              <Globe className="h-5 w-5" aria-hidden="true" />
            </div>
            <input
              id="target-url-input"
              ref={activeInputRef}
              type="text"
              value={url}
              onChange={handleInputChange}
              disabled={isDisabled || scanState === 'scanning' || scanState === 'validating'}
              placeholder="https://yourwebsite.com"
              aria-label="Target Website URL to check"
              aria-invalid={Boolean(errorMessage)}
              aria-describedby={errorMessage ? 'url-input-error' : undefined}
              className="w-full bg-transparent py-3 pr-9 text-sm sm:text-base font-mono text-neutral-100 placeholder:text-neutral-400 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            />

            {/* Validation status badge inside input */}
            <div className="absolute right-2 flex items-center" aria-hidden="true">
              {scanState === 'scanning' || scanState === 'validating' ? (
                <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
              ) : isCurrentInputValid && url.length > 10 ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : errorMessage ? (
                <AlertCircle className="h-4 w-4 text-rose-400" />
              ) : null}
            </div>
          </div>

          {/* Action button */}
          <div className="flex items-center gap-2">
            <button
              id="scan-website-btn"
              type="submit"
              disabled={isDisabled || scanState === 'scanning' || scanState === 'validating'}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-cyan-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap min-h-[44px]"
            >
              {scanState === 'validating' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Validating...</span>
                </>
              ) : scanState === 'scanning' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Scanning...</span>
                </>
              ) : (
                <>
                  <span>Scan Website</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Engine mode switcher & state tester toggle */}
        <div className="mt-2.5 pt-2 border-t border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400 px-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono">Engine:</span>
            <button
              type="button"
              onClick={() => setIsEngineMode('real')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                isEngineMode === 'real'
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                  : 'hover:text-neutral-200'
              }`}
            >
              Real Engine (Phase 2)
            </button>
            <button
              type="button"
              onClick={() => setIsEngineMode('simulation')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                isEngineMode === 'simulation'
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                  : 'hover:text-neutral-200'
              }`}
            >
              Simulation (Phase 1)
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowStateTester(!showStateTester)}
            className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-cyan-300 transition-colors"
          >
            <SlidersHorizontal className="h-3 w-3" />
            <span>{showStateTester ? 'Hide UI Tester' : 'UI States'}</span>
          </button>
        </div>

        {/* Error message inline */}
        {errorMessage && (
          <div
            id="url-input-error"
            role="alert"
            className="mt-2.5 flex items-start gap-2 rounded-lg bg-rose-950/40 border border-rose-900/60 p-2.5 text-xs text-rose-300 animate-in fade-in"
          >
            <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 flex items-center justify-between">
              <span>{errorMessage}</span>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-rose-400 hover:text-rose-200 text-xs ml-2 font-mono underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Scanning progress sequence */}
        {(scanState === 'scanning' || scanState === 'validating') && (
          <div
            id="scan-progress-panel"
            aria-live="polite"
            className="mt-3 pt-3 border-t border-neutral-800 space-y-2 animate-in fade-in"
          >
            <div className="flex items-center justify-between text-xs font-mono text-cyan-300">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                {isEngineMode === 'real'
                  ? 'REAL SCANNER ENGINE EXECUTING'
                  : 'MOCK SCAN SEQUENCE IN PROGRESS'}
              </span>
              <span>Step {currentStepIndex + 1} of {steps.length}</span>
            </div>

            {liveTelemetry.stageMessage && isEngineMode === 'real' && (
              <div className="p-2 rounded bg-neutral-950 border border-cyan-900/40 text-xs font-mono text-cyan-200">
                <p className="truncate">→ {liveTelemetry.stageMessage}</p>
                {liveTelemetry.currentUrl && (
                  <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                    Target: {liveTelemetry.currentUrl}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5 pt-1">
              {steps.map((step, idx) => (
                <div
                  key={step.id}
                  className={`flex items-center justify-between p-2 rounded-md text-xs transition-colors ${
                    step.status === 'in_progress'
                      ? 'bg-cyan-950/50 border border-cyan-800/60 text-cyan-200'
                      : step.status === 'completed'
                      ? 'bg-neutral-950/50 text-neutral-300'
                      : 'text-neutral-400'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {step.status === 'completed' ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    ) : step.status === 'in_progress' ? (
                      <Loader2 className="h-3.5 w-3.5 text-cyan-400 animate-spin shrink-0" />
                    ) : (
                      <span className="h-3.5 w-3.5 rounded-full border border-neutral-700 flex items-center justify-center text-[9px] font-mono text-neutral-400 shrink-0">
                        {idx + 1}
                      </span>
                    )}
                    <span className={step.status === 'in_progress' ? 'font-medium text-white' : ''}>
                      {step.label}
                    </span>
                  </div>
                  <span className="text-[11px] text-neutral-400 hidden sm:inline">{step.description}</span>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-neutral-400 pt-1 text-center font-mono">
              {isEngineMode === 'real'
                ? 'Bounded server-side fetcher • SSRF guarded • Max 20 pages'
                : 'Demo simulation only • No network requests made to target server'}
            </p>
          </div>
        )}

        {/* Scan completed state */}
        {scanState === 'completed' && (
          <div
            id="scan-completed-panel"
            className="mt-3 pt-3 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-emerald-950/20 border border-emerald-800/40 rounded-lg p-3 animate-in fade-in"
          >
            <div className="flex items-center gap-2.5 text-xs text-emerald-300">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <div>
                <p className="font-semibold text-white">
                  {completedScan ? 'Live Website Scan Completed' : 'Mock Scan Simulation Completed'}
                </p>
                <p className="text-neutral-400 text-[11px]">
                  {completedScan
                    ? `Collected raw facts across ${completedScan.pages.length} crawled pages`
                    : 'Structured readiness findings ready for inspection'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setScanState('idle')}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-neutral-700 text-xs text-neutral-300 hover:bg-neutral-800"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Reset</span>
              </button>
              <button
                type="button"
                onClick={() => onScanComplete?.(url, completedScan || undefined)}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow"
              >
                <span>View Full Report</span>
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* State Tester Panel for QA Verification */}
      {showStateTester && (
        <div
          id="scan-state-tester"
          className="mt-3 p-3 rounded-lg border border-neutral-800 bg-neutral-900/60 text-xs text-neutral-300 space-y-2 animate-in fade-in"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-cyan-400 font-semibold">Interactive UI State Tester (QA Verification)</span>
            <span className="text-[10px] text-neutral-400">Phase 1 + 2 QA</span>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setTestState('idle')}
              className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[11px] font-mono"
            >
              1. Idle
            </button>
            <button
              type="button"
              onClick={() => setTestState('valid')}
              className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[11px] font-mono text-emerald-400"
            >
              2. Valid Input
            </button>
            <button
              type="button"
              onClick={() => setTestState('invalid')}
              className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[11px] font-mono text-rose-400"
            >
              3. Invalid Input
            </button>
            <button
              type="button"
              onClick={() => setTestState('disabled')}
              className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[11px] font-mono text-neutral-400"
            >
              4. Disabled
            </button>
            <button
              type="button"
              onClick={() => setTestState('loading')}
              className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[11px] font-mono text-cyan-400"
            >
              5. Sim Sequence
            </button>
            <button
              type="button"
              onClick={() => setTestState('completed')}
              className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[11px] font-mono text-emerald-300"
            >
              6. Completed
            </button>
            <button
              type="button"
              onClick={() => setTestState('error')}
              className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[11px] font-mono text-rose-300"
            >
              7. Error State
            </button>
            <button
              type="button"
              onClick={() => startMockScan(true)}
              className="px-2.5 py-1 rounded bg-rose-950/60 border border-rose-800 hover:bg-rose-900/60 text-[11px] font-mono text-rose-200"
            >
              8. Sim Failure
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
