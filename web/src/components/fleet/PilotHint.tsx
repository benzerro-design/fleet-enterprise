import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  /** Optional short label shown in the badge (default: HINT). */
  label?: string;
};

/**
 * Temporary help / pilot copy.
 *
 * Production cleanup: search the repo for `PilotHint` or `data-pilot-hint`
 * and remove every match (component + call sites).
 */
export function PilotHint({ children, className = "", label = "HINT" }: Props) {
  return (
    <div
      data-pilot-hint="true"
      data-pilot-hint-kind="help"
      className={`relative rounded-lg border border-dashed border-amber-700/50 bg-amber-950/15 px-3 py-2 text-[11px] leading-relaxed text-zinc-400 ${className}`.trim()}
    >
      <span
        data-pilot-hint-badge="true"
        className="mb-1 inline-flex rounded border border-amber-800/60 bg-amber-950/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amber-200/90"
      >
        {label}
      </span>
      <div className="text-zinc-400">{children}</div>
    </div>
  );
}
