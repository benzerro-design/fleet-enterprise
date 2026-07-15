"use client";

import { useMemo } from "react";
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
import { appointmentStatusAccentClass } from "./appointment-status-colors";
import { supplierDotClass } from "./supplier-colors";

type SupplierOption = { id: string; code: string; legalName: string; category: string };

type Lane = {
  key: string;
  supplierId: string | null;
  label: string;
  category: string | null;
};

type Props = {
  weekStart: Date;
  appointments: CalendarAppointment[];
  suppliers: SupplierOption[];
  supplierFilter: string[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function SchedulerSupplierBandView({
  weekStart,
  appointments,
  suppliers,
  supplierFilter,
  selectedId,
  onSelect,
}: Props) {
  const days = dayLabels(weekStart);
  const gridH = gridHeightPx();

  const lanes = useMemo((): Lane[] => {
    const visible = suppliers.filter((s) => supplierFilter.includes(s.id));
    const hasUnassigned = appointments.some((a) => !a.supplierId);
    const result: Lane[] = visible.map((s) => ({
      key: s.id,
      supplierId: s.id,
      label: s.code,
      category: s.category,
    }));
    if (hasUnassigned) {
      result.push({ key: "__none__", supplierId: null, label: "Nealocat", category: null });
    }
    return result;
  }, [appointments, supplierFilter, suppliers]);

  if (lanes.length === 0) {
    return (
      <p className="hidden p-6 text-sm text-zinc-500 lg:block">
        Selectează cel puțin un furnizor din sidebar pentru benzi.
      </p>
    );
  }

  return (
    <div className="hidden min-h-0 flex-1 flex-col overflow-y-auto lg:flex">
      <div className="sticky top-0 z-10 flex border-b border-zinc-800 bg-zinc-950/95">
        <div className="w-36 shrink-0 border-r border-zinc-800" />
        <div className="w-12 shrink-0 border-r border-zinc-800" />
        <div className="grid min-w-0 flex-1 grid-cols-5">
          {days.map((day) => {
            const isToday = isSameDay(day.date, new Date());
            return (
              <div
                key={day.date.toISOString()}
                className={`flex h-9 items-center justify-center border-r border-zinc-800 text-xs font-semibold last:border-r-0 ${
                  isToday ? "bg-emerald-950/40 text-emerald-300" : "bg-zinc-900/80 text-zinc-400"
                }`}
              >
                {day.label}
              </div>
            );
          })}
        </div>
      </div>

      {lanes.map((lane) => {
        const laneAppts = appointments.filter((a) =>
          lane.supplierId ? a.supplierId === lane.supplierId : !a.supplierId,
        );
        return (
          <div key={lane.key} className="flex border-b border-zinc-800/80">
            <div className="flex w-36 shrink-0 items-start border-r border-zinc-800 bg-zinc-950/60 px-2 py-2">
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${supplierDotClass(lane.category)}`} />
              <div className="ml-2 min-w-0">
                <p className="truncate text-xs font-semibold text-zinc-200">{lane.label}</p>
                <p className="text-[10px] text-zinc-500">{laneAppts.length} prog.</p>
              </div>
            </div>
            <div className="w-12 shrink-0 border-r border-zinc-800 pt-1">
              {SCHEDULER_HOURS.filter((_, i) => i % 2 === 0).map((h) => (
                <div
                  key={h}
                  className="pr-1 text-right text-[9px] tabular-nums text-zinc-600"
                  style={{ height: PX_PER_HOUR * 2 }}
                >
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>
            <div className="grid min-w-0 flex-1 grid-cols-5">
              {days.map((day) => {
                const dayAppts = laneAppts.filter((a) => isSameDay(new Date(a.scheduledAt), day.date));
                return (
                  <div
                    key={day.date.toISOString()}
                    className="relative min-w-0 border-r border-zinc-800 bg-zinc-950/30 last:border-r-0"
                    style={{ height: gridH }}
                  >
                    {SCHEDULER_HOURS.map((h) => (
                      <div
                        key={h}
                        className="pointer-events-none absolute left-0 right-0 border-t border-zinc-800/50"
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
                          className={`absolute left-0.5 right-0.5 overflow-hidden rounded border border-l-[3px] px-1 py-0.5 text-left text-[9px] leading-tight ${
                            selected ? "z-10 ring-1 ring-emerald-500/50" : "border-zinc-700/80 hover:brightness-110"
                          } ${appointmentStatusAccentClass(a.status)}`}
                          style={{
                            top: topOffsetForTime(start),
                            height: heightForDuration(a.durationMin),
                          }}
                        >
                          <div className="font-semibold text-zinc-100">
                            {start.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                          <div className="truncate font-mono text-emerald-400/90">{a.registrationNumber}</div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
