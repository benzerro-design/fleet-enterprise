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
import { COST_CATEGORY_VALUES } from "@/lib/cost-categories";
import { isFuelCostCategory } from "@/lib/fuel-ops";
import { formatRonFromCents } from "@/lib/money";

export type VehicleCostRow = {
  id: string;
  category: string;
  provider: string | null;
  amountCents: number;
  odometerKm: number | null;
  fuelLiters: number | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  incurredOn: string;
};

type Props = {
  items: VehicleCostRow[];
  totalInDb: number;
  regQs: string;
};

export function VehicleCostsPanel({ items, totalInDb, regQs }: Props) {
  const [category, setCategory] = useState("");
  const [providerQ, setProviderQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const categoriesInData = useMemo(() => {
    const known = new Set<string>(COST_CATEGORY_VALUES);
    const extras = items.map((r) => r.category).filter((c) => c && !known.has(c));
    return [...COST_CATEGORY_VALUES, ...Array.from(new Set(extras))];
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((row) => {
      if (category && row.category !== category) return false;
      if (!matchesText(row.provider, providerQ)) return false;
      if (!matchesDateRange(row.incurredOn, dateFrom, dateTo)) return false;
      return true;
    });
  }, [items, category, providerQ, dateFrom, dateTo]);

  const totalAmountCents = useMemo(
    () => filtered.reduce((sum, row) => sum + row.amountCents, 0),
    [filtered],
  );

  const hasFilters = Boolean(category || providerQ.trim() || dateFrom || dateTo);

  if (items.length === 0) {
    return <p className="mt-2 text-sm text-zinc-500">Nu există costuri înregistrate.</p>;
  }

  return (
    <>
      <div className={vehicleDetailFilterBarClass}>
        <div className="flex min-w-[8rem] flex-col gap-0.5">
          <span className={vehicleDetailFilterLabelClass}>Categorie</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={`${vehicleDetailFilterInputClass} w-full`}
          >
            <option value="">Toate</option>
            {categoriesInData.map((c) => (
              <option key={c} value={c}>
                {c}
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
              setCategory("");
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
                <th className="px-4 py-3">Categorie</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Furnizor</th>
                <th className="px-4 py-3">Km</th>
                <th className="px-4 py-3">Litri</th>
                <th className="px-4 py-3">Factură</th>
                <th className="px-4 py-3">Suma (RON fără TVA)</th>
                <th className="px-4 py-3 text-right">Detaliu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filtered.map((row) => (
                <tr key={row.id} className="bg-zinc-900/30">
                  <td className="px-4 py-3 text-zinc-200">{row.category}</td>
                  <td className="px-4 py-3 text-zinc-300">
                    {new Date(row.incurredOn).toLocaleDateString("ro-RO")}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{row.provider ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-zinc-300">{row.odometerKm ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-zinc-300">
                    {isFuelCostCategory(row.category) && row.fuelLiters != null ? `${row.fuelLiters} L` : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-400">{row.invoiceNumber ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-zinc-300">{formatRonFromCents(row.amountCents)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/fleet/costs/${row.id}`} className="text-emerald-400 hover:underline">
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
              Total{" "}
              <span className="font-mono text-sm text-zinc-200">{formatRonFromCents(totalAmountCents)}</span>
              <span className="text-zinc-600"> RON fără TVA</span>
            </span>
          </div>
        </div>
      )}

      {totalInDb > items.length ? (
        <p className="mt-2 text-xs text-zinc-500">
          Afișate primele {items.length} din {totalInDb}. Filtrele se aplică pe aceste înregistrări.{" "}
          <Link href={`/fleet/costs?${regQs}`} className="text-emerald-400 hover:underline">
            Vezi restul în listă
          </Link>
        </p>
      ) : null}
    </>
  );
}

export function vehicleCostsSummary(items: VehicleCostRow[], totalInDb: number): string {
  if (totalInDb === 0) return "Niciun cost";
  const totalCents = items.reduce((s, r) => s + r.amountCents, 0);
  const countLabel = totalInDb === 1 ? "1 cost" : `${totalInDb} costuri`;
  return `${countLabel} · ${formatRonFromCents(totalCents)} RON`;
}
