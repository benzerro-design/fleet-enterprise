import { REMINDER_PRESETS } from "./document-reminders";

export const ITP_COST_CATEGORY = "ITP";
export const ITP_MAINTENANCE_ALLOCATION = "itp";

export const ITP_REMINDER_OFFSETS = [...REMINDER_PRESETS.find((p) => p.id === "itp_rca")!.offsets];

export function isItpCostCategory(category: string): boolean {
  return category.trim().toUpperCase() === ITP_COST_CATEGORY;
}

export function isItpMaintenanceAllocation(code: string): boolean {
  return code.trim().toLowerCase() === ITP_MAINTENANCE_ALLOCATION;
}
