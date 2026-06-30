"use client";

import { parseOdometerInput } from "@/lib/vehicle-odometer-sync";

type Props = {
  odometerKm: string;
  vehicleOdometerKm: number;
  /** Data evenimentului (ISO sau datetime-local) — pentru analiză dată + km. */
  eventDate?: string;
};

function parseEventDate(raw: string | undefined): Date | null {
  if (!raw?.trim()) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function OpsOdometerKmHint({ odometerKm, vehicleOdometerKm, eventDate }: Props) {
  const km = parseOdometerInput(odometerKm);
  if (km == null) return null;

  const eventAt = parseEventDate(eventDate);
  const now = new Date();
  const isBackdated = eventAt != null && eventAt.getTime() < now.getTime() - 60_000;

  if (km > vehicleOdometerKm && isBackdated) {
    return (
      <p className="rounded-lg border border-amber-900/40 bg-amber-950/25 px-3 py-2 text-xs text-amber-200/95">
        Atenție (dată + km): km introdus ({km.toLocaleString("ro-RO")}) depășește km curent vehicul (
        {vehicleOdometerKm.toLocaleString("ro-RO")}), dar data evenimentului este în trecut (
        {eventAt!.toLocaleString("ro-RO")}). La salvare, km curent se actualizează doar dacă aceasta este cea
        mai recentă citire cronologic — altfel rămâne {vehicleOdometerKm.toLocaleString("ro-RO")} km. Verificați
        că km respectă ordinea din istoric (nu poate fi mai mare decât citiri ulterioare).
      </p>
    );
  }

  if (km > vehicleOdometerKm) {
    return (
      <p className="rounded-lg border border-amber-900/40 bg-amber-950/25 px-3 py-2 text-xs text-amber-200/95">
        Atenție: km introdus ({km.toLocaleString("ro-RO")}) depășește km curent vehicul (
        {vehicleOdometerKm.toLocaleString("ro-RO")}). La salvare, km curent al vehiculului va fi actualizat la
        valoarea celei mai recente citiri cronologic (dată + km).
      </p>
    );
  }

  if (km < vehicleOdometerKm && isBackdated) {
    return (
      <p className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-400">
        Km introdus este sub km curent ({vehicleOdometerKm.toLocaleString("ro-RO")}) la o dată din trecut. Citirea
        se înregistrează în istoric dacă se încadrează cronologic între citirile existente; altfel veți primi
        avertisment de importanță majoră.
      </p>
    );
  }

  if (km < vehicleOdometerKm) {
    return (
      <p className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-400">
        Km introdus este sub km curent vehicul ({vehicleOdometerKm.toLocaleString("ro-RO")}) — km curent se
        modifică doar dacă data evenimentului este cea mai recentă din istoric.
      </p>
    );
  }

  return null;
}
