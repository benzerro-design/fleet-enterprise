"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createTenantServiceType,
  deleteTenantServiceType,
  patchTenantServiceType,
} from "@/lib/tenant-service-types/tenant-service-types-api";
import type { TenantServiceType } from "@/lib/tenant-service-types/types";

type Props = {
  initialItems: TenantServiceType[];
};

function ClientPreview({
  types,
  previewCode,
  onPreviewCodeChange,
}: {
  types: TenantServiceType[];
  previewCode: string;
  onPreviewCodeChange: (code: string) => void;
}) {
  const active = types.filter((t) => t.active);
  const preview = active.find((t) => t.code === previewCode) ?? active[0];

  if (active.length === 0) {
    return (
      <p className="text-sm text-zinc-500">Niciun tip activ — clienții nu vor vedea opțiuni în portal.</p>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
      <p className="text-sm font-medium text-zinc-200">Preview — portal client (tichet nou)</p>
      <p className="mt-1 text-xs text-zinc-500">
        Simulare dropdown — fiecare tip are propria descriere; nu afectează celelalte din catalog.
      </p>
      <label className="mt-4 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        Tip solicitare servicii
      </label>
      <select
        value={preview?.code ?? ""}
        onChange={(e) => onPreviewCodeChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
      >
        {active.map((s) => (
          <option key={s.id} value={s.code}>
            {s.label}
          </option>
        ))}
      </select>
      <p key={preview?.id} className="mt-2 text-xs leading-relaxed text-zinc-400">
        {preview?.clientDescription}
      </p>
    </div>
  );
}

export function TenantServiceTypesEditor({ initialItems }: Props) {
  const [items, setItems] = useState(initialItems);
  const [selectedId, setSelectedId] = useState<string | null>(initialItems[0]?.id ?? null);
  const [previewCode, setPreviewCode] = useState(initialItems.find((t) => t.active)?.code ?? initialItems[0]?.code ?? "");
  const [showAdd, setShowAdd] = useState(false);
  const [draftCode, setDraftCode] = useState("");
  const [draftLabel, setDraftLabel] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const addPanelRef = useRef<HTMLDivElement>(null);

  const selected = items.find((x) => x.id === selectedId) ?? items[0];

  const canDelete = selected && !selected.system && selected.usedBySuppliers === 0 && selected.usedByTickets === 0;

  const dirty = useMemo(() => {
    if (!selected) return false;
    const orig = initialItems.find((x) => x.id === selected.id);
    if (!orig) return true;
    return orig.label !== selected.label || orig.clientDescription !== selected.clientDescription;
  }, [selected, initialItems]);

  useEffect(() => {
    if (!selected) return;
    setPreviewCode(selected.code);
  }, [selected?.id, selected?.code]);

  useEffect(() => {
    const active = items.filter((t) => t.active);
    if (active.length === 0) return;
    if (!active.some((t) => t.code === previewCode)) {
      setPreviewCode(active[0]!.code);
    }
  }, [items, previewCode]);

  useEffect(() => {
    if (showAdd) {
      addPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [showAdd]);

  function selectRow(id: string) {
    const row = items.find((x) => x.id === id);
    setSelectedId(id);
    if (row) setPreviewCode(row.code);
    setShowAdd(false);
  }

  function handlePreviewCodeChange(code: string) {
    setPreviewCode(code);
    const row = items.find((t) => t.code === code);
    if (row) setSelectedId(row.id);
  }

  function updateLocal(id: string, patch: Partial<TenantServiceType>) {
    setItems((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    setSaved(false);
  }

  async function saveSelected() {
    if (!selected) return;
    setPending(true);
    setError(null);
    try {
      const updated = await patchTenantServiceType(selected.id, {
        label: selected.label,
        clientDescription: selected.clientDescription,
      });
      setItems((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la salvare");
    } finally {
      setPending(false);
    }
  }

  async function toggleActive(id: string) {
    const row = items.find((x) => x.id === id);
    if (!row) return;
    setPending(true);
    setError(null);
    try {
      const updated = await patchTenantServiceType(id, { active: !row.active });
      setItems((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string) {
    setPending(true);
    setError(null);
    try {
      await deleteTenantServiceType(id);
      const next = items.filter((x) => x.id !== id);
      setItems(next);
      if (selectedId === id) {
        const fallback = next[0];
        setSelectedId(fallback?.id ?? null);
        if (fallback) setPreviewCode(fallback.code);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la ștergere");
    } finally {
      setPending(false);
    }
  }

  async function addType() {
    const code = draftCode.trim().toLowerCase().replace(/\s+/g, "_");
    const label = draftLabel.trim();
    if (!code || !label) {
      setError("Cod și denumire sunt obligatorii");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const created = await createTenantServiceType({
        code,
        label,
        clientDescription: draftDesc.trim() || label,
      });
      setItems((prev) => [...prev, created]);
      setSelectedId(created.id);
      setPreviewCode(created.code);
      setDraftCode("");
      setDraftLabel("");
      setDraftDesc("");
      setShowAdd(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la adăugare");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid min-h-0 gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Catalog tipuri servicii</h2>
            <p className="mt-1 text-sm text-zinc-400">Tenant-wide — folosit de clienți, furnizori și CRM.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowAdd(true);
              setError(null);
            }}
            disabled={pending}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            + Tip nou
          </button>
        </div>

        {error ? (
          <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">{error}</p>
        ) : null}
        {saved ? <p className="text-sm text-emerald-400">Modificări salvate.</p> : null}

        <div className="overflow-hidden rounded-xl border border-zinc-800">
          <div className="grid grid-cols-[4.5rem_1fr_3rem_3rem_3rem] gap-2 border-b border-zinc-800 bg-zinc-900/60 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            <span>Cod</span>
            <span>Denumire</span>
            <span className="text-center">Furniz.</span>
            <span className="text-center">Tichete</span>
            <span className="text-center">Activ</span>
          </div>
          {items.map((row, i) => (
            <button
              key={row.id}
              type="button"
              onClick={() => selectRow(row.id)}
              className={`grid w-full grid-cols-[4.5rem_1fr_3rem_3rem_3rem] gap-2 px-3 py-2.5 text-left text-sm transition-colors ${
                selected?.id === row.id ? "bg-zinc-900/80" : "bg-zinc-950 hover:bg-zinc-900/40"
              } ${i ? "border-t border-zinc-800" : ""}`}
            >
              <span className="truncate font-mono text-xs text-zinc-500">{row.code}</span>
              <span className={selected?.id === row.id ? "font-medium text-zinc-100" : "text-zinc-300"}>
                {row.label}
                {row.system ? <span className="ml-2 text-[10px] text-zinc-600">sistem</span> : null}
              </span>
              <span className="text-center text-zinc-500">{row.usedBySuppliers}</span>
              <span className="text-center text-zinc-500">{row.usedByTickets}</span>
              <span className="text-center text-xs text-zinc-400">{row.active ? "Da" : "Nu"}</span>
            </button>
          ))}
        </div>
      </div>

      <div ref={addPanelRef} className="space-y-4 lg:max-h-[calc(100dvh-12rem)] lg:overflow-y-auto lg:pr-1 fleet-scroll-pane">
        {showAdd ? (
          <div className="space-y-3 rounded-xl border border-emerald-900/40 bg-zinc-900/40 p-4">
            <p className="text-sm font-medium text-zinc-200">Tip servicii nou</p>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Cod (slug)</label>
              <input
                value={draftCode}
                onChange={(e) => setDraftCode(e.target.value)}
                placeholder="ex. adblue_refill"
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Denumire (admin)</label>
              <input
                value={draftLabel}
                onChange={(e) => setDraftLabel(e.target.value)}
                placeholder="ex. Reîncărcare AdBlue"
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Descriere pentru clienți
              </label>
              <textarea
                value={draftDesc}
                onChange={(e) => setDraftDesc(e.target.value)}
                rows={3}
                placeholder="Text afișat în portal client la selectarea tipului..."
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addType}
                disabled={pending}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                Adaugă
              </button>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
              >
                Anulează
              </button>
            </div>
          </div>
        ) : selected ? (
          <>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-zinc-100">{selected.label}</p>
                <code className="text-xs text-zinc-500">{selected.code}</code>
              </div>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    Denumire (admin + furnizor)
                  </label>
                  <input
                    value={selected.label}
                    onChange={(e) => updateLocal(selected.id, { label: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    Descriere pentru clienți
                  </label>
                  <textarea
                    value={selected.clientDescription}
                    onChange={(e) => updateLocal(selected.id, { clientDescription: e.target.value })}
                    rows={4}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {dirty ? (
                    <button
                      type="button"
                      onClick={saveSelected}
                      disabled={pending}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      Salvează
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => toggleActive(selected.id)}
                    disabled={pending}
                    className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900 disabled:opacity-50"
                  >
                    {selected.active ? "Dezactivează" : "Activează"}
                  </button>
                  {canDelete ? (
                    <button
                      type="button"
                      onClick={() => remove(selected.id)}
                      disabled={pending}
                      className="rounded-lg border border-red-900/60 px-3 py-2 text-sm text-red-300 hover:bg-red-950/30 disabled:opacity-50"
                    >
                      Șterge
                    </button>
                  ) : null}
                </div>
                {selected.usedBySuppliers > 0 || selected.usedByTickets > 0 ? (
                  <p className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
                    Folosit de {selected.usedBySuppliers} furnizori și {selected.usedByTickets} tichete — doar
                    dezactivare.
                  </p>
                ) : null}
              </div>
            </div>
            <ClientPreview
              types={items}
              previewCode={previewCode}
              onPreviewCodeChange={handlePreviewCodeChange}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
