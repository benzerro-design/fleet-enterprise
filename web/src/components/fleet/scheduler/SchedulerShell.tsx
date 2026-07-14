"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  appointmentsBrowserBase,
  type AppointmentStats,
  type CalendarAppointment,
} from "@/lib/appointments-api";
import { fleetJsonHeaders } from "@/lib/fleet-api";
import {
  parseSchedulerWeekParam,
  schedulerHref,
  type SchedulerViewMode,
} from "@/lib/scheduler-deep-link";
import {
  addDays,
  calendarRangeIso,
  formatWeekRange,
  startOfWeekMonday,
  toDatetimeLocalValue,
} from "@/lib/scheduler-date-utils";
import { SchedulerAgendaView } from "./SchedulerAgendaView";
import { SchedulerInspector } from "./SchedulerInspector";
import { SchedulerSidebar } from "./SchedulerSidebar";
import { SchedulerSupplierBandView } from "./SchedulerSupplierBandView";
import { SchedulerWeekView } from "./SchedulerWeekView";

type SupplierOption = { id: string; code: string; legalName: string; category: string; services?: string[] };
type ServiceTypeOption = { id: string; code: string; label: string };
type VehicleOption = { id: string; registrationNumber: string; clientId: string };

type Props = {
  canWrite: boolean;
  initialStats: AppointmentStats | null;
  suppliers: SupplierOption[];
  serviceTypes?: ServiceTypeOption[];
  vehicles: VehicleOption[];
  initialWeekIso?: string;
  initialSelectId?: string;
  initialViewMode?: SchedulerViewMode;
  initialTicketId?: string;
  initialVehicleId?: string;
  initialCreate?: boolean;
};

export function SchedulerShell({
  canWrite,
  initialStats,
  suppliers,
  serviceTypes = [],
  vehicles,
  initialWeekIso,
  initialSelectId,
  initialViewMode = "grid",
  initialTicketId,
  initialVehicleId,
  initialCreate = false,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [weekStart, setWeekStart] = useState(() => {
    const parsed = parseSchedulerWeekParam(initialWeekIso);
    return parsed ? startOfWeekMonday(parsed) : startOfWeekMonday(new Date());
  });
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [stats, setStats] = useState<AppointmentStats | null>(initialStats);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectId ?? null);
  const [supplierFilter, setSupplierFilter] = useState<string[]>(() => suppliers.map((s) => s.id));
  const [serviceTypeCode, setServiceTypeCode] = useState("");
  const visibleSuppliers = useMemo(() => {
    if (!serviceTypeCode) return suppliers;
    return suppliers.filter((s) => s.services?.includes(serviceTypeCode));
  }, [suppliers, serviceTypeCode]);

  useEffect(() => {
    setSupplierFilter(visibleSuppliers.map((s) => s.id));
  }, [serviceTypeCode, visibleSuppliers]);

  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<SchedulerViewMode>(initialViewMode);
  const [createPrefillAt, setCreatePrefillAt] = useState<string | undefined>();
  const [linkTicketId] = useState(initialTicketId ?? null);
  const [linkVehicleId] = useState(initialVehicleId ?? null);
  const [createMode, setCreateMode] = useState(() => !!(initialCreate && initialTicketId && canWrite));
  const [mobileDetail, setMobileDetail] = useState(() => !!(initialSelectId || (initialCreate && initialTicketId)));

  const weekLabel = useMemo(() => formatWeekRange(weekStart), [weekStart]);
  const range = useMemo(() => calendarRangeIso(weekStart), [weekStart]);

  const syncUrl = useCallback(
    (opts: {
      week?: Date;
      select?: string | null;
      view?: SchedulerViewMode;
      clearTicketLink?: boolean;
    }) => {
      const href = schedulerHref({
        week: opts.week ?? weekStart,
        select: opts.select ?? undefined,
        view: opts.view ?? viewMode,
        ticket: opts.clearTicketLink ? undefined : linkTicketId ?? undefined,
        vehicle: opts.clearTicketLink ? undefined : linkVehicleId ?? undefined,
        create:
          !opts.clearTicketLink && createMode && linkTicketId ? true : undefined,
      });
      router.replace(href, { scroll: false });
    },
    [router, viewMode, weekStart, linkTicketId, linkVehicleId, createMode],
  );

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

  useEffect(() => {
    const weekParam = searchParams.get("week");
    const parsed = parseSchedulerWeekParam(weekParam);
    if (parsed) {
      setWeekStart(startOfWeekMonday(parsed));
    }
    const select = searchParams.get("select");
    if (select) {
      setSelectedId(select);
      setMobileDetail(true);
    }
    const view = searchParams.get("view");
    if (view === "bands" || view === "grid") {
      setViewMode(view);
    }
  }, [searchParams]);

  const selected = appointments.find((a) => a.id === selectedId) ?? null;

  const reschedule = useCallback(
    async (id: string, scheduledAt: Date) => {
      const res = await fetch(`${appointmentsBrowserBase}/${id}`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({ scheduledAt: scheduledAt.toISOString() }),
      });
      if (!res.ok) return;
      await load();
    },
    [load],
  );

  const setAppointmentStatus = useCallback(
    async (id: string, status: "confirmed" | "cancelled") => {
      const res = await fetch(`${appointmentsBrowserBase}/${id}`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({ status }),
      });
      if (!res.ok) return;
      await load();
    },
    [load],
  );

  function toggleSupplier(id: string) {
    setSupplierFilter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function selectAppointment(id: string) {
    setSelectedId(id);
    setCreateMode(false);
    setMobileDetail(true);
    syncUrl({ select: id, clearTicketLink: true });
  }

  function goToday() {
    const w = startOfWeekMonday(new Date());
    setWeekStart(w);
    syncUrl({ week: w, select: selectedId });
  }

  function shiftWeek(delta: number) {
    setWeekStart((w) => {
      const next = addDays(w, delta * 7);
      syncUrl({ week: next, select: selectedId });
      return next;
    });
  }

  function setView(mode: SchedulerViewMode) {
    setViewMode(mode);
    syncUrl({ view: mode, select: selectedId });
  }

  function openCreateAt(when: Date) {
    setCreatePrefillAt(toDatetimeLocalValue(when.toISOString()));
    setCreateMode(true);
    setSelectedId(null);
    setMobileDetail(true);
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
          <div className="hidden items-center rounded-lg border border-zinc-700 p-0.5 lg:flex">
            <button
              type="button"
              onClick={() => setView("grid")}
              className={`rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-wide ${
                viewMode === "grid" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Grilă
            </button>
            <button
              type="button"
              onClick={() => setView("bands")}
              className={`rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-wide ${
                viewMode === "bands" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Benzi
            </button>
          </div>
          <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500 lg:hidden">
            Agendă
          </span>
          {canWrite ? (
            <button
              type="button"
              onClick={() => {
                setCreatePrefillAt(undefined);
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
          suppliers={visibleSuppliers}
          serviceTypes={serviceTypes}
          serviceTypeCode={serviceTypeCode}
          onServiceTypeChange={setServiceTypeCode}
          selectedIds={supplierFilter}
          onToggle={toggleSupplier}
          weekLabel={weekLabel}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          {loading ? (
            <p className="p-6 text-sm text-zinc-500">Se încarcă programările…</p>
          ) : (
            <>
              {viewMode === "grid" ? (
                <SchedulerWeekView
                  weekStart={weekStart}
                  appointments={appointments}
                  selectedId={selectedId}
                  canWrite={canWrite}
                  onSelect={selectAppointment}
                  onReschedule={canWrite ? reschedule : undefined}
                  onSlotClick={canWrite ? openCreateAt : undefined}
                  onStatusChange={canWrite ? setAppointmentStatus : undefined}
                />
              ) : (
                <SchedulerSupplierBandView
                  weekStart={weekStart}
                  appointments={appointments}
                  suppliers={suppliers}
                  supplierFilter={supplierFilter}
                  selectedId={selectedId}
                  onSelect={selectAppointment}
                />
              )}
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
              if (linkTicketId) syncUrl({ clearTicketLink: true });
            }}
            onUpdated={() => {
              void load();
              if (linkTicketId) {
                setCreateMode(false);
                syncUrl({ clearTicketLink: true });
              }
            }}
            vehicles={vehicles}
            initialCreateScheduledAt={createPrefillAt}
            linkTicketId={linkTicketId}
            initialVehicleId={linkVehicleId ?? undefined}
            serviceTypeCode={serviceTypeCode || undefined}
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
            setCreatePrefillAt(undefined);
            if (linkTicketId) syncUrl({ clearTicketLink: true });
          }}
          onCancelCreate={() => {
            setCreateMode(false);
            setMobileDetail(false);
            setCreatePrefillAt(undefined);
            if (linkTicketId) syncUrl({ clearTicketLink: true });
          }}
          onUpdated={() => {
            void load();
            if (linkTicketId) {
              setCreateMode(false);
              setCreatePrefillAt(undefined);
              syncUrl({ clearTicketLink: true });
            }
          }}
          vehicles={vehicles}
          initialCreateScheduledAt={createPrefillAt}
          linkTicketId={linkTicketId}
          initialVehicleId={linkVehicleId ?? undefined}
          serviceTypeCode={serviceTypeCode || undefined}
        />
      ) : null}
    </div>
  );
}
