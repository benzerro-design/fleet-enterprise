"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  FleetDataTable,
  fleetTableClass,
  fleetTdClass,
  fleetThClass,
  fleetTheadClass,
} from "@/components/fleet/fleet-data-table";
import { fleetBrowserBase } from "@/lib/fleet-api";
import {
  driversBrowserBase,
  fleetJsonHeaders,
  type DriverAssignmentRecord,
} from "@/lib/drivers-api";

type Props = {
  driverId: string;
  clientCode: string;
  initialAssignments: DriverAssignmentRecord[];
  canWrite: boolean;
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ro-RO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DriverAssignmentsPanel({
  driverId,
  clientCode,
  initialAssignments,
  canWrite,
}: Props) {
  const router = useRouter();
  const [assignments, setAssignments] = useState(initialAssignments);
  const [vehicleId, setVehicleId] = useState("");
  const [notes, setNotes] = useState("");
  const [vehicles, setVehicles] = useState<Array<{ id: string; registrationNumber: string }>>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadingVehicles(true);
      try {
        const res = await fetch(
          `${fleetBrowserBase}/vehicles?clientId=${encodeURIComponent(clientCode)}&pageSize=200`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          items: Array<{ id: string; registrationNumber: string }>;
        };
        if (!cancelled) {
          setVehicles(data.items.map((v) => ({ id: v.id, registrationNumber: v.registrationNumber })));
        }
      } finally {
        if (!cancelled) setLoadingVehicles(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientCode]);

  async function onAssign() {
    if (!vehicleId) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${driversBrowserBase}/${driverId}/assignments`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({ vehicleId, notes: notes.trim() || null }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string | string[] };
          if (typeof j.message === "string") msg = j.message;
          else if (Array.isArray(j.message)) msg = j.message.join(", ");
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      setVehicleId("");
      setNotes("");
      router.refresh();
      const listRes = await fetch(`${driversBrowserBase}/${driverId}/assignments`);
      if (listRes.ok) {
        setAssignments((await listRes.json()) as DriverAssignmentRecord[]);
      }
    } finally {
      setPending(false);
    }
  }

  async function onEnd(assignmentId: string) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(
        `${driversBrowserBase}/${driverId}/assignments/${assignmentId}/end`,
        { method: "PATCH", headers: fleetJsonHeaders() },
      );
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string | string[] };
          if (typeof j.message === "string") msg = j.message;
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      router.refresh();
      const listRes = await fetch(`${driversBrowserBase}/${driverId}/assignments`);
      if (listRes.ok) {
        setAssignments((await listRes.json()) as DriverAssignmentRecord[]);
      }
    } finally {
      setPending(false);
    }
  }

  const active = assignments.filter((a) => !a.unassignedAt);
  const history = assignments.filter((a) => a.unassignedAt);

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <h2 className="text-sm font-medium text-zinc-300">Alocări vehicule</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Un șofer poate folosi mai multe vehicule. Alocarea pe un vehicul închide automat alocarea anterioară pe același vehicul.
      </p>

      {canWrite ? (
        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
          <div className="min-w-[12rem] flex-1">
            <label className="text-xs text-zinc-500">Vehicul</label>
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              disabled={loadingVehicles || pending}
              className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="">{loadingVehicles ? "Se încarcă…" : "Selectează vehicul"}</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.registrationNumber}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[12rem] flex-1">
            <label className="text-xs text-zinc-500">Note (opțional)</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={pending}
              className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
          </div>
          <button
            type="button"
            onClick={() => void onAssign()}
            disabled={!vehicleId || pending}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-60"
          >
            Alocă
          </button>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}

      <div className="mt-6">
        <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Active</h3>
        {active.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Nicio alocare activă.</p>
        ) : (
          <ul className="mt-2 divide-y divide-zinc-800/80">
            {active.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <Link
                    href={`/fleet/vehicles/${a.vehicleId}`}
                    className="font-mono text-emerald-400 hover:underline"
                  >
                    {a.registrationNumber}
                  </Link>
                  <span className="ml-2 text-zinc-500">din {formatDateTime(a.assignedAt)}</span>
                  {a.assignedByEmail ? (
                    <span className="ml-2 text-xs text-zinc-600">de {a.assignedByEmail}</span>
                  ) : null}
                </div>
                {canWrite ? (
                  <button
                    type="button"
                    onClick={() => void onEnd(a.id)}
                    disabled={pending}
                    className="text-xs text-amber-400 hover:underline disabled:opacity-60"
                  >
                    Încheie alocarea
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {history.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Istoric</h3>
          <FleetDataTable className="mt-2">
            <table className={fleetTableClass}>
              <thead className={fleetTheadClass}>
                <tr>
                  <th className={fleetThClass}>Vehicul</th>
                  <th className={fleetThClass}>Alocat</th>
                  <th className={fleetThClass}>Încheiat</th>
                  <th className={fleetThClass}>De către</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {history.map((a) => (
                  <tr key={a.id} className="text-zinc-200">
                    <td className={fleetTdClass}>
                      <Link
                        href={`/fleet/vehicles/${a.vehicleId}`}
                        className="font-mono text-emerald-400 hover:underline"
                      >
                        {a.registrationNumber}
                      </Link>
                    </td>
                    <td className={`${fleetTdClass} text-zinc-400`}>{formatDateTime(a.assignedAt)}</td>
                    <td className={`${fleetTdClass} text-zinc-400`}>
                      {a.unassignedAt ? formatDateTime(a.unassignedAt) : "—"}
                    </td>
                    <td className={`${fleetTdClass} text-zinc-500`}>{a.assignedByEmail ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </FleetDataTable>
        </div>
      ) : null}
    </section>
  );
}
