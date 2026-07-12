"use client";

import { useMemo, useState } from "react";
import {
  fleetJsonHeaders,
  supplierServiceLabel,
  suppliersBrowserBase,
  type SupplierServiceCatalogEntry,
  type SupplierServiceKind,
} from "@/lib/suppliers-api";

type Props = {
  supplierId: string;
  catalog: SupplierServiceCatalogEntry[];
  initialSelected: SupplierServiceKind[];
  canWrite: boolean;
  assignedByLabel?: string;
  onSaved?: (services: SupplierServiceKind[]) => void;
};

export function SupplierServicesEditor({
  supplierId,
  catalog,
  initialSelected,
  canWrite,
  assignedByLabel = "Flotă",
  onSaved,
}: Props) {
  const [selected, setSelected] = useState<SupplierServiceKind[]>(initialSelected);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = useMemo(() => {
    const a = [...selected].sort().join(",");
    const b = [...initialSelected].sort().join(",");
    return a !== b;
  }, [selected, initialSelected]);

  function toggle(kind: SupplierServiceKind) {
    if (!canWrite) return;
    setSelected((prev) =>
      prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind],
    );
    setSaved(false);
  }

  async function save() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${suppliersBrowserBase}/${supplierId}/services`, {
        method: "PUT",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({ services: selected }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string | string[] };
          if (typeof j.message === "string") msg = j.message;
          else if (Array.isArray(j.message)) msg = j.message.join(", ");
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      const updated = (await res.json()) as { services?: SupplierServiceKind[] };
      const next = updated.services ?? selected;
      setSelected(next);
      setSaved(true);
      onSaved?.(next);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400">
        Bifați serviciile pe care le prestați. Lista e folosită de flotă și clienți la programări și alocare
        comenzi.
      </p>

      {error ? (
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="text-sm text-emerald-400">Servicii salvate.</p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <div className="grid grid-cols-[1fr_1fr_5rem_6rem] gap-2 border-b border-zinc-800 bg-zinc-900/60 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          <span>Serviciu</span>
          <span>Descriere</span>
          <span>Activ</span>
          <span>Sursă</span>
        </div>
        {catalog.map((entry, i) => {
          const active = selected.includes(entry.kind);
          return (
            <div
              key={entry.kind}
              className={`grid grid-cols-[1fr_1fr_5rem_6rem] items-center gap-2 px-3 py-2.5 text-sm ${
                i > 0 ? "border-t border-zinc-800/80" : ""
              } ${canWrite ? "hover:bg-zinc-900/40" : ""}`}
            >
              <label className={`flex items-center gap-2 ${canWrite ? "cursor-pointer" : ""}`}>
                {canWrite ? (
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggle(entry.kind)}
                    className="rounded border-zinc-600"
                  />
                ) : null}
                <span className="font-medium text-zinc-200">
                  {entry.label ?? supplierServiceLabel(entry.kind)}
                </span>
              </label>
              <span className="text-xs text-zinc-500">{entry.description}</span>
              <span
                className={`text-center text-[10px] font-semibold uppercase ${
                  active ? "text-emerald-400" : "text-zinc-600"
                }`}
              >
                {active ? "Da" : "Nu"}
              </span>
              <span className="text-[10px] text-zinc-600">{active ? assignedByLabel : "—"}</span>
            </div>
          );
        })}
      </div>

      {canWrite ? (
        <button
          type="button"
          disabled={pending || !dirty}
          onClick={() => void save()}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {pending ? "Salvez…" : "Salvează servicii"}
        </button>
      ) : (
        <p className="text-xs text-zinc-500">Doar citire — contactați administratorul flotei pentru modificări.</p>
      )}
    </div>
  );
}
