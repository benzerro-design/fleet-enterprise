"use client";

import { useEffect, useMemo, useState } from "react";
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

type Props = {
  supplierId: string;
  /** Controlled selected location id (optional). */
  value?: string | null;
  onPick: (locationId: string, label: string) => void;
  onCancel?: () => void;
  /** compact = butoane locație; form = toate selectoare (check-in). */
  variant?: "compact" | "form";
};

export function WarehouseLocationPicker({
  supplierId,
  value = null,
  onPick,
  onCancel,
  variant = "compact",
}: Props) {
  const [warehouses, setWarehouses] = useState<TireWarehouseRow[]>([]);
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [zones, setZones] = useState<TireWarehouseZoneRow[]>([]);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [rows, setRows] = useState<TireWarehouseStorageRow[]>([]);
  const [rowId, setRowId] = useState<string | null>(null);
  const [locations, setLocations] = useState<TireWarehouseLocationRow[]>([]);
  const [locationId, setLocationId] = useState<string | null>(value);

  useEffect(() => {
    setLocationId(value);
  }, [value]);

  useEffect(() => {
    void fetchWarehouses(supplierId).then((w) => {
      setWarehouses(w.filter((x) => x.active));
      if (w[0]) setWarehouseId(w[0].id);
    });
  }, [supplierId]);

  useEffect(() => {
    if (!warehouseId) {
      setZones([]);
      return;
    }
    void fetchZones(warehouseId).then((z) => {
      const active = z.filter((x) => x.active);
      setZones(active);
      setZoneId(active[0]?.id ?? null);
    });
  }, [warehouseId]);

  useEffect(() => {
    if (!zoneId) {
      setRows([]);
      return;
    }
    void fetchRows(zoneId).then((r) => {
      const active = r.filter((x) => x.active);
      setRows(active);
      setRowId(active[0]?.id ?? null);
    });
  }, [zoneId]);

  useEffect(() => {
    if (!rowId) {
      setLocations([]);
      return;
    }
    void fetchLocations(rowId).then((locs) => {
      const active = locs.filter((x) => x.active);
      setLocations(active);
      if (value && active.some((l) => l.id === value)) {
        setLocationId(value);
      } else if (!active.some((l) => l.id === locationId)) {
        setLocationId(active[0]?.id ?? null);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-sync when row changes
  }, [rowId]);

  const wh = warehouses.find((w) => w.id === warehouseId);
  const zone = zones.find((z) => z.id === zoneId);
  const row = rows.find((r) => r.id === rowId);
  const whCode = wh?.code;
  const zoneCode = zone?.code;
  const rowCode = row?.code;

  const labelFor = useMemo(() => {
    return (locCode: string) =>
      [whCode, zoneCode, rowCode, locCode].filter(Boolean).join("/");
  }, [whCode, zoneCode, rowCode]);

  function commitPick(id: string) {
    const loc = locations.find((l) => l.id === id);
    if (!loc) return;
    setLocationId(id);
    onPick(id, labelFor(loc.code));
  }

  // Form: keep parent in sync when cascade auto-selects the first location
  // (select onChange does not fire if the user never changes the dropdown).
  useEffect(() => {
    if (variant !== "form") return;
    if (!locationId || !whCode || !zoneCode || !rowCode) return;
    const loc = locations.find((l) => l.id === locationId);
    if (!loc) return;
    onPick(locationId, [whCode, zoneCode, rowCode, loc.code].join("/"));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync on cascade ids only
  }, [variant, locationId, locations, whCode, zoneCode, rowCode]);

  const selectClass =
    variant === "form"
      ? "w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm text-zinc-100"
      : "max-w-[140px] rounded border border-zinc-700 bg-zinc-950 px-1.5 py-1 text-[11px] text-zinc-200";

  return (
    <div
      className={
        variant === "form"
          ? "space-y-2 rounded-xl border border-zinc-700 bg-zinc-950/40 p-3"
          : "space-y-2 rounded-lg border border-zinc-700 bg-zinc-900/80 p-3"
      }
    >
      <p className={variant === "form" ? "text-xs text-zinc-400" : "text-[11px] font-medium text-zinc-400"}>
        Locație depozit — alege (nu completa liber)
      </p>
      <div className={variant === "form" ? "grid gap-2 sm:grid-cols-2" : "flex flex-wrap gap-2"}>
        <label className="block min-w-0 flex-1 text-[10px] text-zinc-500">
          Depozit
          <select
            className={`mt-0.5 ${selectClass}`}
            value={warehouseId ?? ""}
            onChange={(e) => setWarehouseId(e.target.value || null)}
          >
            {warehouses.length === 0 ? <option value="">— configurează Depozite —</option> : null}
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {w.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-0 flex-1 text-[10px] text-zinc-500">
          Zonă
          <select
            className={`mt-0.5 ${selectClass}`}
            value={zoneId ?? ""}
            onChange={(e) => setZoneId(e.target.value || null)}
          >
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.code}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-0 flex-1 text-[10px] text-zinc-500">
          Rând
          <select
            className={`mt-0.5 ${selectClass}`}
            value={rowId ?? ""}
            onChange={(e) => setRowId(e.target.value || null)}
          >
            {rows.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-0 flex-1 text-[10px] text-zinc-500">
          Locație / bay
          <select
            className={`mt-0.5 ${selectClass}`}
            value={locationId ?? ""}
            onChange={(e) => {
              const id = e.target.value;
              if (id) commitPick(id);
              else setLocationId(null);
            }}
          >
            <option value="">— alege —</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.code}
              </option>
            ))}
          </select>
        </label>
      </div>

      {variant === "compact" ? (
        <div className="flex flex-wrap gap-1.5">
          {locations.map((loc) => (
            <button
              key={loc.id}
              type="button"
              onClick={() => commitPick(loc.id)}
              className={`rounded border px-2.5 py-1 text-xs ${
                locationId === loc.id
                  ? "border-emerald-500 bg-emerald-950/40 text-emerald-100"
                  : "border-emerald-800/60 text-emerald-200 hover:bg-emerald-950/40"
              }`}
            >
              {loc.code}
            </button>
          ))}
        </div>
      ) : null}

      {locationId ? (
        <p className="text-[11px] text-emerald-200/80">
          Selectat: {labelFor(locations.find((l) => l.id === locationId)?.code ?? "")}
        </p>
      ) : (
        <p className="text-[11px] text-zinc-500">
          {warehouses.length === 0
            ? "Niciun depozit — creează-l în meniul Depozite."
            : locations.length === 0
              ? "Nicio locație pe acest rând — configurează în Depozite."
              : "Alege locația din listă."}
        </p>
      )}

      {onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          className="text-[11px] text-zinc-500 underline hover:text-zinc-300"
        >
          Anulează
        </button>
      ) : null}
    </div>
  );
}
