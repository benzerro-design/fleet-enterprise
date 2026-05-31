"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  matchesDateRange,
  matchesText,
  vehicleDetailFilterBarClass,
  vehicleDetailFilterInputClass,
  vehicleDetailFilterLabelClass,
} from "@/components/fleet/vehicle-detail-filter-styles";
import { MAINTENANCE_COST_ALLOCATION_OPTIONS, maintenanceCostAllocationLabel } from "@/lib/maintenance-cost-allocation";
import { formatRonFromCents } from "@/lib/money";

export type VehicleMaintenanceRow = {
  id: string;
  title: string;
  provider: string | null;
  costAllocationCode: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  performedAt: string | null;
  odometerKm: number | null;
  costCents: number | null;
};

type Props = {
  items: VehicleMaintenanceRow[];
  totalInDb: number;
  regQs: string;
};

export function VehicleMaintenancePanel({ items, totalInDb, regQs }: Props) {
  const [titleQ, setTitleQ] = useState("");
  const [allocation, setAllocation] = useState("");
  const [providerQ, setProviderQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filtered = useMemo(() => {
    return items.filter((row) => {
      if (!matchesText(row.title, titleQ)) return false;
      if (allocation && row.costAllocationCode !== allocation) return false;
      if (!matchesText(row.provider, providerQ)) return false;
      if (!matchesDateRange(row.performedAt, dateFrom, dateTo)) return false;
      return true;
    });
  }, [items, titleQ, allocation, providerQ, dateFrom, dateTo]);

  const totalCostCents = useMemo(
    () => filtered.reduce((sum, row) => sum + (row.costCents ?? 0), 0),
    [filtered],
  );

  const hasFilters = Boolean(titleQ.trim() || allocation || providerQ.trim() || dateFrom || dateTo);

  if (items.length === 0) {
    return <p className="mt-2 text-sm text-zinc-500">Nu există înregistrări de mentenanță.</p>;
  }

  return (
    <>
      <div className={vehicleDetailFilterBarClass}>
        <div className="flex min-w-[7rem] flex-1 flex-col gap-0.5">
          <span className={vehicleDetailFilterLabelClass}>Titlu</span>
          <input
            type="search"
            value={titleQ}
            onChange={(e) => setTitleQ(e.target.value)}
            placeholder="Caută…"
            className={`${vehicleDetailFilterInputClass} w-full`}
          />
        </div>
        <div className="flex min-w-[8rem] flex-col gap-0.5">
          <span className={vehicleDetailFilterLabelClass}>Alocare</span>
          <select
            value={allocation}
            onChange={(e) => setAllocation(e.target.value)}
            className={`${vehicleDetailFilterInputClass} w-full`}
          >
            <option value="">Toate</option>
            {MAINTENANCE_COST_ALLOCATION_OPTIONS.map((o) => (
              <option key={o.code} value={o.code}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-[7rem] flex-1 flex-col gap-0.5">
          <span className={vehicleDetailFilterLabelClass}>Furnizor</span>
          <input
            type="search"
            value={providerQ}
            onChange={(e) => setProviderQ(e.target.value)}
            placeholder="Caută…"
            className={`${vehicleDetailFilterInputClass} w-full`}
          />
        </div>
        <div className="flex min-w-[8.5rem] flex-col gap-0.5">
          <span className={vehicleDetailFilterLabelClass}>Data de la</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={vehicleDetailFilterInputClass}
          />
        </div>
        <div className="flex min-w-[8.5rem] flex-col gap-0.5">
          <span className={vehicleDetailFilterLabelClass}>Data până la</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={vehicleDetailFilterInputClass}
          />
        </div>
        {hasFilters ? (
          <button
            type="button"
            onClick={() => {
              setTitleQ("");
              setAllocation("");
              setProviderQ("");
              setDateFrom("");
              setDateTo("");
            }}
            className="rounded border border-zinc-800/80 px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-300"
          >
            Resetează
          </button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">Nicio înregistrare nu corespunde filtrelor.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-950 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Titlu</th>
                <th className="px-4 py-3">Alocare</th>
                <th className="px-4 py-3">Furnizor</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Km</th>
                <th className="px-4 py-3">Factură</th>
                <th className="px-4 py-3">Cost (RON fără TVA)</th>
                <th className="px-4 py-3 text-right">Detaliu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filtered.map((row) => (
                <tr key={row.id} className="bg-zinc-900/30">
                  <td className="px-4 py-3 text-zinc-200">{row.title}</td>
                  <td className="max-w-[9rem] truncate px-4 py-3 text-xs text-zinc-400">
                    {maintenanceCostAllocationLabel(row.costAllocationCode)}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{row.provider ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-300">
                    {row.performedAt ? new Date(row.performedAt).toLocaleDateString("ro-RO") : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-zinc-300">{row.odometerKm ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-400">{row.invoiceNumber ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-zinc-300">
                    {row.costCents != null ? formatRonFromCents(row.costCents) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/fleet/maintenance/${row.id}`} className="text-emerald-400 hover:underline">
                      Vezi
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/80 bg-zinc-950/40 px-4 py-2.5 text-xs">
            <span className="text-zinc-500">
              {filtered.length} {filtered.length === 1 ? "înregistrare" : "înregistrări"}
              {hasFilters ? " (filtrate)" : null}
            </span>
            <span className="text-zinc-400">
              Total cost{" "}
              <span className="font-mono text-sm text-zinc-200">{formatRonFromCents(totalCostCents)}</span>
              <span className="text-zinc-600"> RON fără TVA</span>
            </span>
          </div>
        </div>
      )}

      {totalInDb > items.length ? (
        <p className="mt-2 text-xs text-zinc-500">
          Afișate primele {items.length} din {totalInDb}. Filtrele se aplică pe aceste înregistrări.{" "}
          <Link href={`/fleet/maintenance?${regQs}`} className="text-emerald-400 hover:underline">
            Vezi restul în listă
          </Link>
        </p>
      ) : null}
    </>
  );
}

export function vehicleMaintenanceSummary(items: VehicleMaintenanceRow[], totalInDb: number): string {
  if (totalInDb === 0) return "Nicio intervenție";
  const totalCents = items.reduce((s, r) => s + (r.costCents ?? 0), 0);
  const countLabel = totalInDb === 1 ? "1 intervenție" : `${totalInDb} intervenții`;
  if (totalCents > 0) return `${countLabel} · ${formatRonFromCents(totalCents)} RON`;
  return countLabel;
}
