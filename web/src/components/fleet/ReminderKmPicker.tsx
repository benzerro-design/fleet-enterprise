"use client";

import { REMINDER_OFFSET_KM_CHOICES, formatOffsetKmLabel } from "@/lib/reminder-actions";

type Props = {
  dueOdometerKm: number | null;
  offsets: number[];
  currentOdometerKm: number;
  onChange: (offsets: number[]) => void;
  onDueOdometerChange: (km: number | null) => void;
  disabled?: boolean;
};

export function ReminderKmPicker({
  dueOdometerKm,
  offsets,
  currentOdometerKm,
  onChange,
  onDueOdometerChange,
  disabled,
}: Props) {
  function toggleOffset(km: number) {
    const set = new Set(offsets);
    if (set.has(km)) set.delete(km);
    else set.add(km);
    onChange([...set].sort((a, b) => b - a));
  }

  return (
    <div className="rounded-xl border border-sky-900/40 bg-gradient-to-b from-sky-950/20 to-zinc-950/40 p-4">
      <p className="text-sm font-medium text-sky-100">Remindere kilometraj</p>
      <p className="mt-0.5 text-xs text-zinc-500">
        Odometru curent vehicul: <span className="font-mono text-zinc-300">{currentOdometerKm.toLocaleString("ro-RO")} km</span>
        {" "}(actualizare automată — în curând)
      </p>

      <div className="mt-3 space-y-2">
        <label className="block text-xs font-medium text-zinc-400">Km țintă (scadență)</label>
        <input
          type="number"
          min={0}
          disabled={disabled}
          value={dueOdometerKm ?? ""}
          onChange={(e) => {
            const v = e.target.value.trim();
            onDueOdometerChange(v ? Math.max(0, parseInt(v, 10) || 0) : null);
          }}
          placeholder="ex. 150000"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-mono"
        />
      </div>

      {dueOdometerKm != null ? (
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-wide text-zinc-600">Alerte înainte (km)</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {REMINDER_OFFSET_KM_CHOICES.map((km) => {
              const on = offsets.includes(km);
              return (
                <button
                  key={km}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleOffset(km)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                    on
                      ? "border-sky-500/60 bg-sky-600/20 text-sky-100"
                      : "border-zinc-800 text-zinc-500 hover:border-zinc-600"
                  }`}
                >
                  {formatOffsetKmLabel(km)}
                </button>
              );
            })}
          </div>
          {offsets.length > 0 ? (
            <ul className="mt-3 space-y-1 text-xs text-zinc-500">
              {offsets.map((o) => (
                <li key={o} className="font-mono text-zinc-400">
                  {formatOffsetKmLabel(o)} → la {(dueOdometerKm - o).toLocaleString("ro-RO")} km
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
