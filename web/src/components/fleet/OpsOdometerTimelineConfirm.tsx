"use client";

import type { OdometerPreviewPayload } from "@/lib/ops-odometer-preview";

type Props = {
  open: boolean;
  preview: OdometerPreviewPayload | null;
  onCancel: () => void;
  onConfirm: () => void;
  pending?: boolean;
};

export function OpsOdometerTimelineConfirm({
  open,
  preview,
  onCancel,
  onConfirm,
  pending = false,
}: Props) {
  if (!open || !preview) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="odometer-timeline-confirm-title"
        className="w-full max-w-lg rounded-xl border border-rose-900/50 bg-zinc-950 p-5 shadow-xl"
      >
        <h3 id="odometer-timeline-confirm-title" className="text-base font-semibold text-rose-200">
          Importanță majoră — dată și km
        </h3>
        <p className="mt-2 text-sm text-zinc-400">
          Combinația introdusă nu respectă ordinea din istoricul odometrului vehiculului.
        </p>
        <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-xs text-rose-100/90">
          {preview.messages.map((m) => (
            <li key={m} className="rounded border border-rose-900/30 bg-rose-950/20 px-3 py-2">
              {m}
            </li>
          ))}
        </ul>
        <p className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-400">
          Dacă salvați oricum: evenimentul se înregistrează, dar{" "}
          <span className="text-zinc-300">km curent vehicul rămâne {preview.vehicleOdometerKm.toLocaleString("ro-RO")} km</span>{" "}
          (sau ultima citire validă). Recomandăm corectarea km sau datei.
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900 disabled:opacity-50"
          >
            Anulează
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-50"
          >
            {pending ? "Se salvează…" : "Salvează oricum"}
          </button>
        </div>
      </div>
    </div>
  );
}
