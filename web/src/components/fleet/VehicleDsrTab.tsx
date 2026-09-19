"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatDateRo } from "@/lib/datetime-local";
import { maintenanceBrowserBase } from "@/lib/fleet-api";
import type { VehicleRecord } from "@/lib/fleet-api";
import {
  countActiveEquipment,
  dsrCsv,
  maintenanceToDsrEntries,
  sortDsrJournal,
  workOrdersToDsrEntries,
  type DsrJournalEntry,
} from "@/lib/vehicle-dsr";
import type { MaintenanceListPayload } from "@/lib/vehicle-detail-server";
import {
  vehicleEquipmentKindLabel,
  type VehicleEquipmentPayload,
} from "@/lib/vehicle-equipment-types";
import { formatMoneyCents, workOrdersBrowserBase, workOrderStatusLabel, type WorkOrderListRow } from "@/lib/work-orders-api";
import { maintenanceCostAllocationLabel } from "@/lib/maintenance-cost-allocation";

type Props = {
  vehicle: VehicleRecord;
  maintenance: MaintenanceListPayload | null;
  equipment: VehicleEquipmentPayload;
  printHref: string;
};

export function VehicleDsrTab({ vehicle, maintenance, equipment, printHref }: Props) {
  const [repairs, setRepairs] = useState<WorkOrderListRow[] | null>(null);
  const [moreMaintenance, setMoreMaintenance] = useState<MaintenanceListPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [woRes, mntRes] = await Promise.all([
          fetch(`${workOrdersBrowserBase}?vehicleId=${encodeURIComponent(vehicle.id)}&pageSize=200`),
          fetch(
            `${maintenanceBrowserBase}?registrationNumber=${encodeURIComponent(vehicle.registrationNumber)}&page=1&pageSize=200`,
          ),
        ]);
        if (cancelled) return;
        if (woRes.ok) {
          const j = (await woRes.json()) as { items?: WorkOrderListRow[] };
          setRepairs(j.items ?? []);
        } else {
          setRepairs([]);
        }
        if (mntRes.ok) {
          setMoreMaintenance((await mntRes.json()) as MaintenanceListPayload);
        }
      } catch {
        if (!cancelled) {
          setError("Nu am putut încărca tot istoricul DSR.");
          setRepairs([]);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [vehicle.id, vehicle.registrationNumber]);

  const journal = useMemo(() => {
    const mnt = moreMaintenance?.items ?? maintenance?.items ?? [];
    return sortDsrJournal([
      ...maintenanceToDsrEntries(mnt),
      ...workOrdersToDsrEntries(repairs ?? []),
    ]);
  }, [maintenance, moreMaintenance, repairs]);

  const maintenanceCount = journal.filter((e) => e.kind === "maintenance").length;
  const repairCount = journal.filter((e) => e.kind === "repair").length;
  const activeEq = countActiveEquipment(equipment.items);

  function downloadCsv() {
    const blob = new Blob([dsrCsv(journal)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DSR-${vehicle.registrationNumber.replaceAll(" ", "")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Carte service (DSR)</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Jurnal mentenanțe și reparații pentru {vehicle.registrationNumber}
            {vehicle.brand || vehicle.model ? ` · ${[vehicle.brand, vehicle.model].filter(Boolean).join(" ")}` : ""}
            {vehicle.vin ? ` · VIN ${vehicle.vin}` : ""}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Link
            href={printHref}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Deschide / printează
          </Link>
          <button
            type="button"
            onClick={downloadCsv}
            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600"
          >
            Descarcă CSV
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Mentenanțe" value={String(maintenanceCount)} />
        <Kpi label="Reparații (WO)" value={repairs == null ? "…" : String(repairCount)} />
        <Kpi label="Echipări active" value={String(activeEq)} />
      </div>

      {error ? <p className="text-sm text-amber-300">{error}</p> : null}

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Jurnal</h3>
        {journal.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            {repairs == null ? "Se încarcă istoricul…" : "Nicio lucrare înregistrată încă."}
          </p>
        ) : (
          <ol className="mt-3 divide-y divide-zinc-800/80 rounded-lg border border-zinc-800">
            {journal.map((entry) => (
              <DsrRow key={entry.id} entry={entry} />
            ))}
          </ol>
        )}
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Echipări</h3>
        {equipment.items.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Nicio echipare pe vehicul.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-800/80 rounded-lg border border-zinc-800">
            {equipment.items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-sm">
                <span className="text-zinc-100">
                  {item.label}
                  <span className="ml-2 text-zinc-500">{vehicleEquipmentKindLabel(item.kind)}</span>
                </span>
                <span className="text-xs text-zinc-500">
                  {item.isActive ? "Activă" : "Demontată"}
                  {item.serialNumber ? ` · ${item.serialNumber}` : ""}
                  {item.mountedOn ? ` · montat ${formatDateRo(item.mountedOn)}` : ""}
                  {item.removedOn ? ` · scos ${formatDateRo(item.removedOn)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-100">{value}</p>
    </div>
  );
}

function DsrRow({ entry }: { entry: DsrJournalEntry }) {
  const kindLabel = entry.kind === "maintenance" ? "Mentenanță" : "Reparație";
  const status =
    entry.kind === "repair"
      ? workOrderStatusLabel(entry.status ?? "")
      : maintenanceCostAllocationLabel(entry.status);
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2.5 text-sm">
      <div>
        <Link href={entry.href} className="font-medium text-zinc-100 hover:text-emerald-300">
          {entry.title}
        </Link>
        <p className="text-[11px] text-zinc-500">
          {kindLabel}
          {entry.provider ? ` · ${entry.provider}` : ""}
          {status && status !== "—" ? ` · ${status}` : ""}
        </p>
      </div>
      <div className="text-right text-xs text-zinc-500">
        <p>{formatDateRo(entry.at)}</p>
        <p>
          {entry.odometerKm != null ? `${entry.odometerKm.toLocaleString("ro-RO")} km` : ""}
          {entry.odometerKm != null && entry.amountCents != null ? " · " : ""}
          {entry.amountCents != null ? formatMoneyCents(entry.amountCents) : ""}
        </p>
      </div>
    </li>
  );
}
