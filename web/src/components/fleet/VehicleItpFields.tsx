"use client";

import { OpsReminderFields } from "@/components/fleet/OpsReminderFields";
import {
  hasConfiguredOpsReminder,
  inferReminderConstraintMode,
} from "@/lib/ops-reminder-fields";

type Props = {
  itpDate: string;
  onItpDateChange: (value: string) => void;
  itpStationName: string;
  onItpStationNameChange: (value: string) => void;
  reminderOffsetsDays: number[];
  onReminderOffsetsDaysChange: (value: number[]) => void;
  syncReminderAction: boolean;
  onSyncReminderActionChange: (value: boolean) => void;
  vehicleOdometerKm: number;
  disabled?: boolean;
};

export function VehicleItpFields({
  itpDate,
  onItpDateChange,
  itpStationName,
  onItpStationNameChange,
  reminderOffsetsDays,
  onReminderOffsetsDaysChange,
  syncReminderAction,
  onSyncReminderActionChange,
  vehicleOdometerKm,
  disabled,
}: Props) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-zinc-300">ITP</p>
        <p className="mt-0.5 text-xs text-zinc-500">Dată expirare și remindere — la fel ca la documente sau mentenanță.</p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">ITP — stație (opțional)</label>
        <input
          value={itpStationName}
          disabled={disabled}
          onChange={(e) => onItpStationNameChange(e.target.value)}
          placeholder="ex. RAR București"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2 disabled:opacity-60"
        />
      </div>

      <OpsReminderFields
        constraintMode="time"
        onConstraintModeChange={() => {}}
        dueDate={itpDate}
        onDueDateChange={onItpDateChange}
        dueDateLabel="ITP — dată expirare"
        dueDateHint="Opțional. Dacă completați data, puteți configura remindere în meniul Remindere."
        reminderOffsetsDays={reminderOffsetsDays}
        onReminderOffsetsDaysChange={onReminderOffsetsDaysChange}
        dueOdometerKm={null}
        onDueOdometerKmChange={() => {}}
        reminderOffsetsKm={[]}
        onReminderOffsetsKmChange={() => {}}
        vehicleOdometerKm={vehicleOdometerKm}
        syncReminderAction={syncReminderAction}
        onSyncReminderActionChange={onSyncReminderActionChange}
        disabled={disabled}
        isItp
        fixedMode="time"
      />
    </div>
  );
}

export function buildVehicleItpPayload(input: {
  itpDate: string;
  itpStationName: string;
  reminderOffsetsDays: number[];
  syncReminderAction: boolean;
}): {
  itpExpiresOn?: string | null;
  itpStationName?: string | null;
  itpReminderOffsetsDays?: number[] | null;
  syncItpReminderAction: boolean;
} {
  const configured = hasConfiguredOpsReminder({
    mode: inferReminderConstraintMode({ dueDate: input.itpDate }),
    dueDate: input.itpDate,
    reminderOffsetsDays: input.reminderOffsetsDays,
    dueOdometerKm: null,
    reminderOffsetsKm: [],
  });

  const expiryIso = input.itpDate.trim() ? `${input.itpDate.trim()}T12:00:00.000Z` : null;

  return {
    itpExpiresOn: expiryIso,
    itpStationName: input.itpStationName.trim() || null,
    itpReminderOffsetsDays:
      configured || input.itpDate.trim() ? input.reminderOffsetsDays : null,
    syncItpReminderAction: configured ? input.syncReminderAction : false,
  };
}
