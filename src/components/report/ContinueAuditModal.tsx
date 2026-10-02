/**
 * Continue Audit Modal Component (Phase 4.1)
 *
 * Facilitates the Incremental Full-Site Audit workflow:
 * Audits the next batch of up to 50 pages without rescanning
 * pages already analyzed in previous batches of the current session.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Layers,
  X,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Globe,
  ArrowRight,
  Database
} from 'lucide-react';
import { ScanResult, ScanProgressEvent } from '../../scanner/types';
import { AuditCoverage } from '../../report/types';
import { consumeScanSseStream } from '../../utils/scan-sse';

interface ContinueAuditModalProps {
  url: string;
  isOpen: boolean;
  onClose: () => void;
  onBatchComplete: (newBatchScan: ScanResult) => void;
  coverage?: AuditCoverage;
  currentBatchIndex: number;
  sessionId: string;
  alreadyScannedUrls: string[];
  remainingUrls: string[];
  allDiscoveredUrls?: string[];
}

export const ContinueAuditModal: React.FC<ContinueAuditModalProps> = ({
  url,
  isOpen,
  onClose,
  onBatchComplete,
  coverage,
  currentBatchIndex,
  sessionId,
  alreadyScannedUrls,
  remainingUrls,
  allDiscoveredUrls,
}) => {
  const [isAuditing, setIsAuditing] = useState(false);
  const [progress, setProgress] = useState<ScanProgressEvent | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Keyboard accessibility: Escape key listener & focus management
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isAuditing) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    modalRef.current?.focus();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isAuditing, onClose]);

  if (!isOpen) return null;

  const nextBatchIndex = currentBatchIndex + 1;
  const pagesInNextBatch = Math.min(50, remainingUrls.length > 0 ? remainingUrls.length : 50);

  const handleStartNextBatch = async () => {
    setIsAuditing(true);
    setErrorMessage(null);
    setProgress({
      stage: 'validating',
      message: `Starting Batch ${nextBatchIndex} (${pagesInNextBatch} pages)...`,
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
        body: JSON.stringify({
          url,
          stream: true,
          sessionId,
          batchIndex: nextBatchIndex,
          alreadyScannedUrls,
          seedUrls: remainingUrls.slice(0, 50),
          allDiscoveredUrls,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Audit batch failed with HTTP status ${response.status}`
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Streaming response body not supported in browser.');
      }

      await consumeScanSseStream(reader, {
        onProgress: setProgress,
        onCompleted: (scan) => {
          setIsAuditing(false);
          onBatchComplete(scan);
          onClose();
        },
        onError: (message) => {
          setIsAuditing(false);
          setErrorMessage(message);
        },
        onCancelled: (message) => {
          setIsAuditing(false);
          setErrorMessage(message);
        },
      });
    } catch (err: unknown) {
      setIsAuditing(false);
      setErrorMessage(err instanceof Error ? err.message : 'Audit batch failed unexpectedly.');
    }
  };

  return (
    <div
      ref={modalRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="continue-audit-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in focus:outline-none"
    >
      <div className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900 p-6 space-y-6 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
              <Layers className={`h-4 w-4 ${isAuditing ? 'animate-pulse' : ''}`} aria-hidden="true" />
            </div>
            <div>
              <h3 id="continue-audit-modal-title" className="text-base font-bold text-white">
                Continue Audit — Batch {nextBatchIndex}
              </h3>
              <p className="text-xs text-neutral-400 font-mono">
                Incremental Multi-Batch Coverage
              </p>
            </div>
          </div>

          {!isAuditing && (
            <button
              type="button"
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-200 p-1 rounded-md hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 transition-colors"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Coverage Context Box */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between text-neutral-400">
            <span>Website Target:</span>
            <span className="text-neutral-200 font-semibold truncate max-w-[260px]">{url}</span>
          </div>

          <div className="flex items-center justify-between text-neutral-400">
            <span>Current Progress:</span>
            <span className="text-cyan-300">
              {alreadyScannedUrls.length} pages analyzed across {currentBatchIndex} {currentBatchIndex === 1 ? 'batch' : 'batches'}
            </span>
          </div>

          {coverage && (
            <div className="flex items-center justify-between text-neutral-400">
              <span>Remaining In Inventory:</span>
              <span className="text-amber-400 font-bold">
                {coverage.remainingCount} unanalyzed pages
              </span>
            </div>
          )}

          <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between text-neutral-400">
            <span>Next Batch Scope:</span>
            <span className="text-emerald-400 font-semibold">
              + Up to {pagesInNextBatch} pages
            </span>
          </div>
        </div>

        {/* Audit explanation */}
        <div className="text-xs text-neutral-300 leading-relaxed space-y-1.5">
          <p>
            The scanner will skip the <strong>{alreadyScannedUrls.length} previously analyzed pages</strong> and crawl the next queue of discovered URLs.
          </p>
          <p className="text-neutral-400">
            Upon completion, findings and coverage metrics are automatically aggregated into your cumulative report.
          </p>
        </div>

        {/* Live Progress Stage */}
        {isAuditing && progress && (
          <div className="rounded-xl border border-cyan-900/50 bg-cyan-950/20 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-cyan-300 flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                <span className="uppercase">{progress.stage}</span>
              </span>
              <span className="font-mono text-[11px] text-neutral-400">
                Step {progress.stepNumber} of {progress.totalSteps}
              </span>
            </div>

            <div className="w-full bg-neutral-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-cyan-500 h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.round((progress.stepNumber / progress.totalSteps) * 100)}%`,
                }}
              />
            </div>

            <p className="text-xs text-neutral-300 font-mono truncate">
              {progress.message}
            </p>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="rounded-xl border border-rose-800 bg-rose-950/40 p-4 text-xs text-rose-300 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Batch Audit Encountered An Error</p>
              <p className="text-rose-200/90">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
          {!isAuditing && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-neutral-800 bg-neutral-900 text-xs font-mono text-neutral-300 hover:bg-neutral-800 transition-colors"
            >
              Cancel
            </button>
          )}

          <button
            type="button"
            disabled={isAuditing}
            onClick={handleStartNextBatch}
            className={`inline-flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-mono font-semibold transition-all ${
              isAuditing
                ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                : 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-950/50'
            }`}
          >
            {isAuditing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Auditing Batch {nextBatchIndex}...</span>
              </>
            ) : (
              <>
                <span>Start Batch {nextBatchIndex} (+{pagesInNextBatch} Pages)</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
