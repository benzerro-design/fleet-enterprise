"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { OPS_INPUT_CLASS } from "@/components/fleet/ops-form-primitives";
import { fleetJsonHeaders, suppliersBrowserBase, type SupplierRecord } from "@/lib/suppliers-api";

type Props = {
  supplier: SupplierRecord;
  canWrite: boolean;
};

export function SupplierTarifeEditor({ supplier, canWrite }: Props) {
  const router = useRouter();
  const [parts, setParts] = useState(String(supplier.partsDiscountPercent ?? 0));
  const [labor, setLabor] = useState(String(supplier.laborDiscountPercent ?? 0));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!canWrite) {
    return (
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-zinc-500">Discount piese</dt>
          <dd className="mt-1 text-sm text-zinc-200">{supplier.partsDiscountPercent ?? 0}%</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Discount manoperă</dt>
          <dd className="mt-1 text-sm text-zinc-200">{supplier.laborDiscountPercent ?? 0}%</dd>
        </div>
        <p className="sm:col-span-2 text-xs text-zinc-500">
          Default pe linii noi de deviz. Doar admin flotă poate edita.
        </p>
      </dl>
    );
  }

  async function save() {
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`${suppliersBrowserBase}/${supplier.id}`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          partsDiscountPercent: Number.parseFloat(parts.replace(",", ".")) || 0,
          laborDiscountPercent: Number.parseFloat(labor.replace(",", ".")) || 0,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Salvare eșuată");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs text-zinc-500">
          Discount piese (%)
          <input
            value={parts}
            onChange={(e) => setParts(e.target.value)}
            className={`${OPS_INPUT_CLASS} mt-1`}
            inputMode="decimal"
          />
        </label>
        <label className="text-xs text-zinc-500">
          Discount manoperă (%)
          <input
            value={labor}
            onChange={(e) => setLabor(e.target.value)}
            className={`${OPS_INPUT_CLASS} mt-1`}
            inputMode="decimal"
          />
        </label>
      </div>
      <p className="text-xs text-zinc-500">
        Prefill pe linii noi de deviz (piese / manoperă). Se poate modifica per linie pe comandă.
      </p>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-400">Salvat.</p> : null}
      <button
        type="button"
        disabled={pending}
        onClick={() => void save()}
        className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
      >
        {pending ? "Se salvează…" : "Salvează tarife"}
      </button>
    </div>
  );
}
