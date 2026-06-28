"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  FleetDataTable,
  fleetTableClass,
  fleetTdClass,
  fleetThClass,
  fleetTheadClass,
} from "@/components/fleet/fleet-data-table";
import { DriverSelect } from "@/components/fleet/DriverSelect";
import {
  driversBrowserBase,
  fleetJsonHeaders,
  type DriverAssignmentRecord,
} from "@/lib/drivers-api";

type Props = {
  vehicleId: string;
  clientCode: string;
  registrationNumber: string;
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

export function VehicleDriversPanel({
  vehicleId,
  clientCode,
  registrationNumber,
  initialAssignments,
  canWrite,
}: Props) {
  const router = useRouter();
  const [assignments, setAssignments] = useState(initialAssignments);
  const [driverId, setDriverId] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = assignments.find((a) => !a.unassignedAt) ?? null;
  const history = assignments.filter((a) => a.unassignedAt);

  async function refreshAssignments() {
    const res = await fetch(`/api/fleet/vehicles/${vehicleId}/driver-assignments`);
    if (res.ok) {
      setAssignments((await res.json()) as DriverAssignmentRecord[]);
    }
  }

  async function onAssign() {
    if (!driverId) return;
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
      setDriverId("");
      setNotes("");
      router.refresh();
      await refreshAssignments();
    } finally {
      setPending(false);
    }
  }

  async function onEnd(assignment: DriverAssignmentRecord) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(
        `${driversBrowserBase}/${assignment.driverId}/assignments/${assignment.id}/end`,
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
      await refreshAssignments();
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h2 className="text-sm font-medium text-zinc-300">Șofer curent</h2>
        {active ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <Link
                href={`/fleet/drivers/${active.driverId}`}
                className="text-lg font-medium text-emerald-400 hover:underline"
              >
                {active.driverFullName ?? "Șofer"}
              </Link>
              <p className="mt-1 text-xs text-zinc-500">
                Alocat din {formatDateTime(active.assignedAt)}
                {active.assignedByEmail ? ` · de ${active.assignedByEmail}` : ""}
              </p>
            </div>
            {canWrite ? (
              <button
                type="button"
                onClick={() => void onEnd(active)}
                disabled={pending}
                className="rounded-lg border border-amber-800/60 px-3 py-1.5 text-xs text-amber-300 hover:bg-amber-950/40 disabled:opacity-60"
              >
                Încheie alocarea
              </button>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">Niciun șofer alocat pe {registrationNumber}.</p>
        )}
      </div>

      {canWrite ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="text-sm font-medium text-zinc-300">Alocă / schimbă șofer</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Alocarea unui șofer nou închide automat alocarea anterioară pe acest vehicul.
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="min-w-[14rem] flex-1">
              <DriverSelect clientCode={clientCode} value={driverId} onChange={setDriverId} />
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
              disabled={!driverId || pending}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-60"
            >
              Alocă șofer
            </button>
          </div>
          {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}
        </div>
      ) : null}

      <div>
        <h2 className="text-sm font-medium text-zinc-300">Istoric șoferi</h2>
        {history.length === 0 && !active ? (
          <p className="mt-3 text-sm text-zinc-500">Nicio alocare înregistrată.</p>
        ) : (
          <FleetDataTable className="mt-3">
            <table className={fleetTableClass}>
              <thead className={fleetTheadClass}>
                <tr>
                  <th className={fleetThClass}>Șofer</th>
                  <th className={fleetThClass}>Alocat</th>
                  <th className={fleetThClass}>Încheiat</th>
                  <th className={fleetThClass}>De către</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {assignments.map((a) => (
                  <tr key={a.id} className="text-zinc-200">
                    <td className={fleetTdClass}>
                      <Link
                        href={`/fleet/drivers/${a.driverId}`}
                        className="text-emerald-400 hover:underline"
                      >
                        {a.driverFullName ?? a.driverId.slice(0, 8)}
                      </Link>
                      {!a.unassignedAt ? (
                        <span className="ml-2 rounded bg-emerald-950/60 px-1.5 py-0.5 text-[10px] text-emerald-300">
                          activ
                        </span>
                      ) : null}
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
        )}
      </div>
    </section>
  );
}
