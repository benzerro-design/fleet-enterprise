"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDateRo } from "@/lib/datetime-local";
import {
  formatMoneyCents,
  workOrdersBrowserBase,
  workOrderStatusLabel,
  type WorkOrderListPayload,
  type WorkOrderListRow,
} from "@/lib/work-orders-api";

type Props = {
  vehicleId: string;
  currentWorkOrderId: string;
  /** Partner list base path */
  listBasePath?: string;
};

export function PartnerVehicleHistoryPanel({
  vehicleId,
  currentWorkOrderId,
  listBasePath = "/fleet/partner/work-orders",
}: Props) {
  const [items, setItems] = useState<WorkOrderListRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `${workOrdersBrowserBase}?vehicleId=${encodeURIComponent(vehicleId)}&pageSize=20&inbox=all`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          if (!cancelled) setError(`HTTP ${res.status}`);
          return;
        }
        const data = (await res.json()) as WorkOrderListPayload;
        if (cancelled) return;
        const others = (data.items ?? []).filter((r) => r.id !== currentWorkOrderId);
        setItems(others);
        setError(null);
      } catch {
        if (!cancelled) setError("Nu am putut încărca istoricul.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [vehicleId, currentWorkOrderId]);

  const preview = (items ?? []).slice(0, 5);
  const more = (items?.length ?? 0) - preview.length;

  return (
    <div className="mt-3 border-t border-zinc-800 pt-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Istoric la atelierul tău
        </p>
        <Link
          href={`${listBasePath}?vehicleId=${encodeURIComponent(vehicleId)}`}
          className="text-[10px] text-sky-400 hover:underline"
        >
          Vezi tot →
        </Link>
      </div>
      {error ? <p className="mt-1 text-[10px] text-red-400">{error}</p> : null}
      {items === null && !error ? (
        <p className="mt-1 text-[10px] text-zinc-600">Se încarcă…</p>
      ) : null}
      {items && items.length === 0 ? (
        <p className="mt-1 text-[10px] text-zinc-600">Nicio comandă anterioară pe acest vehicul.</p>
      ) : null}
      {preview.length > 0 ? (
        <ul className="mt-1.5 space-y-1">
          {preview.map((row) => (
            <li key={row.id}>
              <Link
                href={`${listBasePath}/${row.id}`}
                className="block rounded border border-zinc-800/80 bg-zinc-950/40 px-2 py-1 hover:border-zinc-700"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-violet-300">
                    {row.displayNumber ?? row.id.slice(0, 8)}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    {formatDateRo(row.createdAt.slice(0, 10))}
                  </span>
                </div>
                <div className="truncate text-[10px] text-zinc-400">
                  {workOrderStatusLabel(row.status)}
                  {row.quoteSummary.totalGrossCents != null
                    ? ` · ${formatMoneyCents(row.quoteSummary.totalGrossCents, row.quoteSummary.currency ?? "RON")}`
                    : ""}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {more > 0 ? (
        <p className="mt-1 text-[10px] text-zinc-600">+{more} mai vechi pe listă filtrată</p>
      ) : null}
    </div>
  );
}
