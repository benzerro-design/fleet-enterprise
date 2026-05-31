import type { MaintenancePlanTriggerMode } from "@/lib/maintenance-plan-types";

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function previewNextDue(input: {
  triggerMode: MaintenancePlanTriggerMode;
  intervalDays: number | null;
  intervalKm: number | null;
  lastServiceOn: string;
  lastServiceKm: number | null;
  vehicleOdometerKm: number;
}): { nextDueOn: string | null; dueOdometerKm: number | null } {
  const baseDate = input.lastServiceOn.trim() || new Date().toISOString().slice(0, 10);
  const baseKm = input.lastServiceKm ?? input.vehicleOdometerKm;

  const timeDue =
    input.intervalDays != null && input.intervalDays > 0
      ? addDays(baseDate, input.intervalDays)
      : null;
  const kmDue =
    input.intervalKm != null && input.intervalKm > 0 ? baseKm + input.intervalKm : null;

  switch (input.triggerMode) {
    case "time":
      return { nextDueOn: timeDue, dueOdometerKm: null };
    case "km":
      return { nextDueOn: null, dueOdometerKm: kmDue };
    default:
      return { nextDueOn: timeDue, dueOdometerKm: kmDue };
  }
}
