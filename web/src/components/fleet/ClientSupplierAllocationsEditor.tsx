"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { OPS_INPUT_CLASS } from "@/components/fleet/ops-form-primitives";
import { clientsBrowserBase, type ClientSupplierAllocationItem } from "@/lib/clients-api";
import { fleetJsonHeaders } from "@/lib/fleet-api";
import {
  suppliersBrowserBase,
  supplierCategoryLabel,
  supplierStatusLabel,
  type SupplierCategory,
  type SupplierListPayload,
  type SupplierRecord,
  type SupplierStatus,
} from "@/lib/suppliers-api";

type Props = {
  clientId: string;
  canWrite: boolean;
};

export function ClientSupplierAllocationsEditor({ clientId, canWrite }: Props) {
  const [allocated, setAllocated] = useState<ClientSupplierAllocationItem[]>([]);
  const [catalog, setCatalog] = useState<SupplierRecord[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const allocRes = await fetch(`${clientsBrowserBase}/${clientId}/supplier-allocations`, {
        headers: fleetJsonHeaders(),
        cache: "no-store",
      });
      if (!allocRes.ok) throw new Error(`HTTP ${allocRes.status}`);
      const allocData = (await allocRes.json()) as { items?: ClientSupplierAllocationItem[] };
      const items = allocData.items ?? [];
      setAllocated(items);
      setSelected(new Set(items.map((i) => i.supplierId)));

      if (canWrite) {
        const catRes = await fetch(`${suppliersBrowserBase}?pageSize=200`, {
          headers: fleetJsonHeaders(),
          cache: "no-store",
        });
        if (!catRes.ok) throw new Error(`HTTP ${catRes.status}`);
        const catData = (await catRes.json()) as SupplierListPayload;
        setCatalog(catData.items ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Încărcare eșuată");
    }
  }, [clientId, canWrite]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return catalog;
    return catalog.filter(
      (s) =>
        s.legalName.toLowerCase().includes(needle) ||
        s.code.toLowerCase().includes(needle) ||
        (s.taxId ?? "").toLowerCase().includes(needle),
    );
  }, [catalog, q]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSaved(false);
  }

  async function save() {
    if (!canWrite) return;
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`${clientsBrowserBase}/${clientId}/supplier-allocations`, {
        method: "PUT",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({ supplierIds: [...selected] }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { items?: ClientSupplierAllocationItem[] };
      const items = data.items ?? [];
      setAllocated(items);
      setSelected(new Set(items.map((i) => i.supplierId)));
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Salvare eșuată");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-100">Furnizori alocați</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Managerul clientului (L1) vede în costuri / mentenanță doar furnizorii bifați aici.
        </p>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-400">Alocare salvată.</p> : null}

      {canWrite ? (
        <>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Caută furnizor…"
            className={OPS_INPUT_CLASS}
          />
          {filtered.length === 0 ? (
            <p className="text-sm text-zinc-500">Niciun furnizor de alocat.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-zinc-800/80 overflow-y-auto rounded-lg border border-zinc-800">
              {filtered.map((s) => (
                <li key={s.id}>
                  <label className="flex cursor-pointer items-start gap-3 px-3 py-2 text-sm hover:bg-zinc-900/60">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selected.has(s.id)}
                      disabled={pending}
                      onChange={() => toggle(s.id)}
                    />
                    <span>
                      <span className="font-medium text-zinc-100">{s.legalName}</span>
                      <span className="mt-0.5 block font-mono text-xs text-zinc-500">
                        {s.code} · {supplierCategoryLabel(s.category)} · {supplierStatusLabel(s.status)}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => void save()}
            className="rounded-lg border border-emerald-600/50 bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold text-emerald-100 disabled:opacity-50"
          >
            {pending ? "Se salvează…" : "Salvează alocarea"}
          </button>
        </>
      ) : allocated.length === 0 ? (
        <p className="text-sm text-zinc-500">Niciun furnizor alocat acestui client.</p>
      ) : (
        <ul className="divide-y divide-zinc-800/80 rounded-lg border border-zinc-800">
          {allocated.map((s) => (
            <li key={s.supplierId} className="px-3 py-2 text-sm">
              <p className="font-medium text-zinc-100">{s.legalName}</p>
              <p className="mt-0.5 font-mono text-xs text-zinc-500">
                {s.code} · {supplierCategoryLabel(s.category as SupplierCategory)} ·{" "}
                {supplierStatusLabel(s.status as SupplierStatus)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
