"use client";

import { useEffect, useState } from "react";
import { fetchOdometerPreview, opsEventDateToIso, type OdometerPreviewPayload } from "@/lib/ops-odometer-preview";
import { parseOdometerInput } from "@/lib/vehicle-odometer-sync";

type Props = {
  odometerKm: string;
  vehicleOdometerKm: number;
  vehicleId?: string;
  /** Data evenimentului (ISO, datetime-local sau YYYY-MM-DD). */
  eventDate?: string;
};

function parseEventDate(raw: string | undefined): Date | null {
  if (!raw?.trim()) return null;
  const iso = opsEventDateToIso(raw);
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function OpsOdometerKmHint({ odometerKm, vehicleOdometerKm, vehicleId, eventDate }: Props) {
  const km = parseOdometerInput(odometerKm);
  const [preview, setPreview] = useState<OdometerPreviewPayload | null>(null);

  useEffect(() => {
    if (km == null || !vehicleId?.trim() || !eventDate?.trim()) {
      setPreview(null);
      return;
    }
    const iso = opsEventDateToIso(eventDate);
    if (!iso) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void fetchOdometerPreview(vehicleId, km, iso).then((p) => {
        if (!cancelled) setPreview(p);
      });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [km, vehicleId, eventDate]);

  if (km == null) return null;

  if (preview?.severity === "critical") {
    return (
      <div className="space-y-2">
        <p className="rounded-lg border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-xs text-rose-100/95">
          <span className="font-semibold uppercase tracking-wide text-rose-300">Importanță majoră · </span>
          {preview.messages[0] ?? preview.message}
        </p>
        <p className="text-xs text-zinc-500">
          La salvare vi se va cere confirmare. Km curent vehicul nu va fi modificat dacă datele rămân inconsistente.
        </p>
      </div>
    );
  }

  const eventAt = parseEventDate(eventDate);
  const now = new Date();
  const isBackdated = eventAt != null && eventAt.getTime() < now.getTime() - 60_000;

  if (preview?.severity === "info" || preview?.severity === "warning") {
    return (
      <p className="rounded-lg border border-sky-900/40 bg-sky-950/25 px-3 py-2 text-xs text-sky-200/95">
        {preview.message}
      </p>
    );
  }

  if (km > vehicleOdometerKm && isBackdated) {
    return (
      <p className="rounded-lg border border-amber-900/40 bg-amber-950/25 px-3 py-2 text-xs text-amber-200/95">
        Atenție (dată + km): km introdus ({km.toLocaleString("ro-RO")}) depășește km curent vehicul (
        {vehicleOdometerKm.toLocaleString("ro-RO")}), dar data evenimentului este în trecut (
        {eventAt!.toLocaleString("ro-RO")}). Verificați ordinea din istoricul odometrului.
      </p>
    );
  }

  if (km > vehicleOdometerKm) {
    return (
      <p className="rounded-lg border border-amber-900/40 bg-amber-950/25 px-3 py-2 text-xs text-amber-200/95">
        Atenție: km introdus ({km.toLocaleString("ro-RO")}) depășește km curent vehicul (
        {vehicleOdometerKm.toLocaleString("ro-RO")}). La salvare, km curent se actualizează doar dacă citirea este
        validă cronologic.
      </p>
    );
  }

  if (km < vehicleOdometerKm && isBackdated) {
    return (
      <p className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-400">
        Km introdus este sub km curent ({vehicleOdometerKm.toLocaleString("ro-RO")}) la o dată din trecut. Verificați
        încadrarea în istoricul odometrului.
      </p>
    );
  }

  if (km < vehicleOdometerKm) {
    return (
      <p className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-400">
        Km introdus este sub km curent vehicul ({vehicleOdometerKm.toLocaleString("ro-RO")}) — km curent se modifică
        doar dacă data evenimentului este cea mai recentă validă din istoric.
      </p>
    );
  }

  return null;
}
