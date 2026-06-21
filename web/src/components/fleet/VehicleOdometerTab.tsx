"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { fleetBrowserBase, fleetJsonHeaders } from "@/lib/fleet-api";
import type { OdometerReadingsPayload } from "@/lib/vehicle-profile-types";

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual (tab Odometru)",
  tracking: "Tracking",
  import: "Import / migrare",
  ops: "Operațiuni (cost / mentenanță / cursă)",
};

type Props = {
  vehicleId: string;
  write: boolean;
  initial: OdometerReadingsPayload;
};

export function VehicleOdometerTab({ vehicleId, write, initial }: Props) {
  const router = useRouter();
  const [currentKm, setCurrentKm] = useState(initial.vehicleOdometerKm);
  const [readings, setReadings] = useState(initial.items);
  const [newKm, setNewKm] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!write) return;
    const km = Number(newKm);
    if (!Number.isFinite(km) || km < 0) {
      setError("Introduceți un număr valid de km.");
      return;
    }
    if (km < currentKm && !notes.trim()) {
      setError(
        `Km introdus (${km.toLocaleString("ro-RO")}) este sub km-ul curent (${currentKm.toLocaleString("ro-RO")}). Adăugați o notă explicativă pentru corecție.`,
      );
      return;
    }
    setPending(true);
    setError(null);
    setSuccess(null);
    const prevKm = currentKm;
    try {
      const res = await fetch(`${fleetBrowserBase}/vehicles/${vehicleId}/odometer-readings`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          odometerKm: Math.round(km),
          notes: notes.trim() || null,
          source: "manual",
        }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string | string[] };
          if (typeof j.message === "string") msg = j.message;
          else if (Array.isArray(j.message)) msg = j.message.join(", ");
        } catch {}
        setError(msg);
        return;
      }
      const data = (await res.json()) as {
        reading: (typeof readings)[0];
        vehicle: { odometerKm: number };
      };
      setCurrentKm(data.vehicle.odometerKm);
      setReadings((prev) => [data.reading, ...prev]);
      setNewKm("");
      setNotes("");
      if (data.vehicle.odometerKm > prevKm) {
        setSuccess(
          `Citire înregistrată în istoric. Km curent vehicul actualizat: ${prevKm.toLocaleString("ro-RO")} → ${data.vehicle.odometerKm.toLocaleString("ro-RO")} km.`,
        );
      } else if (data.vehicle.odometerKm < prevKm) {
        setSuccess(
          `Citire corectivă înregistrată în istoric (${km.toLocaleString("ro-RO")} km). Km curent vehicul rămas ${data.vehicle.odometerKm.toLocaleString("ro-RO")} km.`,
        );
      } else {
        setSuccess(`Citire înregistrată în istoric (${km.toLocaleString("ro-RO")} km). Km curent vehicul neschimbat.`);
      }
      router.refresh();
    } catch {
      setError("Rețea sau server indisponibil.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-sky-900/40 bg-sky-950/20 p-4">
        <p className="text-xs uppercase tracking-wide text-sky-400/80">Km curent vehicul</p>
        <p className="mt-1 font-mono text-3xl font-semibold text-sky-100">{currentKm.toLocaleString("ro-RO")} km</p>
        <p className="mt-2 text-xs text-zinc-500">
          Se actualizează automat când introduceți km mai mari la cost, mentenanță sau cursă (cu avertisment). Aici
          înregistrați manual orice citire — fiecare salvare apare în istoricul de mai jos.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-4">
        <p className="text-sm font-medium text-zinc-300">Integrare tracking (în curând)</p>
        <p className="mt-1 text-xs text-zinc-500">
          La conectarea aplicației de tracking, citirile vor veni automat cu sursă{" "}
          <span className="text-sky-300">tracking</span> și verificare în timp real față de km-ul curent.
        </p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-500">
          <span className="h-2 w-2 rounded-full bg-zinc-600" />
          Neconectat
        </div>
      </div>

      {write ? (
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4 rounded-lg border border-zinc-800 p-4">
          <h3 className="text-sm font-medium text-zinc-300">Actualizare manuală</h3>
          {error ? <p className="text-sm text-amber-300">{error}</p> : null}
          {success ? (
            <p className="rounded-lg border border-sky-900/40 bg-sky-950/25 px-3 py-2 text-sm text-sky-200">{success}</p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm text-zinc-400">Km nou</label>
              <input
                type="number"
                min={0}
                step={1}
                required
                value={newKm}
                onChange={(e) => setNewKm(e.target.value)}
                placeholder={String(currentKm)}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400">Notă (opțional)</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ex. citire atelier, factură service"
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {pending ? "Înregistrez…" : "Înregistrează km"}
          </button>
        </form>
      ) : null}

      <div>
        <h3 className="mb-3 text-sm font-medium text-zinc-300">Istoric citiri</h3>
        {readings.length === 0 ? (
          <p className="text-sm text-zinc-500">Nicio citire înregistrată.</p>
        ) : (
          <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
            {readings.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="font-mono text-zinc-200">{r.odometerKm.toLocaleString("ro-RO")} km</span>
                <span className="text-xs text-zinc-500">
                  {SOURCE_LABELS[r.source] ?? r.source} · {new Date(r.recordedAt).toLocaleString("ro-RO")}
                  {r.recordedByEmail ? ` · ${r.recordedByEmail}` : ""}
                </span>
                {r.notes ? <span className="w-full text-xs text-zinc-600">{r.notes}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
