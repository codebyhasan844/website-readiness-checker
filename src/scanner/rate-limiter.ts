/**
 * In-Memory Abuse & Rate Limiter (Phase 2)
 *
 * Enforces concurrent scan limits and per-client burst limits to prevent
 * the scanner from being leveraged as an unrestricted scanning proxy.
 */

import { ScannerException } from './errors';

export interface RateLimiterOptions {
  maxConcurrentScans: number;
  maxScansPerWindow: number;
  windowMs: number;
}

export class MemoryRateLimiter {
  private activeScans = 0;
  private clientHistory = new Map<string, number[]>();
  private readonly options: RateLimiterOptions;

  constructor(
    options: RateLimiterOptions = {
      maxConcurrentScans: 3,
      maxScansPerWindow: 15,
      windowMs: 5 * 60 * 1000, // 5 minutes
    }
  ) {
    this.options = options;
  }

  /**
   * Asserts whether a client IP can initiate a new scan.
   * Throws ScannerException(RATE_LIMITED) if limits are exceeded.
   */
  public acquire(clientKey: string): () => void {
    // 1. Check concurrent scans
    if (this.activeScans >= this.options.maxConcurrentScans) {
      throw new ScannerException(
        'RATE_LIMITED',
        'Scanner is currently handling maximum concurrent capacity. Please wait a moment and try again.',
        `Active scans: ${this.activeScans} >= ${this.options.maxConcurrentScans}`
      );
    }

    // 2. Check window rate limits
    const now = Date.now();
    this.pruneExpiredClientHistory(now);
    const timestamps = this.clientHistory.get(clientKey) || [];
    const recent = timestamps.filter((t) => now - t < this.options.windowMs);

    if (recent.length >= this.options.maxScansPerWindow) {
      throw new ScannerException(
        'RATE_LIMITED',
        `Rate limit exceeded. You can perform up to ${this.options.maxScansPerWindow} scans every 5 minutes.`,
        `Client ${clientKey} hit limit`
      );
    }

    recent.push(now);
    this.clientHistory.set(clientKey, recent);
    this.activeScans++;

    let released = false;
    return () => {
      if (!released) {
        released = true;
        this.activeScans = Math.max(0, this.activeScans - 1);
      }
    };
  }

  public getStats(): { activeScans: number; trackedClients: number } {
    return {
      activeScans: this.activeScans,
      trackedClients: this.clientHistory.size,
    };
  }

  private pruneExpiredClientHistory(now: number): void {
    for (const [clientKey, timestamps] of this.clientHistory) {
      const recent = timestamps.filter((timestamp) => now - timestamp < this.options.windowMs);
      if (recent.length === 0) {
        this.clientHistory.delete(clientKey);
      } else if (recent.length !== timestamps.length) {
        this.clientHistory.set(clientKey, recent);
      }
    }
  }
}

export const globalRateLimiter = new MemoryRateLimiter();
