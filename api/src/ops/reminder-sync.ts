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

export function reminderMenuSyncEnabledForCreate(syncReminderAction?: boolean): boolean {
  return syncReminderAction !== false;
}

export function reminderMenuSyncEnabledPatchValue(
  syncReminderAction: boolean | undefined,
): boolean | undefined {
  if (syncReminderAction === false) return false;
  if (syncReminderAction === true) return true;
  return undefined;
}

export function shouldRunReminderMenuSync(
  reminderMenuSyncEnabled: boolean,
  syncReminderAction?: boolean,
): boolean {
  if (syncReminderAction === false) return false;
  return reminderMenuSyncEnabled;
}
