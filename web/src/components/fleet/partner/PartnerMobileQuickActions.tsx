"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { workOrdersBrowserBase } from "@/lib/work-orders-api";
import { fleetJsonHeaders } from "@/lib/fleet-api";

type Props = {
  workOrderId: string;
  canWrite: boolean;
  status: string;
  hasInService: boolean;
  hasReady: boolean;
};

/**
 * PARTNER-019 — acțiuni rapide pe mobil (IN / Ready / Done) fără scroll în foaia desktop.
 */
export function PartnerMobileQuickActions({
  workOrderId,
  canWrite,
  status,
  hasInService,
  hasReady,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canWrite) return null;

  async function run(label: string, fn: () => Promise<void>) {
    setPending(label);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
    } finally {
      setPending(null);
    }
  }

  async function markIn() {
    const now = new Date().toISOString();
    const res = await fetch(`${workOrdersBrowserBase}/${workOrderId}/service-times`, {
      method: "PATCH",
      headers: fleetJsonHeaders(),
      body: JSON.stringify({ inServiceAt: now }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(j.message ?? `HTTP ${res.status}`);
    }
  }

  async function markReady() {
    const res = await fetch(`${workOrdersBrowserBase}/${workOrderId}/mark-ready`, {
      method: "POST",
      headers: fleetJsonHeaders(),
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(j.message ?? `HTTP ${res.status}`);
    }
  }

  async function markDone() {
    const res = await fetch(`${workOrdersBrowserBase}/${workOrderId}/complete`, {
      method: "POST",
      headers: fleetJsonHeaders(),
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(j.message ?? `HTTP ${res.status}`);
    }
  }

  const done = status === "done" || status === "cancelled";

  return (
    <div className="mb-4 rounded-xl border border-violet-500/30 bg-violet-950/20 p-3 lg:hidden">
      <p className="text-[11px] font-medium uppercase tracking-wide text-violet-300/90">
        Acțiuni rapide
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <button
          type="button"
          disabled={!!pending || done || hasInService}
          onClick={() => void run("in", markIn)}
          className="rounded-lg bg-zinc-900 px-2 py-2.5 text-xs font-medium text-zinc-100 disabled:opacity-40"
        >
          {pending === "in" ? "…" : "IN atelier"}
        </button>
        <button
          type="button"
          disabled={!!pending || done || hasReady || !hasInService}
          onClick={() => void run("ready", markReady)}
          className="rounded-lg bg-zinc-900 px-2 py-2.5 text-xs font-medium text-zinc-100 disabled:opacity-40"
        >
          {pending === "ready" ? "…" : "Gata"}
        </button>
        <button
          type="button"
          disabled={!!pending || done}
          onClick={() => void run("done", markDone)}
          className="rounded-lg bg-violet-600 px-2 py-2.5 text-xs font-medium text-white disabled:opacity-40"
        >
          {pending === "done" ? "…" : "Finalizează"}
        </button>
      </div>
      <p className="mt-2 text-[10px] text-zinc-500">
        Foto: folosește galeria din foaie · Programări: tab Programator
      </p>
      {error ? <p className="mt-1 text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
