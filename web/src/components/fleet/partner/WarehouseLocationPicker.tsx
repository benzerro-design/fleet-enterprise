"use client";

import { useEffect, useState } from "react";
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
  onPick: (locationId: string, label: string) => void;
  onCancel?: () => void;
};

export function WarehouseLocationPicker({ supplierId, onPick, onCancel }: Props) {
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

  const wh = warehouses.find((w) => w.id === warehouseId);
  const zone = zones.find((z) => z.id === zoneId);
  const row = rows.find((r) => r.id === rowId);

  return (
    <div className="space-y-2 rounded-lg border border-zinc-700 bg-zinc-900/80 p-3">
      <p className="text-[11px] font-medium text-zinc-400">Locație depozit (zonă → rând → locație)</p>
      <div className="flex flex-wrap gap-2">
        <select
          className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200"
          value={warehouseId ?? ""}
          onChange={(e) => setWarehouseId(e.target.value || null)}
        >
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.code} — {w.name}
            </option>
          ))}
        </select>
        <select
          className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200"
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
          className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200"
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
      <div className="flex flex-wrap gap-1.5">
        {locations.filter((l) => l.active).map((loc) => {
          const label = [wh?.code, zone?.code, row?.code, loc.code].filter(Boolean).join("/");
          return (
            <button
              key={loc.id}
              type="button"
              onClick={() => onPick(loc.id, label)}
              className="rounded border border-emerald-800/60 px-2.5 py-1 text-xs text-emerald-200 hover:bg-emerald-950/40"
            >
              {loc.code}
            </button>
          );
        })}
        {locations.length === 0 ? (
          <p className="text-[11px] text-zinc-500">Nicio locație — configurează în Depozite.</p>
        ) : null}
      </div>
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
