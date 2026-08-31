"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { OPS_INPUT_CLASS } from "@/components/fleet/ops-form-primitives";
import { clientsBrowserBase, type ClientListPayload, type ClientRecord } from "@/lib/clients-api";
import { fleetJsonHeaders } from "@/lib/fleet-api";
import { suppliersBrowserBase, type SupplierClientAllocationItem } from "@/lib/suppliers-api";

type Props = {
  supplierId: string;
};

export function SupplierClientAllocationsEditor({ supplierId }: Props) {
  const [catalog, setCatalog] = useState<ClientRecord[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [allocRes, cliRes] = await Promise.all([
        fetch(`${suppliersBrowserBase}/${supplierId}/client-allocations`, {
          headers: fleetJsonHeaders(),
          cache: "no-store",
        }),
        fetch(`${clientsBrowserBase}?pageSize=200`, {
          headers: fleetJsonHeaders(),
          cache: "no-store",
        }),
      ]);
      if (!allocRes.ok) throw new Error(`HTTP ${allocRes.status}`);
      if (!cliRes.ok) throw new Error(`HTTP ${cliRes.status}`);
      const allocData = (await allocRes.json()) as { items?: SupplierClientAllocationItem[] };
      const cliData = (await cliRes.json()) as ClientListPayload;
      setCatalog(cliData.items ?? []);
      setSelected(new Set((allocData.items ?? []).map((i) => i.clientId)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Încărcare eșuată");
    }
  }, [supplierId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return catalog;
    return catalog.filter(
      (c) =>
        c.legalName.toLowerCase().includes(needle) ||
        c.code.toLowerCase().includes(needle) ||
        (c.taxId ?? "").toLowerCase().includes(needle),
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
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`${suppliersBrowserBase}/${supplierId}/client-allocations`, {
        method: "PUT",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({ clientIds: [...selected] }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { items?: SupplierClientAllocationItem[] };
      setSelected(new Set((data.items ?? []).map((i) => i.clientId)));
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
        <h3 className="text-sm font-semibold text-zinc-100">Clienți alocați</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Doar managerii acestor clienți văd furnizorul în formulare (costuri, mentenanță, WO).
        </p>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-400">Alocare salvată.</p> : null}

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Caută client…"
        className={OPS_INPUT_CLASS}
      />
      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-500">Niciun client de alocat.</p>
      ) : (
        <ul className="max-h-96 divide-y divide-zinc-800/80 overflow-y-auto rounded-lg border border-zinc-800">
          {filtered.map((c) => (
            <li key={c.id}>
              <label className="flex cursor-pointer items-start gap-3 px-3 py-2 text-sm hover:bg-zinc-900/60">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.has(c.id)}
                  disabled={pending}
                  onChange={() => toggle(c.id)}
                />
                <span>
                  <span className="font-medium text-zinc-100">{c.legalName}</span>
                  <span className="mt-0.5 block font-mono text-xs text-zinc-500">
                    {c.code} · {c.status === "active" ? "Activ" : "Inactiv"}
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
    </div>
  );
}
