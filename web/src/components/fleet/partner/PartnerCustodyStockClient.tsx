"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { parsePartnerSupplierQuery } from "@/lib/partner-context";
import type { TireHotelCapability } from "@/lib/partner-tire-hotel-api";
import {
  assignCustodyLocation,
  fetchCustodyAssetFiche,
  fetchCustodyStock,
  patchCustodyAssetTread,
  type CustodyAssetFiche,
  type CustodyStockRow,
} from "@/lib/partner-tire-custody-api";
import {
  fetchLocations,
  fetchRows,
  fetchWarehouses,
  fetchZones,
  type TireWarehouseLocationRow,
  type TireWarehouseRow,
  type TireWarehouseStorageRow,
  type TireWarehouseZoneRow,
} from "@/lib/partner-tire-warehouse-api";
import { formatTireSetSearchFieldOnChange } from "@/lib/tire-set-search";
import { tireMountedAsLabel, vehicleTireSeasonLabel } from "@/lib/vehicle-wheels-types";
import type { TireLedgerMovement } from "@/components/fleet/TireMovementLedger";

type Props = {
  canWrite: boolean;
  adminMode: boolean;
  supplierId?: string;
};

function formatCheckIn(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ro-RO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function AssetFichePanel({
  fiche,
  canWrite,
  supplierId,
  onClose,
  onFicheUpdated,
}: {
  fiche: CustodyAssetFiche;
  canWrite: boolean;
  supplierId?: string;
  onClose: () => void;
  onFicheUpdated: (next: CustodyAssetFiche) => void;
}) {
  const a = fiche.asset;
  const movements = [...(fiche.movements ?? [])].reverse();
  const [treadInput, setTreadInput] = useState(
    a.treadMm != null ? String(a.treadMm) : "",
  );
  const [noteInput, setNoteInput] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTreadInput(a.treadMm != null ? String(a.treadMm) : "");
    setNoteInput("");
    setSaveError(null);
  }, [a.assetId, a.treadMm]);

  const saveTread = async () => {
    if (!supplierId) return;
    const normalized = treadInput.trim().replace(",", ".");
    const n = Number(normalized);
    if (!normalized || !Number.isFinite(n) || n < 0) {
      setSaveError("Profil (mm) invalid — introduceți un număr ≥ 0");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const next = await patchCustodyAssetTread(
        a.assetId,
        {
          treadMm: n,
          ...(noteInput.trim() ? { note: noteInput.trim() } : {}),
        },
        supplierId,
      );
      onFicheUpdated(next);
      setNoteInput("");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Nu s-a putut salva profilul");
    } finally {
      setSaving(false);
    }
  };

  const mountedBadge =
    fiche.set?.mountedAs != null ? tireMountedAsLabel(fiche.set.mountedAs) : null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto border-l border-zinc-800 bg-zinc-950 p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-100">Fișă anvelopă</h2>
            {mountedBadge ? (
              <span className="rounded border border-zinc-600 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-300">
                {mountedBadge}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400 hover:bg-zinc-900"
          >
            Închide
          </button>
        </div>
        <dl className="space-y-1 text-xs text-zinc-300">
          <div>
            <span className="text-zinc-500">Marcă / model: </span>
            {[a.brand, a.model].filter(Boolean).join(" ") || "—"}
          </div>
          <div>
            <span className="text-zinc-500">Dimensiune: </span>
            {a.size ?? "—"}
          </div>
          <div>
            <span className="text-zinc-500">DOT: </span>
            {a.dot ?? "—"}
          </div>
          {!canWrite ? (
            <div>
              <span className="text-zinc-500">Profil (mm): </span>
              {a.treadMm != null ? String(a.treadMm) : "—"}
            </div>
          ) : null}
          <div>
            <span className="text-zinc-500">Serial / QR: </span>
            {a.serialOrQr ?? "—"}
          </div>
          {fiche.stayLocation?.locationLabel ? (
            <div>
              <span className="text-zinc-500">Locație hotel: </span>
              {fiche.stayLocation.locationLabel}
            </div>
          ) : null}
        </dl>
        {canWrite ? (
          <div className="mt-3 space-y-2 rounded border border-zinc-800 bg-zinc-900/40 p-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              Corectare profil după cazare
            </p>
            <label className="block text-[11px] text-zinc-400">
              Profil (mm)
              <input
                type="text"
                inputMode="decimal"
                value={treadInput}
                onChange={(e) => setTreadInput(e.target.value)}
                className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100"
              />
            </label>
            <label className="block text-[11px] text-zinc-400">
              Notă scurtă (opțional)
              <textarea
                rows={2}
                maxLength={500}
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100"
              />
            </label>
            {saveError ? <p className="text-[11px] text-red-400">{saveError}</p> : null}
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveTread()}
              className="rounded border border-emerald-800/60 bg-emerald-950/30 px-2 py-1 text-[11px] text-emerald-200 hover:bg-emerald-950/50 disabled:opacity-50"
            >
              {saving ? "Se salvează…" : "Salvează"}
            </button>
          </div>
        ) : null}
        <h3 className="mb-2 mt-4 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          Mișcări
        </h3>
        <ul className="space-y-2">
          {movements.length === 0 ? (
            <li className="text-xs text-zinc-500">Nicio mișcare înregistrată.</li>
          ) : (
            movements.map((m: TireLedgerMovement) => (
              <li key={m.id} className="rounded border border-zinc-800 bg-zinc-900/50 px-2 py-1.5 text-[11px]">
                <div className="text-zinc-200">{m.label}</div>
                <div className="text-zinc-500">
                  {formatCheckIn(m.at)}
                  {m.plate ? ` · ${m.plate}` : ""}
                  {m.locationCode ? ` · ${m.locationCode}` : ""}
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

function LocationPicker({
  supplierId,
  onPick,
  onCancel,
}: {
  supplierId: string;
  onPick: (locationId: string, label: string) => void;
  onCancel: () => void;
}) {
  const [warehouses, setWarehouses] = useState<TireWarehouseRow[]>([]);
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [zones, setZones] = useState<TireWarehouseZoneRow[]>([]);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [rows, setRows] = useState<TireWarehouseStorageRow[]>([]);
  const [rowId, setRowId] = useState<string | null>(null);
  const [locations, setLocations] = useState<TireWarehouseLocationRow[]>([]);

  useEffect(() => {
    void fetchWarehouses(supplierId).then((w) => {
      setWarehouses(w);
      if (w[0]) setWarehouseId(w[0].id);
    });
  }, [supplierId]);

  useEffect(() => {
    if (!warehouseId) {
      setZones([]);
      return;
    }
    void fetchZones(warehouseId).then((z) => {
      setZones(z);
      setZoneId(z[0]?.id ?? null);
    });
  }, [warehouseId]);

  useEffect(() => {
    if (!zoneId) {
      setRows([]);
      return;
    }
    void fetchRows(zoneId).then((r) => {
      setRows(r);
      setRowId(r[0]?.id ?? null);
    });
  }, [zoneId]);

  useEffect(() => {
    if (!rowId) {
      setLocations([]);
      return;
    }
    void fetchLocations(rowId).then(setLocations);
  }, [rowId]);

  return (
    <div className="mt-2 space-y-2 rounded border border-zinc-700 bg-zinc-900/80 p-2">
      <div className="flex flex-wrap gap-1">
        <select
          className="max-w-[140px] rounded border border-zinc-700 bg-zinc-950 px-1.5 py-1 text-[11px] text-zinc-200"
          value={warehouseId ?? ""}
          onChange={(e) => setWarehouseId(e.target.value || null)}
        >
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.code}
            </option>
          ))}
        </select>
        <select
          className="max-w-[100px] rounded border border-zinc-700 bg-zinc-950 px-1.5 py-1 text-[11px] text-zinc-200"
          value={zoneId ?? ""}
          onChange={(e) => setZoneId(e.target.value || null)}
        >
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.code}
            </option>
          ))}
        </select>
        <select
          className="max-w-[100px] rounded border border-zinc-700 bg-zinc-950 px-1.5 py-1 text-[11px] text-zinc-200"
          value={rowId ?? ""}
          onChange={(e) => setRowId(e.target.value || null)}
        >
          {rows.map((r) => (
            <option key={r.id} value={r.id}>
              {r.code}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-1">
        {locations.filter((l) => l.active).map((loc) => (
          <button
            key={loc.id}
            type="button"
            onClick={() => onPick(loc.id, loc.code)}
            className="rounded border border-emerald-800/60 px-2 py-0.5 text-[11px] text-emerald-200 hover:bg-emerald-950/40"
          >
            {loc.code}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="text-[11px] text-zinc-500 underline hover:text-zinc-300"
      >
        Anulează
      </button>
    </div>
  );
}

export function PartnerCustodyStockClient({ canWrite, adminMode, supplierId }: Props) {
  const searchParams = useSearchParams();
  const supplierQ = useMemo(
    () => parsePartnerSupplierQuery(Object.fromEntries(searchParams.entries())),
    [searchParams],
  );
  const querySupplierId = supplierId ?? supplierQ.supplierId;

  const [capability, setCapability] = useState<TireHotelCapability | null>(null);
  const apiSupplierId = querySupplierId ?? capability?.supplierId ?? undefined;

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (querySupplierId) p.set("supplierId", querySupplierId);
    return p.toString();
  }, [querySupplierId]);

  const [rows, setRows] = useState<CustodyStockRow[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pickerStayId, setPickerStayId] = useState<string | null>(null);
  const [busyStayId, setBusyStayId] = useState<string | null>(null);
  const [fiche, setFiche] = useState<CustodyAssetFiche | null>(null);

  const loadCapability = useCallback(async () => {
    const res = await fetch(`/api/partner/tire-hotel/capability?${qs}`, { cache: "no-store" });
    if (!res.ok) return;
    setCapability((await res.json()) as TireHotelCapability);
  }, [qs]);

  const reload = useCallback(async () => {
    if (!apiSupplierId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCustodyStock(apiSupplierId, filter.trim() || undefined);
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
    } finally {
      setLoading(false);
    }
  }, [apiSupplierId, filter]);

  useEffect(() => {
    void loadCapability();
  }, [loadCapability]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const assignLocation = async (stayId: string, locationId: string) => {
    if (!apiSupplierId || !canWrite) return;
    setBusyStayId(stayId);
    setError(null);
    try {
      await assignCustodyLocation(stayId, locationId, apiSupplierId);
      setPickerStayId(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la atribuire");
    } finally {
      setBusyStayId(null);
    }
  };

  const openFiche = async (assetId: string) => {
    if (!apiSupplierId) return;
    try {
      const data = await fetchCustodyAssetFiche(assetId, apiSupplierId);
      setFiche(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare fișă");
    }
  };

  if (adminMode && !apiSupplierId) {
    return (
      <p className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
        Selectează un furnizor din contextul partener pentru a vedea stocul în custodie.
      </p>
    );
  }

  if (!apiSupplierId) {
    return <p className="text-xs text-zinc-500">Se rezolvă furnizorul…</p>;
  }

  if (capability && !capability.hasTireStorage) {
    return (
      <p className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-4 text-sm text-amber-200/90">
        Furnizorul nu are activată capacitatea{" "}
        <span className="font-mono text-amber-100">tire_storage</span>.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {adminMode ? (
        <p className="rounded border border-amber-900/40 bg-amber-950/20 px-2 py-1 text-[11px] text-amber-200">
          Mod vizualizare admin — atribuirea locațiilor este dezactivată.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          placeholder="Nr. înmatriculare / QR anvelopă"
          value={filter}
          onChange={(e) => setFilter(formatTireSetSearchFieldOnChange(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") void reload();
          }}
          className="min-w-[200px] flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100"
        />
        <button
          type="button"
          onClick={() => void reload()}
          className="rounded border border-zinc-600 px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900"
        >
          Caută
        </button>
      </div>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      {loading ? <p className="text-xs text-zinc-500">Se încarcă…</p> : null}
      <div className="overflow-x-auto rounded border border-zinc-800">
        <table className="w-full min-w-[640px] text-left text-[11px] text-zinc-300">
          <thead className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-500">
            <tr>
              <th className="px-2 py-1.5">Nr.</th>
              <th className="px-2 py-1.5">Set</th>
              <th className="px-2 py-1.5">Client</th>
              <th className="px-2 py-1.5">Locație</th>
              <th className="px-2 py-1.5">Check-in</th>
              <th className="px-2 py-1.5">Buc.</th>
              <th className="px-2 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading ? (
              <tr>
                <td colSpan={7} className="px-2 py-4 text-center text-zinc-500">
                  Niciun sejur deschis.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <Fragment key={row.id}>
                  <tr className="border-b border-zinc-800/80 hover:bg-zinc-900/40">
                    <td className="px-2 py-2 font-medium text-zinc-100">{row.set.plate}</td>
                    <td className="px-2 py-2">
                      {row.set.name ?? vehicleTireSeasonLabel(row.set.season)}
                      <span className="text-zinc-500"> · {tireMountedAsLabel(row.set.mountedAs)}</span>
                    </td>
                    <td className="px-2 py-2">{row.set.clientName}</td>
                    <td className="px-2 py-2">
                      <span
                        className={
                          row.locationLabel === "nealocat" ? "text-amber-400" : "text-emerald-300/90"
                        }
                      >
                        {row.locationLabel}
                      </span>
                    </td>
                    <td className="px-2 py-2">{formatCheckIn(row.checkInAt)}</td>
                    <td className="px-2 py-2">{row.set.itemCount}</td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => toggleExpand(row.id)}
                        className="mr-1 rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] hover:bg-zinc-800"
                      >
                        {expanded.has(row.id) ? "Ascunde" : "Detalii"}
                      </button>
                      {canWrite && !adminMode ? (
                        <>
                          {row.suggestedLocationId && pickerStayId !== row.id ? (
                            <button
                              type="button"
                              disabled={busyStayId === row.id}
                              onClick={() =>
                                void assignLocation(row.id, row.suggestedLocationId!)
                              }
                              className="mr-1 rounded border border-emerald-800/50 px-1.5 py-0.5 text-[10px] text-emerald-200 hover:bg-emerald-950/40"
                              title={row.suggestedLocationLabel ?? undefined}
                            >
                              Sugestie
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() =>
                              setPickerStayId((id) => (id === row.id ? null : row.id))
                            }
                            className="rounded border border-zinc-600 px-1.5 py-0.5 text-[10px] hover:bg-zinc-800"
                          >
                            Atribuie locație
                          </button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                  {pickerStayId === row.id && canWrite && !adminMode ? (
                    <tr>
                      <td colSpan={7} className="px-2 pb-2">
                        <LocationPicker
                          supplierId={apiSupplierId}
                          onPick={(locId) => void assignLocation(row.id, locId)}
                          onCancel={() => setPickerStayId(null)}
                        />
                      </td>
                    </tr>
                  ) : null}
                  {expanded.has(row.id) ? (
                    <tr>
                      <td colSpan={7} className="bg-zinc-900/30 px-2 py-2">
                        <ul className="space-y-1">
                          {row.items.map((item) => (
                            <li key={item.assetId} className="flex flex-wrap items-center gap-2">
                              <span className="text-zinc-200">
                                {[item.brand, item.model, item.size].filter(Boolean).join(" ") || "—"}
                              </span>
                              <span className="text-zinc-500">
                                DOT {item.dot ?? "—"} · {item.treadMm ?? "—"} mm
                              </span>
                              <button
                                type="button"
                                onClick={() => void openFiche(item.assetId)}
                                className="rounded border border-zinc-600 px-1.5 py-0.5 text-[10px] hover:bg-zinc-800"
                              >
                                Fișă
                              </button>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
      {fiche ? (
        <AssetFichePanel
          fiche={fiche}
          canWrite={canWrite && !adminMode}
          supplierId={apiSupplierId}
          onClose={() => setFiche(null)}
          onFicheUpdated={(next) => setFiche(next)}
        />
      ) : null}
    </div>
  );
}
