"use client";

import type { VehicleOdometerSyncPayload } from "@/lib/vehicle-odometer-sync";
import { severityBorderClass } from "@/lib/vehicle-odometer-sync";

type Props = {
  sync: VehicleOdometerSyncPayload | null | undefined;
  className?: string;
};

/** Mesaj după salvare cost / mentenanță / cursă — respectă severitatea timeline dată+km. */
export function OpsOdometerSyncNotice({ sync, className = "" }: Props) {
  if (!sync?.message) return null;
  return (
    <p className={`rounded-lg border px-4 py-3 text-sm ${severityBorderClass(sync.severity)} ${className}`.trim()}>
      {sync.severity === "critical" ? (
        <span className="mr-1 font-semibold uppercase tracking-wide text-rose-300">Importanță majoră · </span>
      ) : null}
      {sync.message}
    </p>
  );
}
