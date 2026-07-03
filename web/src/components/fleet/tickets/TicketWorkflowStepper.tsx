"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SupplierCombobox } from "@/components/fleet/SupplierCombobox";
import {
  SERVICE_CASE_STAGES,
  appointmentStatusLabel,
  formatQuoteMoney,
  quoteStatusLabel,
  serviceCaseStageLabel,
  serviceCasesBrowserBase,
  fleetJsonHeaders,
  type PostApprovalPath,
  type ServiceCaseRecord,
  type WorkOrderRecord,
} from "@/lib/service-cases-api";
import { workOrdersBrowserBase } from "@/lib/work-orders-api";
import { schedulerHref } from "@/lib/scheduler-deep-link";
import { OPS_INPUT_CLASS, OPS_LABEL_CLASS } from "@/components/fleet/ops-form-primitives";

type Props = {
  ticketId: string;
  canOperate: boolean;
  canApproveQuote: boolean;
  canConfirmAppointment: boolean;
  canAckAppointment: boolean;
  closed: boolean;
  hasVehicle: boolean;
};

export function TicketWorkflowStepper({
  ticketId,
  canOperate,
  canApproveQuote,
  canConfirmAppointment,
  canAckAppointment,
  closed,
  hasVehicle,
}: Props) {
  const router = useRouter();
  const [serviceCase, setServiceCase] = useState<ServiceCaseRecord | null | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [appointmentLocation, setAppointmentLocation] = useState("");
  const [appointmentNotes, setAppointmentNotes] = useState("");

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
    } catch {
      setServiceCase(null);
      setError("Nu s-a putut încărca dosarul lucrare.");
    }
  }, [ticketId]);

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
    if (!serviceCase || !scheduledAt) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${serviceCasesBrowserBase}/${serviceCase.id}/appointments`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          scheduledAt: new Date(scheduledAt).toISOString(),
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
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  function formatAppointmentWhen(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("ro-RO");
  }

  if (serviceCase === undefined) {
    return (
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <p className="text-sm text-zinc-500">Se încarcă fluxul operațional…</p>
      </section>
    );
  }

  const currentIdx = serviceCase ? SERVICE_CASE_STAGES.indexOf(serviceCase.currentStage) : -1;
  const hasPendingAppointment =
    serviceCase?.appointments?.some((a) => a.status === "scheduled") ?? false;
  const inRescheduleLoop =
    serviceCase?.postApprovalPath === "reschedule" && serviceCase.currentStage === "scheduled";
  const canScheduleNew =
    canOperate &&
    !closed &&
    serviceCase?.status === "active" &&
    serviceCase.currentStage === "scheduled" &&
    !hasPendingAppointment;

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">Flux operațional</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Tichet → programare → comandă service → deviz → aprobare → factură → cost → închidere
            {inRescheduleLoop ? " · buclă reprogramare activă" : ""}
          </p>
        </div>
        {serviceCase ? (
          <span className="rounded-full border border-emerald-500/40 bg-emerald-950/30 px-2.5 py-1 text-xs text-emerald-200">
            {serviceCaseStageLabel(serviceCase.currentStage)}
          </span>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}

      {!serviceCase ? (
        <div className="mt-4">
          {error ? (
            <div className="space-y-2">
              <p className="text-sm text-red-400">{error}</p>
              <button
                type="button"
                disabled={pending}
                onClick={() => void load()}
                className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
              >
                Reîncearcă
              </button>
            </div>
          ) : !hasVehicle ? (
            <p className="text-sm text-amber-300">Atașează un vehicul la tichet pentru a porni fluxul.</p>
          ) : canOperate && !closed ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => void startCase()}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Pornește dosar lucrare
            </button>
          ) : (
            <p className="text-sm text-zinc-500">Dosarul nu a fost pornit.</p>
          )}
        </div>
      ) : (
        <>
          <ol className="mt-4 flex flex-wrap gap-1.5" aria-label="Etape dosar">
            {SERVICE_CASE_STAGES.map((stage, idx) => {
              const done = idx < currentIdx;
              const active = idx === currentIdx;
              return (
                <li
                  key={stage}
                  className={`rounded-full border px-2 py-0.5 text-[10px] sm:text-xs ${
                    active
                      ? "border-emerald-500/60 bg-emerald-950/40 text-emerald-200"
                      : done
                        ? "border-zinc-600 bg-zinc-800/60 text-zinc-300"
                        : "border-zinc-800 text-zinc-500"
                  }`}
                >
                  {serviceCaseStageLabel(stage)}
                </li>
              );
            })}
          </ol>

          {serviceCase.appointments?.length ? (
            <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs uppercase text-zinc-500">Programări</p>
                <Link
                  href={schedulerHref({
                    week: new Date(serviceCase.appointments[0]!.scheduledAt),
                    select: serviceCase.appointments[0]!.id,
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
                        href={schedulerHref({ week: new Date(appt.scheduledAt), select: appt.id })}
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
                      {appt.managerConfirmedAt ? (
                        <span className="text-emerald-400/90">Confirmat manager</span>
                      ) : (
                        <span>Neconfirmat manager</span>
                      )}
                      {appt.driverAcknowledgedAt ? (
                        <span className="text-sky-400/90">Confirmat șofer</span>
                      ) : (
                        <span>Fără confirmare șofer</span>
                      )}
                    </div>
                    {!closed && appt.status !== "cancelled" ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {canConfirmAppointment && !appt.managerConfirmedAt ? (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => void confirmAppointment(appt.id)}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                          >
                            Confirmă programarea
                          </button>
                        ) : null}
                        {canAckAppointment && appt.managerConfirmedAt && !appt.driverAcknowledgedAt ? (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => void acknowledgeAppointment(appt.id)}
                            className="rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
                          >
                            Confirmă primire (șofer)
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {inRescheduleLoop ? (
            <div className="mt-4 rounded-lg border border-sky-500/30 bg-sky-950/20 p-3 text-sm text-sky-100">
              <p className="font-medium">Reprogramare după deviz aprobat</p>
              <p className="mt-1 text-xs text-sky-200/80">
                Devizul rămâne valid — adaugă o programare nouă, confirmă, apoi factură și cost (fără deviz
                nou).
              </p>
            </div>
          ) : null}

          {canScheduleNew ? (
            <div className="mt-4 space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
              <p className="text-xs uppercase text-zinc-500">
                {inRescheduleLoop ? "Programare nouă (reparație)" : "Programare service"}
              </p>
              <div>
                <label className={OPS_LABEL_CLASS}>Data și ora</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className={OPS_INPUT_CLASS}
                />
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
                disabled={pending || !scheduledAt}
                onClick={() => void createAppointment()}
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
              >
                Salvează programarea
              </button>
            </div>
          ) : null}

          {serviceCase.workOrders.length > 0 ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs uppercase text-zinc-500">Comenzi service & devize</p>
              {serviceCase.workOrders.map((wo) => (
                <WorkOrderStepCard
                  key={wo.id}
                  wo={wo}
                  pending={pending}
                  canApproveQuote={canApproveQuote}
                  onQuoteAction={quoteAction}
                />
              ))}
            </div>
          ) : null}

          {serviceCase.awaitingPostApproval && canOperate && !closed ? (
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-950/20 p-3">
              <p className="text-sm font-medium text-amber-100">Deviz aprobat — alege următorul pas</p>
              <p className="mt-1 text-xs text-amber-200/70">
                Execută imediat sau reprogramează service-ul în programator.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void applyPostApproval("immediate")}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  Execută acum
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void applyPostApproval("reschedule")}
                  className="rounded-lg border border-amber-500/50 px-3 py-1.5 text-sm text-amber-100 hover:bg-amber-950/40 disabled:opacity-50"
                >
                  Programează din nou
                </button>
              </div>
            </div>
          ) : null}

          {serviceCase.status === "completed" ? (
            <p className="mt-3 text-sm text-emerald-400">Dosar închis.</p>
          ) : null}
        </>
      )}
    </section>
  );
}

function WorkOrderStepCard({
  wo,
  pending,
  canApproveQuote,
  onQuoteAction,
}: {
  wo: WorkOrderRecord;
  pending: boolean;
  canApproveQuote: boolean;
  onQuoteAction: (workOrderId: string, quoteId: string, action: "approve" | "reject") => void;
}) {
  const q = wo.latestQuote;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href={`/fleet/work-orders/${wo.id}`} className="font-medium text-sky-300 hover:underline">
            {wo.title}
          </Link>
          <p className="mt-0.5 text-xs text-zinc-500">
            {wo.status}
            {wo.supplierLegalName ? ` · ${wo.supplierLegalName}` : ""}
          </p>
        </div>
        <Link
          href={`/fleet/work-orders/${wo.id}`}
          className="text-[10px] text-zinc-400 hover:text-zinc-200"
        >
          Deschide →
        </Link>
      </div>
      {q ? (
        <div className="mt-2 rounded-md border border-zinc-800/80 bg-zinc-900/30 p-2">
          <p className="text-xs text-zinc-400">
            Deviz v{q.version} · {quoteStatusLabel(q.status)} ·{" "}
            {formatQuoteMoney(q.totalGrossCents, q.currency)}
          </p>
          {canApproveQuote && q.status === "submitted" ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => onQuoteAction(wo.id, q.id, "approve")}
                className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                Aprobă deviz
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => onQuoteAction(wo.id, q.id, "reject")}
                className="rounded-lg border border-red-500/50 px-2.5 py-1 text-xs text-red-200 hover:bg-red-950/40 disabled:opacity-50"
              >
                Respinge
              </button>
            </div>
          ) : q.status === "approved" ? (
            <p className="mt-2 text-xs text-emerald-400/90">
              Deviz aprobat — după reparație: factură apoi cost.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-xs text-zinc-500">Fără deviz încă — adaugă din pagina comenzii.</p>
      )}
    </div>
  );
}
