import type { MaintenancePlanTriggerMode } from '@prisma/client';

export type NextDueInput = {
  intervalDays: number | null;
  intervalKm: number | null;
  triggerMode: MaintenancePlanTriggerMode;
  lastServiceOn: Date | null;
  lastServiceKm: number | null;
  baselineDate: Date;
  baselineKm: number;
  dueManualOverride: boolean;
  manualNextDueOn: Date | null;
  manualDueOdometerKm: number | null;
};

export type NextDueResult = {
  nextDueOn: Date | null;
  dueOdometerKm: number | null;
};

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

function computeTimeDue(input: NextDueInput): Date | null {
  if (input.intervalDays == null || input.intervalDays <= 0) return null;
  const base = input.lastServiceOn ?? input.baselineDate;
  return addDays(base, input.intervalDays);
}

function computeKmDue(input: NextDueInput): number | null {
  if (input.intervalKm == null || input.intervalKm <= 0) return null;
  const base = input.lastServiceKm ?? input.baselineKm;
  return base + input.intervalKm;
}

export function computeMaintenancePlanNextDue(input: NextDueInput): NextDueResult {
  if (input.dueManualOverride) {
    return {
      nextDueOn: input.manualNextDueOn,
      dueOdometerKm: input.manualDueOdometerKm,
    };
  }

  const timeDue = computeTimeDue(input);
  const kmDue = computeKmDue(input);

  switch (input.triggerMode) {
    case 'time':
      return { nextDueOn: timeDue, dueOdometerKm: null };
    case 'km':
      return { nextDueOn: null, dueOdometerKm: kmDue };
    case 'whichever_first':
    default:
      return { nextDueOn: timeDue, dueOdometerKm: kmDue };
  }
}

export function formatIntervalLabel(
  intervalDays: number | null,
  intervalKm: number | null,
  triggerMode: MaintenancePlanTriggerMode,
): string {
  const parts: string[] = [];
  if (intervalDays != null && intervalDays > 0) {
    if (intervalDays % 365 === 0 && intervalDays >= 365) {
      const years = intervalDays / 365;
      parts.push(years === 1 ? '12 luni' : `${years} ani`);
    } else if (intervalDays % 30 === 0 && intervalDays >= 30) {
      const months = intervalDays / 30;
      parts.push(months === 1 ? '1 lună' : `${months} luni`);
    } else {
      parts.push(`${intervalDays} zile`);
    }
  }
  if (intervalKm != null && intervalKm > 0) {
    parts.push(`${intervalKm.toLocaleString('ro-RO')} km`);
  }
  if (parts.length === 0) return 'Fără interval';
  if (parts.length === 1) return parts[0]!;
  if (triggerMode === 'whichever_first') return `${parts.join(' sau ')} (primul)`;
  if (triggerMode === 'time') return parts[0]!;
  return parts[parts.length - 1]!;
}
