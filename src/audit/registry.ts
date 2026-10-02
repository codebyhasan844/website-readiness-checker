/**
 * Audit Check Registry (Phase 3)
 *
 * Central registry managing all deterministic audit checks and categories.
 */

import { AuditCheck, FindingCategory } from './types';
import { ALL_AUDIT_CHECKS } from './checks';

export class AuditRegistry {
  private checks: Map<string, AuditCheck> = new Map();

  constructor() {
    for (const check of ALL_AUDIT_CHECKS) {
      this.checks.set(check.id, check);
    }
  }

  public getAllChecks(): AuditCheck[] {
    return Array.from(this.checks.values());
  }

  public getCheckById(id: string): AuditCheck | undefined {
    return this.checks.get(id);
  }

  public getChecksByCategory(category: FindingCategory): AuditCheck[] {
    return this.getAllChecks().filter((c) => c.category === category);
  }

  public registerCheck(check: AuditCheck): void {
    this.checks.set(check.id, check);
  }
}

export const defaultAuditRegistry = new AuditRegistry();
