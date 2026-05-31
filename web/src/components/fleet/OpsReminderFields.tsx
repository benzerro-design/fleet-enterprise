"use client";

import { ReminderKmPicker } from "@/components/fleet/ReminderKmPicker";
import { ReminderSchedulePicker } from "@/components/fleet/ReminderSchedulePicker";
import {
  defaultDayOffsetsForMode,
  defaultKmOffsets,
  hasConfiguredOpsReminder,
  type ReminderConstraintMode,
} from "@/lib/ops-reminder-fields";

type Props = {
  constraintMode: ReminderConstraintMode;
  onConstraintModeChange: (mode: ReminderConstraintMode) => void;
  dueDate: string;
  onDueDateChange: (value: string) => void;
  dueDateLabel: string;
  dueDateHint?: string;
  reminderOffsetsDays: number[];
  onReminderOffsetsDaysChange: (value: number[]) => void;
  dueOdometerKm: number | null;
  onDueOdometerKmChange: (value: number | null) => void;
  reminderOffsetsKm: number[];
  onReminderOffsetsKmChange: (value: number[]) => void;
  vehicleOdometerKm: number;
  syncReminderAction: boolean;
  onSyncReminderActionChange: (value: boolean) => void;
  disabled?: boolean;
  isItp?: boolean;
};

const MODE_OPTIONS: { value: ReminderConstraintMode; label: string }[] = [
  { value: "time", label: "Timp (dată)" },
  { value: "km", label: "Kilometraj" },
  { value: "both", label: "Timp + km" },
];

export function OpsReminderFields({
  constraintMode,
  onConstraintModeChange,
  dueDate,
  onDueDateChange,
  dueDateLabel,
  dueDateHint,
  reminderOffsetsDays,
  onReminderOffsetsDaysChange,
  dueOdometerKm,
  onDueOdometerKmChange,
  reminderOffsetsKm,
  onReminderOffsetsKmChange,
  vehicleOdometerKm,
  syncReminderAction,
  onSyncReminderActionChange,
  disabled,
  isItp = false,
}: Props) {
  const showTime = constraintMode === "time" || constraintMode === "both";
  const showKm = constraintMode === "km" || constraintMode === "both";
  const configured = hasConfiguredOpsReminder({
    mode: constraintMode,
    dueDate,
    reminderOffsetsDays,
    dueOdometerKm,
    reminderOffsetsKm,
  });

  function onModeChange(mode: ReminderConstraintMode) {
    onConstraintModeChange(mode);
    if ((mode === "time" || mode === "both") && dueDate && reminderOffsetsDays.length === 0) {
      onReminderOffsetsDaysChange(defaultDayOffsetsForMode(isItp));
    }
    if ((mode === "km" || mode === "both") && dueOdometerKm != null && reminderOffsetsKm.length === 0) {
      onReminderOffsetsKmChange(defaultKmOffsets());
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-violet-900/30 bg-violet-950/10 p-4">
      <div>
        <p className="text-sm font-medium text-violet-100">Remindere</p>
        <p className="mt-0.5 text-xs text-zinc-500">Alege tipul de scadență pentru acțiunea din meniul Remindere.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {MODE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onModeChange(opt.value)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              constraintMode === opt.value
                ? "border-violet-500/60 bg-violet-950/50 text-violet-100"
                : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {showTime ? (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">{dueDateLabel}</label>
          <input
            type="date"
            value={dueDate}
            disabled={disabled}
            onChange={(e) => {
              const v = e.target.value;
              onDueDateChange(v);
              if (v && reminderOffsetsDays.length === 0) {
                onReminderOffsetsDaysChange(defaultDayOffsetsForMode(isItp));
              }
              if (!v) onReminderOffsetsDaysChange([]);
            }}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
          />
          {dueDateHint ? <p className="text-xs text-zinc-500">{dueDateHint}</p> : null}
          {dueDate ? (
            <ReminderSchedulePicker
              expiresOn={dueDate}
              offsets={reminderOffsetsDays}
              onChange={onReminderOffsetsDaysChange}
              disabled={disabled}
            />
          ) : null}
        </div>
      ) : null}

      {showKm ? (
        <ReminderKmPicker
          dueOdometerKm={dueOdometerKm}
          offsets={reminderOffsetsKm}
          currentOdometerKm={vehicleOdometerKm}
          onChange={onReminderOffsetsKmChange}
          onDueOdometerChange={(km) => {
            onDueOdometerKmChange(km);
            if (km != null && reminderOffsetsKm.length === 0) {
              onReminderOffsetsKmChange(defaultKmOffsets());
            }
            if (km == null) onReminderOffsetsKmChange([]);
          }}
          disabled={disabled}
        />
      ) : null}

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-violet-900/30 bg-violet-950/10 px-4 py-3">
        <input
          type="checkbox"
          checked={syncReminderAction}
          disabled={disabled || !configured}
          onChange={(e) => onSyncReminderActionChange(e.target.checked)}
          className="mt-0.5 rounded border-zinc-600"
        />
        <span className="text-sm text-zinc-300">
          <span className="font-medium text-violet-200">Creează acțiune în meniul Remindere</span>
          <span className="mt-0.5 block text-xs text-zinc-500">
            Sincronizează automat cu setările de mai sus. Editarea ulterioară se face din modulul sursă.
          </span>
        </span>
      </label>
    </div>
  );
}
