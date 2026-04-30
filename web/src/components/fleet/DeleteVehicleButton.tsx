"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fleetBrowserBase, fleetJsonHeaders } from "@/lib/fleet-api";

type Props = {
  vehicleId: string;
  registrationNumber: string;
};

export function DeleteVehicleButton({ vehicleId, registrationNumber }: Props) {
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
