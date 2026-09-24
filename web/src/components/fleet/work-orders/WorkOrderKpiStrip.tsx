"use client";

import Link from "next/link";
import type { WorkOrderStats } from "@/lib/work-orders-api";

type Props = {
  stats: WorkOrderStats;
  /** Optional deep-links per KPI (CRM-006). */
  links?: {
    open?: string;
    pendingApproval?: string;
    inProgress?: string;
    waitingParts?: string;
    readyUninvoiced?: string;
    done?: string;
  };
};

export function WorkOrderKpiStrip({ stats, links }: Props) {
  const items = [
    { key: "open" as const, label: "Deschise", value: stats.open, warn: false },
    {
      key: "pendingApproval" as const,
      label: "Așteaptă aprobare",
      value: stats.pendingApproval,
      warn: stats.pendingApproval > 0,
    },
    { key: "inProgress" as const, label: "În lucru", value: stats.inProgress, warn: false },
    {
      key: "waitingParts" as const,
      label: "Așteaptă piese",
      value: stats.waitingParts,
      warn: stats.waitingParts > 0,
    },
    {
      key: "readyUninvoiced" as const,
      label: "Gata, nefacturat",
      value: stats.readyUninvoiced,
      warn: stats.readyUninvoiced > 0,
    },
    { key: "done" as const, label: "Finalizate", value: stats.done, warn: false },
  ];

  return (
    <div className="flex flex-wrap gap-3 border-b border-zinc-800 pb-4">
      {items.map((k) => {
        const href = links?.[k.key];
        const className = `min-w-[5.5rem] rounded-lg border px-3 py-2 transition ${
          k.warn ? "border-amber-700/50 bg-amber-950/20" : "border-zinc-800 bg-zinc-900/40"
        } ${href ? "hover:border-sky-700/60 hover:bg-zinc-900/80" : ""}`;
        const inner = (
          <>
            <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{k.label}</div>
            <div className={`mt-0.5 text-lg font-semibold ${k.warn ? "text-amber-200" : "text-zinc-200"}`}>
              {k.value}
            </div>
          </>
        );
        if (href) {
          return (
            <Link key={k.key} href={href} className={`block ${className}`}>
              {inner}
            </Link>
          );
        }
        return (
          <div key={k.key} className={className}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
