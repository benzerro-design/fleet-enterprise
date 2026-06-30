"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { fleetBrowserBase, fleetJsonHeaders } from "@/lib/fleet-api";
import { severityBorderClass } from "@/lib/vehicle-odometer-sync";
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
  const [timeline] = useState(initial.timeline);
  const [newKm, setNewKm] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [successSeverity, setSuccessSeverity] = useState<"ok" | "info" | "warning" | "critical">("ok");

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
        odometerValidation?: {
          severity: "ok" | "info" | "warning" | "critical";
          message: string;
        };
      };
      setCurrentKm(data.vehicle.odometerKm);
      setReadings((prev) => [data.reading, ...prev].sort(
        (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
      ));
      setNewKm("");
      setNotes("");
      const severity = data.odometerValidation?.severity ?? "ok";
      setSuccessSeverity(severity);
      setSuccess(
        data.odometerValidation?.message ??
          (data.vehicle.odometerKm > prevKm
            ? `Citire înregistrată. Km curent: ${prevKm.toLocaleString("ro-RO")} → ${data.vehicle.odometerKm.toLocaleString("ro-RO")} km.`
            : `Citire înregistrată (${km.toLocaleString("ro-RO")} km). Km curent vehicul: ${data.vehicle.odometerKm.toLocaleString("ro-RO")} km.`),
      );
      router.refresh();
    } catch {
      setError("Rețea sau server indisponibil.");
    } finally {
      setPending(false);
    }
  }

  const violationIds = new Set<string>();
  if (timeline?.violations.length) {
    for (const v of timeline.violations) {
      violationIds.add(v.laterRecordedAt);
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-sky-900/40 bg-sky-950/20 p-4">
        <p className="text-xs uppercase tracking-wide text-sky-400/80">Km curent vehicul</p>
        <p className="mt-1 font-mono text-3xl font-semibold text-sky-100">{currentKm.toLocaleString("ro-RO")} km</p>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          Km curent = valoarea din <span className="text-zinc-400">cea mai recentă citire cronologic</span> (dată +
          km), nu neapărat cel mai mare număr din istoric. Citirile se adaugă automat la cost, mentenanță sau cursă
          (cu analiză dată/km). Înregistrările manuale apar în istoricul de mai jos.
        </p>
        {timeline?.latestRecordedAt ? (
          <p className="mt-2 text-xs text-zinc-600">
            Ultima citire cronologic:{" "}
            {new Date(timeline.latestRecordedAt).toLocaleString("ro-RO")}
            {timeline.currentKmFromTimeline != null
              ? ` · ${timeline.currentKmFromTimeline.toLocaleString("ro-RO")} km`
              : null}
          </p>
        ) : null}
        {initial.reconciled ? (
          <p className="mt-2 rounded border border-sky-900/30 bg-sky-950/30 px-2 py-1 text-xs text-sky-300">
            Km curent a fost reconciliat automat cu istoricul (corecție față de vechea regulă „maxim numeric”).
          </p>
        ) : null}
      </div>

      {timeline?.hasCriticalViolations ? (
        <div className="rounded-lg border border-rose-900/50 bg-rose-950/30 p-4">
          <p className="text-sm font-semibold text-rose-200">Importanță majoră — inconsistență dată / km</p>
          <p className="mt-1 text-xs text-rose-200/90">
            Istoricul conține citiri unde odometrul scade în timp. Corectați datele sursă (curse, mentenanță, costuri)
            sau citirile manuale.
          </p>
          <ul className="mt-3 space-y-2">
            {timeline.violations.map((v) => (
              <li key={`${v.earlierRecordedAt}-${v.laterRecordedAt}`} className="text-xs text-rose-100/90">
                {v.message}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs font-medium text-rose-300">
            Acțiune: verificați evenimentele din perioada indicată și aliniați km cu ordinea cronologică.
          </p>
        </div>
      ) : timeline && !timeline.isConsistent ? (
        <div className="rounded-lg border border-amber-900/40 bg-amber-950/25 p-4 text-xs text-amber-200">
          Există neconcordanțe minore în istoric — verificați citirile de mai jos.
        </div>
      ) : null}

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-4">
        <p className="text-sm font-medium text-zinc-300">Integrare tracking (în curând)</p>
        <p className="mt-1 text-xs text-zinc-500">
          La conectarea aplicației de tracking, citirile vor veni automat cu sursă{" "}
          <span className="text-sky-300">tracking</span> și verificare în timp real față de km-ul curent și ordinea
          cronologică.
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
            <p className={`rounded-lg border px-3 py-2 text-sm ${severityBorderClass(successSeverity)}`}>{success}</p>
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
            {[...readings]
              .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
              .map((r) => {
                const isViolation = violationIds.has(r.recordedAt);
                return (
                  <li
                    key={r.id}
                    className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm ${isViolation ? "bg-rose-950/15" : ""}`}
                  >
                    <span className={`font-mono ${isViolation ? "text-rose-200" : "text-zinc-200"}`}>
                      {r.odometerKm.toLocaleString("ro-RO")} km
                    </span>
                    <span className="text-xs text-zinc-500">
                      {SOURCE_LABELS[r.source] ?? r.source} · {new Date(r.recordedAt).toLocaleString("ro-RO")}
                      {r.recordedByEmail ? ` · ${r.recordedByEmail}` : ""}
                    </span>
                    {r.notes ? <span className="w-full text-xs text-zinc-600">{r.notes}</span> : null}
                    {isViolation ? (
                      <span className="w-full text-xs font-medium text-rose-400">
                        Importanță majoră: km incompatibil cu ordinea cronologică
                      </span>
                    ) : null}
                  </li>
                );
              })}
          </ul>
        )}
      </div>
    </div>
  );
}
