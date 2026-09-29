"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OPS_INPUT_CLASS } from "@/components/fleet/ops-form-primitives";
import { fleetBrowserBase, fleetJsonHeaders } from "@/lib/fleet-api";
import {
  VEHICLE_WHEEL_POSITIONS,
  VEHICLE_TIRE_SEASONS,
  vehicleWheelPositionLabel,
  vehicleTireSeasonLabel,
  type VehicleTireSeason,
  type VehicleWheelFitmentRecord,
  type VehicleWheelPosition,
  type VehicleWheelsPayload,
} from "@/lib/vehicle-wheels-types";

type Props = {
  vehicleId: string;
  write: boolean;
  initial: VehicleWheelsPayload;
};

type Draft = {
  size: string;
  brand: string;
  season: VehicleTireSeason;
  dot: string;
  treadMm: string;
  rimSize: string;
  notes: string;
};

function draftFrom(row: VehicleWheelFitmentRecord | undefined): Draft {
  return {
    size: row?.size ?? "",
    brand: row?.brand ?? "",
    season: row?.season ?? "unknown",
    dot: row?.dot ?? "",
    treadMm: row?.treadMm != null ? String(row.treadMm) : "",
    rimSize: row?.rimSize ?? "",
    notes: row?.notes ?? "",
  };
}

/** FLEET-019 — jante/anvelope pe poziții pe vehicul. */
export function VehicleWheelsTab({ vehicleId, write, initial }: Props) {
  const router = useRouter();
  const byPos = new Map(initial.items.map((i) => [i.position, i]));
  const [drafts, setDrafts] = useState<Record<VehicleWheelPosition, Draft>>(() => {
    const out = {} as Record<VehicleWheelPosition, Draft>;
    for (const p of VEHICLE_WHEEL_POSITIONS) out[p] = draftFrom(byPos.get(p));
    return out;
  });
  const [pending, setPending] = useState<VehicleWheelPosition | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(position: VehicleWheelPosition) {
    if (!write) return;
    setPending(position);
    setError(null);
    const d = drafts[position];
    try {
      const res = await fetch(`${fleetBrowserBase}/vehicles/${vehicleId}/wheels`, {
        method: "PUT",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          position,
          size: d.size.trim() || null,
          brand: d.brand.trim() || null,
          season: d.season,
          dot: d.dot.trim() || null,
          treadMm: d.treadMm.trim() ? Number(d.treadMm.replace(",", ".")) : null,
          rimSize: d.rimSize.trim() || null,
          notes: d.notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Salvare eșuată");
    } finally {
      setPending(null);
    }
  }

  async function clear(position: VehicleWheelPosition) {
    if (!write) return;
    setPending(position);
    setError(null);
    try {
      const res = await fetch(`${fleetBrowserBase}/vehicles/${vehicleId}/wheels/${position}`, {
        method: "DELETE",
        headers: fleetJsonHeaders(),
      });
      if (!res.ok && res.status !== 204) {
        throw new Error(`HTTP ${res.status}`);
      }
      setDrafts((prev) => ({ ...prev, [position]: draftFrom(undefined) }));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ștergere eșuată");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400">
        Anvelope / jante montate pe mașină. Inventarul de depozit rămâne pe FLEET-007 (parcat).
      </p>
      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {VEHICLE_WHEEL_POSITIONS.map((position) => {
          const d = drafts[position];
          return (
            <div
              key={position}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2"
            >
              <h3 className="text-sm font-medium text-zinc-100">
                {vehicleWheelPositionLabel(position)}
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-zinc-500">
                  Dimensiune
                  <input
                    disabled={!write}
                    value={d.size}
                    onChange={(e) =>
                      setDrafts((p) => ({ ...p, [position]: { ...p[position], size: e.target.value } }))
                    }
                    placeholder="205/55 R16"
                    className={`${OPS_INPUT_CLASS} mt-1`}
                  />
                </label>
                <label className="text-xs text-zinc-500">
                  Brand
                  <input
                    disabled={!write}
                    value={d.brand}
                    onChange={(e) =>
                      setDrafts((p) => ({
                        ...p,
                        [position]: { ...p[position], brand: e.target.value },
                      }))
                    }
                    className={`${OPS_INPUT_CLASS} mt-1`}
                  />
                </label>
                <label className="text-xs text-zinc-500">
                  Sezon
                  <select
                    disabled={!write}
                    value={d.season}
                    onChange={(e) =>
                      setDrafts((p) => ({
                        ...p,
                        [position]: {
                          ...p[position],
                          season: e.target.value as VehicleTireSeason,
                        },
                      }))
                    }
                    className={`${OPS_INPUT_CLASS} mt-1`}
                  >
                    {VEHICLE_TIRE_SEASONS.map((s) => (
                      <option key={s} value={s}>
                        {vehicleTireSeasonLabel(s)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-zinc-500">
                  DOT
                  <input
                    disabled={!write}
                    value={d.dot}
                    onChange={(e) =>
                      setDrafts((p) => ({ ...p, [position]: { ...p[position], dot: e.target.value } }))
                    }
                    className={`${OPS_INPUT_CLASS} mt-1`}
                  />
                </label>
                <label className="text-xs text-zinc-500">
                  Uzură (mm)
                  <input
                    disabled={!write}
                    value={d.treadMm}
                    onChange={(e) =>
                      setDrafts((p) => ({
                        ...p,
                        [position]: { ...p[position], treadMm: e.target.value },
                      }))
                    }
                    className={`${OPS_INPUT_CLASS} mt-1`}
                  />
                </label>
                <label className="text-xs text-zinc-500">
                  Jantă
                  <input
                    disabled={!write}
                    value={d.rimSize}
                    onChange={(e) =>
                      setDrafts((p) => ({
                        ...p,
                        [position]: { ...p[position], rimSize: e.target.value },
                      }))
                    }
                    className={`${OPS_INPUT_CLASS} mt-1`}
                  />
                </label>
              </div>
              {write ? (
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    disabled={pending === position}
                    onClick={() => void save(position)}
                    className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
                  >
                    Salvează
                  </button>
                  <button
                    type="button"
                    disabled={pending === position}
                    onClick={() => void clear(position)}
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
                  >
                    Golește
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
