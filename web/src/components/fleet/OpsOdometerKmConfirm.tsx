"use client";

import { parseOdometerInput } from "@/lib/vehicle-odometer-sync";

type Props = {
  open: boolean;
  enteredKm: number;
  vehicleOdometerKm: number;
  onCancel: () => void;
  onConfirm: () => void;
  pending?: boolean;
};

export function OpsOdometerKmConfirm({
  open,
  enteredKm,
  vehicleOdometerKm,
  onCancel,
  onConfirm,
  pending = false,
}: Props) {
  if (!open) return null;

  const willUpdateVehicle = enteredKm >= vehicleOdometerKm;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="odometer-confirm-title"
        className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-950 p-5 shadow-xl"
      >
        <h3 id="odometer-confirm-title" className="text-base font-semibold text-zinc-100">
          Confirmare km eveniment
        </h3>
        <p className="mt-3 text-sm text-zinc-400">
          Km introdus:{" "}
          <span className="font-mono text-sky-300">{enteredKm.toLocaleString("ro-RO")}</span>
          {" · "}
          Km curent vehicul:{" "}
          <span className="font-mono text-zinc-300">{vehicleOdometerKm.toLocaleString("ro-RO")}</span>
        </p>
        {willUpdateVehicle ? (
          <p className="mt-3 rounded-lg border border-amber-900/40 bg-amber-950/25 px-3 py-2 text-xs text-amber-200/95">
            La confirmare se va crea o citire odometru pe vehicul și un eveniment în timeline-ul tichetului.
          </p>
        ) : (
          <p className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-400">
            Km introdus este sub km curent — vehiculul nu va fi actualizat, dar km eveniment va fi înregistrat pe tichet.
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900 disabled:opacity-50"
          >
            Nu
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {pending ? "Se salvează…" : "Da, confirmă"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function shouldConfirmOdometerKm(odometerKm: string, vehicleOdometerKm: number): number | null {
  const km = parseOdometerInput(odometerKm);
  if (km == null) return null;
  if (km > vehicleOdometerKm) return km;
  return null;
}
