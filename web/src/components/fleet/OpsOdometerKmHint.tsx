"use client";

import { parseOdometerInput } from "@/lib/vehicle-odometer-sync";

type Props = {
  odometerKm: string;
  vehicleOdometerKm: number;
};

export function OpsOdometerKmHint({ odometerKm, vehicleOdometerKm }: Props) {
  const km = parseOdometerInput(odometerKm);
  if (km == null) return null;

  if (km > vehicleOdometerKm) {
    return (
      <p className="rounded-lg border border-amber-900/40 bg-amber-950/25 px-3 py-2 text-xs text-amber-200/95">
        Atenție: km introdus ({km.toLocaleString("ro-RO")}) depășește km curent vehicul (
        {vehicleOdometerKm.toLocaleString("ro-RO")}). La salvare, km curent al vehiculului va fi actualizat
        automat.
      </p>
    );
  }

  if (km < vehicleOdometerKm) {
    return (
      <p className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-400">
        Km introdus este sub km curent vehicul ({vehicleOdometerKm.toLocaleString("ro-RO")}) — km vehicul nu se
        modifică.
      </p>
    );
  }

  return null;
}
