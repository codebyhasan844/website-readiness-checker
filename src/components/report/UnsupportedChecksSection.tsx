import React from 'react';
import { UnsupportedCheck } from '../../audit/types';
import { ShieldAlert, Info } from 'lucide-react';

interface UnsupportedChecksSectionProps {
  unsupportedChecks: UnsupportedCheck[];
}

export const UnsupportedChecksSection: React.FC<UnsupportedChecksSectionProps> = ({
  unsupportedChecks,
}) => {
  if (!unsupportedChecks || unsupportedChecks.length === 0) return null;

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 space-y-4" aria-label="Unsupported Checks">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-400" aria-hidden="true" />
          <h2 className="text-base font-semibold text-neutral-100">
            Intentionally Unsupported Checks ({unsupportedChecks.length})
          </h2>
        </div>
        <span className="text-xs font-mono text-neutral-400 px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700">
          Zero Fabricated Facts
        </span>
      </div>

      <p className="text-xs text-neutral-400 leading-relaxed">
        To maintain strict audit integrity, Website Readiness Checker never guesses or fabricates evidence.
        The following checks are marked as unsupported because they exceed bounded HTTP scanner boundaries or require specialized host-level access:
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
        {unsupportedChecks.map((item) => (
          <div
            key={item.id}
            className="p-3.5 rounded-lg border border-neutral-800/80 bg-neutral-950/70 space-y-2 text-xs"
          >
            <div className="flex items-start gap-1.5 font-medium text-neutral-200">
              <Info className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{item.name}</span>
            </div>
            <p className="text-neutral-400 text-[11px] leading-relaxed pl-5">
              {item.reason}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};
