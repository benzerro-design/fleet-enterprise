import type { MaintenanceListPayload } from "@/lib/vehicle-detail-server";
import type { VehicleEquipmentRecord } from "@/lib/vehicle-equipment-types";
import type { WorkOrderListRow } from "@/lib/work-orders-api";

export type DsrEntryKind = "maintenance" | "repair";

export type DsrJournalEntry = {
  id: string;
  kind: DsrEntryKind;
  at: string | null;
  sortAt: number;
  title: string;
  provider: string | null;
  odometerKm: number | null;
  amountCents: number | null;
  status: string | null;
  href: string;
};

export function maintenanceToDsrEntries(
  items: MaintenanceListPayload["items"],
): DsrJournalEntry[] {
  return items.map((row) => ({
    id: `mnt-${row.id}`,
    kind: "maintenance" as const,
    at: row.performedAt ?? row.invoiceDate,
    sortAt: Date.parse(row.performedAt ?? row.invoiceDate ?? "") || 0,
    title: row.title,
    provider: row.provider,
    odometerKm: row.odometerKm,
    amountCents: row.costCents,
    status: row.costAllocationCode,
    href: `/fleet/maintenance/${row.id}`,
  }));
}

export function workOrdersToDsrEntries(items: WorkOrderListRow[]): DsrJournalEntry[] {
  return items
    .filter((row) => row.status !== "cancelled")
    .map((row) => ({
      id: `wo-${row.id}`,
      kind: "repair" as const,
      at: row.completedAt ?? row.plannedAt ?? row.createdAt,
      sortAt: Date.parse(row.completedAt ?? row.plannedAt ?? row.createdAt) || 0,
      title: row.displayNumber ? `${row.displayNumber} · ${row.title}` : row.title,
      provider: row.supplierLegalName,
      odometerKm: null,
      amountCents: row.quoteSummary?.totalGrossCents ?? null,
      status: row.status,
      href: `/fleet/work-orders/${row.id}`,
    }));
}

export function sortDsrJournal(entries: DsrJournalEntry[]): DsrJournalEntry[] {
  return [...entries].sort((a, b) => b.sortAt - a.sortAt || a.title.localeCompare(b.title, "ro"));
}

export function dsrCsv(entries: DsrJournalEntry[]): string {
  const header = ["Tip", "Data", "Titlu", "Furnizor", "Km", "Sumă (bani)", "Status"];
  const lines = entries.map((e) =>
    [
      e.kind === "maintenance" ? "Mentenanță" : "Reparație",
      e.at ?? "",
      e.title,
      e.provider ?? "",
      e.odometerKm ?? "",
      e.amountCents ?? "",
      e.status ?? "",
    ]
      .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export function countActiveEquipment(items: VehicleEquipmentRecord[]): number {
  return items.filter((i) => i.isActive).length;
}
