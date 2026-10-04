"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fleetJsonHeaders } from "@/lib/fleet-api";
import { suppliersBrowserBase, type SupplierClientAllocationItem } from "@/lib/suppliers-api";

type Props = {
  supplierId: string;
};

/** SUPP-042: pe fișa Furnizor — doar read/link. Write canonic = Client → Furnizori. */
export function SupplierClientAllocationsEditor({ supplierId }: Props) {
  const [items, setItems] = useState<SupplierClientAllocationItem[]>([]);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${suppliersBrowserBase}/${supplierId}/client-allocations`, {
        headers: fleetJsonHeaders(),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { items?: SupplierClientAllocationItem[] };
      setItems(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Încărcare eșuată");
    } finally {
      setPending(false);
    }
  }, [supplierId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-100">Clienți alocați</h3>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          Vizualizare. Alocarea se editează pe{" "}
          <span className="text-zinc-400">Client → tab Furnizori</span> (un singur write canonic —
          SUPP-042).
        </p>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {pending ? <p className="text-sm text-zinc-500">Se încarcă…</p> : null}

      {!pending && items.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Niciun client alocat. Deschide fișa clientului → Furnizori pentru a aloca.
        </p>
      ) : null}

      {!pending && items.length > 0 ? (
        <ul className="divide-y divide-zinc-800/80 overflow-hidden rounded-lg border border-zinc-800">
          {items.map((c) => (
            <li key={c.clientId}>
              <Link
                href={`/fleet/clients/${c.clientId}?tab=suppliers`}
                className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm hover:bg-zinc-900/60"
              >
                <span>
                  <span className="font-medium text-zinc-100">{c.legalName}</span>
                  <span className="mt-0.5 block font-mono text-xs text-zinc-500">
                    {c.code} · {c.status === "active" ? "Activ" : "Inactiv"}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-sky-400">Deschide →</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
