import { normalizeReminderOffsets } from './document-reminders';
import { normalizeReminderOffsetsKm } from './reminder-status';

export type ReminderSyncPayload = {
  dueOn?: Date | null;
  reminderOffsetsDays?: unknown;
  dueOdometerKm?: number | null;
  reminderOffsetsKm?: unknown;
};

/** True dacă există cel puțin o constrângere timp sau km configurată pentru sync. */
export function hasReminderSyncConstraints(input: ReminderSyncPayload): boolean {
  const dayOffsets = normalizeReminderOffsets(input.reminderOffsetsDays);
  const kmOffsets = normalizeReminderOffsetsKm(input.reminderOffsetsKm);
  const hasTime = Boolean(input.dueOn && dayOffsets?.length);
  const hasKm =
    input.dueOdometerKm != null &&
    input.dueOdometerKm > 0 &&
    Boolean(kmOffsets?.length);
  return hasTime || hasKm;
}
