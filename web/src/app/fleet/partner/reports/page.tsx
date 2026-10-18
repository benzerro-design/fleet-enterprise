"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { partnerBrowserSupplierQuery } from "@/lib/partner-pending-actions-api";

type MonthlySummary = {
  year: number;
  month: number;
  workOrderCount: number;
  completedCount: number;
  readyCount: number;
  appointmentCompletedCount: number;
  quoteApprovedCount: number;
  quoteInvoicedCount: number;
  valueInvoicedCents: number;
  valueApprovedCents: number;
};

type FieldDef = {
  id: string;
  label: string;
  group: string;
  defaultOn: boolean;
};

type FieldsCatalog = {
  groups: Array<{ id: string; label: string }>;
  fields: FieldDef[];
  defaults: string[];
};

const STORAGE_KEY = "partner-report-fields-v1";

function ron(cents: number): string {
  return `${(cents / 100).toLocaleString("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} RON`;
}

function loadStoredFields(defaults: string[]): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed) || !parsed.length) return defaults;
    return parsed;
  } catch {
    return defaults;
  }
}

export default function PartnerReportsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [catalog, setCatalog] = useState<FieldsCatalog | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/partner/reports/fields", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as FieldsCatalog;
        if (cancelled) return;
        setCatalog(data);
        const allowed = new Set(data.fields.map((f) => f.id));
        const stored = loadStoredFields(data.defaults).filter((id) => allowed.has(id));
        setSelected(new Set(stored.length ? stored : data.defaults));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Catalog câmpuri indisponibil");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selected.size) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...selected]));
    } catch {
      /* ignore */
    }
  }, [selected]);

  const load = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      q.set("year", String(year));
      q.set("month", String(month));
      const supplierQ = partnerBrowserSupplierQuery().replace(/^\?/, "");
      if (supplierQ) {
        for (const [k, v] of new URLSearchParams(supplierQ)) q.set(k, v);
      }
      const res = await fetch(`/api/partner/reports/monthly?${q.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSummary((await res.json()) as MonthlySummary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Încărcare eșuată");
      setSummary(null);
    } finally {
      setPending(false);
    }
  }, [year, month]);

  useEffect(() => {
    void load();
  }, [load]);

  const allIds = useMemo(() => catalog?.fields.map((f) => f.id) ?? [], [catalog]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const noneSelected = selected.size === 0;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(allIds));
  }

  function selectNone() {
    setSelected(new Set());
  }

  function selectDefaults() {
    if (catalog) setSelected(new Set(catalog.defaults));
  }

  function toggleGroup(groupId: string, on: boolean) {
    if (!catalog) return;
    const ids = catalog.fields.filter((f) => f.group === groupId).map((f) => f.id);
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function csvHref(): string {
    const q = new URLSearchParams();
    q.set("year", String(year));
    q.set("month", String(month));
    if (selected.size) q.set("fields", [...selected].join(","));
    const supplierQ = partnerBrowserSupplierQuery().replace(/^\?/, "");
    if (supplierQ) {
      for (const [k, v] of new URLSearchParams(supplierQ)) q.set(k, v);
    }
    return `/api/partner/reports/monthly.csv?${q.toString()}`;
  }

  const rowCount = selected.size - (selected.has("summaryFooter") ? 1 : 0);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 pb-16">
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">Raport lunar</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Sumar pe lună + export CSV. Bifează ce coloane vrei în fișier — preferința se salvează
          local.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-zinc-500">
          An
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="mt-1 block w-24 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
        </label>
        <label className="text-xs text-zinc-500">
          Lună
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="mt-1 block w-28 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <a
          href={noneSelected || rowCount < 1 ? undefined : csvHref()}
          aria-disabled={noneSelected || rowCount < 1}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            noneSelected || rowCount < 1
              ? "cursor-not-allowed bg-zinc-800 text-zinc-500"
              : "bg-violet-600 text-white hover:bg-violet-500"
          }`}
          onClick={(e) => {
            if (noneSelected || rowCount < 1) e.preventDefault();
          }}
        >
          Descarcă CSV ({selected.size} câmpuri)
        </a>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {pending && !summary ? <p className="text-sm text-zinc-500">Se încarcă…</p> : null}

      {summary ? (
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
            <dt className="text-[11px] text-zinc-500">WO create</dt>
            <dd className="mt-1 text-lg text-zinc-100">{summary.workOrderCount}</dd>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
            <dt className="text-[11px] text-zinc-500">Gata / finalizate</dt>
            <dd className="mt-1 text-lg text-zinc-100">
              {summary.readyCount} / {summary.completedCount}
            </dd>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
            <dt className="text-[11px] text-zinc-500">Programări finalizate</dt>
            <dd className="mt-1 text-lg text-zinc-100">{summary.appointmentCompletedCount}</dd>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
            <dt className="text-[11px] text-zinc-500">Devize aprobate / facturate</dt>
            <dd className="mt-1 text-lg text-zinc-100">
              {summary.quoteApprovedCount} / {summary.quoteInvoicedCount}
            </dd>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 sm:col-span-2">
            <dt className="text-[11px] text-zinc-500">Valoare aprobată / facturată</dt>
            <dd className="mt-1 text-lg text-zinc-100">
              {ron(summary.valueApprovedCents)} · {ron(summary.valueInvoicedCents)}
            </dd>
          </div>
        </dl>
      ) : null}

      {catalog ? (
        <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Câmpuri în export</h2>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                {selected.size} selectate · minim 1 coloană pe rând WO (în afară de SUMMARY)
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={selectAll}
                className="rounded-md border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-300 hover:bg-zinc-900"
              >
                Selectează tot
              </button>
              <button
                type="button"
                onClick={selectDefaults}
                className="rounded-md border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-300 hover:bg-zinc-900"
              >
                Implicite
              </button>
              <button
                type="button"
                onClick={selectNone}
                className="rounded-md border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-300 hover:bg-zinc-900"
              >
                Niciunul
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {catalog.groups.map((group) => {
              const fields = catalog.fields.filter((f) => f.group === group.id);
              if (!fields.length) return null;
              const groupAll = fields.every((f) => selected.has(f.id));
              const groupSome = fields.some((f) => selected.has(f.id));
              return (
                <div key={group.id}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-zinc-300">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-950 text-violet-500"
                        checked={groupAll}
                        ref={(el) => {
                          if (el) el.indeterminate = groupSome && !groupAll;
                        }}
                        onChange={(e) => toggleGroup(group.id, e.target.checked)}
                      />
                      {group.label}
                    </label>
                    <span className="text-[10px] text-zinc-600">
                      {fields.filter((f) => selected.has(f.id)).length}/{fields.length}
                    </span>
                  </div>
                  <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                    {fields.map((f) => (
                      <label
                        key={f.id}
                        className="flex cursor-pointer items-start gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-2.5 py-2 text-[12px] text-zinc-300 hover:border-zinc-700"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-zinc-600 bg-zinc-950 text-violet-500"
                          checked={selected.has(f.id)}
                          onChange={() => toggle(f.id)}
                        />
                        <span>
                          {f.label}
                          {f.defaultOn ? (
                            <span className="ml-1 text-[10px] text-zinc-600">· default</span>
                          ) : null}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {allSelected ? (
            <p className="mt-3 text-[11px] text-violet-300/80">Toate câmpurile disponibile sunt bifate.</p>
          ) : null}
        </section>
      ) : (
        <p className="text-sm text-zinc-500">Se încarcă lista de câmpuri…</p>
      )}
    </div>
  );
}
