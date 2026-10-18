"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { partnerBrowserSupplierQuery } from "@/lib/partner-pending-actions-api";

type DistStats = {
  count: number;
  median: number | null;
  mean: number | null;
  p90: number | null;
  min: number | null;
  max: number | null;
  within24hPercent: number | null;
  within48hPercent: number | null;
};

type Scorecard = {
  from: string;
  to: string;
  definitions: {
    response: string;
    quoteResponse: string;
    turnaround: string;
    priceDeviation: string;
  };
  volume: {
    appointmentsValidated: number;
    appointmentsPendingSupplier: number;
    workOrdersReadyInPeriod: number;
    workOrdersOpen: number;
    quotesSubmittedInPeriod: number;
    quotesInvoicedInPeriod: number;
  };
  responseTimeHours: DistStats;
  quoteResponseTimeHours: DistStats;
  turnaroundHours: DistStats;
  priceDeviationPercent: DistStats & {
    invoiceMismatchCount: number;
    invoiceMismatchPercent: number | null;
    meanAbsPercent: number | null;
    overQuoteCount: number;
    underQuoteCount: number;
    totalInvoicedCents: number;
    totalQuotedCents: number;
  };
  monthly: Array<{
    month: string;
    responseMedianHours: number | null;
    turnaroundMedianHours: number | null;
    priceDeviationMedianPercent: number | null;
    appointmentsValidated: number;
    workOrdersReady: number;
    quotesInvoiced: number;
  }>;
  slowestResponses: Array<{
    appointmentId: string;
    hours: number;
    createdAt: string;
    validatedAt: string;
    vehiclePlate: string | null;
  }>;
  slowestTurnarounds: Array<{
    workOrderId: string;
    displayNumber: string | null;
    title: string;
    hours: number;
    inServiceAt: string;
    readyAt: string;
    vehiclePlate: string | null;
  }>;
  largestPriceDeviations: Array<{
    quoteId: string;
    workOrderId: string;
    displayNumber: string | null;
    deviationPercent: number;
    quotedGrossCents: number;
    invoiceGrossCents: number;
    invoiceMismatch: boolean;
    invoicedAt: string;
    vehiclePlate: string | null;
  }>;
};

type Preset = "30d" | "90d" | "6m" | "12m";

function presetRange(preset: Preset): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  if (preset === "30d") from.setDate(from.getDate() - 30);
  else if (preset === "90d") from.setDate(from.getDate() - 90);
  else if (preset === "6m") from.setMonth(from.getMonth() - 6);
  else from.setMonth(from.getMonth() - 12);
  return { from: from.toISOString(), to: to.toISOString() };
}

function fmtHours(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v < 48) return `${v.toFixed(1)} h`;
  return `${(v / 24).toFixed(1)} zile`;
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

function fmtRon(cents: number): string {
  return `${(cents / 100).toLocaleString("ro-RO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} RON`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ro-RO");
}

function StatGrid({
  stats,
  unit,
  showSla,
}: {
  stats: DistStats;
  unit: "h" | "%";
  showSla?: boolean;
}) {
  const fmt = unit === "h" ? fmtHours : fmtPct;
  return (
    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
      <div>
        <dt className="text-zinc-600">Mediană</dt>
        <dd className="font-medium text-zinc-100">{fmt(stats.median)}</dd>
      </div>
      <div>
        <dt className="text-zinc-600">Medie</dt>
        <dd className="font-medium text-zinc-200">{fmt(stats.mean)}</dd>
      </div>
      <div>
        <dt className="text-zinc-600">p90</dt>
        <dd className="font-medium text-zinc-200">{fmt(stats.p90)}</dd>
      </div>
      <div>
        <dt className="text-zinc-600">Min / max</dt>
        <dd className="font-medium text-zinc-300">
          {fmt(stats.min)} / {fmt(stats.max)}
        </dd>
      </div>
      <div>
        <dt className="text-zinc-600">Eșantion</dt>
        <dd className="font-medium text-zinc-300">{stats.count}</dd>
      </div>
      {showSla ? (
        <div>
          <dt className="text-zinc-600">≤24h / ≤48h</dt>
          <dd className="font-medium text-zinc-300">
            {stats.within24hPercent ?? "—"}% / {stats.within48hPercent ?? "—"}%
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

function MonthBars({
  monthly,
  field,
}: {
  monthly: Scorecard["monthly"];
  field: "responseMedianHours" | "turnaroundMedianHours" | "priceDeviationMedianPercent";
}) {
  const values = monthly.map((m) => m[field]).filter((v): v is number => v != null);
  const max = values.length ? Math.max(...values.map((v) => Math.abs(v)), 0.01) : 1;
  return (
    <div className="mt-3 space-y-1.5">
      {monthly.map((m) => {
        const v = m[field];
        const width = v == null ? 0 : Math.min(100, (Math.abs(v) / max) * 100);
        const label =
          field === "priceDeviationMedianPercent" ? fmtPct(v) : fmtHours(v);
        return (
          <div key={m.month} className="flex items-center gap-2 text-[11px]">
            <span className="w-14 shrink-0 font-mono text-zinc-500">{m.month}</span>
            <div className="h-2 flex-1 overflow-hidden rounded bg-zinc-900">
              <div
                className={`h-full rounded ${
                  field === "priceDeviationMedianPercent" && v != null && v > 0
                    ? "bg-amber-500/70"
                    : "bg-violet-500/70"
                }`}
                style={{ width: `${width}%` }}
              />
            </div>
            <span className="w-16 shrink-0 text-right text-zinc-400">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function Section({
  title,
  definition,
  children,
}: {
  title: string;
  definition: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
      <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
      <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{definition}</p>
      {children}
    </section>
  );
}

export default function PartnerScorecardPage() {
  const searchParams = useSearchParams();
  const [preset, setPreset] = useState<Preset>("90d");
  const [data, setData] = useState<Scorecard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(true);

  const range = useMemo(() => presetRange(preset), [preset]);

  const load = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      q.set("from", range.from);
      q.set("to", range.to);
      const supplierQ = partnerBrowserSupplierQuery().replace(/^\?/, "");
      if (supplierQ) {
        for (const [k, v] of new URLSearchParams(supplierQ)) q.set(k, v);
      }
      const res = await fetch(`/api/partner/scorecard?${q.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as Scorecard);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Încărcare eșuată");
      setData(null);
    } finally {
      setPending(false);
    }
  }, [range.from, range.to, searchParams]);

  useEffect(() => {
    void load();
  }, [load]);

  const woBase = "/fleet/partner/work-orders";

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Scorecard KPI</h1>
          <p className="mt-1 text-xs text-zinc-500">
            Performanță atelier pe răspuns, ciclu reparație și aliniere preț factură ↔ deviz.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["30d", "30 zile"],
              ["90d", "90 zile"],
              ["6m", "6 luni"],
              ["12m", "12 luni"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPreset(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                preset === key
                  ? "bg-violet-600 text-white"
                  : "border border-zinc-700 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {pending && !data ? <p className="text-sm text-zinc-500">Se încarcă…</p> : null}

      {data ? (
        <>
          <p className="text-[11px] text-zinc-600">
            {fmtDate(data.from)} – {fmtDate(data.to)}
            {pending ? " · actualizare…" : null}
          </p>

          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["Programări validate", data.volume.appointmentsValidated],
              ["Așteaptă validare", data.volume.appointmentsPendingSupplier],
              ["WO gata (interval)", data.volume.workOrdersReadyInPeriod],
              ["WO deschise acum", data.volume.workOrdersOpen],
              ["Devize trimise", data.volume.quotesSubmittedInPeriod],
              ["Facturi în interval", data.volume.quotesInvoicedInPeriod],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2"
              >
                <p className="text-[10px] uppercase tracking-wide text-zinc-600">{label}</p>
                <p className="mt-0.5 text-lg font-semibold text-zinc-100">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="1. Răspuns programare" definition={data.definitions.response}>
              <StatGrid stats={data.responseTimeHours} unit="h" showSla />
              <MonthBars monthly={data.monthly} field="responseMedianHours" />
            </Section>

            <Section
              title="2. Răspuns pe deviz"
              definition={data.definitions.quoteResponse}
            >
              <StatGrid stats={data.quoteResponseTimeHours} unit="h" showSla />
            </Section>

            <Section title="3. Turnaround reparație" definition={data.definitions.turnaround}>
              <StatGrid stats={data.turnaroundHours} unit="h" />
              <MonthBars monthly={data.monthly} field="turnaroundMedianHours" />
            </Section>

            <Section title="4. Deviație preț" definition={data.definitions.priceDeviation}>
              <StatGrid stats={data.priceDeviationPercent} unit="%" />
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-zinc-600">|deviație| medie</dt>
                  <dd className="font-medium text-zinc-200">
                    {fmtPct(data.priceDeviationPercent.meanAbsPercent)}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-600">Mismatch factură</dt>
                  <dd className="font-medium text-zinc-200">
                    {data.priceDeviationPercent.invoiceMismatchCount}
                    {data.priceDeviationPercent.invoiceMismatchPercent != null
                      ? ` (${data.priceDeviationPercent.invoiceMismatchPercent}%)`
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-600">Peste / sub ofertă</dt>
                  <dd className="font-medium text-zinc-200">
                    {data.priceDeviationPercent.overQuoteCount} /{" "}
                    {data.priceDeviationPercent.underQuoteCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-600">Sumă facturat vs. ofertă</dt>
                  <dd className="font-medium text-zinc-200">
                    {fmtRon(data.priceDeviationPercent.totalInvoicedCents)} /{" "}
                    {fmtRon(data.priceDeviationPercent.totalQuotedCents)}
                  </dd>
                </div>
              </dl>
              <MonthBars monthly={data.monthly} field="priceDeviationMedianPercent" />
            </Section>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="rounded-xl border border-zinc-800 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Cele mai lente validări
              </h3>
              {data.slowestResponses.length ? (
                <ul className="mt-3 space-y-2 text-xs">
                  {data.slowestResponses.map((r) => (
                    <li
                      key={r.appointmentId}
                      className="flex justify-between gap-2 border-b border-zinc-900 pb-2"
                    >
                      <span className="min-w-0 truncate text-zinc-300">
                        {r.vehiclePlate ?? "—"} · {fmtDate(r.createdAt)}
                      </span>
                      <span className="shrink-0 font-mono text-amber-300/90">
                        {fmtHours(r.hours)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-zinc-600">Nicio validare în interval.</p>
              )}
            </section>

            <section className="rounded-xl border border-zinc-800 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Cele mai lungi reparații
              </h3>
              {data.slowestTurnarounds.length ? (
                <ul className="mt-3 space-y-2 text-xs">
                  {data.slowestTurnarounds.map((r) => (
                    <li
                      key={r.workOrderId}
                      className="flex justify-between gap-2 border-b border-zinc-900 pb-2"
                    >
                      <Link
                        href={`${woBase}/${r.workOrderId}`}
                        className="min-w-0 truncate text-violet-300 hover:underline"
                      >
                        {r.displayNumber ?? r.title} · {r.vehiclePlate ?? "—"}
                      </Link>
                      <span className="shrink-0 font-mono text-amber-300/90">
                        {fmtHours(r.hours)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-zinc-600">Niciun WO gata în interval.</p>
              )}
            </section>

            <section className="rounded-xl border border-zinc-800 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Cele mai mari abateri preț
              </h3>
              {data.largestPriceDeviations.length ? (
                <ul className="mt-3 space-y-2 text-xs">
                  {data.largestPriceDeviations.map((r) => (
                    <li
                      key={r.quoteId}
                      className="flex justify-between gap-2 border-b border-zinc-900 pb-2"
                    >
                      <Link
                        href={`${woBase}/${r.workOrderId}`}
                        className="min-w-0 truncate text-violet-300 hover:underline"
                      >
                        {r.displayNumber ?? r.workOrderId.slice(0, 8)} ·{" "}
                        {r.vehiclePlate ?? "—"}
                        {r.invoiceMismatch ? " · mismatch" : ""}
                      </Link>
                      <span
                        className={`shrink-0 font-mono ${
                          r.deviationPercent > 0 ? "text-amber-300" : "text-emerald-300/90"
                        }`}
                      >
                        {fmtPct(r.deviationPercent)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-zinc-600">Nicio factură în interval.</p>
              )}
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
