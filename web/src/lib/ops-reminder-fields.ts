import { DEFAULT_REMINDER_OFFSETS } from "./document-reminders";
import { REMINDER_OFFSET_KM_CHOICES } from "./reminder-actions";

export type ReminderConstraintMode = "time" | "km" | "both";

export const DEFAULT_KM_REMINDER_OFFSETS = [10000, 5000, 1000];

export function inferReminderConstraintMode(input: {
  dueDate?: string | null;
  dueOdometerKm?: number | null;
}): ReminderConstraintMode {
  const hasTime = Boolean(input.dueDate?.trim());
  const hasKm = input.dueOdometerKm != null && input.dueOdometerKm > 0;
  if (hasTime && hasKm) return "both";
  if (hasKm) return "km";
  return "time";
}

export function hasConfiguredOpsReminder(input: {
  mode: ReminderConstraintMode;
  dueDate: string;
  reminderOffsetsDays: number[];
  dueOdometerKm: number | null;
  reminderOffsetsKm: number[];
}): boolean {
  const hasTime =
    input.mode !== "km" && input.dueDate.trim().length > 0 && input.reminderOffsetsDays.length > 0;
  const hasKm =
    input.mode !== "time" &&
    input.dueOdometerKm != null &&
    input.dueOdometerKm > 0 &&
    input.reminderOffsetsKm.length > 0;
  return hasTime || hasKm;
}

export function defaultDayOffsetsForMode(isItp: boolean): number[] {
  return isItp ? [30, 14, 7, 1, 0] : [...DEFAULT_REMINDER_OFFSETS];
}

export function defaultKmOffsets(): number[] {
  return [...DEFAULT_KM_REMINDER_OFFSETS];
}

export { REMINDER_OFFSET_KM_CHOICES };
