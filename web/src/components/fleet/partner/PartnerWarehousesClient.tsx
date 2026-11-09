"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { parsePartnerSupplierQuery } from "@/lib/partner-context";
import type { TireHotelCapability } from "@/lib/partner-tire-hotel-api";
import {
  createLocation,
  createRow,
  createWarehouse,
  createZone,
  fetchLocationLabel,
  fetchLocations,
  fetchRows,
  fetchWarehouses,
  fetchZones,
  type TireWarehouseLocationLabel,
  type TireWarehouseLocationRow,
  type TireWarehouseRow,
  type TireWarehouseStorageRow,
  type TireWarehouseZoneRow,
} from "@/lib/partner-tire-warehouse-api";
import { TireHotelQrPayload } from "@/components/fleet/partner/TireHotelQrPayload";

type Props = {
  canWrite: boolean;
  adminMode: boolean;
  supplierId?: string;
};

export function PartnerWarehousesClient({ canWrite, adminMode, supplierId }: Props) {
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
  const [warehouses, setWarehouses] = useState<TireWarehouseRow[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
  const [zones, setZones] = useState<TireWarehouseZoneRow[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [storageRows, setStorageRows] = useState<TireWarehouseStorageRow[]>([]);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [locations, setLocations] = useState<TireWarehouseLocationRow[]>([]);
  const [labelLocationId, setLabelLocationId] = useState<string | null>(null);
  const [labelData, setLabelData] = useState<TireWarehouseLocationLabel | null>(null);

  const [whCode, setWhCode] = useState("");
  const [whName, setWhName] = useState("");
  const [zoneCode, setZoneCode] = useState("");
  const [zoneName, setZoneName] = useState("");
  const [rowCode, setRowCode] = useState("");
  const [rowName, setRowName] = useState("");
  const [locationCode, setLocationCode] = useState("");
  const [locationName, setLocationName] = useState("");

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCapability = useCallback(async () => {
    const res = await fetch(`/api/partner/tire-hotel/capability?${qs}`, { cache: "no-store" });
    if (!res.ok) return;
    setCapability((await res.json()) as TireHotelCapability);
  }, [qs]);

  const reloadWarehouses = useCallback(async () => {
    if (!apiSupplierId) return;
    const rows = await fetchWarehouses(apiSupplierId);
    setWarehouses(rows);
    if (rows.length && !selectedWarehouseId) {
      setSelectedWarehouseId(rows[0]!.id);
    }
  }, [apiSupplierId, selectedWarehouseId]);

  const reloadZones = useCallback(async () => {
    if (!selectedWarehouseId) {
      setZones([]);
      return;
    }
    const rows = await fetchZones(selectedWarehouseId);
    setZones(rows);
    if (rows.length && !rows.some((z) => z.id === selectedZoneId)) {
      setSelectedZoneId(rows[0]!.id);
    }
  }, [selectedWarehouseId, selectedZoneId]);

  const reloadStorageRows = useCallback(async () => {
    if (!selectedZoneId) {
      setStorageRows([]);
      return;
    }
    const rows = await fetchRows(selectedZoneId);
    setStorageRows(rows);
    if (rows.length && !rows.some((r) => r.id === selectedRowId)) {
      setSelectedRowId(rows[0]!.id);
    } else if (!rows.length) {
      setSelectedRowId(null);
    }
  }, [selectedZoneId, selectedRowId]);

  const reloadLocations = useCallback(async () => {
    if (!selectedRowId) {
      setLocations([]);
      return;
    }
    setLocations(await fetchLocations(selectedRowId));
  }, [selectedRowId]);

  useEffect(() => {
    void loadCapability();
  }, [loadCapability]);

  useEffect(() => {
    setError(null);
    if (!capability?.hasTireStorage || !apiSupplierId) return;
    void reloadWarehouses().catch((e: Error) => setError(e.message));
  }, [capability?.hasTireStorage, apiSupplierId, reloadWarehouses]);

  useEffect(() => {
    void reloadZones().catch((e: Error) => setError(e.message));
  }, [reloadZones]);

  useEffect(() => {
    void reloadStorageRows().catch((e: Error) => setError(e.message));
  }, [reloadStorageRows]);

  useEffect(() => {
    void reloadLocations().catch((e: Error) => setError(e.message));
  }, [reloadLocations]);

  async function runAction(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
    } finally {
      setBusy(null);
    }
  }

  async function openLabel(locationId: string) {
    setLabelLocationId(locationId);
    setLabelData(null);
    try {
      setLabelData(await fetchLocationLabel(locationId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la etichetă");
      setLabelLocationId(null);
    }
  }

  const hasTireStorage = capability?.hasTireStorage ?? false;

  if (adminMode && !apiSupplierId) {
    return (
      <p className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
        Selectează un furnizor din contextul partener pentru a gestiona depozitele.
      </p>
    );
  }

  if (capability && !hasTireStorage) {
    return (
      <p className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-4 text-sm text-amber-200/90">
        Furnizorul nu are activată capacitatea{" "}
        <span className="font-mono text-amber-100">tire_storage</span>.
      </p>
    );
  }

  const selectedWarehouse = warehouses.find((w) => w.id === selectedWarehouseId);
  const selectedZone = zones.find((z) => z.id === selectedZoneId);
  const selectedStorageRow = storageRows.find((r) => r.id === selectedRowId);

  return (
    <div className="space-y-4">
      <div className={labelLocationId ? "print:hidden" : undefined}>
        {error ? (
          <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-4 lg:grid-cols-2">
          {/* Warehouses */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
            <h2 className="text-sm font-semibold text-zinc-200">Depozite</h2>
            {warehouses.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500">Niciun depozit — adaugă primul depozit mai jos.</p>
            ) : (
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {warehouses.map((w) => (
                  <li key={w.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedWarehouseId(w.id);
                        setSelectedZoneId(null);
                        setSelectedRowId(null);
                      }}
                      className={`w-full rounded-lg px-2 py-1.5 text-left text-xs ${
                        w.id === selectedWarehouseId
                          ? "bg-violet-900/50 text-violet-100"
                          : "text-zinc-300 hover:bg-zinc-800"
                      }`}
                    >
                      <span className="font-mono">{w.code}</span> — {w.name}
                      {!w.active ? <span className="text-zinc-500"> (inactiv)</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {canWrite ? (
              <form
                className="mt-3 space-y-2 border-t border-zinc-800 pt-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!apiSupplierId || !whCode.trim()) return;
                  void runAction("wh", async () => {
                    await createWarehouse(apiSupplierId, {
                      code: whCode.trim(),
                      name: whName.trim() || undefined,
                    });
                    setWhCode("");
                    setWhName("");
                    await reloadWarehouses();
                  });
                }}
              >
                <p className="text-[11px] font-medium text-zinc-400">Adaugă depozit</p>
                <input
                  value={whCode}
                  onChange={(e) => setWhCode(e.target.value)}
                  placeholder="Cod (ex. MAIN)"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100"
                />
                <input
                  value={whName}
                  onChange={(e) => setWhName(e.target.value)}
                  placeholder="Nume (opțional)"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100"
                />
                <button
                  type="submit"
                  disabled={!!busy || !whCode.trim()}
                  className="rounded-md bg-violet-700 px-2 py-1.5 text-xs font-medium text-white hover:bg-violet-600 disabled:opacity-50"
                >
                  {busy === "wh" ? "Se salvează…" : "Salvează depozit"}
                </button>
              </form>
            ) : null}
          </section>

          {/* Zones */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
            <h2 className="text-sm font-semibold text-zinc-200">
              Zone{selectedWarehouse ? ` — ${selectedWarehouse.code}` : ""}
            </h2>
            {!selectedWarehouseId ? (
              <p className="mt-2 text-xs text-zinc-500">Selectează un depozit.</p>
            ) : zones.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500">Nicio zonă încă.</p>
            ) : (
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {zones.map((z) => (
                  <li key={z.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedZoneId(z.id);
                        setSelectedRowId(null);
                      }}
                      className={`w-full rounded-lg px-2 py-1.5 text-left text-xs ${
                        z.id === selectedZoneId
                          ? "bg-violet-900/50 text-violet-100"
                          : "text-zinc-300 hover:bg-zinc-800"
                      }`}
                    >
                      <span className="font-mono">{z.code}</span>
                      {z.name ? ` — ${z.name}` : ""}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {canWrite && selectedWarehouseId ? (
              <form
                className="mt-3 space-y-2 border-t border-zinc-800 pt-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!zoneCode.trim() || !selectedWarehouseId) return;
                  void runAction("zone", async () => {
                    await createZone(selectedWarehouseId, {
                      code: zoneCode.trim(),
                      name: zoneName.trim() || undefined,
                    });
                    setZoneCode("");
                    setZoneName("");
                    await reloadZones();
                  });
                }}
              >
                <p className="text-[11px] font-medium text-zinc-400">Adaugă zonă</p>
                <input
                  value={zoneCode}
                  onChange={(e) => setZoneCode(e.target.value)}
                  placeholder="Cod zonă (ex. A)"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100"
                />
                <input
                  value={zoneName}
                  onChange={(e) => setZoneName(e.target.value)}
                  placeholder="Nume (opțional)"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100"
                />
                <button
                  type="submit"
                  disabled={!!busy || !zoneCode.trim()}
                  className="rounded-md bg-violet-700 px-2 py-1.5 text-xs font-medium text-white hover:bg-violet-600 disabled:opacity-50"
                >
                  {busy === "zone" ? "Se salvează…" : "Salvează zonă"}
                </button>
              </form>
            ) : null}
          </section>

          {/* Rows */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
            <h2 className="text-sm font-semibold text-zinc-200">
              Rânduri{selectedZone ? ` — ${selectedZone.code}` : ""}
            </h2>
            {!selectedZoneId ? (
              <p className="mt-2 text-xs text-zinc-500">Selectează o zonă.</p>
            ) : storageRows.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500">Niciun rând — adaugă primul rând.</p>
            ) : (
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {storageRows.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedRowId(r.id)}
                      className={`w-full rounded-lg px-2 py-1.5 text-left text-xs ${
                        r.id === selectedRowId
                          ? "bg-violet-900/50 text-violet-100"
                          : "text-zinc-300 hover:bg-zinc-800"
                      }`}
                    >
                      <span className="font-mono">{r.code}</span>
                      {r.name ? ` — ${r.name}` : ""}
                      {!r.active ? <span className="text-zinc-500"> (inactiv)</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {canWrite && selectedZoneId ? (
              <form
                className="mt-3 space-y-2 border-t border-zinc-800 pt-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!rowCode.trim() || !selectedZoneId) return;
                  void runAction("row", async () => {
                    await createRow(selectedZoneId, {
                      code: rowCode.trim(),
                      name: rowName.trim() || undefined,
                    });
                    setRowCode("");
                    setRowName("");
                    await reloadStorageRows();
                  });
                }}
              >
                <p className="text-[11px] font-medium text-zinc-400">Adaugă rând</p>
                <input
                  value={rowCode}
                  onChange={(e) => setRowCode(e.target.value)}
                  placeholder="Cod rând (ex. A1)"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100"
                />
                <input
                  value={rowName}
                  onChange={(e) => setRowName(e.target.value)}
                  placeholder="Nume (opțional)"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100"
                />
                <button
                  type="submit"
                  disabled={!!busy || !rowCode.trim()}
                  className="rounded-md bg-violet-700 px-2 py-1.5 text-xs font-medium text-white hover:bg-violet-600 disabled:opacity-50"
                >
                  {busy === "row" ? "Se salvează…" : "Salvează rând"}
                </button>
              </form>
            ) : null}
          </section>

          {/* Locations */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
            <h2 className="text-sm font-semibold text-zinc-200">
              Locații{selectedStorageRow ? ` — ${selectedStorageRow.code}` : ""}
            </h2>
            {!selectedRowId ? (
              <p className="mt-2 text-xs text-zinc-500">Selectează un rând.</p>
            ) : locations.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500">Nicio locație — adaugă prima locație.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {locations.map((loc) => (
                  <li
                    key={loc.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-2 py-1.5"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-mono text-xs text-zinc-200">{loc.code}</span>
                      {loc.name ? <span className="text-xs text-zinc-500"> — {loc.name}</span> : null}
                      {!loc.active ? <span className="text-xs text-zinc-600"> (inactiv)</span> : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => void openLabel(loc.id)}
                      className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-200 hover:bg-zinc-800"
                    >
                      Tipărește etichetă
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {canWrite && selectedRowId ? (
              <form
                className="mt-3 space-y-2 border-t border-zinc-800 pt-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!locationCode.trim() || !selectedRowId) return;
                  void runAction("loc", async () => {
                    await createLocation(selectedRowId, {
                      code: locationCode.trim(),
                      name: locationName.trim() || undefined,
                    });
                    setLocationCode("");
                    setLocationName("");
                    await reloadLocations();
                  });
                }}
              >
                <p className="text-[11px] font-medium text-zinc-400">Adaugă locație</p>
                <input
                  value={locationCode}
                  onChange={(e) => setLocationCode(e.target.value)}
                  placeholder="Cod locație (ex. 01)"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100"
                />
                <input
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="Nume (opțional)"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100"
                />
                <button
                  type="submit"
                  disabled={!!busy || !locationCode.trim()}
                  className="rounded-md bg-violet-700 px-2 py-1.5 text-xs font-medium text-white hover:bg-violet-600 disabled:opacity-50"
                >
                  {busy === "loc" ? "Se salvează…" : "Salvează locație"}
                </button>
              </form>
            ) : null}
          </section>
        </div>
      </div>

      {labelLocationId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 print:static print:inset-auto print:block print:bg-white print:p-0"
          role="dialog"
          aria-modal
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 p-5 shadow-xl print:max-w-none print:overflow-visible print:border-0 print:shadow-none print:bg-white print:text-black">
            <div className="mb-3 flex items-start justify-between gap-2 print:hidden">
              <h3 className="text-sm font-semibold text-zinc-100">Etichetă locație</h3>
              <button
                type="button"
                onClick={() => {
                  setLabelLocationId(null);
                  setLabelData(null);
                }}
                className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                Închide
              </button>
            </div>
            {labelData ? (
              <div className="tire-warehouse-label space-y-3 print:p-4 [&_button]:print:hidden">
                <p className="text-center text-sm font-semibold print:text-black">{labelData.labelText}</p>
                <p className="text-center font-mono text-xs text-zinc-400 print:text-black">
                  {labelData.warehouseCode} / {labelData.zoneCode} / {labelData.rowCode} / {labelData.code}
                </p>
                <div className="flex justify-center">
                  <TireHotelQrPayload payload={labelData.qrPayload} showQrImage compact={false} />
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="w-full rounded-lg bg-violet-700 py-2 text-sm font-medium text-white hover:bg-violet-600 print:hidden"
                >
                  Tipărește
                </button>
              </div>
            ) : (
              <p className="text-xs text-zinc-500">Se încarcă eticheta…</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
