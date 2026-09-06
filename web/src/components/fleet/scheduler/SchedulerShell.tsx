"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  appointmentHasSlot,
  appointmentsBrowserBase,
  type AppointmentStats,
  type CalendarAppointment,
  type SlottedCalendarAppointment,
} from "@/lib/appointments-api";
import { fleetJsonHeaders } from "@/lib/fleet-api";
import { serviceCasesBrowserBase } from "@/lib/service-cases-api";
import {
  schedulerHref,
  type SchedulerInboxFilter,
  type SchedulerViewMode,
} from "@/lib/scheduler-deep-link";
import {
  addDays,
  calendarRangeIso,
  formatWeekRange,
  startOfWeekMonday,
  toDatetimeLocalValue,
} from "@/lib/scheduler-date-utils";
import { AppointmentQueueList } from "./AppointmentQueueList";
import { SchedulerAgendaView } from "./SchedulerAgendaView";
import { SchedulerInspector } from "./SchedulerInspector";
import { SchedulerKpiStrip, SchedulerStatusLegend } from "./SchedulerKpiStrip";
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
  initialInbox?: SchedulerInboxFilter;
  initialTicketId?: string;
  initialVehicleId?: string;
  initialVehicleLabel?: string;
  initialServiceCaseId?: string;
  initialSupplierId?: string;
  initialCreate?: boolean;
  /** După repropunere / reprogramare, navighează înapoi la tichet. */
  returnToTicket?: boolean;
  basePath?: string;
  extraSearch?: string;
  partnerMode?: boolean;
};

function filterByInbox(items: CalendarAppointment[], inbox: SchedulerInboxFilter): CalendarAppointment[] {
  if (inbox === "all") return items;
  if (inbox === "action") {
    return items.filter(
      (a) =>
        a.status === "pending_supplier" ||
        a.status === "needs_repropose" ||
        a.status === "scheduled",
    );
  }
  return items.filter((a) => a.status === inbox);
}

export function SchedulerShell({
  canWrite,
  initialStats,
  suppliers,
  serviceTypes = [],
  vehicles,
  initialWeekIso,
  initialSelectId,
  initialViewMode = "split",
  initialInbox = "all",
  initialTicketId,
  initialVehicleId,
  initialVehicleLabel,
  initialServiceCaseId,
  initialSupplierId,
  initialCreate = false,
  returnToTicket = false,
  basePath = "/fleet/scheduler",
  extraSearch,
  partnerMode = false,
}: Props) {
  const router = useRouter();
  const [weekStart, setWeekStart] = useState(() => {
    const parsed = initialWeekIso ? new Date(initialWeekIso) : null;
    return parsed && !Number.isNaN(parsed.getTime())
      ? startOfWeekMonday(parsed)
      : startOfWeekMonday(new Date());
  });
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [stats, setStats] = useState<AppointmentStats | null>(initialStats);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectId ?? null);
  const [supplierFilter, setSupplierFilter] = useState<string[]>(() => suppliers.map((s) => s.id));
  const [serviceTypeCode, setServiceTypeCode] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<SchedulerViewMode>(initialViewMode);
  const [inboxFilter, setInboxFilter] = useState<SchedulerInboxFilter>(initialInbox);
  const [createPrefillAt, setCreatePrefillAt] = useState<string | undefined>();
  const [linkTicketId] = useState(initialTicketId ?? null);
  const [linkVehicleId] = useState(initialVehicleId ?? null);
  const [linkVehicleLabel] = useState(initialVehicleLabel ?? null);
  const [linkServiceCaseId] = useState(initialServiceCaseId ?? null);
  const [returnTicketId] = useState(() =>
    returnToTicket && initialTicketId ? initialTicketId : null,
  );
  const [createMode, setCreateMode] = useState(
    () => !!(initialCreate && canWrite && (initialTicketId || initialVehicleId || initialServiceCaseId)),
  );
  const [mobileDetail, setMobileDetail] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  /** Repropunere / edit interval — click pe slot umple data, nu deschide programare nouă. */
  const [rescheduleEditing, setRescheduleEditing] = useState(false);
  const [reschedulePickAt, setReschedulePickAt] = useState<string | undefined>();
  /** Deschide inspectorul în modul „propune altă dată” (listă partener). */
  const [proposeRescheduleForId, setProposeRescheduleForId] = useState<string | null>(null);

  const visibleSuppliers = useMemo(() => {
    if (!serviceTypeCode) return suppliers;
    return suppliers.filter((s) => s.services?.includes(serviceTypeCode));
  }, [suppliers, serviceTypeCode]);

  const keepCaseLink = !!(linkTicketId || linkVehicleId || linkServiceCaseId);
  const vehiclesForCreate = useMemo(() => {
    if (!linkVehicleId) return vehicles;
    if (vehicles.some((v) => v.id === linkVehicleId)) return vehicles;
    return [
      {
        id: linkVehicleId,
        registrationNumber: linkVehicleLabel || "Vehicul dosar",
        clientId: "",
      },
      ...vehicles,
    ];
  }, [vehicles, linkVehicleId, linkVehicleLabel]);
  const partnerSupplier = partnerMode && suppliers.length > 0 ? suppliers[0] : undefined;

  useEffect(() => {
    setSupplierFilter(visibleSuppliers.map((s) => s.id));
  }, [serviceTypeCode, visibleSuppliers]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const weekLabel = useMemo(() => formatWeekRange(weekStart), [weekStart]);
  const range = useMemo(() => calendarRangeIso(weekStart), [weekStart]);

  const syncUrlHistory = useCallback(
    (opts: {
      week?: Date;
      select?: string | null;
      view?: SchedulerViewMode;
      inbox?: SchedulerInboxFilter;
      clearTicketLink?: boolean;
    }) => {
      const href = schedulerHref({
        basePath,
        extraSearch,
        week: opts.week ?? weekStart,
        select: opts.select ?? undefined,
        view: opts.view ?? viewMode,
        inbox: opts.inbox ?? inboxFilter,
        ticket: opts.clearTicketLink && !returnTicketId ? undefined : linkTicketId ?? returnTicketId ?? undefined,
        vehicle: opts.clearTicketLink && !returnTicketId ? undefined : linkVehicleId ?? undefined,
        reg: opts.clearTicketLink && !returnTicketId ? undefined : linkVehicleLabel ?? undefined,
        case: opts.clearTicketLink && !returnTicketId ? undefined : linkServiceCaseId ?? undefined,
        create:
          !opts.clearTicketLink && createMode && (linkTicketId || linkVehicleId || linkServiceCaseId)
            ? true
            : undefined,
        returnToTicket: !!returnTicketId,
      });
      window.history.replaceState(null, "", href);
    },
    [basePath, extraSearch, weekStart, viewMode, inboxFilter, linkTicketId, linkVehicleId, linkVehicleLabel, linkServiceCaseId, createMode, returnTicketId],
  );

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setInitialLoading(true);
      try {
        const params = new URLSearchParams({ from: range.from, to: range.to });
        if (supplierFilter.length > 0 && supplierFilter.length < suppliers.length) {
          params.set("supplierIds", supplierFilter.join(","));
        }
        const statsParams = extraSearch ? `?${extraSearch}` : "";
        const [calRes, statsRes] = await Promise.all([
          fetch(`${appointmentsBrowserBase}/calendar?${params.toString()}`),
          fetch(`${appointmentsBrowserBase}/stats${statsParams}`),
        ]);
        if (calRes.ok) {
          setAppointments((await calRes.json()) as CalendarAppointment[]);
        }
        if (statsRes.ok) {
          setStats((await statsRes.json()) as AppointmentStats);
        }
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    [range.from, range.to, supplierFilter, suppliers.length, extraSearch],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const filteredAppointments = useMemo(
    () => filterByInbox(appointments, inboxFilter),
    [appointments, inboxFilter],
  );
  const slottedAppointments = useMemo(
    () =>
      filteredAppointments.filter((a): a is SlottedCalendarAppointment =>
        appointmentHasSlot(a.scheduledAt),
      ),
    [filteredAppointments],
  );

  const selected = appointments.find((a) => a.id === selectedId) ?? null;

  const reschedule = useCallback(
    async (id: string, scheduledAt: Date) => {
      const res = await fetch(`${appointmentsBrowserBase}/${id}`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({ scheduledAt: scheduledAt.toISOString() }),
      });
      if (!res.ok) return;
      await load(true);
    },
    [load],
  );

  const setAppointmentStatus = useCallback(
    async (id: string, status: "confirmed" | "cancelled") => {
      if (status === "confirmed") {
        const res = await fetch(`${serviceCasesBrowserBase}/appointments/${id}/confirm`, {
          method: "POST",
          headers: fleetJsonHeaders(),
        });
        if (!res.ok) return;
      } else {
        const res = await fetch(`${appointmentsBrowserBase}/${id}`, {
          method: "PATCH",
          headers: fleetJsonHeaders(),
          body: JSON.stringify({ status }),
        });
        if (!res.ok) return;
      }
      await load(true);
    },
    [load],
  );

  const supplierValidateById = useCallback(
    async (id: string) => {
      const row = appointments.find((a) => a.id === id);
      if (row && !appointmentHasSlot(row.scheduledAt)) {
        proposeAlternateDate(id);
        return;
      }
      const res = await fetch(`${serviceCasesBrowserBase}/appointments/${id}/supplier-validate`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({}),
      });
      if (!res.ok) return;
      await load(true);
    },
    [appointments, load],
  );

  const requestCancelById = useCallback(
    async (id: string) => {
      const res = await fetch(`${serviceCasesBrowserBase}/appointments/${id}/request-cancel`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({}),
      });
      if (!res.ok) return;
      await load(true);
    },
    [load],
  );

  function toggleSupplier(id: string) {
    setSupplierFilter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function clearSelection() {
    setSelectedId(null);
    setCreateMode(false);
    setRescheduleEditing(false);
    setReschedulePickAt(undefined);
    setProposeRescheduleForId(null);
    setCreatePrefillAt(undefined);
    setMobileDetail(false);
    syncUrlHistory({ select: null, clearTicketLink: true });
  }

  function selectAppointment(id: string) {
    if (selectedId === id) {
      clearSelection();
      return;
    }
    setSelectedId(id);
    setCreateMode(false);
    setRescheduleEditing(false);
    setReschedulePickAt(undefined);
    setProposeRescheduleForId(null);
    if (isMobile) setMobileDetail(true);
    syncUrlHistory({ select: id, clearTicketLink: !returnTicketId });
  }

  function proposeAlternateDate(id: string) {
    setSelectedId(id);
    setCreateMode(false);
    setRescheduleEditing(true);
    setReschedulePickAt(undefined);
    setProposeRescheduleForId(id);
    if (isMobile) setMobileDetail(true);
    syncUrlHistory({ select: id, clearTicketLink: !returnTicketId });
  }

  function goBackToTicket() {
    if (!returnTicketId) return;
    router.push(`/fleet/tickets/${returnTicketId}`);
  }

  function goToday() {
    const w = startOfWeekMonday(new Date());
    setWeekStart(w);
    syncUrlHistory({ week: w, select: selectedId });
  }

  function shiftWeek(delta: number) {
    setWeekStart((w) => {
      const next = addDays(w, delta * 7);
      syncUrlHistory({ week: next, select: selectedId });
      return next;
    });
  }

  function setView(mode: SchedulerViewMode) {
    setViewMode(mode);
    syncUrlHistory({ view: mode, select: selectedId });
  }

  function setInbox(inbox: SchedulerInboxFilter) {
    setInboxFilter(inbox);
    syncUrlHistory({ inbox, select: selectedId });
  }

  function openCreateAt(when: Date) {
    setCreatePrefillAt(toDatetimeLocalValue(when.toISOString()));
    setCreateMode(true);
    setSelectedId(null);
    setRescheduleEditing(false);
    setReschedulePickAt(undefined);
    if (isMobile) setMobileDetail(true);
    syncUrlHistory({ select: null, clearTicketLink: !keepCaseLink });
  }

  function handleSlotClick(when: Date) {
    if (rescheduleEditing && selectedId) {
      setReschedulePickAt(toDatetimeLocalValue(when.toISOString()));
      return;
    }
    openCreateAt(when);
  }

  const showMobileInspector = isMobile && mobileDetail && (selected || createMode);

  const calendarBlock = (
    <>
      {viewMode === "split" ? (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="flex min-h-0 w-full flex-col border-b border-zinc-800 lg:w-1/2 lg:border-b-0 lg:border-r">
            <p className="border-b border-zinc-800/80 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Listă programări {refreshing ? "· actualizare…" : ""}
            </p>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <AppointmentQueueList
                appointments={filteredAppointments}
                selectedId={selectedId}
                canWrite={canWrite}
                onSelect={selectAppointment}
                onConfirm={canWrite ? (id) => void setAppointmentStatus(id, "confirmed") : undefined}
                onCancel={canWrite ? (id) => void setAppointmentStatus(id, "cancelled") : undefined}
                onSupplierValidate={canWrite ? (id) => void supplierValidateById(id) : undefined}
                onRequestCancel={
                  canWrite && partnerMode ? (id) => void requestCancelById(id) : undefined
                }
                onProposeReschedule={
                  canWrite && partnerMode ? (id) => proposeAlternateDate(id) : undefined
                }
                partnerMode={partnerMode}
                compact
              />
            </div>
          </div>
          <div className="hidden min-h-0 w-full flex-1 lg:flex lg:w-1/2 lg:flex-col">
            <SchedulerWeekView
              weekStart={weekStart}
              appointments={slottedAppointments}
              selectedId={selectedId}
              canWrite={canWrite}
              partnerMode={partnerMode}
              onSelect={selectAppointment}
              onDeselect={clearSelection}
              onReschedule={canWrite ? reschedule : undefined}
              onSlotClick={canWrite ? handleSlotClick : undefined}
              slotClickMode={rescheduleEditing && selectedId ? "reschedule" : "create"}
              onStatusChange={canWrite ? setAppointmentStatus : undefined}
              onSupplierValidate={canWrite ? supplierValidateById : undefined}
              onRequestCancel={canWrite && partnerMode ? requestCancelById : undefined}
            />
          </div>
        </div>
      ) : null}
      {viewMode === "grid" ? (
        <SchedulerWeekView
          weekStart={weekStart}
          appointments={slottedAppointments}
          selectedId={selectedId}
          canWrite={canWrite}
          partnerMode={partnerMode}
          onSelect={selectAppointment}
          onDeselect={clearSelection}
          onReschedule={canWrite ? reschedule : undefined}
          onSlotClick={canWrite ? handleSlotClick : undefined}
          slotClickMode={rescheduleEditing && selectedId ? "reschedule" : "create"}
          onStatusChange={canWrite ? setAppointmentStatus : undefined}
          onSupplierValidate={canWrite ? supplierValidateById : undefined}
          onRequestCancel={canWrite && partnerMode ? requestCancelById : undefined}
        />
      ) : null}
      {viewMode === "bands" ? (
        <SchedulerSupplierBandView
          weekStart={weekStart}
          appointments={slottedAppointments}
          suppliers={suppliers}
          supplierFilter={supplierFilter}
          selectedId={selectedId}
          onSelect={selectAppointment}
        />
      ) : null}
      {viewMode === "list" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <AppointmentQueueList
            appointments={filteredAppointments}
            selectedId={selectedId}
            canWrite={canWrite}
            onSelect={selectAppointment}
            onConfirm={canWrite ? (id) => void setAppointmentStatus(id, "confirmed") : undefined}
            onCancel={canWrite ? (id) => void setAppointmentStatus(id, "cancelled") : undefined}
            onSupplierValidate={canWrite ? (id) => void supplierValidateById(id) : undefined}
            onRequestCancel={
              canWrite && partnerMode ? (id) => void requestCancelById(id) : undefined
            }
            onProposeReschedule={
              canWrite && partnerMode ? (id) => proposeAlternateDate(id) : undefined
            }
            partnerMode={partnerMode}
          />
        </div>
      ) : null}
      <SchedulerAgendaView
        weekStart={weekStart}
        appointments={slottedAppointments}
        selectedId={selectedId}
        partnerMode={partnerMode}
        onSelect={selectAppointment}
      />
    </>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-zinc-800 px-3 py-3 lg:px-4">
        <SchedulerKpiStrip
          stats={stats}
          activeInbox={inboxFilter}
          onInboxChange={setInbox}
          partnerMode={partnerMode}
        />
      </div>

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
            {(
              [
                ["split", "Split"],
                ["grid", "Calendar"],
                ["bands", "Benzi"],
                ["list", "Listă"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                className={`rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-wide ${
                  viewMode === mode ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {canWrite && (!partnerMode || keepCaseLink) ? (
            <button
              type="button"
              onClick={() => {
                setCreatePrefillAt(undefined);
                setCreateMode(true);
                setSelectedId(null);
                setRescheduleEditing(false);
                setReschedulePickAt(undefined);
                setProposeRescheduleForId(null);
                if (isMobile) setMobileDetail(true);
                syncUrlHistory({ select: null, clearTicketLink: !keepCaseLink });
              }}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
            >
              + Programare
            </button>
          ) : null}
        </div>
      </div>

      <SchedulerStatusLegend />

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

        <div className="relative flex min-w-0 flex-1 flex-col">
          {initialLoading ? (
            <p className="p-6 text-sm text-zinc-500">Se încarcă programările…</p>
          ) : (
            calendarBlock
          )}
        </div>

        {!isMobile ? (
          <SchedulerInspector
            appointment={selected}
            canWrite={canWrite}
            createMode={createMode}
            partnerMode={partnerMode}
            openInRescheduleMode={proposeRescheduleForId === selected?.id}
            onClose={clearSelection}
            onRescheduleEditingChange={setRescheduleEditing}
            calendarPickAt={reschedulePickAt}
            onCalendarPickConsumed={() => setReschedulePickAt(undefined)}
            onCancelCreate={() => {
              setCreateMode(false);
              setMobileDetail(false);
              setCreatePrefillAt(undefined);
              syncUrlHistory({ clearTicketLink: !returnTicketId });
            }}
            onUpdated={() => {
              void load(true);
              setRescheduleEditing(false);
              setReschedulePickAt(undefined);
              setProposeRescheduleForId(null);
              if (linkTicketId && !returnTicketId) {
                setCreateMode(false);
                syncUrlHistory({ clearTicketLink: true });
              }
            }}
            onReturnToTicket={returnTicketId ? goBackToTicket : undefined}
            returnTicketId={returnTicketId}
            vehicles={vehiclesForCreate}
            initialCreateScheduledAt={createPrefillAt}
            linkTicketId={linkTicketId}
            linkServiceCaseId={linkServiceCaseId}
            initialVehicleId={linkVehicleId ?? undefined}
            initialVehicleLabel={linkVehicleLabel ?? undefined}
            initialSupplierId={initialSupplierId}
            partnerSupplier={partnerSupplier}
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
          partnerMode={partnerMode}
          openInRescheduleMode={proposeRescheduleForId === selected?.id}
          onClose={clearSelection}
          onRescheduleEditingChange={setRescheduleEditing}
          calendarPickAt={reschedulePickAt}
          onCalendarPickConsumed={() => setReschedulePickAt(undefined)}
          onCancelCreate={() => {
            setCreateMode(false);
            setMobileDetail(false);
            setCreatePrefillAt(undefined);
            syncUrlHistory({ clearTicketLink: !returnTicketId });
          }}
          onUpdated={() => {
            void load(true);
            setRescheduleEditing(false);
            setReschedulePickAt(undefined);
            setProposeRescheduleForId(null);
            if (linkTicketId && !returnTicketId) {
              setCreateMode(false);
              setCreatePrefillAt(undefined);
              syncUrlHistory({ clearTicketLink: true });
            }
          }}
          onReturnToTicket={returnTicketId ? goBackToTicket : undefined}
          returnTicketId={returnTicketId}
          vehicles={vehiclesForCreate}
          initialCreateScheduledAt={createPrefillAt}
          linkTicketId={linkTicketId}
          linkServiceCaseId={linkServiceCaseId}
          initialVehicleId={linkVehicleId ?? undefined}
          initialVehicleLabel={linkVehicleLabel ?? undefined}
          initialSupplierId={initialSupplierId}
          partnerSupplier={partnerSupplier}
          serviceTypeCode={serviceTypeCode || undefined}
        />
      ) : null}
    </div>
  );
}
