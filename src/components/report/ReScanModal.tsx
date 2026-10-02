/**
 * Re-scan Modal Component (Phase 4)
 *
 * Runs a fresh scan against the target website using the Phase 2 backend pipeline
 * (`POST /api/scan?stream=true`) with real-time SSE progress events.
 *
 * Creates a new ScanResult and new scan ID while preserving the previous scan
 * in memory for side-by-side comparison.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  RefreshCw,
  X,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Globe
} from 'lucide-react';
import { ScanResult, ScanProgressEvent } from '../../scanner/types';
import { consumeScanSseStream } from '../../utils/scan-sse';

interface ReScanModalProps {
  url: string;
  isOpen: boolean;
  onClose: () => void;
  onScanComplete: (newScan: ScanResult) => void;
}

export const ReScanModal: React.FC<ReScanModalProps> = ({
  url,
  isOpen,
  onClose,
  onScanComplete,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgressEvent | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Keyboard accessibility: Escape key listener & focus management
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isScanning) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    // Focus modal container
    modalRef.current?.focus();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isScanning, onClose]);

  if (!isOpen) return null;

  const handleStartReScan = async () => {
    setIsScanning(true);
    setErrorMessage(null);
    setProgress({
      stage: 'validating',
      message: 'Connecting to scan orchestrator...',
      stepNumber: 1,
      totalSteps: 7,
      timestamp: new Date().toISOString(),
    });

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
        throw new Error(
          errorData.message || `Scan failed with HTTP status ${response.status}`
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Streaming response body not supported in browser.');
      }

      await consumeScanSseStream(reader, {
        onProgress: setProgress,
        onCompleted: (scan) => {
          setIsScanning(false);
          onScanComplete(scan);
          onClose();
        },
        onError: (message) => {
          setIsScanning(false);
          setErrorMessage(message);
        },
        onCancelled: (message) => {
          setIsScanning(false);
          setErrorMessage(message);
        },
      });
    } catch (err: unknown) {
      setIsScanning(false);
      setErrorMessage(err instanceof Error ? err.message : 'Scan failed unexpectedly.');
    }
  };

  return (
    <div
      ref={modalRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rescan-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in focus:outline-none"
    >
      <div className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900 p-6 space-y-6 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
              <RefreshCw className={`h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} aria-hidden="true" />
            </div>
            <div>
              <h3 id="rescan-modal-title" className="text-base font-bold text-white">
                Re-scan Website
              </h3>
              <p className="text-xs text-neutral-400 font-mono">
                Trigger fresh verification crawl
              </p>
            </div>
          </div>

          {!isScanning && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-neutral-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="space-y-4">
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 space-y-2">
            <span className="text-[11px] font-mono uppercase text-neutral-400 flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-cyan-400" />
              Target Website
            </span>
            <p className="font-mono text-sm text-neutral-100 font-semibold break-all">
              {url}
            </p>
            <p className="text-xs text-neutral-400">
              A new scan will execute server-side, gather fresh telemetry, and generate a new scan ID without overwriting your current report.
            </p>
          </div>

          {/* Progress / Status feedback */}
          {isScanning && progress && (
            <div className="rounded-xl border border-cyan-900/60 bg-cyan-950/30 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-cyan-300 flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                  <span>Step {progress.stepNumber} of {progress.totalSteps}</span>
                </span>
                <span className="text-neutral-400 uppercase">{progress.stage}</span>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 w-full rounded-full bg-neutral-800 overflow-hidden">
                <div
                  className="h-full bg-cyan-500 transition-all duration-300"
                  style={{ width: `${(progress.stepNumber / progress.totalSteps) * 100}%` }}
                />
              </div>

              <p className="text-xs font-mono text-neutral-200">
                {progress.message}
              </p>
            </div>
          )}

          {errorMessage && (
            <div className="rounded-xl border border-rose-900/60 bg-rose-950/40 p-4 flex items-start gap-3 text-xs text-rose-200">
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold">Re-scan Error</span>
                <p>{errorMessage}</p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {!isScanning ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-neutral-800 bg-neutral-950 text-xs font-mono text-neutral-300 hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartReScan}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-mono font-semibold text-white shadow-lg shadow-cyan-950/50 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Start Fresh Re-scan</span>
              </button>
            </>
          ) : (
            <div className="text-xs font-mono text-neutral-400 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Scanning safely within limits...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
