"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { fleetBrowserBase, fleetJsonHeaders } from "@/lib/fleet-api";
import {
  tireEventTypeLabel,
  tireHubAlertKindLabel,
  tireHubLocationLabel,
  type TireHubInventoryLocation,
  type TireHubInventorySet,
  type TireHubPayload,
} from "@/lib/tire-hub-api";
import { formatClientDisplay } from "@/lib/client-display";
import {
  tireMountedAsHint,
  tireMountedAsLabel,
  vehicleTireSeasonLabel,
  type TireMountedAs,
  type VehicleTireSeason,
} from "@/lib/vehicle-wheels-types";

type LocFilter = "all" | TireHubInventoryLocation;

type Props = {
  hub: TireHubPayload;
  canWrite?: boolean;
  /** Pre-filtrează inventarul pe vehicul (din Roti → Inventar). */
  initialVehicleId?: string | null;
  /** Deschide drawer pe set dacă există în inventar. */
  initialSetId?: string | null;
};

type VehicleOpt = { id: string; registrationNumber: string };

function formatRon(cents: number | null): string {
  if (cents == null) return "—";
  return `${(cents / 100).toLocaleString("ro-RO", { minimumFractionDigits: 0 })} lei`;
}

export function TireHubInventory({
  hub,
  canWrite = false,
  initialVehicleId = null,
  initialSetId = null,
}: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(hub.inventorySets ?? []);
  const [loc, setLoc] = useState<LocFilter>("all");
  const [season, setSeason] = useState<string>("all");
  const [clientId, setClientId] = useState<string>("all");
  const [supplierId, setSupplierId] = useState<string>("all");
  const [vehicleFilter, setVehicleFilter] = useState<string>(initialVehicleId?.trim() || "all");
  const [q, setQ] = useState("");
  const deepLinkConsumed = useRef(false);
  const [drawer, setDrawer] = useState<TireHubInventorySet | null>(() => {
    const sid = initialSetId?.trim();
    if (!sid) return null;
    const row = (hub.inventorySets ?? []).find((r) => r.setId === sid) ?? null;
    if (row) deepLinkConsumed.current = true;
    return row;
  });
  const [addOpen, setAddOpen] = useState(false);
  const [vehicles, setVehicles] = useState<VehicleOpt[]>([]);
  const [addVehicleId, setAddVehicleId] = useState("");
  const [addSeason, setAddSeason] = useState<VehicleTireSeason>("winter");
  const [addMountedAs, setAddMountedAs] = useState<TireMountedAs>("on_rim");
  const [addSeed, setAddSeed] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [opError, setOpError] = useState<string | null>(null);

  useEffect(() => {
    setRows(hub.inventorySets ?? []);
  }, [hub.inventorySets]);

  useEffect(() => {
    if (initialVehicleId?.trim()) setVehicleFilter(initialVehicleId.trim());
  }, [initialVehicleId]);

  useEffect(() => {
    if (deepLinkConsumed.current) return;
    const sid = initialSetId?.trim();
    if (!sid) return;
    const row = (hub.inventorySets ?? []).find((r) => r.setId === sid);
    if (!row) return;
    deepLinkConsumed.current = true;
    setDrawer(row);
  }, [initialSetId, hub.inventorySets]);

  useEffect(() => {
    if (!addOpen || !canWrite) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${fleetBrowserBase}/vehicles?page=1&pageSize=200`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          items?: Array<{ id: string; registrationNumber: string }>;
        };
        if (cancelled) return;
        const list = (data.items ?? []).map((v) => ({
          id: v.id,
          registrationNumber: v.registrationNumber,
        }));
        setVehicles(list);
        if (list[0] && !addVehicleId) setAddVehicleId(list[0].id);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [addOpen, canWrite, addVehicleId]);

  const clients = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) map.set(r.clientId, formatClientDisplay(r.clientCode, r.clientName));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "ro"));
  }, [rows]);

  const suppliers = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (r.supplierId && r.supplierName) map.set(r.supplierId, r.supplierName);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "ro"));
  }, [rows]);

  const vehicleOpts = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) map.set(r.vehicleId, r.plate);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "ro"));
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (vehicleFilter !== "all" && r.vehicleId !== vehicleFilter) return false;
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
  }, [rows, vehicleFilter, loc, season, clientId, supplierId, q]);

  function applyKpiFilter(next: LocFilter | "tread" | "dot" | "replace") {
    if (next === "tread" || next === "dot" || next === "replace") {
      setLoc("all");
      setQ("");
      return;
    }
    setLoc(next);
  }

  async function submitAddSet() {
    if (!canWrite || !addVehicleId) return;
    setPending("add");
    setOpError(null);
    try {
      const res = await fetch(`${fleetBrowserBase}/vehicles/${addVehicleId}/tire-sets`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          season: addSeason,
          mountedAs: addMountedAs,
          seedFrom: addSeed ? "mounted_specs" : "empty",
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      setAddOpen(false);
      router.refresh();
    } catch (e) {
      setOpError(e instanceof Error ? e.message : "Adăugare eșuată");
    } finally {
      setPending(null);
    }
  }

  async function scrapSet(row: TireHubInventorySet) {
    if (!canWrite) return;
    if (row.isMounted) {
      setOpError("Nu poți casa setul montat — demontează / schimbă sezon mai întâi.");
      return;
    }
    if (row.atHotel) {
      setOpError("Nu poți casa un set cu sejur hotel deschis — check-out mai întâi.");
      return;
    }
    if (
      !window.confirm(
        `Casezi setul ${row.setName ?? vehicleTireSeasonLabel(row.season)} pe ${row.plate}?`,
      )
    ) {
      return;
    }
    setPending(`scrap-${row.setId}`);
    setOpError(null);
    try {
      const res = await fetch(
        `${fleetBrowserBase}/tires/sets/${encodeURIComponent(row.setId)}/scrap`,
        {
          method: "POST",
          headers: fleetJsonHeaders(),
          body: JSON.stringify({}),
        },
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      setRows((prev) => prev.filter((r) => r.setId !== row.setId));
      if (drawer?.setId === row.setId) setDrawer(null);
      router.refresh();
    } catch (e) {
      setOpError(e instanceof Error ? e.message : "Casare eșuată");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-xs text-zinc-400">
        <p className="text-zinc-200">Privire de ansamblu — toate seturile din flota vizibilă.</p>
        <p className="mt-1">
          Filtrează după unde sunt (montat / hotel / la client), cine e clientul sau furnizorul de
          hotel, ce sezon e pe etichetă, apoi deschide fișa pe Roți pentru ce / cum / când.
        </p>
      </div>
      {canWrite ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-zinc-500">
            Operații set (admin/manager): adăugare set de schimb și casare din inventar.
          </p>
          <button
            type="button"
            onClick={() => {
              setOpError(null);
              setAddOpen(true);
            }}
            className="rounded-lg border border-emerald-700/60 bg-emerald-950/30 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-950/50"
          >
            Adaugă set
          </button>
        </div>
      ) : null}
      {opError ? (
        <p className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-100">
          {opError}
        </p>
      ) : null}

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
          onClick={() => applyKpiFilter("other")}
          className={`rounded-lg border px-3 py-1.5 text-xs ${loc === "other" ? "border-emerald-600 bg-emerald-950/40 text-emerald-200" : "border-zinc-700 text-zinc-300 hover:bg-zinc-900"}`}
        >
          Altele ({rows.filter((r) => r.location === "other").length})
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
        <label className="flex min-w-[9rem] flex-col gap-1 text-xs text-zinc-500">
          Vehicul
          <select
            value={vehicleFilter}
            onChange={(e) => setVehicleFilter(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          >
            <option value="all">Toate</option>
            {vehicleOpts.map(([id, plate]) => (
              <option key={id} value={id}>
                {plate}
              </option>
            ))}
          </select>
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
                      {formatClientDisplay(r.clientCode, r.clientName)}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-zinc-300">
                    <p className="flex flex-wrap items-center gap-1.5">
                      <span>{r.setName ?? "—"}</span>
                      <span
                        className="rounded bg-sky-950/50 px-1.5 py-0.5 text-[10px] text-sky-200"
                        title={tireMountedAsHint(
                          (r.mountedAs as TireMountedAs) === "tyre_only" ? "tyre_only" : "on_rim",
                        )}
                      >
                        {tireMountedAsLabel(
                          (r.mountedAs as TireMountedAs) === "tyre_only" ? "tyre_only" : "on_rim",
                        )}
                      </span>
                      {r.seasonLabelMismatch ? (
                        <span
                          className="rounded bg-amber-950/50 px-1.5 py-0.5 text-[10px] text-amber-200"
                          title={`Etichetă set: ${vehicleTireSeasonLabel(r.season)}; anvelope: ${vehicleTireSeasonLabel(r.itemsSeason ?? "unknown")}`}
                        >
                          Sezon nealiniat
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {vehicleTireSeasonLabel(r.season)} · {r.itemCount} buc
                      {r.dominantBrand ? ` · ${r.dominantBrand}` : ""}
                      {r.dominantSize ? ` · ${r.dominantSize}` : ""}
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
                      {canWrite && !r.isMounted && !r.atHotel ? (
                        <button
                          type="button"
                          disabled={pending === `scrap-${r.setId}`}
                          onClick={() => void scrapSet(r)}
                          className="rounded-lg border border-red-900/50 px-2.5 py-1 text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                        >
                          Casare
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {addOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal>
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-100">Adaugă set de schimb</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Același flux ca pe tab Roți: sezon + tip (roți / anvelope) pe un vehicul din scope.
            </p>
            <div className="mt-4 space-y-3 text-sm">
              <label className="block text-xs text-zinc-500">
                Vehicul
                <select
                  value={addVehicleId}
                  onChange={(e) => setAddVehicleId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
                >
                  {vehicles.length === 0 ? <option value="">Se încarcă…</option> : null}
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.registrationNumber}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-zinc-500">
                Sezon
                <select
                  value={addSeason}
                  onChange={(e) => setAddSeason(e.target.value as VehicleTireSeason)}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
                >
                  <option value="summer">Vară</option>
                  <option value="winter">Iarnă</option>
                  <option value="all_season">All-season</option>
                </select>
              </label>
              <label className="block text-xs text-zinc-500">
                Tip set
                <select
                  value={addMountedAs}
                  onChange={(e) => setAddMountedAs(e.target.value as TireMountedAs)}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
                  title={tireMountedAsHint(addMountedAs)}
                >
                  <option value="on_rim">Set roți (pe jantă)</option>
                  <option value="tyre_only">Set anvelope (fără jantă)</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-400">
                <input
                  type="checkbox"
                  checked={addSeed}
                  onChange={(e) => setAddSeed(e.target.checked)}
                  className="rounded border-zinc-600 bg-zinc-900"
                />
                Copiază specificații de pe setul montat (fără DOT/uzură)
              </label>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900"
              >
                Anulează
              </button>
              <button
                type="button"
                disabled={pending === "add" || !addVehicleId}
                onClick={() => void submitAddSet()}
                className="rounded-lg border border-emerald-700/60 bg-emerald-950/40 px-3 py-1.5 text-xs text-emerald-100 disabled:opacity-50"
              >
                {pending === "add" ? "Se adaugă…" : "Salvează set"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
                  {vehicleTireSeasonLabel(drawer.season)} ·{" "}
                  {tireMountedAsLabel(
                    (drawer.mountedAs as TireMountedAs) === "tyre_only" ? "tyre_only" : "on_rim",
                  )}{" "}
                  · {tireHubLocationLabel(drawer.location)}
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

            <div className="mt-6">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Anvelope în set
              </h4>
              {(drawer.items?.length ?? 0) === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">Nicio anvelopă legată de set.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {drawer.items!.map((it) => (
                    <li
                      key={it.assetId}
                      className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm"
                    >
                      <p className="font-medium text-zinc-200">
                        {it.position ? it.position.toUpperCase() : "—"}
                        {it.brand || it.model
                          ? ` · ${[it.brand, it.model].filter(Boolean).join(" ")}`
                          : ""}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {it.size ?? "size ?"}
                        {it.treadMm != null ? ` · ${it.treadMm.toFixed(1)} mm` : " · uzură —"}
                        {it.dot ? ` · DOT ${it.dot}` : ""}
                        {it.serialOrQr ? ` · ${it.serialOrQr}` : ""}
                        {it.recommendedReplace ? " · înlocuire" : ""}
                        {it.runFlat ? " · RF" : ""}
                        {it.tpmsSensorPresent ? " · TPMS" : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

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
              Mutările check-in/out și protocoalele PV semnate (custodie) rămân în portalul
              partener / WO tip R. Hubul e read-only.
            </p>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
