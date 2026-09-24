"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FleetAvatar } from "@/components/fleet/tickets/TicketListGlyphs";
import {
  driversBrowserBase,
  fleetJsonHeaders,
  type DriverRecord,
} from "@/lib/drivers-api";

type VehicleRow = {
  id: string;
  registrationNumber: string;
  clientId: string;
  clientLegalName?: string;
  brand?: string | null;
  model?: string | null;
};

type Props = {
  vehicles: VehicleRow[];
  drivers: DriverRecord[];
  canWrite: boolean;
};

export function DriverAllocationBoard({ vehicles, drivers, canWrite }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "assigned" | "unassigned">("all");
  const [q, setQ] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assignDraft, setAssignDraft] = useState<Record<string, string>>({});

  const driverByVehicle = useMemo(() => {
    const map = new Map<string, DriverRecord>();
    for (const d of drivers) {
      for (const vid of d.activeVehicleIds) {
        map.set(vid, d);
      }
    }
    return map;
  }, [drivers]);

  const rows = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return vehicles
      .filter((v) => {
        const driver = driverByVehicle.get(v.id);
        if (filter === "assigned" && !driver) return false;
        if (filter === "unassigned" && driver) return false;
        if (!qq) return true;
        const hay = [
          v.registrationNumber,
          v.clientLegalName,
          v.brand,
          v.model,
          driver?.fullName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(qq);
      })
      .sort((a, b) => a.registrationNumber.localeCompare(b.registrationNumber, "ro"));
  }, [vehicles, driverByVehicle, filter, q]);

  const assignedCount = vehicles.filter((v) => driverByVehicle.has(v.id)).length;
  const unassignedCount = vehicles.length - assignedCount;

  async function assign(vehicleId: string, driverId: string) {
    if (!driverId) return;
    setPendingId(vehicleId);
    setError(null);
    try {
      const res = await fetch(`${driversBrowserBase}/${driverId}/assignments`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({ vehicleId }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Alocare eșuată");
    } finally {
      setPendingId(null);
    }
  }

  async function unassign(vehicleId: string, driver: DriverRecord) {
    const assignmentHint = driver.activeVehicleIds.includes(vehicleId);
    if (!assignmentHint) return;
    setPendingId(vehicleId);
    setError(null);
    try {
      // Need assignment id — fetch current vehicle assignments
      const listRes = await fetch(`/api/fleet/vehicles/${vehicleId}/driver-assignments`, {
        cache: "no-store",
      });
      if (!listRes.ok) throw new Error(`HTTP ${listRes.status}`);
      const list = (await listRes.json()) as Array<{
        id: string;
        driverId: string;
        unassignedAt: string | null;
      }>;
      const active = list.find((a) => a.driverId === driver.id && !a.unassignedAt);
      if (!active) throw new Error("Nicio alocare activă găsită");
      const res = await fetch(
        `${driversBrowserBase}/${driver.id}/assignments/${active.id}/end`,
        { method: "PATCH", headers: fleetJsonHeaders(), body: "{}" },
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dealocare eșuată");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-zinc-500">Căutare</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="nr. auto, șofer, client"
            className="mt-1 block w-56 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "all" as const, label: `Toate (${vehicles.length})` },
              { id: "assigned" as const, label: `Alocate (${assignedCount})` },
              { id: "unassigned" as const, label: `Fără șofer (${unassignedCount})` },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                filter === f.id
                  ? "bg-emerald-600 text-white"
                  : "border border-zinc-700 text-zinc-300 hover:bg-zinc-900"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-900/60 text-[10px] uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2">Vehicul</th>
              <th className="px-3 py-2">Client</th>
              <th className="px-3 py-2">Șofer alocat</th>
              {canWrite ? <th className="px-3 py-2">Acțiune</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={canWrite ? 4 : 3} className="px-3 py-6 text-center text-zinc-500">
                  Niciun vehicul pentru filtrele curente.
                </td>
              </tr>
            ) : (
              rows.map((v) => {
                const driver = driverByVehicle.get(v.id);
                const clientDrivers = drivers.filter(
                  (d) => d.clientId === v.clientId && d.status === "active",
                );
                return (
                  <tr key={v.id} className="hover:bg-zinc-900/40">
                    <td className="px-3 py-2">
                      <Link
                        href={`/fleet/vehicles/${v.id}`}
                        className="font-mono text-sky-300 hover:underline"
                      >
                        {v.registrationNumber}
                      </Link>
                      <div className="text-[11px] text-zinc-500">
                        {[v.brand, v.model].filter(Boolean).join(" ") || "—"}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-zinc-300">{v.clientLegalName ?? "—"}</td>
                    <td className="px-3 py-2">
                      {driver ? (
                        <Link
                          href={`/fleet/drivers/${driver.id}`}
                          className="inline-flex items-center gap-2 text-zinc-200 hover:underline"
                        >
                          <FleetAvatar name={driver.fullName} size={22} />
                          {driver.fullName}
                        </Link>
                      ) : (
                        <span className="text-amber-400/90">Nealocat</span>
                      )}
                    </td>
                    {canWrite ? (
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {driver ? (
                            <button
                              type="button"
                              disabled={pendingId === v.id}
                              onClick={() => void unassign(v.id, driver)}
                              className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
                            >
                              Dealocă
                            </button>
                          ) : null}
                          <select
                            className="max-w-[10rem] rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
                            value={assignDraft[v.id] ?? ""}
                            onChange={(e) =>
                              setAssignDraft((prev) => ({ ...prev, [v.id]: e.target.value }))
                            }
                          >
                            <option value="">Șofer…</option>
                            {clientDrivers.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.fullName}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={pendingId === v.id || !assignDraft[v.id]}
                            onClick={() => void assign(v.id, assignDraft[v.id]!)}
                            className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                          >
                            Alocă
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
