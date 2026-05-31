import type { ReminderActionRow } from "@/lib/reminder-actions";

export type VehicleReminderRow = ReminderActionRow;

export function vehicleRemindersSummary(items: VehicleReminderRow[], totalInDb: number): string {
  if (totalInDb === 0) return "Niciun reminder";
  const urgent = items.filter(
    (r) =>
      r.summary.status === "due_today" ||
      r.summary.status === "due_soon" ||
      r.summary.status === "expired" ||
      r.summary.status === "km_overdue" ||
      r.summary.status === "km_due_soon",
  ).length;
  const countLabel = totalInDb === 1 ? "1 acțiune" : `${totalInDb} acțiuni`;
  if (urgent > 0) return `${countLabel} · ${urgent} necesită atenție`;
  return countLabel;
}
