"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fleetBrowserBase } from "@/lib/fleet-api";

export type TireLedgerMovement = {
  id: string;
  at: string;
  source: "placement" | "stay" | "event";
  kind: string;
  label: string;
  plate?: string | null;
  supplierName?: string | null;
  locationCode?: string | null;
  workOrderId?: string | null;
  sourceSystem?: string | null;
};

type Props = {
  /** fleet or partner API base path */
  apiBase?: string;
  mode: "vehicle" | "asset" | "client";
  entityId: string;
  /** Collapsed by default in compact embeds */
  defaultOpen?: boolean;
  title?: string;
};

export function TireMovementLedger({
  apiBase = `${fleetBrowserBase}/tires/ledger`,
  mode,
  entityId,
  defaultOpen = false,
  title = "Fișă mișcări",
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [items, setItems] = useState<TireLedgerMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !entityId.trim()) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetch(`${apiBase}/${mode}/${encodeURIComponent(entityId.trim())}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { movements?: TireLedgerMovement[] };
        if (!cancelled) setItems([...(data.movements ?? [])].reverse());
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Eroare");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase, mode, entityId, open]);

  return (
    <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-zinc-300 hover:bg-zinc-900/50"
      >
        <span>{title}</span>
        <span className="text-zinc-500">{open ? "▲" : "▼"}</span>
      </button>
      {open ? (
        <div className="border-t border-zinc-800/80 px-3 py-2">
          {loading ? (
            <p className="text-xs text-zinc-500">Se încarcă…</p>
          ) : error ? (
            <p className="text-xs text-red-300">{error}</p>
          ) : items.length === 0 ? (
            <p className="text-xs text-zinc-500">Nicio mișcare înregistrată.</p>
          ) : (
            <ul className="max-h-48 space-y-1.5 overflow-y-auto">
              {items.map((m) => (
                <li key={m.id} className="text-[11px] text-zinc-400">
                  <span className="text-zinc-300">
                    {new Date(m.at).toLocaleString("ro-RO", {
                      day: "2-digit",
                      month: "short",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {" · "}
                  <span className="text-zinc-200">{m.label}</span>
                  {m.plate ? ` · ${m.plate}` : ""}
                  {m.supplierName ? ` · ${m.supplierName}` : ""}
                  {m.locationCode ? ` · ${m.locationCode}` : ""}
                  {m.sourceSystem ? ` · ${m.sourceSystem}` : ""}
                  {m.workOrderId ? (
                    <>
                      {" · "}
                      <Link
                        href={`/fleet/work-orders/${m.workOrderId}`}
                        className="text-sky-400 hover:underline"
                      >
                        WO
                      </Link>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
