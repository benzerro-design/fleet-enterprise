"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  appointmentFleetCanRepropose,
  appointmentHasSlot,
  appointmentNegotiateOpts,
  appointmentProtocolBlocksSilentSlotEdit,
  appointmentsBrowserBase,
  type AppointmentStats,
  type AppointmentStatus,
  type CalendarAppointment,
  type SlottedCalendarAppointment,
} from "@/lib/appointments-api";
import { fleetJsonHeaders } from "@/lib/fleet-api";
import { serviceCasesBrowserBase } from "@/lib/service-cases-api";
import {
  schedulerHref,
  schedulerOpensInReschedulePick,
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
  /** Tenant admin: poate valida în locul furnizorului (UI flotă). Partenerul are mereu via partnerMode. */
  canSupplierValidate?: boolean;
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
  /** Deep-link din tichet «Propune altă dată/oră» — click pe slot nu deschide programare nouă. */
  initialReschedule?: boolean;
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
        a.status === "pending_fleet_peer" ||
        a.status === "needs_repropose" ||
        a.status === "scheduled",
    );
  }
  return items.filter((a) => a.status === inbox);
}

/** Statusuri pentru coada de inbox (listă ±365z, nu săptămâna calendarului). */
function inboxStatusesForFilter(inbox: SchedulerInboxFilter): AppointmentStatus[] | null {
  if (inbox === "all") return null;
  if (inbox === "action") {
    return ["pending_supplier", "pending_fleet_peer", "needs_repropose", "scheduled"];
  }
  return [inbox];
}

function supplierIdsFromExtraSearch(extraSearch?: string): string[] {
  if (!extraSearch?.trim()) return [];
  const p = new URLSearchParams(extraSearch);
  const multi = p.get("suppliers")?.trim();
  if (multi) {
    return multi
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const one = p.get("supplierId")?.trim();
  return one ? [one] : [];
}

function applyCalendarSupplierParams(
  params: URLSearchParams,
  opts: { extraSearch?: string; supplierFilter: string[]; suppliersTotal: number },
) {
  const fromExtra = supplierIdsFromExtraSearch(opts.extraSearch);
  if (fromExtra.length > 0) {
    params.set("supplierIds", fromExtra.join(","));
    return;
  }
  if (
    opts.supplierFilter.length > 0 &&
    opts.supplierFilter.length < opts.suppliersTotal
  ) {
    params.set("supplierIds", opts.supplierFilter.join(","));
  }
}

const INBOX_RANGE_DAYS = 365;

export function SchedulerShell({
  canWrite,
  canSupplierValidate = false,
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
  initialReschedule = false,
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
  /** Coadă inbox (KPI) — fără fereastră de săptămână; calendarul rămâne pe `appointments`. */
  const [inboxAppointments, setInboxAppointments] = useState<CalendarAppointment[]>([]);
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
  const opensInReschedulePick = schedulerOpensInReschedulePick({
    canWrite,
    selectId: initialSelectId,
    reschedule: initialReschedule,
    create: initialCreate,
  });
  const [createMode, setCreateMode] = useState(
    () =>
      !opensInReschedulePick &&
      !!(initialCreate && canWrite && (initialTicketId || initialVehicleId || initialServiceCaseId)),
  );
  const [mobileDetail, setMobileDetail] = useState(opensInReschedulePick);
  const [isMobile, setIsMobile] = useState(false);
  /** Repropunere / edit interval — click pe slot umple data, nu deschide programare nouă. */
  const [rescheduleEditing, setRescheduleEditing] = useState(opensInReschedulePick);
  const [reschedulePickAt, setReschedulePickAt] = useState<string | undefined>();
  /** Deschide inspectorul în modul „propune altă dată” (listă partener). */
  const [proposeRescheduleForId, setProposeRescheduleForId] = useState<string | null>(
    () => (opensInReschedulePick && initialSelectId ? initialSelectId : null),
  );

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
  const allowSupplierValidate = canWrite && (partnerMode || canSupplierValidate);

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
      reschedule?: boolean;
    }) => {
      const selectId = opts.select === undefined ? selectedId : opts.select;
      const inReschedulePick =
        opts.reschedule !== undefined ? opts.reschedule : !!(rescheduleEditing && selectId);
      const href = schedulerHref({
        basePath,
        extraSearch,
        week: opts.week ?? weekStart,
        select: selectId ?? undefined,
        view: opts.view ?? viewMode,
        inbox: opts.inbox ?? inboxFilter,
        ticket: opts.clearTicketLink && !returnTicketId ? undefined : linkTicketId ?? returnTicketId ?? undefined,
        vehicle: opts.clearTicketLink && !returnTicketId ? undefined : linkVehicleId ?? undefined,
        reg: opts.clearTicketLink && !returnTicketId ? undefined : linkVehicleLabel ?? undefined,
        case: opts.clearTicketLink && !returnTicketId ? undefined : linkServiceCaseId ?? undefined,
        create:
          !inReschedulePick &&
          !opts.clearTicketLink &&
          createMode &&
          (linkTicketId || linkVehicleId || linkServiceCaseId)
            ? true
            : undefined,
        reschedule: !!(inReschedulePick && selectId),
        returnToTicket: !!returnTicketId,
      });
      window.history.replaceState(null, "", href);
    },
    [
      basePath,
      extraSearch,
      weekStart,
      viewMode,
      inboxFilter,
      linkTicketId,
      linkVehicleId,
      linkVehicleLabel,
      linkServiceCaseId,
      createMode,
      returnTicketId,
      selectedId,
      rescheduleEditing,
    ],
  );

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setInitialLoading(true);
      try {
        const params = new URLSearchParams({ from: range.from, to: range.to });
        applyCalendarSupplierParams(params, {
          extraSearch,
          supplierFilter,
          suppliersTotal: suppliers.length,
        });
        const statsParams = extraSearch ? `?${extraSearch}` : "";
        const inboxStatuses = inboxStatusesForFilter(inboxFilter);
        const inboxFetches =
          inboxStatuses?.map((status) => {
            const inboxParams = new URLSearchParams({
              from: new Date(Date.now() - INBOX_RANGE_DAYS * 24 * 60 * 60 * 1000).toISOString(),
              to: new Date(Date.now() + INBOX_RANGE_DAYS * 24 * 60 * 60 * 1000).toISOString(),
              status,
            });
            applyCalendarSupplierParams(inboxParams, {
              extraSearch,
              supplierFilter,
              suppliersTotal: suppliers.length,
            });
            return fetch(`${appointmentsBrowserBase}/calendar?${inboxParams.toString()}`);
          }) ?? [];

        const [calRes, statsRes, ...inboxResList] = await Promise.all([
          fetch(`${appointmentsBrowserBase}/calendar?${params.toString()}`),
          fetch(`${appointmentsBrowserBase}/stats${statsParams}`),
          ...inboxFetches,
        ]);
        if (calRes.ok) {
          setAppointments((await calRes.json()) as CalendarAppointment[]);
        }
        if (statsRes.ok) {
          setStats((await statsRes.json()) as AppointmentStats);
        }
        if (inboxStatuses) {
          const byId = new Map<string, CalendarAppointment>();
          for (const res of inboxResList) {
            if (!res.ok) continue;
            const rows = (await res.json()) as CalendarAppointment[];
            for (const row of rows) byId.set(row.id, row);
          }
          setInboxAppointments(Array.from(byId.values()));
        } else {
          setInboxAppointments([]);
        }
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    [range.from, range.to, supplierFilter, suppliers.length, extraSearch, inboxFilter],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  /** Deep-link / select din coadă: sare calendarul la săptămâna slotului.
   *  Nu în pick-mode (Propune altă dată/oră) — altfel săgețile săptămână se blochează (UAT-052). */
  useEffect(() => {
    if (!selectedId || initialLoading) return;
    if (rescheduleEditing || proposeRescheduleForId) return;
    if (appointments.some((a) => a.id === selectedId)) return;
    const row = inboxAppointments.find((a) => a.id === selectedId);
    if (!row?.scheduledAt) return;
    const week = startOfWeekMonday(new Date(row.scheduledAt));
    if (Number.isNaN(week.getTime()) || week.getTime() === weekStart.getTime()) return;
    setWeekStart(week);
    syncUrlHistory({ week, select: selectedId });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- doar când lipsește din săptămâna curentă
  }, [selectedId, appointments, inboxAppointments, initialLoading, rescheduleEditing, proposeRescheduleForId]);

  const filteredAppointments = useMemo(() => {
    if (inboxFilter === "all") return appointments;
    return filterByInbox(inboxAppointments, inboxFilter);
  }, [appointments, inboxAppointments, inboxFilter]);
  /** Grila/agenda = săptămâna curentă. Lista din inbox = coadă all-time (±365z). */
  const slottedAppointments = useMemo(
    () =>
      appointments.filter((a): a is SlottedCalendarAppointment =>
        appointmentHasSlot(a.scheduledAt),
      ),
    [appointments],
  );

  const findAppointment = useCallback(
    (id: string) =>
      appointments.find((a) => a.id === id) ?? inboxAppointments.find((a) => a.id === id) ?? null,
    [appointments, inboxAppointments],
  );

  const selected = selectedId ? findAppointment(selectedId) : null;
  const slotClickMode =
    rescheduleEditing && selectedId
      ? selected && !appointmentHasSlot(selected.scheduledAt)
        ? "propose"
        : "reschedule"
      : "create";

  const reschedule = useCallback(
    async (id: string, scheduledAt: Date) => {
      const row = findAppointment(id);
      if (!row) return;

      if (
        partnerMode &&
        (row.status === "pending_supplier" || row.status === "needs_repropose")
      ) {
        const res = await fetch(
          `${serviceCasesBrowserBase}/appointments/${id}/supplier-validate`,
          {
            method: "POST",
            headers: fleetJsonHeaders(),
            body: JSON.stringify({ scheduledAt: scheduledAt.toISOString() }),
          },
        );
        if (!res.ok) return;
        await load(true);
        return;
      }

      if (!partnerMode && appointmentFleetCanRepropose(row, appointmentNegotiateOpts(row))) {
        const res = await fetch(`${serviceCasesBrowserBase}/appointments/${id}/repropose`, {
          method: "POST",
          headers: fleetJsonHeaders(),
          body: JSON.stringify({ scheduledAt: scheduledAt.toISOString() }),
        });
        if (!res.ok) return;
        await load(true);
        return;
      }

      if (appointmentProtocolBlocksSilentSlotEdit(row)) {
        return;
      }

      const res = await fetch(`${appointmentsBrowserBase}/${id}`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({ scheduledAt: scheduledAt.toISOString() }),
      });
      if (!res.ok) return;
      await load(true);
    },
    [findAppointment, load, partnerMode],
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
      const row = findAppointment(id);
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
      revealProposedAppointment(row?.scheduledAt ?? null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- proposeAlternateDate / revealProposedAppointment are local fns
    [findAppointment, load],
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
    syncUrlHistory({ select: null, clearTicketLink: true, reschedule: false });
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
    const row = findAppointment(id);
    if (row?.scheduledAt) {
      const week = startOfWeekMonday(new Date(row.scheduledAt));
      if (!Number.isNaN(week.getTime()) && week.getTime() !== weekStart.getTime()) {
        setWeekStart(week);
        syncUrlHistory({
          week,
          select: id,
          clearTicketLink: !returnTicketId,
          reschedule: false,
        });
        return;
      }
    }
    syncUrlHistory({ select: id, clearTicketLink: !returnTicketId, reschedule: false });
  }

  function proposeAlternateDate(id: string) {
    setSelectedId(id);
    setCreateMode(false);
    setRescheduleEditing(true);
    setReschedulePickAt(undefined);
    setProposeRescheduleForId(id);
    if (isMobile) setMobileDetail(true);
    const row = findAppointment(id);
    if (row?.scheduledAt) {
      const week = startOfWeekMonday(new Date(row.scheduledAt));
      if (!Number.isNaN(week.getTime()) && week.getTime() !== weekStart.getTime()) {
        setWeekStart(week);
        syncUrlHistory({
          week,
          select: id,
          clearTicketLink: !returnTicketId,
          reschedule: true,
        });
        return;
      }
    }
    syncUrlHistory({ select: id, clearTicketLink: !returnTicketId, reschedule: true });
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

  function revealProposedAppointment(scheduledAt: string | null) {
    setInboxFilter("scheduled");
    if (scheduledAt) {
      const week = startOfWeekMonday(new Date(scheduledAt));
      if (!Number.isNaN(week.getTime())) {
        setWeekStart(week);
        syncUrlHistory({ inbox: "scheduled", week, select: selectedId });
        return;
      }
    }
    syncUrlHistory({ inbox: "scheduled", select: selectedId });
  }

  function openCreateAt(when: Date) {
    setCreatePrefillAt(toDatetimeLocalValue(when.toISOString()));
    setCreateMode(true);
    setSelectedId(null);
    setRescheduleEditing(false);
    setReschedulePickAt(undefined);
    setProposeRescheduleForId(null);
    if (isMobile) setMobileDetail(true);
    syncUrlHistory({ select: null, clearTicketLink: !keepCaseLink, reschedule: false });
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
              Listă programări
              {inboxFilter !== "all" ? " · coadă" : ""}
              {refreshing ? " · actualizare…" : ""}
              {inboxFilter !== "all" && filteredAppointments.length > 0
                ? ` · ${filteredAppointments.length}`
                : ""}
            </p>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <AppointmentQueueList
                appointments={filteredAppointments}
                selectedId={selectedId}
                canWrite={canWrite}
                onSelect={selectAppointment}
                onConfirm={canWrite ? (id) => void setAppointmentStatus(id, "confirmed") : undefined}
                onCancel={canWrite ? (id) => void setAppointmentStatus(id, "cancelled") : undefined}
                onSupplierValidate={
                  allowSupplierValidate ? (id) => void supplierValidateById(id) : undefined
                }
                onRequestCancel={
                  canWrite && partnerMode ? (id) => void requestCancelById(id) : undefined
                }
                onProposeReschedule={canWrite ? (id) => proposeAlternateDate(id) : undefined}
                partnerMode={partnerMode}
                compact
                emptyHint={
                  inboxFilter !== "all"
                    ? "Nicio programare în coadă (toate săptămânile)."
                    : undefined
                }
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
              slotClickMode={slotClickMode}
              onStatusChange={canWrite ? setAppointmentStatus : undefined}
              onSupplierValidate={
                allowSupplierValidate ? supplierValidateById : undefined
              }
              onRequestCancel={canWrite && partnerMode ? requestCancelById : undefined}
              onProposeReschedule={canWrite ? proposeAlternateDate : undefined}
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
          slotClickMode={slotClickMode}
          onStatusChange={canWrite ? setAppointmentStatus : undefined}
          onSupplierValidate={
            allowSupplierValidate ? supplierValidateById : undefined
          }
          onRequestCancel={canWrite && partnerMode ? requestCancelById : undefined}
          onProposeReschedule={canWrite ? proposeAlternateDate : undefined}
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
            onSupplierValidate={
              allowSupplierValidate ? (id) => void supplierValidateById(id) : undefined
            }
            onRequestCancel={
              canWrite && partnerMode ? (id) => void requestCancelById(id) : undefined
            }
            onProposeReschedule={canWrite ? (id) => proposeAlternateDate(id) : undefined}
            partnerMode={partnerMode}
            emptyHint={
              inboxFilter !== "all"
                ? "Nicio programare în coadă (toate săptămânile)."
                : undefined
            }
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
                syncUrlHistory({ select: null, clearTicketLink: !keepCaseLink, reschedule: false });
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
            canSupplierValidate={allowSupplierValidate}
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
            onAfterSupplierPropose={revealProposedAppointment}
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
          canSupplierValidate={allowSupplierValidate}
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
          onAfterSupplierPropose={revealProposedAppointment}
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
