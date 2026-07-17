"use client";

import { useCallback, useEffect, useState } from "react";
import { fleetJsonHeaders, workOrdersBrowserBase } from "@/lib/work-orders-api";

export type WorkOrderMessage = {
  id: string;
  workOrderId: string;
  body: string;
  visibility: "internal" | "client_visible";
  authorEmail: string;
  authorDisplayName: string;
  createdAt: string;
};

type Props = {
  workOrderId: string;
  canWrite: boolean;
  isPartner?: boolean;
};

export function WorkOrderMessageThread({ workOrderId, canWrite, isPartner = false }: Props) {
  const [items, setItems] = useState<WorkOrderMessage[]>([]);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Flotă: notă internă (invizibilă partenerului). Default = vizibil partener. */
  const [internalOnly, setInternalOnly] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${workOrdersBrowserBase}/${workOrderId}/messages`, { cache: "no-store" });
      if (!res.ok) return;
      setItems((await res.json()) as WorkOrderMessage[]);
    } catch {
      /* ignore */
    }
  }, [workOrderId]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(id);
  }, [load]);

  async function send() {
    if (!body.trim()) return;
    setPending(true);
    setError(null);
    try {
      const visibility =
        isPartner || !internalOnly ? "client_visible" : "internal";
      const res = await fetch(`${workOrdersBrowserBase}/${workOrderId}/messages`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          body: body.trim(),
          visibility,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setBody("");
      await load();
    } catch {
      setError("Nu am putut trimite mesajul.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
      <h3 className="text-sm font-semibold text-zinc-200">Mesaje comandă</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Thread partener ↔ flotă pe această comandă
        {isPartner ? " (vedeți doar mesajele partajate)." : "."}
      </p>

      <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
        {items.length === 0 ? (
          <p className="text-sm text-zinc-500">Niciun mesaj încă.</p>
        ) : (
          items.map((m) => (
            <div key={m.id} className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2">
              <p className="text-[10px] text-zinc-500">
                {m.authorDisplayName} · {new Date(m.createdAt).toLocaleString("ro-RO")}
                {!isPartner ? (
                  m.visibility === "internal" ? (
                    <span className="text-amber-400/80"> · intern (doar flotă)</span>
                  ) : (
                    <span className="text-emerald-500/70"> · vizibil partener</span>
                  )
                ) : null}
              </p>
              <p className="mt-1 text-sm text-zinc-200">{m.body}</p>
            </div>
          ))
        )}
      </div>

      {canWrite ? (
        <div className="mt-4 space-y-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Scrie un mesaj…"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
          {!isPartner ? (
            <label className="flex items-center gap-2 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={internalOnly}
                onChange={(e) => setInternalOnly(e.target.checked)}
              />
              Doar flotă (intern — partenerul nu vede)
            </label>
          ) : null}
          {error ? <p className="text-xs text-amber-300">{error}</p> : null}
          <button
            type="button"
            disabled={pending || !body.trim()}
            onClick={() => void send()}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {pending ? "Trimit…" : "Trimite"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
