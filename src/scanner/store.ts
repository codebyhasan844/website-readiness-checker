/**
 * Scan Results Store (Phase 2)
 *
 * Provides in-memory retention for active and completed raw scan results.
 */

import { ScanResult } from './types';

class ScanResultsStore {
  private results = new Map<string, ScanResult>();

  public set(scan: ScanResult): void {
    // Keep max 50 recent scans in memory
    if (this.results.size >= 50) {
      const oldestKey = this.results.keys().next().value;
      if (oldestKey) this.results.delete(oldestKey);
    }
    this.results.set(scan.scanId, scan);
  }

  public get(scanId: string): ScanResult | undefined {
    return this.results.get(scanId);
  }

  public has(scanId: string): boolean {
    return this.results.has(scanId);
  }

  public getAll(): ScanResult[] {
    return Array.from(this.results.values());
  }

  public clear(): void {
    this.results.clear();
  }
}

export const globalScanStore = new ScanResultsStore();
