"use client";

import Link from "next/link";
import { useState } from "react";
import {
  FleetDataTable,
  fleetTableClass,
  fleetTdClass,
  fleetThClass,
  fleetThRightClass,
  fleetTheadClass,
} from "@/components/fleet/fleet-data-table";
import type { ConsumptionPayload } from "@/lib/consumption-types";
import { formatDateTimeRo } from "@/lib/datetime-local";
import { formatRonFromCents } from "@/lib/money";

type Props = {
  data: ConsumptionPayload;
};

type Panel = "trips" | "fills" | "segments";

function WeeklyChart({ weekly }: { weekly: ConsumptionPayload["weekly"] }) {
  if (weekly.length === 0) {
    return <p className="text-sm text-zinc-500">Nu există date săptămânale pentru grafic.</p>;
  }

  const maxKm = Math.max(...weekly.map((b) => b.tripKm), 1);
  const maxL = Math.max(...weekly.map((b) => b.fuelLiters), 1);
  const w = 520;
  const h = 150;
  const pad = 32;
  const slot = (w - pad * 2) / weekly.length;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="min-w-[320px] w-full max-w-2xl text-zinc-400" role="img" aria-label="Km curse vs litri alimentați pe săptămână">
        {weekly.map((b, i) => {
          const x = pad + i * slot;
          const barW = slot / 2.6;
          const kmH = ((h - pad * 2) * b.tripKm) / maxKm;
          const lH = ((h - pad * 2) * b.fuelLiters) / maxL;
          return (
            <g key={b.weekStart}>
              <rect x={x} y={h - pad - kmH} width={barW} height={kmH} rx={2} className="fill-sky-500/70" />
              <rect x={x + barW + 2} y={h - pad - lH} width={barW} height={lH} rx={2} className="fill-amber-500/70" />
              <text x={x + barW} y={h - 8} textAnchor="middle" className="fill-zinc-500 text-[8px]">
                {b.weekLabel}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-sky-500/70" /> Km curse
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-500/70" /> Litri alimentați
        </span>
      </div>
    </div>
  );
}

function ReconciliationChart({ weekly }: { weekly: ConsumptionPayload["weekly"] }) {
  const withOdo = weekly.filter((b) => b.odometerKm != null && b.odometerKm > 0);
  if (withOdo.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Reconciliere km curse vs odometru necesită alimentări cu km înregistrat în perioadă.
      </p>
    );
  }

  const max = Math.max(...withOdo.flatMap((b) => [b.tripKm, b.odometerKm ?? 0]), 1);
  const w = 520;
  const h = 150;
  const pad = 32;
  const slot = (w - pad * 2) / withOdo.length;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="min-w-[320px] w-full max-w-2xl" role="img" aria-label="Reconciliere km curse vs odometru">
        {withOdo.map((b, i) => {
          const x = pad + i * slot;
          const barW = slot / 2.6;
          const tripH = ((h - pad * 2) * b.tripKm) / max;
          const odoH = ((h - pad * 2) * (b.odometerKm ?? 0)) / max;
          return (
            <g key={b.weekStart}>
              <rect x={x} y={h - pad - tripH} width={barW} height={tripH} rx={2} className="fill-sky-500/60" />
              <rect x={x + barW + 2} y={h - pad - odoH} width={barW} height={odoH} rx={2} className="fill-violet-500/60" />
              <text x={x + barW} y={h - 8} textAnchor="middle" className="fill-zinc-500 text-[8px]">
                {b.weekLabel}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-sky-500/60" /> Km curse
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-violet-500/60" /> Δ odometru (alimentări)
        </span>
      </div>
    </div>
  );
}

function FuelMixChart({ fuelMix }: { fuelMix: ConsumptionPayload["fuelMix"] }) {
  if (fuelMix.length === 0) {
    return <p className="text-sm text-zinc-500">Nicio alimentare cu litri în perioadă.</p>;
  }

  const total = fuelMix.reduce((s, r) => s + r.liters, 0);
  const colors = ["fill-amber-500/80", "fill-sky-500/80", "fill-emerald-500/80", "fill-violet-500/80", "fill-rose-500/80"];
  let offset = 0;
  const r = 48;
  const cx = 60;
  const cy = 60;
  const circum = 2 * Math.PI * r;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <svg viewBox="0 0 120 120" className="h-28 w-28 shrink-0" role="img" aria-label="Mix carburant">
        <circle cx={cx} cy={cy} r={r} className="fill-none stroke-zinc-800" strokeWidth={16} />
        {fuelMix.map((row, i) => {
          const pct = row.liters / total;
          const dash = pct * circum;
          const el = (
            <circle
              key={row.label}
              cx={cx}
              cy={cy}
              r={r}
              className={`fill-none ${colors[i % colors.length].replace("fill-", "stroke-")}`}
              strokeWidth={16}
              strokeDasharray={`${dash} ${circum - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <ul className="space-y-1 text-sm">
        {fuelMix.map((row, i) => (
          <li key={row.label} className="flex items-center gap-2 text-zinc-300">
            <span className={`inline-block h-2.5 w-2.5 rounded-sm ${colors[i % colors.length]}`} />
            <span>{row.label}</span>
            <span className="font-mono text-amber-200/90">{row.liters.toLocaleString("ro-RO")} L</span>
            <span className="text-xs text-zinc-500">({Math.round((row.liters / total) * 100)}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TripsConsumptionView({ data }: Props) {
  const [panel, setPanel] = useState<Panel>("trips");
  const { summary } = data;

  const panelBtn = (id: Panel, label: string, count: number) => (
    <button
      type="button"
      onClick={() => setPanel(id)}
      className={`rounded-lg px-3 py-1.5 text-sm ${
        panel === id
          ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
          : "border border-zinc-700 text-zinc-300 hover:bg-zinc-900"
      }`}
    >
      {label} ({count})
    </button>
  );

  return (
    <div className="space-y-8">
      <p className="text-sm text-zinc-400">
        Perioadă {new Date(data.periodStart).toLocaleDateString("ro-RO")} —{" "}
        {new Date(data.periodEnd).toLocaleDateString("ro-RO")}
        {" · "}
        {data.vehicleScope === "all"
          ? "Toată flota"
          : `${data.selectedVehicleCount} vehicule selectate`}
      </p>

      {summary.qualityWarnings.length > 0 ? (
        <ul className="space-y-1 rounded-lg border border-amber-900/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-200/90">
          {summary.qualityWarnings.map((w) => (
            <li key={w}>• {w}</li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Km curse"
          value={`${summary.totalTripKm.toLocaleString("ro-RO")} km`}
          hint={`${summary.tripCount} curse — fără litri alocați`}
          accent="sky"
        />
        <StatCard
          label="Litri alimentați"
          value={`${summary.totalFuelLiters.toLocaleString("ro-RO")} L`}
          hint={`${summary.fillCount} alimentări · ${formatRonFromCents(summary.totalFuelCostCents)} RON`}
          accent="amber"
        />
        <StatCard
          label="Consum mediu (segmente)"
          value={summary.avgSegmentL100 != null ? `${summary.avgSegmentL100} L/100km` : "—"}
          hint={`${summary.segmentCount} segmente fill-to-fill`}
          accent="emerald"
        />
        <StatCard
          label="Reconciliere km"
          value={
            summary.kmReconciliationPct != null ? `${summary.kmReconciliationPct}%` : "—"
          }
          hint="Km curse vs Δ odometru (alimentări)"
          accent="violet"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-4">
          <h3 className="mb-3 text-sm font-medium text-zinc-300">Km curse vs litri / săptămână</h3>
          <WeeklyChart weekly={data.weekly} />
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-4">
          <h3 className="mb-3 text-sm font-medium text-zinc-300">Reconciliere km curse vs odometru</h3>
          <ReconciliationChart weekly={data.weekly} />
        </div>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-4">
        <h3 className="mb-3 text-sm font-medium text-zinc-300">Mix carburant (informativ)</h3>
        <FuelMixChart fuelMix={data.fuelMix} />
      </div>

      <div>
        <div className="mb-3 flex flex-wrap gap-2">
          {panelBtn("trips", "Curse", data.trips.length)}
          {panelBtn("fills", "Alimentări", data.fills.length)}
          {panelBtn("segments", "Segmente consum", data.segments.length)}
        </div>

        {panel === "trips" ? (
          data.trips.length === 0 ? (
            <p className="text-sm text-zinc-500">Nicio cursă în perioada selectată.</p>
          ) : (
            <FleetDataTable>
              <table className={fleetTableClass}>
                <thead className={fleetTheadClass}>
                  <tr>
                    <th className={fleetThClass}>Ref</th>
                    <th className={fleetThClass}>Nr. auto</th>
                    <th className={fleetThClass}>Start</th>
                    <th className={fleetThClass}>Stop</th>
                    <th className={fleetThClass}>Km</th>
                    <th className={fleetThClass}>Odometru</th>
                    <th className={fleetThRightClass}>Detaliu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {data.trips.map((row) => (
                    <tr key={row.id} className="bg-zinc-900/30">
                      <td className={`${fleetTdClass} font-mono`}>{row.reference ?? "—"}</td>
                      <td className={`${fleetTdClass} font-mono`}>{row.registrationNumber}</td>
                      <td className={fleetTdClass}>{formatDateTimeRo(row.startedAt)}</td>
                      <td className={fleetTdClass}>{formatDateTimeRo(row.endedAt)}</td>
                      <td className={`${fleetTdClass} font-mono text-sky-300`}>{row.distanceKm ?? "—"}</td>
                      <td className={`${fleetTdClass} font-mono text-xs text-zinc-500`}>
                        {row.odometerStartKm != null || row.odometerEndKm != null
                          ? `${row.odometerStartKm ?? "—"} → ${row.odometerEndKm ?? "—"}`
                          : "—"}
                      </td>
                      <td className={`${fleetTdClass} text-right`}>
                        <Link href={`/fleet/trips/${row.id}`} className="text-emerald-400 hover:underline">
                          Vezi
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </FleetDataTable>
          )
        ) : null}

        {panel === "fills" ? (
          data.fills.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Nicio alimentare cu litri în perioadă.{" "}
              <Link href="/fleet/costs/new?category=Combustibil" className="text-emerald-400 hover:underline">
                Adaugă cost Combustibil
              </Link>
              .
            </p>
          ) : (
            <FleetDataTable>
              <table className={fleetTableClass}>
                <thead className={fleetTheadClass}>
                  <tr>
                    <th className={fleetThClass}>Data</th>
                    <th className={fleetThClass}>Nr. auto</th>
                    <th className={fleetThClass}>Produs</th>
                    <th className={fleetThClass}>Litri</th>
                    <th className={fleetThClass}>Km</th>
                    <th className={fleetThClass}>Sumă</th>
                    <th className={fleetThRightClass}>Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {data.fills.map((row) => (
                    <tr key={row.id} className="bg-zinc-900/30">
                      <td className={fleetTdClass}>{new Date(row.incurredOn).toLocaleDateString("ro-RO")}</td>
                      <td className={`${fleetTdClass} font-mono`}>{row.registrationNumber}</td>
                      <td className={fleetTdClass}>{row.fuelProductLabel}</td>
                      <td className={`${fleetTdClass} font-mono text-amber-200/90`}>{row.fuelLiters} L</td>
                      <td className={`${fleetTdClass} font-mono text-zinc-400`}>
                        {row.odometerKm != null ? row.odometerKm.toLocaleString("ro-RO") : "—"}
                      </td>
                      <td className={`${fleetTdClass} font-mono`}>{formatRonFromCents(row.amountCents)} RON</td>
                      <td className={`${fleetTdClass} text-right`}>
                        <Link href={`/fleet/costs/${row.id}/edit`} className="text-emerald-400 hover:underline">
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </FleetDataTable>
          )
        ) : null}

        {panel === "segments" ? (
          data.segments.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Segmente L/100km necesită alimentări consecutive cu km odometru pe același vehicul.
            </p>
          ) : (
            <FleetDataTable>
              <table className={fleetTableClass}>
                <thead className={fleetTheadClass}>
                  <tr>
                    <th className={fleetThClass}>Nr. auto</th>
                    <th className={fleetThClass}>Perioadă</th>
                    <th className={fleetThClass}>Produs</th>
                    <th className={fleetThClass}>Litri</th>
                    <th className={fleetThClass}>Km</th>
                    <th className={fleetThClass}>L/100km</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {data.segments.map((row) => (
                    <tr key={`${row.fillId}-${row.periodEnd}`} className="bg-zinc-900/30">
                      <td className={`${fleetTdClass} font-mono`}>{row.registrationNumber}</td>
                      <td className={`${fleetTdClass} text-xs text-zinc-400`}>
                        {new Date(row.periodStart).toLocaleDateString("ro-RO")} →{" "}
                        {new Date(row.periodEnd).toLocaleDateString("ro-RO")}
                      </td>
                      <td className={fleetTdClass}>{row.fuelProductLabel}</td>
                      <td className={`${fleetTdClass} font-mono text-amber-200/90`}>{row.fillLiters} L</td>
                      <td className={`${fleetTdClass} font-mono`}>{row.kmDelta.toLocaleString("ro-RO")}</td>
                      <td className={`${fleetTdClass} font-mono text-emerald-300`}>{row.l100}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </FleetDataTable>
          )
        ) : null}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent: "amber" | "sky" | "emerald" | "violet";
}) {
  const border = {
    amber: "border-amber-900/40 bg-amber-950/20",
    sky: "border-sky-900/40 bg-sky-950/20",
    emerald: "border-emerald-900/40 bg-emerald-950/20",
    violet: "border-violet-900/40 bg-violet-950/20",
  }[accent];
  return (
    <div className={`rounded-lg border p-4 ${border}`}>
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-100">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{hint}</p>
    </div>
  );
}
