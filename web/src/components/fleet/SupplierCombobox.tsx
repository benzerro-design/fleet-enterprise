"use client";

import { useEffect, useState } from "react";
import {
  suppliersBrowserBase,
  type SupplierCategory,
  type SupplierRecord,
} from "@/lib/suppliers-api";

type Props = {
  value: string;
  onChange: (supplierId: string, supplier: SupplierRecord | null) => void;
  category?: SupplierCategory;
  serviceTypeCode?: string;
  disabled?: boolean;
  className?: string;
};

export function SupplierCombobox({
  value,
  onChange,
  category,
  serviceTypeCode,
  disabled,
  className = "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2",
}: Props) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<SupplierRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("status", "active");
      params.set("pageSize", "30");
      if (q.trim()) params.set("q", q.trim());
      if (category) params.set("category", category);
      if (serviceTypeCode) params.set("serviceTypeCode", serviceTypeCode);
      void fetch(`${suppliersBrowserBase}?${params}`)
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((j: { items?: SupplierRecord[] }) => {
          if (!cancelled) setItems(j.items ?? []);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, category, serviceTypeCode]);

  return (
    <div className="space-y-2">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Caută furnizor (cod, denumire, CUI)…"
        disabled={disabled}
        className={className}
      />
      <select
        value={value}
        disabled={disabled || loading}
        onChange={(e) => {
          const id = e.target.value;
          const row = items.find((i) => i.id === id) ?? null;
          onChange(id, row);
        }}
        className={className}
      >
        <option value="">— Selectează furnizor —</option>
        {items.map((s) => (
          <option key={s.id} value={s.id}>
            {s.code} — {s.legalName}
          </option>
        ))}
      </select>
      {loading ? <p className="text-xs text-zinc-500">Se încarcă…</p> : null}
    </div>
  );
}
