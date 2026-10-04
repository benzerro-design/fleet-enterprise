"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SheetListGrid, type SheetCol } from "@/components/fleet/SheetListGrid";
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

  type SupplierCol = "pick" | "name" | "code" | "category" | "status";
  type SupplierGridRow = {
    id: string;
    legalName: string;
    code: string;
    category: string;
    status: string;
    taxId: string | null;
  };

  const WRITE_COLUMNS: SheetCol<SupplierCol>[] = [
    { key: "pick", label: "Alocat", defaultVisible: true, canHide: false, width: "4.5rem" },
    { key: "name", label: "Furnizor", defaultVisible: true, canHide: false, width: "34%" },
    { key: "code", label: "Cod", defaultVisible: true, canHide: true, width: "16%" },
    { key: "category", label: "Categorie", defaultVisible: true, canHide: true, width: "22%" },
    { key: "status", label: "Status", defaultVisible: true, canHide: true, width: "14%" },
  ];
  const READ_COLUMNS = WRITE_COLUMNS.filter((c) => c.key !== "pick");

  function renderSupplierCell(key: SupplierCol, s: SupplierGridRow, writable: boolean) {
    if (key === "pick") {
      return (
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-zinc-600 bg-zinc-950 text-emerald-500"
          checked={selected.has(s.id)}
          disabled={pending || !writable}
          onChange={() => toggle(s.id)}
          aria-label={`Alocă ${s.legalName}`}
        />
      );
    }
    if (key === "name") {
      return (
        <Link href={`/fleet/suppliers/${s.id}`} className="block truncate text-[13px] font-semibold text-zinc-100 hover:text-emerald-300 hover:underline">
          {s.legalName}
        </Link>
      );
    }
    if (key === "code") return <span className="font-mono text-xs text-zinc-400">{s.code}</span>;
    if (key === "category") {
      return <span className="text-zinc-300">{supplierCategoryLabel(s.category as SupplierCategory)}</span>;
    }
    const active = s.status === "active";
    return (
      <span
        className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium ${
          active ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-zinc-500/40 bg-zinc-500/10 text-zinc-300"
        }`}
      >
        {supplierStatusLabel(s.status as SupplierStatus)}
      </span>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-100">Furnizori alocați</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Locul canonic de alocare (SUPP-042). Managerul clientului (L1) vede în costuri / mentenanță /
          WO doar furnizorii bifați aici. Pe fișa furnizorului lista e doar vizualizare.
        </p>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-400">Alocare salvată.</p> : null}

      {canWrite ? (
        <>
          <SheetListGrid
            storageKey="fleet-client-suppliers-grid-v1"
            pickerTitle="Coloane furnizori"
            columns={WRITE_COLUMNS}
            rows={catalog}
            rowKey={(s) => s.id}
            searchPlaceholder="Denumire, cod, CUI…"
            searchText={(s) => `${s.legalName} ${s.code} ${s.taxId ?? ""}`}
            statusOptions={[
              { value: "active", label: "Activ" },
              { value: "inactive", label: "Inactiv" },
              { value: "blocked", label: "Blocat" },
            ]}
            rowStatus={(s) => s.status}
            toolbarEnd={
              <button
                type="button"
                disabled={pending}
                onClick={() => void save()}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                {pending ? "Se salvează…" : "Salvează alocarea"}
              </button>
            }
            empty={<p>Niciun furnizor pentru filtrele curente.</p>}
            renderCell={(key, s) => renderSupplierCell(key, s, true)}
          />
        </>
      ) : (
        <SheetListGrid
          storageKey="fleet-client-suppliers-readonly-grid-v1"
          pickerTitle="Coloane furnizori"
          columns={READ_COLUMNS}
          rows={allocated.map((s) => ({
            id: s.supplierId,
            legalName: s.legalName,
            code: s.code,
            category: s.category,
            status: s.status,
            taxId: null as string | null,
          }))}
          rowKey={(s) => s.id}
          searchPlaceholder="Denumire, cod…"
          searchText={(s) => `${s.legalName} ${s.code}`}
          empty={<p>Niciun furnizor alocat acestui client.</p>}
          renderCell={(key, s) => renderSupplierCell(key, s, false)}
        />
      )}
    </div>
  );
}
