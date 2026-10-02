"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fleetBrowserBase, fleetJsonHeaders } from "@/lib/fleet-api";

type Props = {
  vehicleId: string;
  registrationNumber: string;
  /** text = buton clasic; icon = doar iconiță coș */
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

export function DeleteVehicleButton({ vehicleId, registrationNumber, variant = "text" }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    const ok = window.confirm(
      `Ștergi vehiculul ${registrationNumber}? Acțiunea nu poate fi anulată din UI.`,
    );
    if (!ok) return;

    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${fleetBrowserBase}/vehicles/${vehicleId}`, {
        method: "DELETE",
        headers: fleetJsonHeaders(),
      });
      if (res.status === 204) {
        router.refresh();
        return;
      }
      if (res.status === 404) {
        setError("Vehiculul nu mai există.");
        router.refresh();
        return;
      }
      const text = await res.text();
      setError(text || `Eroare ${res.status}`);
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
          aria-label={`Șterge ${registrationNumber}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-900/60 bg-red-950/40 text-red-200 hover:bg-red-950/70 disabled:opacity-50"
        >
          <IconTrash className="h-3.5 w-3.5" />
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
        {pending ? "Șterg…" : "Șterge"}
      </button>
      {error ? <p className="max-w-[12rem] text-right text-xs text-amber-400">{error}</p> : null}
    </div>
  );
}
