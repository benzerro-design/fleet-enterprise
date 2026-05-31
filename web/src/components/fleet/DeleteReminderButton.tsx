"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  reminderId: string;
  title: string;
  redirectTo?: string;
  onDeleted?: () => void;
  /** delete = custom hard delete; deactivate = synced reminder (keeps source record) */
  mode?: "delete" | "deactivate";
};

export function DeleteReminderButton({
  reminderId,
  title,
  redirectTo,
  onDeleted,
  mode = "delete",
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDeactivate = mode === "deactivate";

  async function onDelete() {
    const msg = isDeactivate
      ? `Dezactivezi reminderul „${title}"?\n\nÎnregistrarea sursă (document, mentenanță sau cost) rămâne. Poți reactiva din modulul sursă.`
      : `Ștergi acțiunea „${title}"?`;
    if (!window.confirm(msg)) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/reminders/${reminderId}`, { method: "DELETE" });
      if (res.ok || res.status === 204 || res.status === 404) {
        onDeleted?.();
        if (redirectTo) router.push(redirectTo);
        else router.refresh();
        return;
      }
      setError((await res.text()) || `Eroare ${res.status}`);
    } catch {
      setError("Rețea sau server indisponibil.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void onDelete()}
        disabled={pending}
        className={
          isDeactivate
            ? "rounded-lg border border-violet-800/60 bg-violet-950/40 px-3 py-1.5 text-xs font-medium text-violet-200 hover:bg-violet-950/70 disabled:opacity-50"
            : "rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-950/70 disabled:opacity-50"
        }
      >
        {pending ? "Procesez..." : isDeactivate ? "Dezactivează" : "Șterge"}
      </button>
      {error ? <p className="max-w-[12rem] text-right text-xs text-amber-400">{error}</p> : null}
    </div>
  );
}
