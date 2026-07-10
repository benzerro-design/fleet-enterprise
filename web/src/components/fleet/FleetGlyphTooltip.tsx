"use client";

import type { ReactNode } from "react";

type Props = {
  label: string;
  children: ReactNode;
  className?: string;
};

/** Tooltip vizibil la hover pentru iconițe din grile (fără click). */
export function FleetGlyphTooltip({ label, children, className }: Props) {
  return (
    <span className={`group/gtip relative inline-flex items-center ${className ?? ""}`}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 hidden max-w-[14rem] -translate-x-1/2 whitespace-normal rounded border border-zinc-600 bg-zinc-900 px-2 py-1 text-center text-[10px] leading-snug text-zinc-100 shadow-lg group-hover/gtip:block"
      >
        {label}
      </span>
    </span>
  );
}
