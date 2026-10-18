"use client";

import { useCallback, useEffect, useState } from "react";
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

function ron(cents: number): string {
  return `${(cents / 100).toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON`;
}

export default function PartnerReportsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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

  function csvHref(): string {
    const q = new URLSearchParams();
    q.set("year", String(year));
    q.set("month", String(month));
    const supplierQ = partnerBrowserSupplierQuery().replace(/^\?/, "");
    if (supplierQ) {
      for (const [k, v] of new URLSearchParams(supplierQ)) q.set(k, v);
    }
    return `/api/partner/reports/monthly.csv?${q.toString()}`;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">Raport lunar</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Volum WO / programări și valoare pe scope-ul furnizorului. Export CSV pe lună.
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
          href={csvHref()}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
        >
          Descarcă CSV
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
    </div>
  );
}
