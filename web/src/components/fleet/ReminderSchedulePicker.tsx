"use client";

import { useMemo, useState } from "react";
import {
  REMINDER_OFFSET_CHOICES,
  REMINDER_PRESETS,
  computeReminderSummary,
  detectPresetFromOffsets,
  formatOffsetDaysLabel,
  type ReminderPresetId,
} from "@/lib/document-reminders";

type Props = {
  expiresOn: string;
  offsets: number[];
  onChange: (offsets: number[]) => void;
  disabled?: boolean;
};

export function ReminderSchedulePicker({ expiresOn, offsets, onChange, disabled }: Props) {
  const [preset, setPreset] = useState<ReminderPresetId>(() => detectPresetFromOffsets(offsets));

  const summary = useMemo(
    () => computeReminderSummary(expiresOn ? new Date(expiresOn).toISOString() : null, offsets),
    [expiresOn, offsets],
  );

  function applyPreset(id: ReminderPresetId) {
    setPreset(id);
    if (id === "custom") return;
    const p = REMINDER_PRESETS.find((x) => x.id === id);
    if (p) onChange([...p.offsets]);
  }

  function toggleOffset(day: number) {
    setPreset("custom");
    const set = new Set(offsets);
    if (set.has(day)) set.delete(day);
    else set.add(day);
    onChange([...set].sort((a, b) => b - a));
  }

  const upcomingTimeline = summary.timeline.filter((t) => t.status !== "past");

  return (
    <div className="rounded-xl border border-violet-900/40 bg-gradient-to-b from-violet-950/20 to-zinc-950/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-violet-100">Remindere expirare</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Alege când vrei alerte înainte de data expirării (in-app; email — fază următoare).
          </p>
        </div>
        {offsets.length > 0 ? (
          <span className="rounded-full border border-violet-800/60 bg-violet-950/50 px-2 py-0.5 text-[10px] text-violet-200">
            {offsets.length} {offsets.length === 1 ? "alertă" : "alerte"}
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {REMINDER_PRESETS.map((p) => {
          const active = preset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              onClick={() => applyPreset(p.id)}
              className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                active
                  ? "border-violet-500/70 bg-violet-950/50 ring-1 ring-violet-500/30"
                  : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700 hover:bg-zinc-900/50"
              } disabled:opacity-50`}
            >
              <span className="block text-xs font-medium text-zinc-100">{p.label}</span>
              <span className="mt-0.5 block text-[10px] leading-snug text-zinc-500">{p.description}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <p className="text-[10px] uppercase tracking-wide text-zinc-600">Personalizare (zile înainte)</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {REMINDER_OFFSET_CHOICES.map((day) => {
            const on = offsets.includes(day);
            return (
              <button
                key={day}
                type="button"
                disabled={disabled}
                onClick={() => toggleOffset(day)}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                  on
                    ? "border-violet-500/60 bg-violet-600/20 text-violet-100"
                    : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                } disabled:opacity-50`}
              >
                {day === 0 ? "0 · expirare" : `${day}z`}
              </button>
            );
          })}
        </div>
      </div>

      {offsets.length > 0 && expiresOn ? (
        <div className="mt-4 rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-zinc-600">Previzualizare calendar</p>
          <ul className="mt-2 space-y-1">
            {upcomingTimeline.length === 0 ? (
              <li className="text-xs text-zinc-500">Toate reminderele pentru acest document au trecut deja.</li>
            ) : (
              upcomingTimeline.map((t) => (
                <li key={t.offsetDays} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-zinc-400">{formatOffsetDaysLabel(t.offsetDays)}</span>
                  <span className="font-mono text-zinc-200">
                    {new Date(t.remindOn).toLocaleDateString("ro-RO")}
                    {t.status === "today" ? (
                      <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-200">
                        azi
                      </span>
                    ) : null}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}

      {offsets.length === 0 ? (
        <p className="mt-3 text-xs text-zinc-500">Selectează cel puțin un offset sau un șablon de mai sus.</p>
      ) : null}
    </div>
  );
}
