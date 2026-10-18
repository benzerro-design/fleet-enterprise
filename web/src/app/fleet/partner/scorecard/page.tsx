"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { partnerBrowserSupplierQuery } from "@/lib/partner-pending-actions-api";

type Scorecard = {
  from: string;
  to: string;
  sample: {
    appointmentsValidated: number;
    workOrdersWithTurnaround: number;
    quotesInvoiced: number;
  };
  responseTimeHours: {
    median: number | null;
    p90: number | null;
    within24hPercent: number | null;
    within48hPercent: number | null;
  };
  turnaroundHours: {
    median: number | null;
    p90: number | null;
  };
  priceDeviationPercent: {
    medianVsQuote: number | null;
    invoiceMismatchCount: number;
  };
};

function fmtHours(v: number | null): string {
  if (v == null) return "—";
  if (v < 48) return `${v.toFixed(1)} h`;
  return `${(v / 24).toFixed(1)} zile`;
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-zinc-100">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-zinc-600">{hint}</p> : null}
    </div>
  );
}

export default function PartnerScorecardPage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<Scorecard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(true);

  const load = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      const q = partnerBrowserSupplierQuery();
      const res = await fetch(`/api/partner/scorecard${q}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as Scorecard);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Încărcare eșuată");
      setData(null);
    } finally {
      setPending(false);
    }
  }, [searchParams]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">Scorecard KPI</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Ultimele ~3 luni · timp răspuns (validare programare), turnaround (IN→gata), deviație
          factură vs. deviz aprobat.
        </p>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {pending && !data ? <p className="text-sm text-zinc-500">Se încarcă…</p> : null}

      {data ? (
        <>
          <p className="text-[11px] text-zinc-600">
            Interval {new Date(data.from).toLocaleDateString("ro-RO")} –{" "}
            {new Date(data.to).toLocaleDateString("ro-RO")} · eșantion:{" "}
            {data.sample.appointmentsValidated} programări, {data.sample.workOrdersWithTurnaround}{" "}
            WO, {data.sample.quotesInvoiced} facturi
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Kpi
              label="Răspuns median"
              value={fmtHours(data.responseTimeHours.median)}
              hint={`p90 ${fmtHours(data.responseTimeHours.p90)} · ≤24h ${data.responseTimeHours.within24hPercent ?? "—"}%`}
            />
            <Kpi
              label="Turnaround median"
              value={fmtHours(data.turnaroundHours.median)}
              hint={`p90 ${fmtHours(data.turnaroundHours.p90)}`}
            />
            <Kpi
              label="Deviație preț mediană"
              value={
                data.priceDeviationPercent.medianVsQuote == null
                  ? "—"
                  : `${data.priceDeviationPercent.medianVsQuote.toFixed(1)}%`
              }
              hint={`${data.priceDeviationPercent.invoiceMismatchCount} mismatch factură`}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
