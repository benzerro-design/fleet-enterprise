"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  tireEventTypeLabel,
  tireHubAlertKindLabel,
  tireHubLocationLabel,
  type TireHubInventoryLocation,
  type TireHubInventorySet,
  type TireHubPayload,
} from "@/lib/tire-hub-api";
import { vehicleTireSeasonLabel } from "@/lib/vehicle-wheels-types";

type LocFilter = "all" | TireHubInventoryLocation;

type Props = { hub: TireHubPayload };

function formatRon(cents: number | null): string {
  if (cents == null) return "—";
  return `${(cents / 100).toLocaleString("ro-RO", { minimumFractionDigits: 0 })} lei`;
}

export function TireHubInventory({ hub }: Props) {
  const rows = hub.inventorySets ?? [];
  const [loc, setLoc] = useState<LocFilter>("all");
  const [season, setSeason] = useState<string>("all");
  const [clientId, setClientId] = useState<string>("all");
  const [supplierId, setSupplierId] = useState<string>("all");
  const [q, setQ] = useState("");
  const [drawer, setDrawer] = useState<TireHubInventorySet | null>(null);

  const clients = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) map.set(r.clientId, `${r.clientCode} — ${r.clientName}`);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "ro"));
  }, [rows]);

  const suppliers = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (r.supplierId && r.supplierName) map.set(r.supplierId, r.supplierName);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "ro"));
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (loc !== "all" && r.location !== loc) return false;
      if (season !== "all" && r.season !== season) return false;
      if (clientId !== "all" && r.clientId !== clientId) return false;
      if (supplierId !== "all" && r.supplierId !== supplierId) return false;
      if (!needle) return true;
      return (
        r.plate.toLowerCase().includes(needle) ||
        r.setId.toLowerCase().includes(needle) ||
        (r.setName?.toLowerCase().includes(needle) ?? false) ||
        (r.supplierName?.toLowerCase().includes(needle) ?? false) ||
        (r.locationCode?.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [rows, loc, season, clientId, supplierId, q]);

  function applyKpiFilter(next: LocFilter | "tread" | "dot" | "replace") {
    if (next === "tread" || next === "dot" || next === "replace") {
      setLoc("all");
      setQ("");
      return;
    }
    setLoc(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => applyKpiFilter("on_vehicle")}
          className={`rounded-lg border px-3 py-1.5 text-xs ${loc === "on_vehicle" ? "border-emerald-600 bg-emerald-950/40 text-emerald-200" : "border-zinc-700 text-zinc-300 hover:bg-zinc-900"}`}
        >
          Montate ({hub.summary.setsMounted})
        </button>
        <button
          type="button"
          onClick={() => applyKpiFilter("at_supplier_hotel")}
          className={`rounded-lg border px-3 py-1.5 text-xs ${loc === "at_supplier_hotel" ? "border-emerald-600 bg-emerald-950/40 text-emerald-200" : "border-zinc-700 text-zinc-300 hover:bg-zinc-900"}`}
        >
          Hotel ({hub.summary.setsAtHotel})
        </button>
        <button
          type="button"
          onClick={() => applyKpiFilter("at_client")}
          className={`rounded-lg border px-3 py-1.5 text-xs ${loc === "at_client" ? "border-emerald-600 bg-emerald-950/40 text-emerald-200" : "border-zinc-700 text-zinc-300 hover:bg-zinc-900"}`}
        >
          La client ({hub.summary.setsAtClient})
        </button>
        <button
          type="button"
          onClick={() => setLoc("all")}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-900"
        >
          Toate
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs text-zinc-500">
          Căutare
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="placă, set, furnizor, raft"
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
        </label>
        <label className="flex min-w-[8rem] flex-col gap-1 text-xs text-zinc-500">
          Sezon
          <select
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          >
            <option value="all">Toate</option>
            <option value="summer">Vară</option>
            <option value="winter">Iarnă</option>
            <option value="all_season">All-season</option>
            <option value="unknown">Necunoscut</option>
          </select>
        </label>
        <label className="flex min-w-[10rem] flex-col gap-1 text-xs text-zinc-500">
          Client
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          >
            <option value="all">Toți</option>
            {clients.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[10rem] flex-col gap-1 text-xs text-zinc-500">
          Furnizor hotel
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          >
            <option value="all">Toți</option>
            {suppliers.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-xs text-zinc-500">
        {filtered.length} seturi
        {filtered.length !== rows.length ? ` (din ${rows.length})` : ""}
      </p>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-500">
          Niciun set în filtrul curent.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-900/60 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-medium">Placă</th>
                <th className="px-3 py-2 font-medium">Set / sezon</th>
                <th className="px-3 py-2 font-medium">Locație</th>
                <th className="px-3 py-2 font-medium">Hotel / raft</th>
                <th className="px-3 py-2 font-medium">Uzură / DOT</th>
                <th className="px-3 py-2 font-medium">Km / cost</th>
                <th className="px-3 py-2 font-medium">Set opus</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {filtered.map((r) => (
                <tr key={r.setId} className="hover:bg-zinc-900/40">
                  <td className="px-3 py-2">
                    <p className="font-medium text-zinc-100">{r.plate}</p>
                    <p className="text-[11px] text-zinc-500">
                      {r.clientCode} · {r.clientName}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-zinc-300">
                    <p>{r.setName ?? "—"}</p>
                    <p className="text-[11px] text-zinc-500">
                      {vehicleTireSeasonLabel(r.season)} · {r.itemCount} buc
                      {r.alertKinds.length
                        ? ` · ${r.alertKinds.map((k) => tireHubAlertKindLabel(k)).join(", ")}`
                        : ""}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-zinc-300">{tireHubLocationLabel(r.location)}</td>
                  <td className="px-3 py-2 text-zinc-400">
                    {r.atHotel ? (
                      <>
                        <p className="text-zinc-200">{r.supplierName ?? "Furnizor ?"}</p>
                        <p className="text-[11px] text-zinc-500">
                          {r.locationCode ? `Raft ${r.locationCode}` : "Fără raft"}
                          {r.checkInAt
                            ? ` · din ${new Date(r.checkInAt).toLocaleDateString("ro-RO")}`
                            : ""}
                        </p>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-zinc-400">
                    {r.minTreadMm != null ? `${r.minTreadMm.toFixed(1)} mm` : "—"}
                    {r.worstDot ? ` · DOT ${r.worstDot}` : ""}
                    {r.assetsRecommendedReplace > 0 ? (
                      <span className="ml-1 text-amber-300">· replace {r.assetsRecommendedReplace}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-zinc-400">
                    <p className="text-[11px]">
                      {r.lastMountKm != null ? `↑ ${r.lastMountKm.toLocaleString("ro-RO")} km` : "↑ —"}
                      {" · "}
                      {r.lastDemountKm != null
                        ? `↓ ${r.lastDemountKm.toLocaleString("ro-RO")} km`
                        : "↓ —"}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {(r.costCount ?? 0) > 0
                        ? `${formatRon(r.costCentsTotal ?? 0)} (${r.costCount})`
                        : "fără costuri"}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    {r.hasOppositeSeasonStored ? (
                      <span className="text-emerald-400">Da</span>
                    ) : (
                      <span className="text-amber-300">Lipsă</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Link
                        href={r.hrefWheels}
                        className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-100 hover:bg-zinc-800"
                      >
                        Roți
                      </Link>
                      <button
                        type="button"
                        onClick={() => setDrawer(r)}
                        className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-100 hover:bg-zinc-800"
                      >
                        Detalii
                      </button>
                      <Link
                        href={r.hrefCreateTicket}
                        className="rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-2.5 py-1 text-xs text-emerald-200 hover:bg-emerald-950/50"
                      >
                        Tichet sezon
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {drawer ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50" role="dialog" aria-modal>
          <button
            type="button"
            className="flex-1 cursor-default"
            aria-label="Închide"
            onClick={() => setDrawer(null)}
          />
          <aside className="h-full w-full max-w-md overflow-y-auto border-l border-zinc-800 bg-zinc-950 p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">Detalii set</p>
                <h3 className="mt-1 text-lg font-semibold text-zinc-100">
                  {drawer.plate}
                  {drawer.setName ? ` · ${drawer.setName}` : ""}
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  {vehicleTireSeasonLabel(drawer.season)} · {tireHubLocationLabel(drawer.location)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrawer(null)}
                className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-900"
              >
                Închide
              </button>
            </div>

            <dl className="mt-5 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-xs text-zinc-500">Ultim montaj km</dt>
                  <dd className="text-zinc-200">
                    {drawer.lastMountKm != null
                      ? `${drawer.lastMountKm.toLocaleString("ro-RO")} km`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-zinc-500">Ultim demontaj km</dt>
                  <dd className="text-zinc-200">
                    {drawer.lastDemountKm != null
                      ? `${drawer.lastDemountKm.toLocaleString("ro-RO")} km`
                      : "—"}
                  </dd>
                </div>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Costuri legate (set)</dt>
                <dd className="text-zinc-200">
                  {(drawer.costCount ?? 0) > 0
                    ? `${formatRon(drawer.costCentsTotal ?? 0)} · ${drawer.costCount} înregistrări`
                    : "Niciun CostEntry pe acest set"}
                </dd>
              </div>
            </dl>

            {(drawer.atHotel || drawer.stayId) && (
              <div className="mt-6">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Stay hotel
                </h4>
                <dl className="mt-3 space-y-3 text-sm">
                  <div>
                    <dt className="text-xs text-zinc-500">Furnizor</dt>
                    <dd className="text-zinc-200">{drawer.supplierName ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-zinc-500">Raft / locație</dt>
                    <dd className="text-zinc-200">{drawer.locationCode ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-zinc-500">Check-in</dt>
                    <dd className="text-zinc-200">
                      {drawer.checkInAt
                        ? new Date(drawer.checkInAt).toLocaleString("ro-RO")
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-zinc-500">Contract / taxă / poze</dt>
                    <dd className="text-zinc-200">
                      {drawer.contractRef ?? "—"} · {formatRon(drawer.feeCents)} ·{" "}
                      {drawer.photoCount} poze
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-zinc-500">Note uzură intake</dt>
                    <dd className="whitespace-pre-wrap text-zinc-300">
                      {drawer.intakeTreadNotes?.trim() || "—"}
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            <div className="mt-6">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Istoric recent
              </h4>
              {(drawer.recentEvents?.length ?? 0) === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">
                  Niciun eveniment încă (montaj/demontaj din WO tip R popula istoricul).
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {drawer.recentEvents!.map((ev) => (
                    <li
                      key={ev.id}
                      className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm"
                    >
                      <p className="font-medium text-zinc-200">{tireEventTypeLabel(ev.type)}</p>
                      <p className="text-[11px] text-zinc-500">
                        {new Date(ev.createdAt).toLocaleString("ro-RO")}
                        {ev.odometerKm != null
                          ? ` · ${ev.odometerKm.toLocaleString("ro-RO")} km`
                          : ""}
                        {ev.workOrderId ? (
                          <>
                            {" · "}
                            <Link
                              href={`/fleet/work-orders/${ev.workOrderId}`}
                              className="text-sky-400 hover:underline"
                            >
                              WO
                            </Link>
                          </>
                        ) : null}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="mt-6 text-xs text-zinc-600">
              Mutările check-in/out rămân în portalul partener / WO tip R. Hubul e read-only.
            </p>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
