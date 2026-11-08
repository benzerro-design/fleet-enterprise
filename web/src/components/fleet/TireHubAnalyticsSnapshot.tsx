"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  tireHubLocationLabel,
  type TireHubInventorySet,
  type TireHubPayload,
} from "@/lib/tire-hub-api";

type Props = {
  hub: TireHubPayload;
};

function formatRon(cents: number): string {
  return `${(cents / 100).toLocaleString("ro-RO", { minimumFractionDigits: 0 })} lei`;
}

export function TireHubAnalyticsSnapshot({ hub }: Props) {
  const inventory = hub.inventorySets ?? [];

  const stats = useMemo(() => {
    const byLocation: Record<string, number> = {
      on_vehicle: 0,
      at_supplier_hotel: 0,
      at_client: 0,
      other: 0,
    };
    let feeAccruedOpenCents = 0;
    let treadSum = 0;
    let treadCount = 0;
    const hotelByVehicle = new Map<
      string,
      { plate: string; vehicleId: string; stays: number; feeCents: number; minTread: number | null }
    >();
    const wearRows: Array<{ plate: string; vehicleId: string; setId: string; tread: number }> = [];

    for (const row of inventory) {
      byLocation[row.location] = (byLocation[row.location] ?? 0) + 1;
      if (row.atHotel && row.feeCents != null && row.feeCents > 0) {
        feeAccruedOpenCents += row.feeCents;
      }
      if (row.minTreadMm != null && Number.isFinite(row.minTreadMm)) {
        treadSum += row.minTreadMm;
        treadCount += 1;
        wearRows.push({
          plate: row.plate,
          vehicleId: row.vehicleId,
          setId: row.setId,
          tread: row.minTreadMm,
        });
      }
      if (row.atHotel) {
        const cur = hotelByVehicle.get(row.vehicleId) ?? {
          plate: row.plate,
          vehicleId: row.vehicleId,
          stays: 0,
          feeCents: 0,
          minTread: null as number | null,
        };
        cur.stays += 1;
        cur.feeCents += row.feeCents ?? 0;
        if (row.minTreadMm != null) {
          cur.minTread =
            cur.minTread == null ? row.minTreadMm : Math.min(cur.minTread, row.minTreadMm);
        }
        hotelByVehicle.set(row.vehicleId, cur);
      }
    }

    const topHotel = [...hotelByVehicle.values()]
      .sort((a, b) => b.stays - a.stays || b.feeCents - a.feeCents)
      .slice(0, 5);
    const topWear = wearRows.sort((a, b) => a.tread - b.tread).slice(0, 5);
    const avgTread = treadCount > 0 ? treadSum / treadCount : null;

    return { byLocation, feeAccruedOpenCents, avgTread, topHotel, topWear };
  }, [inventory]);

  return (
    <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
      <div>
        <h2 className="text-lg font-medium text-zinc-100">Raport anvelope</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Snapshot operațional din hub (inventar curent). Analytics complet urmează în modulul de
          reporting.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Montate" value={String(stats.byLocation.on_vehicle ?? hub.summary.setsMounted)} />
        <Kpi label="La hotel" value={String(stats.byLocation.at_supplier_hotel ?? hub.summary.setsAtHotel)} />
        <Kpi
          label="Taxă hotel (sejururi deschise)"
          value={stats.feeAccruedOpenCents > 0 ? formatRon(stats.feeAccruedOpenCents) : "—"}
        />
        <Kpi
          label="Uzură medie (min pe set)"
          value={
            stats.avgTread != null ? `${stats.avgTread.toFixed(1)} mm` : "—"
          }
        />
      </div>

      <div className="grid gap-3 text-xs text-zinc-400 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            "on_vehicle",
            "at_supplier_hotel",
            "at_client",
            "other",
          ] as TireHubInventorySet["location"][]
        ).map((loc) => (
          <p key={loc}>
            <span className="text-zinc-500">{tireHubLocationLabel(loc)}:</span>{" "}
            <span className="tabular-nums text-zinc-200">{stats.byLocation[loc] ?? 0}</span>
          </p>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium text-zinc-200">Top vehicule la hotel</h3>
          {stats.topHotel.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">Niciun set la hotel în scope.</p>
          ) : (
            <table className="mt-2 min-w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="py-1 pr-2 font-medium">Nr.</th>
                  <th className="py-1 pr-2 font-medium">Seturi</th>
                  <th className="py-1 font-medium">Taxă</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {stats.topHotel.map((r) => (
                  <tr key={r.vehicleId}>
                    <td className="py-1.5 pr-2">
                      <Link
                        href={`/fleet/vehicles/${r.vehicleId}?tab=wheels`}
                        className="text-sky-400 hover:underline"
                      >
                        {r.plate}
                      </Link>
                    </td>
                    <td className="py-1.5 pr-2 tabular-nums text-zinc-300">{r.stays}</td>
                    <td className="py-1.5 tabular-nums text-zinc-300">
                      {r.feeCents > 0 ? formatRon(r.feeCents) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div>
          <h3 className="text-sm font-medium text-zinc-200">Top uzură (cea mai mică)</h3>
          {stats.topWear.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">Fără măsurători tread în inventar.</p>
          ) : (
            <table className="mt-2 min-w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="py-1 pr-2 font-medium">Nr.</th>
                  <th className="py-1 font-medium">Min tread</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {stats.topWear.map((r) => (
                  <tr key={r.setId}>
                    <td className="py-1.5 pr-2">
                      <Link
                        href={`/fleet/vehicles/${r.vehicleId}?tab=wheels&setId=${encodeURIComponent(r.setId)}`}
                        className="text-sky-400 hover:underline"
                      >
                        {r.plate}
                      </Link>
                    </td>
                    <td className="py-1.5 tabular-nums text-zinc-300">{r.tread.toFixed(1)} mm</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-100">{value}</p>
    </div>
  );
}
