"use client";

import type { CalendarAppointment } from "@/lib/appointments-api";
import {
  SCHEDULER_HOURS,
  PX_PER_HOUR,
  dayLabels,
  gridHeightPx,
  heightForDuration,
  isSameDay,
  topOffsetForTime,
} from "@/lib/scheduler-date-utils";
import { supplierAccentClass } from "./supplier-colors";

type Props = {
  weekStart: Date;
  appointments: CalendarAppointment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function SchedulerWeekView({ weekStart, appointments, selectedId, onSelect }: Props) {
  const days = dayLabels(weekStart);
  const gridH = gridHeightPx();

  return (
    <div className="hidden min-h-0 flex-1 flex-col lg:flex">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="w-12 shrink-0 border-r border-zinc-800 pt-9">
          {SCHEDULER_HOURS.map((h) => (
            <div
              key={h}
              className="pr-1 text-right text-[10px] tabular-nums text-zinc-600"
              style={{ height: PX_PER_HOUR }}
            >
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-5">
          {days.map((day) => {
            const dayAppts = appointments.filter((a) => isSameDay(new Date(a.scheduledAt), day.date));
            const isToday = isSameDay(day.date, new Date());
            return (
              <div key={day.date.toISOString()} className="min-w-0 border-r border-zinc-800 last:border-r-0">
                <div
                  className={`flex h-9 items-center justify-center border-b border-zinc-800 text-xs font-semibold ${
                    isToday ? "bg-emerald-950/40 text-emerald-300" : "bg-zinc-900/80 text-zinc-400"
                  }`}
                >
                  {day.label}
                </div>
                <div className="relative bg-zinc-950/40" style={{ height: gridH }}>
                  {SCHEDULER_HOURS.map((h) => (
                    <div
                      key={h}
                      className="pointer-events-none absolute left-0 right-0 border-t border-zinc-800/70"
                      style={{ top: (h - SCHEDULER_HOURS[0]) * PX_PER_HOUR }}
                    />
                  ))}
                  {dayAppts.map((a) => {
                    const start = new Date(a.scheduledAt);
                    const selected = a.id === selectedId;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => onSelect(a.id)}
                        className={`absolute left-1 right-1 overflow-hidden rounded-md border border-l-[3px] px-1.5 py-1 text-left text-[10px] leading-tight transition-shadow ${
                          selected
                            ? "z-10 border-emerald-500/60 bg-emerald-950/50 ring-1 ring-emerald-500/40"
                            : "border-zinc-700/80 bg-zinc-900/90 hover:bg-zinc-800/90"
                        } ${supplierAccentClass(a.supplierCategory)}`}
                        style={{
                          top: topOffsetForTime(start),
                          height: heightForDuration(a.durationMin),
                        }}
                      >
                        <div className="font-semibold text-zinc-100">
                          {start.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        <div className="truncate font-mono text-emerald-400/90">{a.registrationNumber}</div>
                        <div className="truncate text-zinc-400">{a.title}</div>
                        {a.supplierCode ? (
                          <div className="truncate text-zinc-500">{a.supplierCode}</div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
