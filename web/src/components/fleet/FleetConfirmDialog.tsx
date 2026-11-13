"use client";

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Confirmare în stilul aplicației — fără window.confirm din browser. */
export function FleetConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmă",
  cancelLabel = "Anulează",
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fleet-confirm-title"
        className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-950 p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="fleet-confirm-title" className="text-sm font-semibold text-zinc-100">
          {title}
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">{message}</p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="rounded-md bg-violet-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-600 disabled:opacity-50"
          >
            {busy ? "Se procesează…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
