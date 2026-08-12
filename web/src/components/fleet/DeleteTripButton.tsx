"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  tripId: string;
  label?: string;
  redirectTo?: string;
};

export function DeleteTripButton({ tripId, label, redirectTo }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    const ok = window.confirm(`Ștergi cursa ${label ?? tripId}?`);
    if (!ok) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}`, { method: "DELETE" });
      if (res.ok || res.status === 204 || res.status === 404) {
        if (redirectTo) router.push(redirectTo);
        router.refresh();
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
      <button type="button" onClick={() => void onDelete()} disabled={pending} className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-950/70 disabled:opacity-50">
        {pending ? "Șterg..." : "Șterge"}
      </button>
      {error ? <p className="max-w-[12rem] text-right text-xs text-amber-400">{error}</p> : null}
    </div>
  );
}
