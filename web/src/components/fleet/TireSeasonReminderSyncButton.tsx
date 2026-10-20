"use client";

import { fleetJsonHeaders } from "@/lib/fleet-api";
import { useRouter } from "next/navigation";
import { useState } from "react";

type SyncResult = { created: number; updated: number; deactivated: number };

export function TireSeasonReminderSyncButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function sync() {
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch("/api/fleet/tires/sync-season-reminders", {
        method: "POST",
        headers: fleetJsonHeaders(),
      });
      if (!res.ok) {
        setMessage(`Eroare sincronizare (HTTP ${res.status})`);
        return;
      }
      const data = (await res.json()) as SyncResult;
      setMessage(
        `Remindere: ${data.created} noi, ${data.updated} actualizate, ${data.deactivated} dezactivate.`,
      );
      router.refresh();
    } catch {
      setMessage("Eroare la sincronizare.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => void sync()}
        className="rounded-lg border border-violet-800/60 bg-violet-950/30 px-4 py-2 text-sm text-violet-100 hover:bg-violet-950/50 disabled:opacity-50"
      >
        {pending ? "Se sincronizează…" : "Sincronizează remindere sezon"}
      </button>
      {message ? <p className="text-xs text-zinc-400">{message}</p> : null}
    </div>
  );
}
