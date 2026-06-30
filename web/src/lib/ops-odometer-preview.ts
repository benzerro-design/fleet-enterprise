import { fleetBrowserBase } from "@/lib/fleet-api";
import { toIsoFromDatetimeLocal } from "@/lib/datetime-local";

export type OdometerPreviewPayload = {
  severity: "ok" | "info" | "warning" | "critical";
  messages: string[];
  message: string;
  willUpdateCurrentKm: boolean;
  newCurrentKm: number;
  vehicleOdometerKm: number;
  timelineConsistent: boolean;
  requiresConfirmation: boolean;
};

/** Convertește datetime-local sau YYYY-MM-DD la ISO pentru preview API. */
export function opsEventDateToIso(eventDate: string): string | null {
  const raw = eventDate.trim();
  if (!raw) return null;
  if (raw.includes("T")) {
    return toIsoFromDatetimeLocal(raw) ?? null;
  }
  const d = new Date(`${raw}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export async function fetchOdometerPreview(
  vehicleId: string,
  odometerKm: number,
  recordedAtIso: string,
): Promise<OdometerPreviewPayload | null> {
  const qs = new URLSearchParams({
    odometerKm: String(Math.round(odometerKm)),
    recordedAt: recordedAtIso,
  });
  try {
    const res = await fetch(
      `${fleetBrowserBase}/vehicles/${encodeURIComponent(vehicleId)}/odometer-preview?${qs}`,
    );
    if (!res.ok) return null;
    return (await res.json()) as OdometerPreviewPayload;
  } catch {
    return null;
  }
}
