"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SupplierCombobox } from "@/components/fleet/SupplierCombobox";
import {
  appointmentStatusLabel,
  formatQuoteMoney,
  quoteStatusLabel,
  serviceCasesBrowserBase,
  fleetJsonHeaders,
  type PostApprovalPath,
  type ServiceCaseRecord,
  type WorkOrderRecord,
} from "@/lib/service-cases-api";
import { workOrdersBrowserBase } from "@/lib/work-orders-api";
import { schedulerHref } from "@/lib/scheduler-deep-link";
import { OPS_INPUT_CLASS, OPS_LABEL_CLASS } from "@/components/fleet/ops-form-primitives";
import { OperationalFlowFork } from "@/components/fleet/tickets/OperationalFlowFork";
import { OperationalStoryTimeline } from "@/components/fleet/tickets/OperationalStoryTimeline";
import { WorkOrderQuoteBillingActions } from "@/components/fleet/work-orders/WorkOrderQuoteBillingActions";
import { buildOperationalChapters } from "@/lib/ticket-operational-story";
import { formatDateRo } from "@/lib/datetime-local";
import { mobilityBrowserBase, type MobilityEligibilityRecord } from "@/lib/mobility-api";
import { roadsideBrowserBase, type RoadsideInterventionRecord } from "@/lib/roadside-api";
import { fleetJsonHeaders as ticketFleetHeaders, ticketsBrowserBase, type TicketLinkRecord } from "@/lib/tickets-api";
import { toDatetimeLocalValue } from "@/lib/scheduler-date-utils";

type Props = {
  ticketId: string;
  vehicleId?: string | null;
  ticketCreatedAt?: string;
  canOperate: boolean;
  canApproveQuote: boolean;
  canConfirmAppointment: boolean;
  canAckAppointment: boolean;
  closed: boolean;
  hasVehicle: boolean;
  ticketLinks?: TicketLinkRecord[];
  onServiceCaseChange?: (record: ServiceCaseRecord | null | undefined) => void;
  compact?: boolean;
};

export function TicketWorkflowStepper({
  ticketId,
  vehicleId,
  ticketCreatedAt,
  canOperate,
  canApproveQuote,
  canConfirmAppointment,
  canAckAppointment,
  closed,
  hasVehicle,
  ticketLinks = [],
  onServiceCaseChange,
  compact = false,
}: Props) {
  const router = useRouter();
  const [serviceCase, setServiceCase] = useState<ServiceCaseRecord | null | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [appointmentLocation, setAppointmentLocation] = useState("");
  const [appointmentNotes, setAppointmentNotes] = useState("");
  const [mobilityEligibility, setMobilityEligibility] = useState<MobilityEligibilityRecord | null>(null);
  const [roadsideItems, setRoadsideItems] = useState<RoadsideInterventionRecord[]>([]);
  const [declineApptId, setDeclineApptId] = useState<string | null>(null);
  const [declineNote, setDeclineNote] = useState("");
  const [reproposeApptId, setReproposeApptId] = useState<string | null>(null);
  const [reproposeAt, setReproposeAt] = useState("");
  const [reproposeNote, setReproposeNote] = useState("");

  const loadMobility = useCallback(async (workOrderId: string) => {
    try {
      const res = await fetch(`${mobilityBrowserBase}/eligibility/${workOrderId}`);
      if (res.ok) {
        setMobilityEligibility((await res.json()) as MobilityEligibilityRecord);
      } else {
        setMobilityEligibility(null);
      }
    } catch {
      setMobilityEligibility(null);
    }
  }, []);

  const loadRoadside = useCallback(async (serviceCaseId: string | null | undefined) => {
    if (!serviceCaseId) {
      setRoadsideItems([]);
      return;
    }
    try {
      const params = new URLSearchParams({ serviceCaseId, pageSize: "50" });
      const res = await fetch(`${roadsideBrowserBase}/interventions?${params}`);
      if (res.ok) {
        const j = (await res.json()) as { items?: RoadsideInterventionRecord[] };
        setRoadsideItems(j.items ?? []);
      } else {
        setRoadsideItems([]);
      }
    } catch {
      setRoadsideItems([]);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${serviceCasesBrowserBase}/by-ticket/${ticketId}`);
      if (res.status === 404) {
        setServiceCase(null);
        setError(null);
        return;
      }
      const raw = await res.text();
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        if (raw.trim()) {
          try {
            const j = JSON.parse(raw) as { message?: string | string[] };
            if (typeof j.message === "string") msg = j.message;
            else if (Array.isArray(j.message)) msg = j.message.join(", ");
          } catch {
            /* ignore */
          }
        }
        setServiceCase(null);
        setError(msg);
        return;
      }
      if (!raw.trim()) {
        setServiceCase(null);
        setError(null);
        return;
      }
      const data = JSON.parse(raw) as ServiceCaseRecord | null;
      setServiceCase(data);
      setError(null);
      if (data?.supplierId) setSupplierId(data.supplierId);
      const woId = data?.workOrders[0]?.id;
      if (woId) void loadMobility(woId);
      else setMobilityEligibility(null);
      void loadRoadside(data?.id);
      onServiceCaseChange?.(data);
    } catch {
      setServiceCase(null);
      setError("Nu s-a putut încărca dosarul lucrare.");
    }
  }, [ticketId, onServiceCaseChange, loadMobility, loadRoadside]);

  useEffect(() => {
    void load();
  }, [load]);

  async function startCase() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${serviceCasesBrowserBase}/from-ticket/${ticketId}`, {
        method: "POST",
        headers: fleetJsonHeaders(),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string | string[] };
          if (typeof j.message === "string") msg = j.message;
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      const data = (await res.json()) as ServiceCaseRecord;
      setServiceCase(data);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function createAppointment() {
    if (!serviceCase) return;
    if (!scheduledAt && !supplierId) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${serviceCasesBrowserBase}/${serviceCase.id}/appointments`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
          supplierId: supplierId || null,
          location: appointmentLocation || null,
          notes: appointmentNotes || null,
        }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string | string[] };
          if (typeof j.message === "string") msg = j.message;
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      await load();
      const woId = serviceCase?.workOrders[0]?.id;
      if (woId) await loadMobility(woId);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function confirmAppointment(appointmentId: string) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(
        `${serviceCasesBrowserBase}/appointments/${appointmentId}/confirm`,
        { method: "POST", headers: fleetJsonHeaders() },
      );
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string | string[] };
          if (typeof j.message === "string") msg = j.message;
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      const data = (await res.json()) as ServiceCaseRecord;
      setServiceCase(data);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function supplierValidateAppointment(appointmentId: string) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(
        `${serviceCasesBrowserBase}/appointments/${appointmentId}/supplier-validate`,
        { method: "POST", headers: fleetJsonHeaders(), body: JSON.stringify({}) },
      );
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string | string[] };
          if (typeof j.message === "string") msg = j.message;
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      const data = (await res.json()) as ServiceCaseRecord;
      setServiceCase(data);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function transformToMaintenance() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${ticketsBrowserBase}/${ticketId}/transform`, {
        method: "POST",
        headers: ticketFleetHeaders(),
        body: JSON.stringify({ entityType: "maintenance" }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string | string[] };
          if (typeof j.message === "string") msg = j.message;
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      const data = (await res.json()) as { createdEntityId?: string };
      await load();
      if (data.createdEntityId) {
        router.push(`/fleet/maintenance/${data.createdEntityId}`);
      } else {
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  async function acknowledgeAppointment(appointmentId: string) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(
        `${serviceCasesBrowserBase}/appointments/${appointmentId}/acknowledge`,
        { method: "POST", headers: fleetJsonHeaders() },
      );
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string | string[] };
          if (typeof j.message === "string") msg = j.message;
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      const data = (await res.json()) as ServiceCaseRecord;
      setServiceCase(data);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function declineAppointment(appointmentId: string) {
    const note = declineNote.trim();
    if (note.length < 3) {
      setError("Nota pentru refuz trebuie să aibă cel puțin 3 caractere.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${serviceCasesBrowserBase}/appointments/${appointmentId}/decline`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({ note }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string | string[] };
          if (typeof j.message === "string") msg = j.message;
          else if (Array.isArray(j.message)) msg = j.message.join(", ");
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      const data = (await res.json()) as ServiceCaseRecord;
      setServiceCase(data);
      setDeclineApptId(null);
      setDeclineNote("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function reproposeAppointment(appointmentId: string) {
    if (!reproposeAt) {
      setError("Alege data și ora pentru reprogramare.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${serviceCasesBrowserBase}/appointments/${appointmentId}/repropose`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          scheduledAt: new Date(reproposeAt).toISOString(),
          note: reproposeNote.trim() || null,
        }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string | string[] };
          if (typeof j.message === "string") msg = j.message;
          else if (Array.isArray(j.message)) msg = j.message.join(", ");
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      const data = (await res.json()) as ServiceCaseRecord;
      setServiceCase(data);
      setReproposeApptId(null);
      setReproposeAt("");
      setReproposeNote("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function applyPostApproval(path: PostApprovalPath) {
    if (!serviceCase) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${serviceCasesBrowserBase}/${serviceCase.id}/post-approval`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({ path }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string | string[] };
          if (typeof j.message === "string") msg = j.message;
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      const data = (await res.json()) as ServiceCaseRecord;
      setServiceCase(data);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function quoteAction(
    workOrderId: string,
    quoteId: string,
    action: "approve" | "reject",
  ) {
    setPending(true);
    setError(null);
    try {
      let body: string | undefined;
      if (action === "reject") {
        const reason = window.prompt("Motiv respingere (opțional):") ?? "";
        body = JSON.stringify({ reason });
      }
      const res = await fetch(
        `${workOrdersBrowserBase}/${workOrderId}/quotes/${quoteId}/${action}`,
        { method: "POST", headers: fleetJsonHeaders(), body },
      );
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string };
          if (j.message) msg = j.message;
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      await load();
      const woId = serviceCase?.workOrders[0]?.id;
      if (woId) await loadMobility(woId);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  function formatAppointmentWhen(iso: string | null): string {
    if (!iso) return "Fără dată — furnizorul propune";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "Fără dată — furnizorul propune";
    return d.toLocaleString("ro-RO");
  }

  if (serviceCase === undefined) {
    return compact ? (
      <p className="text-sm text-zinc-500">Se încarcă situația service…</p>
    ) : (
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <p className="text-sm text-zinc-500">Se încarcă situația service…</p>
      </section>
    );
  }

  const ticketSettlement = (() => {
    const link = ticketLinks
      .filter((l) => l.entityType === "maintenance" || l.entityType === "cost" || l.entityType === "document")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    if (!link) return null;
    return {
      entityType: link.entityType as "maintenance" | "cost" | "document",
      entityId: link.entityId,
      createdAt: link.createdAt,
    };
  })();

  const chapters = buildOperationalChapters({
    serviceCase,
    closed,
    ticketCreatedAt,
    mobility: mobilityEligibility?.benefitAssignment ?? mobilityEligibility?.activeAssignment ?? null,
    mobilityEligible: mobilityEligibility?.eligible,
    mobilityImmobilizationHours: mobilityEligibility?.immobilizationHours ?? null,
    roadside: roadsideItems,
  });
  const shell = compact ? "space-y-4" : "rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-4";
  const hasPendingAppointment =
    serviceCase?.appointments?.some((a) => a.status === "scheduled") ?? false;
  const inRescheduleLoop =
    serviceCase?.postApprovalPath === "reschedule" &&
    (serviceCase?.currentStage === "scheduled" || serviceCase?.currentStage === "work_order");
  const hasApprovedQuote = serviceCase?.workOrders.some(
    (wo) => wo.approvedQuote ?? wo.latestQuote?.status === "approved",
  );
  const canScheduleNew =
    canOperate &&
    !closed &&
    serviceCase?.status === "active" &&
    (serviceCase?.currentStage === "intake" ||
      serviceCase?.currentStage === "scheduled" ||
      inRescheduleLoop) &&
    !hasPendingAppointment;

  async function recordServiceTime(
    workOrderId: string,
    field: "inServiceAt" | "outServiceAt",
    at?: string,
    odometerKm?: number,
  ) {
    setPending(true);
    setError(null);
    try {
      const body: Record<string, string | number> = {
        [field]: at ?? new Date().toISOString(),
      };
      if (field === "inServiceAt" && odometerKm != null) body.odometerKmIn = odometerKm;
      if (field === "outServiceAt" && odometerKm != null) body.odometerKmOut = odometerKm;

      const res = await fetch(`${workOrdersBrowserBase}/${workOrderId}/service-times`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string };
          if (j.message) msg = j.message;
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      await load();
      const woId = serviceCase?.workOrders[0]?.id;
      if (woId) await loadMobility(woId);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  function errorBlock() {
    if (!error) return null;
    return (
      <div className="space-y-1">
        <p className="text-sm text-red-400">{error}</p>
        {error.toLowerCase().includes("internal server") ? (
          <p className="text-xs text-amber-300/90">
            Pe staging rulează migrările:{" "}
            <code className="font-mono text-zinc-300">cd api && npx prisma migrate deploy</code>
          </p>
        ) : null}
      </div>
    );
  }

  if (!serviceCase) {
    return (
      <div className={shell}>
        {errorBlock()}
        {!hasVehicle ? (
          <p className="text-sm text-amber-300">Atașează un vehicul la tichet pentru a porni fluxul service.</p>
        ) : canOperate && !closed ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => void startCase()}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Deschide flux service
          </button>
        ) : (
          <p className="text-sm text-zinc-500">Dosarul service nu a fost deschis.</p>
        )}
      </div>
    );
  }

  return (
    <div className={shell}>
      {errorBlock()}

      <OperationalStoryTimeline chapters={chapters} />

      {canScheduleNew && !serviceCase.appointments?.length ? (
        <p className="text-xs text-violet-300/90">
          ↓ Stabilește programarea mai jos (dată, furnizor, locație).
        </p>
      ) : null}

      <OperationalFlowFork
            serviceCase={serviceCase}
            awaitingDecision={serviceCase.awaitingPostApproval}
            canOperate={canOperate}
            closed={closed}
            pending={pending}
            onImmediate={() => void applyPostApproval("immediate")}
            onReschedule={() => void applyPostApproval("reschedule")}
          />

          {serviceCase.workOrders.length > 0 ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs uppercase text-zinc-500">Comandă service</p>
              {serviceCase.postApprovalPath === "reschedule" ? (
                <p className="text-xs text-amber-200/80">
                  Reparație planificată cu reprogramare — devizul aprobat rămâne atașat comenzii.
                </p>
              ) : null}
              {serviceCase.workOrders.map((wo) => (
                <WorkOrderStepCard
                  key={wo.id}
                  wo={wo}
                  pending={pending}
                  canOperate={canOperate && !closed}
                  canApproveQuote={canApproveQuote}
                  onQuoteAction={quoteAction}
                  onRecordServiceTime={recordServiceTime}
                  onRefresh={() => {
                    void load();
                    router.refresh();
                  }}
                  repairPath={serviceCase.postApprovalPath}
                  workflowType={serviceCase.workflowType}
                  closed={closed}
                  onTransformMaintenance={transformToMaintenance}
                  ticketSettlement={ticketSettlement}
                />
              ))}
            </div>
          ) : null}

          {serviceCase.appointments?.length ? (
            <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs uppercase text-zinc-500">Programări</p>
                <Link
                  href={schedulerHref({
                    week: serviceCase.appointments[0]!.scheduledAt
                      ? new Date(serviceCase.appointments[0]!.scheduledAt)
                      : undefined,
                    select: serviceCase.appointments[0]!.id,
                    inbox: serviceCase.appointments[0]!.scheduledAt
                      ? undefined
                      : "pending_supplier",
                  })}
                  className="text-[10px] font-medium text-emerald-400 hover:underline"
                >
                  Deschide în programator →
                </Link>
              </div>
              <ul className="mt-2 space-y-3">
                {serviceCase.appointments.map((appt) => (
                  <li key={appt.id} className="rounded-md border border-zinc-800/80 bg-zinc-900/40 p-2.5">
                    <div className="text-zinc-300">
                      <Link
                        href={schedulerHref({
                          week: appt.scheduledAt ? new Date(appt.scheduledAt) : undefined,
                          select: appt.id,
                          inbox: appt.scheduledAt ? undefined : "pending_supplier",
                        })}
                        className="font-medium text-zinc-100 hover:text-emerald-300"
                      >
                        {formatAppointmentWhen(appt.scheduledAt)}
                      </Link>
                      {" · "}
                      {appointmentStatusLabel(appt.status)}
                      {appt.supplierLegalName ? ` · ${appt.supplierLegalName}` : ""}
                      {appt.location ? ` · ${appt.location}` : ""}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-zinc-500">
                      {appt.status === "needs_repropose" ? (
                        <span className="text-rose-300">
                          Șoferul nu poate
                          {appt.driverDeclineNote ? `: ${appt.driverDeclineNote}` : ""}
                        </span>
                      ) : appt.status === "pending_supplier" ? (
                        <span className="text-amber-400/90">
                          {appt.scheduledAt
                            ? "Așteaptă validare furnizor"
                            : "Așteaptă ca furnizorul să propună data"}
                        </span>
                      ) : appt.managerConfirmedAt ? (
                        <span className="text-emerald-400/90">Confirmat manager</span>
                      ) : (
                        <span>Neconfirmat manager</span>
                      )}
                      {appt.driverAcknowledgedAt ? (
                        <span className="text-sky-400/90">Confirmat șofer</span>
                      ) : appt.status !== "needs_repropose" ? (
                        <span>Fără confirmare șofer</span>
                      ) : null}
                      {appt.lastProposalNote ? (
                        <span className="w-full text-zinc-400">Notă propunere: {appt.lastProposalNote}</span>
                      ) : null}
                    </div>
                    {!closed && appt.status !== "cancelled" ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {canOperate &&
                        appt.scheduledAt &&
                        (appt.status === "pending_supplier" || appt.status === "needs_repropose") ? (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => void supplierValidateAppointment(appt.id)}
                            className="rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
                          >
                            Validează (furnizor)
                          </button>
                        ) : null}
                        {canConfirmAppointment &&
                        appt.status === "scheduled" &&
                        !appt.managerConfirmedAt ? (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => void confirmAppointment(appt.id)}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                          >
                            Confirmă programarea
                          </button>
                        ) : null}
                        {canAckAppointment &&
                        appt.managerConfirmedAt &&
                        !appt.driverAcknowledgedAt &&
                        appt.status !== "needs_repropose" &&
                        !appt.driverDeclinedAt ? (
                          <>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => void acknowledgeAppointment(appt.id)}
                              className="rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
                            >
                              Confirmă primire (șofer)
                            </button>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => {
                                setDeclineApptId(appt.id);
                                setDeclineNote("");
                                setReproposeApptId(null);
                              }}
                              className="rounded-lg border border-rose-500/40 px-2.5 py-1 text-xs text-rose-200 hover:bg-rose-950/40 disabled:opacity-50"
                            >
                              Nu pot la data asta
                            </button>
                          </>
                        ) : null}
                        {canOperate && appt.status === "needs_repropose" ? (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => {
                              setReproposeApptId(appt.id);
                              setReproposeAt(toDatetimeLocalValue(appt.scheduledAt));
                              setReproposeNote("");
                              setDeclineApptId(null);
                            }}
                            className="rounded-lg border border-amber-500/40 px-2.5 py-1 text-xs text-amber-200 hover:bg-amber-950/40 disabled:opacity-50"
                          >
                            Propune altă dată
                          </button>
                        ) : null}
                        {appt.managerConfirmedAt &&
                        !appt.driverAcknowledgedAt &&
                        appt.status !== "needs_repropose" &&
                        serviceCase.workOrders.length === 0 &&
                        !inRescheduleLoop ? (
                          <p className="w-full text-[11px] text-amber-200/90">
                            WO se creează automat după Confirmă primire (șofer) — nu există încă o comandă de deschis.
                          </p>
                        ) : null}
                        {declineApptId === appt.id ? (
                          <div className="w-full space-y-2 rounded-lg border border-rose-800/40 bg-rose-950/20 p-2">
                            <label className={OPS_LABEL_CLASS}>De ce nu poți? (min. 3 caractere)</label>
                            <input
                              className={OPS_INPUT_CLASS}
                              value={declineNote}
                              onChange={(e) => setDeclineNote(e.target.value)}
                              placeholder="ex. cursă lungă, nu ajung dimineața"
                            />
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => void declineAppointment(appt.id)}
                                className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-rose-500 disabled:opacity-50"
                              >
                                Trimite refuz
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDeclineApptId(null);
                                  setDeclineNote("");
                                }}
                                className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400"
                              >
                                Anulează
                              </button>
                            </div>
                          </div>
                        ) : null}
                        {reproposeApptId === appt.id ? (
                          <div className="w-full space-y-2 rounded-lg border border-amber-800/40 bg-amber-950/20 p-2">
                            <label className={OPS_LABEL_CLASS}>Dată / oră nouă</label>
                            <input
                              type="datetime-local"
                              className={OPS_INPUT_CLASS}
                              value={reproposeAt}
                              onChange={(e) => setReproposeAt(e.target.value)}
                            />
                            <label className={OPS_LABEL_CLASS}>Notă (opțional)</label>
                            <input
                              className={OPS_INPUT_CLASS}
                              value={reproposeNote}
                              onChange={(e) => setReproposeNote(e.target.value)}
                              placeholder="Context pentru furnizor"
                            />
                            <p className="text-[10px] text-zinc-500">
                              Se trimite din nou la furnizor pentru validare. „Deschide calendar” te duce la
                              programator; după ce trimiți repropunerea te întoarce pe tichet.
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={pending || !reproposeAt}
                                onClick={() => void reproposeAppointment(appt.id)}
                                className="rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-medium text-zinc-950 hover:bg-amber-500 disabled:opacity-50"
                              >
                                Trimite propunere
                              </button>
                              <Link
                                href={schedulerHref({
                                  week: appt.scheduledAt ? new Date(appt.scheduledAt) : undefined,
                                  select: appt.id,
                                  ticket: ticketId,
                                  returnToTicket: true,
                                })}
                                className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-sky-300 hover:bg-zinc-900"
                              >
                                Deschide calendar →
                              </Link>
                              <button
                                type="button"
                                onClick={() => {
                                  setReproposeApptId(null);
                                  setReproposeAt("");
                                  setReproposeNote("");
                                }}
                                className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400"
                              >
                                Anulează
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {inRescheduleLoop && hasApprovedQuote ? (
            <p className="mt-3 text-xs text-sky-300/90">
              Confirmă noua programare; nu este nevoie de deviz nou — folosește devizul aprobat de pe comandă.
            </p>
          ) : null}

          {canScheduleNew ? (
            <div className="mt-4 space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs uppercase text-zinc-500">
                  {inRescheduleLoop ? "Programare nouă (reparație)" : "Programare service"}
                </p>
                {vehicleId ? (
                  <Link
                    href={schedulerHref({
                      ticket: ticketId,
                      vehicle: vehicleId,
                      supplier: supplierId || undefined,
                      create: true,
                      week: scheduledAt ? new Date(scheduledAt) : undefined,
                    })}
                    className="text-[11px] font-medium text-sky-400 hover:underline"
                  >
                    Solicită programare în calendar →
                  </Link>
                ) : null}
              </div>
              <div>
                <label className={OPS_LABEL_CLASS}>Data și ora (opțional)</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className={OPS_INPUT_CLASS}
                />
                <p className="mt-1 text-[11px] text-zinc-500">
                  Lasă gol ca furnizorul să propună slotul. Cu dată = cerere pe intervalul ales.
                </p>
              </div>
              <div>
                <label className={OPS_LABEL_CLASS}>Furnizor / service</label>
                <div className="mt-1">
                  <SupplierCombobox
                    value={supplierId}
                    onChange={(id) => setSupplierId(id)}
                    category={serviceCase.workflowType === "itp" ? "itp" : "service_auto"}
                  />
                </div>
              </div>
              <div>
                <label className={OPS_LABEL_CLASS}>Locație</label>
                <input
                  value={appointmentLocation}
                  onChange={(e) => setAppointmentLocation(e.target.value)}
                  className={OPS_INPUT_CLASS}
                  placeholder="Adresă service"
                />
              </div>
              <button
                type="button"
                disabled={pending || (!scheduledAt && !supplierId)}
                onClick={() => void createAppointment()}
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
              >
                {supplierId && !scheduledAt
                  ? "Solicită programare — furnizorul propune data"
                  : supplierId
                    ? "Solicită programare la furnizor"
                    : "Salvează programarea"}
              </button>
            </div>
          ) : null}

      {serviceCase.status === "completed" ? (
        <p className="text-sm text-emerald-400">Dosar închis.</p>
      ) : null}
    </div>
  );
}

function WorkOrderStepCard({
  wo,
  pending,
  canOperate,
  canApproveQuote,
  onQuoteAction,
  onRecordServiceTime,
  onRefresh,
  repairPath,
  workflowType,
  closed,
  onTransformMaintenance,
  ticketSettlement,
}: {
  wo: WorkOrderRecord;
  pending: boolean;
  canOperate: boolean;
  canApproveQuote: boolean;
  onQuoteAction: (workOrderId: string, quoteId: string, action: "approve" | "reject") => void;
  onRecordServiceTime: (
    workOrderId: string,
    field: "inServiceAt" | "outServiceAt",
    at?: string,
    odometerKm?: number,
  ) => void;
  onRefresh: () => void;
  repairPath?: "immediate" | "reschedule" | null;
  workflowType?: ServiceCaseRecord["workflowType"];
  closed?: boolean;
  onTransformMaintenance?: () => void | Promise<void>;
  ticketSettlement?: {
    entityType: "maintenance" | "cost" | "document";
    entityId: string;
    createdAt: string;
  } | null;
}) {
  const approved = wo.approvedQuote ?? (wo.latestQuote?.status === "approved" ? wo.latestQuote : null);
  const pendingQuote = wo.pendingQuote ?? (wo.latestQuote?.status === "submitted" ? wo.latestQuote : null);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href={`/fleet/work-orders/${wo.id}`} className="font-medium text-sky-300 hover:underline">
            {wo.displayNumber ? (
              <>
                <span className="font-mono text-violet-200">{wo.displayNumber}</span>
                {" · "}
              </>
            ) : null}
            {wo.title}
          </Link>
          <p className="mt-0.5 text-xs text-zinc-500">
            {wo.status}
            {wo.supplierLegalName ? ` · ${wo.supplierLegalName}` : ""}
            {repairPath === "reschedule" ? " · reprogramare" : repairPath === "immediate" ? " · reparație directă" : ""}
            {wo.repairPathNote ? ` · ${wo.repairPathNote}` : ""}
          </p>
        </div>
        <Link href={`/fleet/work-orders/${wo.id}`} className="text-[10px] text-zinc-400 hover:text-zinc-200">
          Deschide comandă →
        </Link>
      </div>

      <div className="mt-2 rounded-md border border-violet-800/40 bg-violet-950/20 p-2">
        <p className="text-[10px] uppercase text-violet-300/80">In / Out service</p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-300">
          <span title="Data intrării în service">
            In:{" "}
            {wo.inServiceAt ? (
              <strong className="text-violet-200">{new Date(wo.inServiceAt).toLocaleString("ro-RO")}</strong>
            ) : (
              <span className="text-zinc-500">—</span>
            )}
            {wo.odometerKmIn != null ? (
              <span className="text-zinc-500"> · {wo.odometerKmIn.toLocaleString("ro-RO")} km</span>
            ) : null}
          </span>
          <span title="Data ieșirii din service">
            Out:{" "}
            {wo.outServiceAt ? (
              <strong className="text-violet-200">{new Date(wo.outServiceAt).toLocaleString("ro-RO")}</strong>
            ) : (
              <span className="text-zinc-500">—</span>
            )}
            {wo.odometerKmOut != null ? (
              <span className="text-zinc-500"> · {wo.odometerKmOut.toLocaleString("ro-RO")} km</span>
            ) : null}
          </span>
        </div>
        {canOperate ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {!wo.inServiceAt ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  const raw = window.prompt("Km la intrare (obligatoriu dacă setarea WO cere km):");
                  const km = raw?.trim() ? parseInt(raw, 10) : undefined;
                  if (raw?.trim() && (!Number.isFinite(km) || km! < 0)) return;
                  void onRecordServiceTime(wo.id, "inServiceAt", undefined, km);
                }}
                className="rounded-lg bg-violet-600 px-2.5 py-1 text-xs text-white hover:bg-violet-500 disabled:opacity-50"
              >
                Mașina a intrat
              </button>
            ) : null}
            {wo.inServiceAt && !wo.outServiceAt ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  const raw = window.prompt("Km la ieșire (obligatoriu dacă setarea WO cere km):");
                  const km = raw?.trim() ? parseInt(raw, 10) : undefined;
                  if (raw?.trim() && (!Number.isFinite(km) || km! < 0)) return;
                  void onRecordServiceTime(wo.id, "outServiceAt", undefined, km);
                }}
                className="rounded-lg border border-violet-500/50 px-2.5 py-1 text-xs text-violet-100 hover:bg-violet-950/40 disabled:opacity-50"
              >
                Mașina a ieșit
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {approved ? (
        <>
          <div className="mt-2 rounded-md border border-emerald-800/50 bg-emerald-950/20 p-2">
            <p className="text-xs font-medium text-emerald-200">
              Deviz{" "}
              <Link href={`/fleet/work-orders/${wo.id}`} className="text-sky-300 hover:underline">
                v{approved.version}
              </Link>
              {" aprobat · "}
              {formatQuoteMoney(approved.totalGrossCents, approved.currency)}
            </p>
            {!approved.invoicedAt ? (
              <p className="mt-1 text-[10px] text-emerald-300/70">După reparație: factură, cost, apoi închidere.</p>
            ) : null}
          </div>
          <WorkOrderQuoteBillingActions
            key={`${approved.id}-${approved.invoicedAt ?? ""}-${approved.costEntryId ?? ""}-${ticketSettlement?.entityId ?? ""}`}
            workOrderId={wo.id}
            workOrderStatus={wo.status}
            quote={approved}
            canWrite={canOperate}
            compact
            workflowType={workflowType}
            vehicleOdometerKm={wo.odometerKmOut ?? wo.odometerKmIn ?? undefined}
            ticketSettlement={ticketSettlement}
            onUpdated={onRefresh}
          />
          {canOperate &&
          !closed &&
          !ticketSettlement &&
          onTransformMaintenance &&
          (workflowType === "itp" || workflowType === "repair") ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => void onTransformMaintenance()}
              className="mt-2 rounded-lg border border-violet-500/50 px-2.5 py-1 text-xs text-violet-200 hover:bg-violet-950/40 disabled:opacity-50"
            >
              Transformă în mentenanță →
            </button>
          ) : ticketSettlement?.entityType === "maintenance" ? (
            <p className="mt-2 text-[10px] text-violet-300/80">
              Deja transformată în mentenanță (
              {new Date(ticketSettlement.createdAt).toLocaleDateString("ro-RO")}).
            </p>
          ) : null}
        </>
      ) : null}

      {pendingQuote ? (
        <div className="mt-2 rounded-md border border-zinc-800/80 bg-zinc-900/30 p-2">
          <p className="text-xs text-zinc-400">
            Deviz v{pendingQuote.version} · {quoteStatusLabel(pendingQuote.status)} ·{" "}
            {formatQuoteMoney(pendingQuote.totalGrossCents, pendingQuote.currency)}
          </p>
          {wo.estimatedRepairAt ? (
            <p className="mt-1 text-xs text-zinc-300">
              Estimare finalizare reparație: {formatDateRo(wo.estimatedRepairAt)}
            </p>
          ) : null}
          {canApproveQuote ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => onQuoteAction(wo.id, pendingQuote.id, "approve")}
                className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                Aprobă deviz
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => onQuoteAction(wo.id, pendingQuote.id, "reject")}
                className="rounded-lg border border-red-500/50 px-2.5 py-1 text-xs text-red-200 hover:bg-red-950/40 disabled:opacity-50"
              >
                Respinge
              </button>
            </div>
          ) : null}
        </div>
      ) : !approved ? (
        <p className="mt-2 text-xs text-zinc-500">Fără deviz — adaugă din pagina comenzii.</p>
      ) : null}
    </div>
  );
}
