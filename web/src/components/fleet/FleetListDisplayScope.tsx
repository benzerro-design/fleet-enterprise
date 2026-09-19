"use client";

import type { ReactNode } from "react";
import { useFleetListDisplayPrefs } from "@/components/fleet/useFleetListDisplayPrefs";

type Props = {
  children: ReactNode;
  /** Ascunde controalele (ex. embed). Preferințele rămân active. */
  hideToolbar?: boolean;
  className?: string;
};

/**
 * FLEET-028: densitate listă + delimitare rânduri (localStorage per browser).
 */
export function FleetListDisplayScope({ children, hideToolbar = false, className = "" }: Props) {
  const { prefs, setDensity, setRowDividers } = useFleetListDisplayPrefs();

  const btn =
    "rounded-md border px-2.5 py-1 text-xs transition-colors disabled:opacity-50";
  const active = "border-emerald-500/50 bg-emerald-950/40 text-emerald-200";
  const idle = "border-zinc-700 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200";

  const bodyClass = [
    "fleet-list-display-body",
    prefs.density === "simple"
      ? [
          "[&_article]:!p-2.5",
          "[&_[data-fleet-list-extra]]:hidden",
          "[&_td]:!py-1.5 [&_th]:!py-1.5",
          "[&_.fleet-list-card-stack]:gap-0",
          "[&_.fleet-list-card-stack>article]:rounded-none",
          "[&_.fleet-list-card-stack>article]:border-x-0",
          "[&_.fleet-list-card-stack>article]:bg-transparent",
        ].join(" ")
      : "",
    prefs.density === "simple" && prefs.rowDividers
      ? "[&_.fleet-list-card-stack>article]:border-b [&_.fleet-list-card-stack>article]:border-zinc-800/90 [&_.fleet-list-card-stack>article]:border-t-0"
      : "",
    prefs.density === "simple" && !prefs.rowDividers
      ? "[&_.fleet-list-card-stack>article]:border-0"
      : "",
    !prefs.rowDividers
      ? "[&_tbody.divide-y>:not([hidden])~:not([hidden])]:!border-t-0"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`fleet-list-display ${className}`.trim()}>
      {!hideToolbar ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Afișare
          </span>
          <button
            type="button"
            className={`${btn} ${prefs.density === "detailed" ? active : idle}`}
            onClick={() => setDensity("detailed")}
          >
            Detaliat
          </button>
          <button
            type="button"
            className={`${btn} ${prefs.density === "simple" ? active : idle}`}
            onClick={() => setDensity("simple")}
          >
            Simplu
          </button>
          <span className="mx-1 hidden h-4 w-px bg-zinc-700 sm:inline-block" aria-hidden />
          <button
            type="button"
            className={`${btn} ${prefs.rowDividers ? active : idle}`}
            onClick={() => setRowDividers(!prefs.rowDividers)}
            title="Linie fină între rânduri"
          >
            {prefs.rowDividers ? "Cu linii" : "Fără linii"}
          </button>
        </div>
      ) : null}
      <div className={bodyClass}>{children}</div>
    </div>
  );
}
