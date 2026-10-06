"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  tripId: string;
  label?: string;
  redirectTo?: string;
  variant?: "text" | "icon";
};

function IconTrash({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4.5 7h15M9.5 7V5.5a1.5 1.5 0 0 1 1.5-1.5h2a1.5 1.5 0 0 1 1.5 1.5V7m2 0v11.5a1.5 1.5 0 0 1-1.5 1.5h-9a1.5 1.5 0 0 1-1.5-1.5V7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 11v5M14 11v5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function DeleteTripButton({ tripId, label, redirectTo, variant = "text" }: Props) {
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

  if (variant === "icon") {
    return (
      <div className="inline-flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => void onDelete()}
          disabled={pending}
          title={pending ? "Șterg…" : "Șterge"}
          aria-label={`Șterge ${label ?? tripId}`}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-red-900/50 bg-red-950/30 text-red-300 transition-colors hover:bg-red-950/60 disabled:opacity-50 touch-manipulation"
        >
          <IconTrash className="h-4 w-4" />
        </button>
        {error ? <p className="max-w-[10rem] text-right text-[10px] text-amber-400">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void onDelete()}
        disabled={pending}
        className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-950/70 disabled:opacity-50"
      >
        {pending ? "Șterg..." : "Șterge"}
      </button>
      {error ? <p className="max-w-[12rem] text-right text-xs text-amber-400">{error}</p> : null}
    </div>
  );
}
