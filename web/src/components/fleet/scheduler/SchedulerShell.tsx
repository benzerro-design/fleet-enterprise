"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  appointmentsBrowserBase,
  type AppointmentStats,
  type CalendarAppointment,
} from "@/lib/appointments-api";
import {
  addDays,
  calendarRangeIso,
  formatWeekRange,
  startOfWeekMonday,
} from "@/lib/scheduler-date-utils";
import { SchedulerAgendaView } from "./SchedulerAgendaView";
import { SchedulerInspector } from "./SchedulerInspector";
import { SchedulerSidebar } from "./SchedulerSidebar";
import { SchedulerWeekView } from "./SchedulerWeekView";

type SupplierOption = { id: string; code: string; legalName: string; category: string };
type VehicleOption = { id: string; registrationNumber: string; clientId: string };

type Props = {
  canWrite: boolean;
  initialStats: AppointmentStats | null;
  suppliers: SupplierOption[];
  vehicles: VehicleOption[];
};

export function SchedulerShell({ canWrite, initialStats, suppliers, vehicles }: Props) {
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()));
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [stats, setStats] = useState<AppointmentStats | null>(initialStats);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [supplierFilter, setSupplierFilter] = useState<string[]>(() => suppliers.map((s) => s.id));
  const [createMode, setCreateMode] = useState(false);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [loading, setLoading] = useState(true);

  const weekLabel = useMemo(() => formatWeekRange(weekStart), [weekStart]);
  const range = useMemo(() => calendarRangeIso(weekStart), [weekStart]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from: range.from, to: range.to });
      if (supplierFilter.length > 0 && supplierFilter.length < suppliers.length) {
        params.set("supplierIds", supplierFilter.join(","));
      }
      const [calRes, statsRes] = await Promise.all([
        fetch(`${appointmentsBrowserBase}/calendar?${params.toString()}`),
        fetch(`${appointmentsBrowserBase}/stats`),
      ]);
      if (calRes.ok) {
        setAppointments((await calRes.json()) as CalendarAppointment[]);
      }
      if (statsRes.ok) {
        setStats((await statsRes.json()) as AppointmentStats);
      }
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, supplierFilter, suppliers.length]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = appointments.find((a) => a.id === selectedId) ?? null;

  function toggleSupplier(id: string) {
    setSupplierFilter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function selectAppointment(id: string) {
    setSelectedId(id);
    setCreateMode(false);
    setMobileDetail(true);
  }

  function goToday() {
    setWeekStart(startOfWeekMonday(new Date()));
  }

  function shiftWeek(delta: number) {
    setWeekStart((w) => addDays(w, delta * 7));
  }

  const showMobileInspector = mobileDetail && (selected || createMode);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-3 py-3 lg:px-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToday}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
          >
            Azi
          </button>
          <button type="button" onClick={() => shiftWeek(-1)} className="rounded-lg border border-zinc-700 px-2 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800">
            ‹
          </button>
          <button type="button" onClick={() => shiftWeek(1)} className="rounded-lg border border-zinc-700 px-2 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800">
            ›
          </button>
          <span className="hidden text-sm font-semibold text-zinc-200 sm:inline">{weekLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500 lg:hidden">
            Agendă
          </span>
          <span className="hidden rounded-full border border-emerald-500/30 bg-emerald-950/30 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-400 lg:inline">
            Săptămână
          </span>
          {canWrite ? (
            <button
              type="button"
              onClick={() => {
                setCreateMode(true);
                setSelectedId(null);
                setMobileDetail(true);
              }}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
            >
              + Programare
            </button>
          ) : null}
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1">
        <SchedulerSidebar
          suppliers={suppliers}
          selectedIds={supplierFilter}
          onToggle={toggleSupplier}
          weekLabel={weekLabel}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          {loading ? (
            <p className="p-6 text-sm text-zinc-500">Se încarcă programările…</p>
          ) : (
            <>
              <SchedulerWeekView
                weekStart={weekStart}
                appointments={appointments}
                selectedId={selectedId}
                onSelect={selectAppointment}
              />
              <SchedulerAgendaView
                weekStart={weekStart}
                appointments={appointments}
                selectedId={selectedId}
                onSelect={selectAppointment}
              />
            </>
          )}
        </div>

        {!showMobileInspector ? (
          <SchedulerInspector
            appointment={selected}
            canWrite={canWrite}
            createMode={createMode}
            onCancelCreate={() => {
              setCreateMode(false);
              setMobileDetail(false);
            }}
            onUpdated={() => void load()}
            vehicles={vehicles}
          />
        ) : null}
      </div>

      {showMobileInspector ? (
        <SchedulerInspector
          appointment={selected}
          canWrite={canWrite}
          mobile
          createMode={createMode}
          onClose={() => {
            setMobileDetail(false);
            setCreateMode(false);
          }}
          onCancelCreate={() => {
            setCreateMode(false);
            setMobileDetail(false);
          }}
          onUpdated={() => void load()}
          vehicles={vehicles}
        />
      ) : null}
    </div>
  );
}
