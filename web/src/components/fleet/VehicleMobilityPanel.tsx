"use client";

import Link from "next/link";
import {
  FleetDataTable,
  fleetTableClass,
  fleetTdClass,
  fleetThClass,
  fleetTheadClass,
} from "@/components/fleet/fleet-data-table";
import type { VehicleMobilityPayload } from "@/lib/vehicle-mobility-types";

type Props = {
  data: VehicleMobilityPayload;
  vehicleId: string;
  regQs: string;
};

function formatMonth(key: string): string {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("ro-RO", { month: "short", year: "2-digit" });
}

function MobilityChart({ monthly }: { monthly: VehicleMobilityPayload["monthly"] }) {
  if (monthly.length === 0) {
    return <p className="text-sm text-zinc-500">Nu există date lunare pentru grafic.</p>;
  }

  const maxKm = Math.max(...monthly.map((b) => b.tripKm), 1);
  const maxL = Math.max(...monthly.map((b) => b.fuelLiters), 1);
  const w = 480;
  const h = 140;
  const pad = 28;
  const barW = (w - pad * 2) / monthly.length / 2.4;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="min-w-[320px] w-full max-w-xl text-zinc-400" role="img" aria-label="Grafic km curse vs litri combustibil">
        {monthly.map((b, i) => {
          const x = pad + i * ((w - pad * 2) / monthly.length);
          const kmH = ((h - pad * 2) * b.tripKm) / maxKm;
          const lH = ((h - pad * 2) * b.fuelLiters) / maxL;
          return (
            <g key={b.month}>
              <rect
                x={x}
                y={h - pad - kmH}
                width={barW}
                height={kmH}
                rx={2}
                className="fill-sky-500/70"
              />
              <rect
                x={x + barW + 2}
                y={h - pad - lH}
                width={barW}
                height={lH}
                rx={2}
                className="fill-amber-500/70"
              />
              <text x={x + barW} y={h - 6} textAnchor="middle" className="fill-zinc-500 text-[9px]">
                {formatMonth(b.month)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-sky-500/70" /> Km curse (Trips)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-500/70" /> Litri alimentați
        </span>
      </div>
    </div>
  );
}

export function VehicleMobilityPanel({ data, vehicleId, regQs }: Props) {
  const { summary } = data;

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Consum mediu"
          value={summary.avgConsumptionL100 != null ? `${summary.avgConsumptionL100} L/100km` : "—"}
          hint="Între alimentări consecutive cu km înregistrat"
          accent="amber"
        />
        <StatCard
          label="Km curse (Trips)"
          value={`${summary.totalTripKm.toLocaleString("ro-RO")} km`}
          hint="Sumă distanțe din modulul Curse"
          accent="sky"
        />
        <StatCard
          label="Combustibil înregistrat"
          value={`${summary.totalFuelLiters.toLocaleString("ro-RO")} L`}
          hint={`${summary.fillCount} alimentări cu litri`}
          accent="emerald"
        />
        <StatCard
          label="Span odometru"
          value={
            summary.odometerSpanKm != null
              ? `${summary.odometerSpanKm.toLocaleString("ro-RO")} km`
              : "—"
          }
          hint={`Km curent: ${data.vehicleOdometerKm.toLocaleString("ro-RO")}`}
          accent="violet"
        />
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-4">
        <p className="text-sm font-medium text-zinc-200">Integrare tracking (în curând)</p>
        <p className="mt-1 text-xs text-zinc-500">
          Km din tracking vor putea fi comparați cu litrii alimentați și cu km din Trips pentru reconciliere
          automată a consumului.
        </p>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium text-zinc-300">Evoluție lunară</h3>
        <MobilityChart monthly={data.monthly} />
      </div>

      {data.segments.length > 0 ? (
        <div>
          <h3 className="mb-3 text-sm font-medium text-zinc-300">Segmente consum (între alimentări)</h3>
          <FleetDataTable>
            <table className={fleetTableClass}>
              <thead className={fleetTheadClass}>
                <tr>
                  <th className={fleetThClass}>Perioadă</th>
                  <th className={fleetThClass}>Km</th>
                  <th className={fleetThClass}>Litri</th>
                  <th className={fleetThClass}>L/100km</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {data.segments.map((s, i) => (
                  <tr key={i}>
                    <td className={`${fleetTdClass} text-xs text-zinc-400`}>
                      {new Date(s.fromDate).toLocaleDateString("ro-RO")} →{" "}
                      {new Date(s.toDate).toLocaleDateString("ro-RO")}
                    </td>
                    <td className={`${fleetTdClass} font-mono text-zinc-200`}>{s.km.toLocaleString("ro-RO")}</td>
                    <td className={`${fleetTdClass} font-mono text-amber-200/90`}>{s.liters} L</td>
                    <td className={`${fleetTdClass} font-mono text-emerald-300`}>{s.l100}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </FleetDataTable>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-zinc-300">Alimentări combustibil</h3>
            <Link href={`/fleet/costs?${regQs}&category=Combustibil`} className="text-xs text-emerald-400 hover:underline">
              Toate costurile →
            </Link>
          </div>
          {data.fuelEvents.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Nicio alimentare cu litri înregistrați. Adaugă un cost{" "}
              <Link href={`/fleet/costs/new?vehicleId=${vehicleId}`} className="text-emerald-400 hover:underline">
                Combustibil
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
              {data.fuelEvents.slice(0, 8).map((f) => (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                  <span className="text-zinc-300">{new Date(f.incurredOn).toLocaleDateString("ro-RO")}</span>
                  <span className="font-mono text-amber-200/90">{f.fuelLiters} L</span>
                  <span className="text-xs text-zinc-500">
                    {f.odometerKm != null ? `${f.odometerKm.toLocaleString("ro-RO")} km` : "fără km"}
                    {f.provider ? ` · ${f.provider}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-zinc-300">Curse recente</h3>
            <Link href={`/fleet/trips?${regQs}`} className="text-xs text-sky-400 hover:underline">
              Toate cursele →
            </Link>
          </div>
          {data.trips.length === 0 ? (
            <p className="text-sm text-zinc-500">Nicio cursă înregistrată pentru acest vehicul.</p>
          ) : (
            <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
              {data.trips.slice(0, 8).map((t) => (
                <li key={t.id} className="px-3 py-2.5 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-zinc-300">{new Date(t.startedAt).toLocaleDateString("ro-RO")}</span>
                    <span className="font-mono text-sky-300">
                      {t.distanceKm != null ? `${t.distanceKm.toLocaleString("ro-RO")} km` : "—"}
                    </span>
                  </div>
                  {(t.originLabel || t.destLabel) && (
                    <p className="mt-0.5 truncate text-xs text-zinc-500">
                      {[t.originLabel, t.destLabel].filter(Boolean).join(" → ")}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
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
