"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  APPOINTMENT_RECURRENCE,
  appointmentsBrowserBase,
  appointmentStatusLabel,
  recurrenceLabel,
  workflowTypeLabel,
  type CalendarAppointment,
} from "@/lib/appointments-api";
import { fleetJsonHeaders } from "@/lib/fleet-api";
import { serviceCasesBrowserBase } from "@/lib/service-cases-api";
import { workOrdersBrowserBase } from "@/lib/work-orders-api";
import { toDatetimeLocalValue } from "@/lib/scheduler-date-utils";
import { ticketDisplayIdFromTicketId } from "@/lib/scheduler-deep-link";
import { SupplierCombobox } from "@/components/fleet/SupplierCombobox";
import { OPS_INPUT_CLASS, OPS_LABEL_CLASS } from "@/components/fleet/ops-form-primitives";
import { supplierDotClass } from "./supplier-colors";

type VehicleOption = { id: string; registrationNumber: string; clientId: string };

type Props = {
  appointment: CalendarAppointment | null;
  canWrite: boolean;
  mobile?: boolean;
  onClose?: () => void;
  onUpdated: () => void;
  createMode?: boolean;
  onCancelCreate?: () => void;
  vehicles: VehicleOption[];
  initialCreateScheduledAt?: string;
  linkTicketId?: string | null;
  initialVehicleId?: string;
  serviceTypeCode?: string;
  partnerMode?: boolean;
  /** Notifică shell-ul când e activă reprogramarea (pick din calendar). */
  onRescheduleEditingChange?: (editing: boolean) => void;
  /** Deschide direct editarea datei (ex. din listă „Propune altă dată”). */
  openInRescheduleMode?: boolean;
  /** Slot ales din calendar în timp ce editezi intervalul. */
  calendarPickAt?: string;
  onCalendarPickConsumed?: () => void;
  /** După trimiterea repropunerii, întoarce la tichet. */
  returnTicketId?: string | null;
  onReturnToTicket?: () => void;
};

export function SchedulerInspector({
  appointment,
  canWrite,
  mobile,
  onClose,
  onUpdated,
  createMode,
  onCancelCreate,
  vehicles,
  initialCreateScheduledAt,
  linkTicketId,
  initialVehicleId,
  serviceTypeCode,
  partnerMode,
  onRescheduleEditingChange,
  openInRescheduleMode,
  calendarPickAt,
  onCalendarPickConsumed,
  returnTicketId,
  onReturnToTicket,
}: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [vehicleId, setVehicleId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMin, setDurationMin] = useState("60");
  const [location, setLocation] = useState("");
  const [recurrenceRule, setRecurrenceRule] = useState("none");
  const [editScheduledAt, setEditScheduledAt] = useState("");
  const [editDurationMin, setEditDurationMin] = useState("60");
  const [cancelNote, setCancelNote] = useState("");
  const [requestingCancel, setRequestingCancel] = useState(false);
  const [fleetOdoNotice, setFleetOdoNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!appointment) return;
    setEditScheduledAt(toDatetimeLocalValue(appointment.scheduledAt));
    setEditDurationMin(String(appointment.durationMin));
    if (openInRescheduleMode) {
      setEditing(true);
      onRescheduleEditingChange?.(true);
    } else {
      setEditing(false);
      onRescheduleEditingChange?.(false);
    }
    setError(null);
    setRequestingCancel(false);
    setCancelNote("");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when appointment identity/time/mode changes
  }, [appointment?.id, appointment?.scheduledAt, appointment?.durationMin, openInRescheduleMode]);

  useEffect(() => {
    setError(null);
    setRequestingCancel(false);
    setCancelNote("");
  }, [createMode, appointment?.id]);

  useEffect(() => {
    if (!editing || !calendarPickAt) return;
    setEditScheduledAt(calendarPickAt);
    onCalendarPickConsumed?.();
  }, [calendarPickAt, editing, onCalendarPickConsumed]);

  useEffect(() => {
    if (createMode && initialCreateScheduledAt) {
      setScheduledAt(initialCreateScheduledAt);
    }
  }, [createMode, initialCreateScheduledAt]);

  useEffect(() => {
    if (createMode && initialVehicleId) {
      setVehicleId(initialVehicleId);
    }
  }, [createMode, initialVehicleId]);

  async function markVehicleService(
    workOrderId: string,
    field: "inServiceAt" | "outServiceAt",
  ) {
    const kmLabel = field === "inServiceAt" ? "Km la intrare" : "Km la ieșire";
    const raw = window.prompt(`${kmLabel} (obligatoriu dacă setarea WO cere km):`);
    if (raw == null) return;
    const trimmed = raw.trim();
    const body: Record<string, string | number> = { [field]: new Date().toISOString() };
    if (trimmed) {
      const km = parseInt(trimmed, 10);
      if (!Number.isFinite(km) || km < 0) {
        setError("Km invalid.");
        return;
      }
      if (field === "inServiceAt") body.odometerKmIn = km;
      else body.odometerKmOut = km;
    }

    setPending(true);
    setError(null);
    setFleetOdoNotice(null);
    try {
      const res = await fetch(`${workOrdersBrowserBase}/${workOrderId}/service-times`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify(body),
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
      const j = (await res.json().catch(() => ({}))) as {
        fleetOdometerUpdate?: { updated: boolean; previousKm: number; newKm: number | null };
      };
      if (j.fleetOdometerUpdate?.updated && j.fleetOdometerUpdate.newKm != null) {
        setFleetOdoNotice(
          `Odometru flotă actualizat: ${j.fleetOdometerUpdate.previousKm.toLocaleString("ro-RO")} → ${j.fleetOdometerUpdate.newKm.toLocaleString("ro-RO")} km`,
        );
      }
      onUpdated();
    } finally {
      setPending(false);
    }
  }

  async function submitCreate() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(appointmentsBrowserBase, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          vehicleId,
          supplierId: supplierId || null,
          title: title || undefined,
          scheduledAt: new Date(scheduledAt).toISOString(),
          durationMin: parseInt(durationMin, 10) || 60,
          location: location || null,
          recurrenceRule: recurrenceRule !== "none" ? recurrenceRule : undefined,
          ...(linkTicketId ? { sourceTicketId: linkTicketId } : {}),
        }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { message?: string };
        setError(j.message ?? `HTTP ${res.status}`);
        return;
      }
      onUpdated();
      onCancelCreate?.();
    } finally {
      setPending(false);
    }
  }

  async function patchAppointment(body: Record<string, unknown>) {
    if (!appointment) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${appointmentsBrowserBase}/${appointment.id}`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json()) as { message?: string };
        setError(j.message ?? `HTTP ${res.status}`);
        return;
      }
      onUpdated();
    } finally {
      setPending(false);
    }
  }

  async function saveReschedule() {
    if (!editScheduledAt || !appointment) return;
    if (
      (appointment.status === "pending_supplier" || appointment.status === "needs_repropose") &&
      partnerMode
    ) {
      await supplierValidateWithReschedule();
      return;
    }
    if (appointment.status === "needs_repropose" && !partnerMode) {
      setPending(true);
      setError(null);
      try {
        const res = await fetch(
          `${serviceCasesBrowserBase}/appointments/${appointment.id}/repropose`,
          {
            method: "POST",
            headers: fleetJsonHeaders(),
            body: JSON.stringify({
              scheduledAt: new Date(editScheduledAt).toISOString(),
              durationMin: parseInt(editDurationMin, 10) || 60,
              note: null,
            }),
          },
        );
        if (!res.ok) {
          const j = (await res.json()) as { message?: string };
          setError(j.message ?? `HTTP ${res.status}`);
          return;
        }
        setEditing(false);
        onRescheduleEditingChange?.(false);
        onUpdated();
        onReturnToTicket?.();
      } finally {
        setPending(false);
      }
      return;
    }
    await patchAppointment({
      scheduledAt: new Date(editScheduledAt).toISOString(),
      durationMin: parseInt(editDurationMin, 10) || 60,
    });
    setEditing(false);
    onRescheduleEditingChange?.(false);
    if (returnTicketId) onReturnToTicket?.();
  }

  async function setStatus(status: string) {
    if (status === "confirmed") {
      await confirmAppointment();
      return;
    }
    await patchAppointment({ status });
  }

  async function confirmAppointment() {
    if (!appointment) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(
        `${serviceCasesBrowserBase}/appointments/${appointment.id}/confirm`,
        { method: "POST", headers: fleetJsonHeaders() },
      );
      if (!res.ok) {
        const j = (await res.json()) as { message?: string };
        setError(j.message ?? `HTTP ${res.status}`);
        return;
      }
      onUpdated();
    } finally {
      setPending(false);
    }
  }

  async function supplierValidate() {
    if (!appointment) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(
        `${serviceCasesBrowserBase}/appointments/${appointment.id}/supplier-validate`,
        {
          method: "POST",
          headers: fleetJsonHeaders(),
          body: JSON.stringify({}),
        },
      );
      if (!res.ok) {
        const j = (await res.json()) as { message?: string };
        setError(j.message ?? `HTTP ${res.status}`);
        return;
      }
      onUpdated();
    } finally {
      setPending(false);
    }
  }

  async function supplierValidateWithReschedule() {
    if (!appointment || !editScheduledAt) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(
        `${serviceCasesBrowserBase}/appointments/${appointment.id}/supplier-validate`,
        {
          method: "POST",
          headers: fleetJsonHeaders(),
          body: JSON.stringify({
            scheduledAt: new Date(editScheduledAt).toISOString(),
            durationMin: parseInt(editDurationMin, 10) || 60,
          }),
        },
      );
      if (!res.ok) {
        const j = (await res.json()) as { message?: string };
        setError(j.message ?? `HTTP ${res.status}`);
        return;
      }
      setEditing(false);
      onRescheduleEditingChange?.(false);
      onUpdated();
      onReturnToTicket?.();
    } finally {
      setPending(false);
    }
  }

  async function requestCancel() {
    if (!appointment) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(
        `${serviceCasesBrowserBase}/appointments/${appointment.id}/request-cancel`,
        {
          method: "POST",
          headers: fleetJsonHeaders(),
          body: JSON.stringify({ note: cancelNote.trim() || null }),
        },
      );
      if (!res.ok) {
        const j = (await res.json()) as { message?: string };
        setError(j.message ?? `HTTP ${res.status}`);
        return;
      }
      setRequestingCancel(false);
      setCancelNote("");
      onUpdated();
    } finally {
      setPending(false);
    }
  }

  if (createMode && canWrite) {
    return (
      <aside
        className={`flex flex-col border-zinc-800 bg-zinc-950/95 ${
          mobile
            ? "fixed inset-x-0 bottom-0 z-40 max-h-[85vh] rounded-t-2xl border-t p-4"
            : "w-72 shrink-0 border-l p-4"
        }`}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-200">Programare nouă</h2>
          {onCancelCreate ? (
            <button type="button" onClick={onCancelCreate} className="text-xs text-zinc-500 hover:text-zinc-300">
              Închide
            </button>
          ) : null}
        </div>
        {error ? <p className="mb-2 text-sm text-red-400">{error}</p> : null}
        {linkTicketId && !partnerMode ? (
          <p className="mb-3 rounded-lg border border-sky-800/50 bg-sky-950/30 px-3 py-2 text-xs text-sky-200">
            Legat de tichet{" "}
            <Link href={`/fleet/tickets/${linkTicketId}`} className="font-mono font-semibold text-sky-300 hover:underline">
              #{ticketDisplayIdFromTicketId(linkTicketId)}
            </Link>
            {" — "}
            programarea se atașează dosarului service al tichetului.
          </p>
        ) : null}
        {linkTicketId && partnerMode ? (
          <p className="mb-3 rounded-lg border border-sky-800/50 bg-sky-950/30 px-3 py-2 text-xs text-sky-200">
            Legat de tichet #{ticketDisplayIdFromTicketId(linkTicketId)} (referință flotă).
          </p>
        ) : null}
        <div className="space-y-3 overflow-y-auto">
          <div>
            <label className={OPS_LABEL_CLASS}>Vehicul</label>
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              disabled={!!linkTicketId && !!initialVehicleId}
              className={OPS_INPUT_CLASS}
            >
              <option value="">Selectează…</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.registrationNumber} · {v.clientId}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={OPS_LABEL_CLASS}>Furnizor</label>
            <SupplierCombobox value={supplierId} onChange={setSupplierId} serviceTypeCode={serviceTypeCode} />
          </div>
          <div>
            <label className={OPS_LABEL_CLASS}>Titlu</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={OPS_INPUT_CLASS} placeholder="Ex. ITP, revizie…" />
          </div>
          <div>
            <label className={OPS_LABEL_CLASS}>Data și ora</label>
            <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className={OPS_INPUT_CLASS} />
          </div>
          <div>
            <label className={OPS_LABEL_CLASS}>Durată (min)</label>
            <input type="number" min={15} step={15} value={durationMin} onChange={(e) => setDurationMin(e.target.value)} className={OPS_INPUT_CLASS} />
          </div>
          <div>
            <label className={OPS_LABEL_CLASS}>Locație</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} className={OPS_INPUT_CLASS} />
          </div>
          <div>
            <label className={OPS_LABEL_CLASS}>Recurență</label>
            <select value={recurrenceRule} onChange={(e) => setRecurrenceRule(e.target.value)} className={OPS_INPUT_CLASS}>
              {APPOINTMENT_RECURRENCE.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            {recurrenceRule !== "none" ? (
              <p className="mt-1 text-[10px] text-zinc-500">Se generează 8 apariții viitoare în serie.</p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          disabled={pending || !vehicleId || !scheduledAt}
          onClick={() => void submitCreate()}
          className="mt-4 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          Salvează programarea
        </button>
      </aside>
    );
  }

  if (!appointment) {
    return (
      <aside className="hidden w-72 shrink-0 flex-col items-center justify-center border-l border-zinc-800 bg-zinc-950/40 p-6 text-center lg:flex">
        <p className="text-sm text-zinc-500">Selectează o programare din calendar sau agenda.</p>
      </aside>
    );
  }

  const start = new Date(appointment.scheduledAt);
  const editable = canWrite && appointment.status !== "cancelled" && appointment.status !== "completed";

  const panel = (
    <>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${supplierDotClass(appointment.supplierCategory)}`} />
            <h2 className="truncate text-sm font-semibold text-zinc-100">{appointment.title}</h2>
          </div>
          <p className="mt-1 text-xs text-zinc-500">{workflowTypeLabel(appointment.workflowType)}</p>
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} className="shrink-0 text-xs text-zinc-500 hover:text-zinc-300">
            Închide
          </button>
        ) : null}
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {appointment.sourceTicketId && appointment.ticketDisplayId ? (
          partnerMode ? (
            <span className="rounded-md border border-zinc-700 px-2 py-1 font-mono text-[10px] font-medium text-emerald-400/90">
              Tichet #{appointment.ticketDisplayId}
            </span>
          ) : (
            <Link
              href={`/fleet/tickets/${appointment.sourceTicketId}`}
              className="rounded-md border border-zinc-700 px-2 py-1 font-mono text-[10px] font-medium text-emerald-400 hover:bg-zinc-900"
            >
              Tichet #{appointment.ticketDisplayId}
            </Link>
          )
        ) : null}
        {appointment.workOrders.map((wo) => {
          const label = wo.displayNumber ?? wo.id.slice(-6).toUpperCase();
          return partnerMode ? (
            <Link
              key={wo.id}
              href={`/fleet/partner/work-orders/${wo.id}`}
              className="rounded-md border border-zinc-700 px-2 py-1 font-mono text-[10px] font-medium text-sky-300 hover:bg-zinc-900"
            >
              WO {label}
            </Link>
          ) : (
            <Link
              key={wo.id}
              href={`/fleet/work-orders/${wo.id}`}
              className="rounded-md border border-zinc-700 px-2 py-1 font-mono text-[10px] font-medium text-sky-300 hover:bg-zinc-900"
            >
              WO {label}
            </Link>
          );
        })}
        {!partnerMode ? (
          <Link
            href={`/fleet/vehicles/${appointment.vehicleId}`}
            className="rounded-md border border-zinc-700 px-2 py-1 font-mono text-[10px] text-zinc-300 hover:bg-zinc-900"
          >
            {appointment.registrationNumber}
          </Link>
        ) : (
          <span className="rounded-md border border-zinc-700 px-2 py-1 font-mono text-[10px] text-zinc-300">
            {appointment.registrationNumber}
          </span>
        )}
      </div>

      {error ? <p className="mb-2 text-sm text-red-400">{error}</p> : null}

      {editing && editable ? (
        <div className="mb-4 space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
          <p className="text-xs font-semibold uppercase text-zinc-500">Reprogramare</p>
          <p className="text-[11px] text-sky-300/90">
            Click pe un slot liber din calendar ca să alegi data/ora vizual.
          </p>
          {returnTicketId ? (
            <p className="text-[11px] text-emerald-300/90">
              După trimitere te întorci automat la tichet #
              {ticketDisplayIdFromTicketId(returnTicketId)}.
            </p>
          ) : null}
          <div>
            <label className={OPS_LABEL_CLASS}>Data și ora</label>
            <input type="datetime-local" value={editScheduledAt} onChange={(e) => setEditScheduledAt(e.target.value)} className={OPS_INPUT_CLASS} />
          </div>
          <div>
            <label className={OPS_LABEL_CLASS}>Durată (min)</label>
            <input type="number" min={15} step={15} value={editDurationMin} onChange={(e) => setEditDurationMin(e.target.value)} className={OPS_INPUT_CLASS} />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending || !editScheduledAt}
              onClick={() => void saveReschedule()}
              className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {appointment?.status === "pending_supplier" || appointment?.status === "needs_repropose"
                ? partnerMode
                  ? "Trimite reprogramare"
                  : appointment.status === "needs_repropose"
                    ? "Trimite propunere"
                    : "Salvează"
                : "Salvează"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                onRescheduleEditingChange?.(false);
              }}
              className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-zinc-900"
            >
              Anulează
            </button>
          </div>
        </div>
      ) : null}

      <dl className="space-y-3 text-sm">
        {(appointment.ticketDisplayId || appointment.workOrders.length > 0) ? (
          <div>
            <dt className="text-xs uppercase text-zinc-500">Referințe</dt>
            <dd className="mt-0.5 space-y-0.5 font-mono text-xs text-zinc-300">
              {appointment.ticketDisplayId ? <p>Tichet #{appointment.ticketDisplayId}</p> : null}
              {appointment.workOrders.map((wo) => (
                <p key={wo.id}>
                  WO {wo.displayNumber ?? wo.id.slice(-6).toUpperCase()}
                  {wo.title ? <span className="font-sans text-zinc-500"> · {wo.title}</span> : null}
                </p>
              ))}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs uppercase text-zinc-500">Interval</dt>
          <dd className="mt-0.5 flex items-center gap-2">
            <span>
              {start.toLocaleString("ro-RO")} · {appointment.durationMin} min
            </span>
            {editable && !editing && appointment.status !== "pending_supplier" ? (
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                  onRescheduleEditingChange?.(true);
                }}
                className="text-[10px] text-sky-400 hover:underline"
              >
                Editează
              </button>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-zinc-500">Status</dt>
          <dd className="mt-0.5">{appointmentStatusLabel(appointment.status)}</dd>
          {appointment.cancellationRequestedAt ? (
            <p className="mt-1 rounded border border-rose-800/50 bg-rose-950/30 px-2 py-1 text-[10px] text-rose-200">
              Anulare solicitată
              {appointment.cancellationRequestNote
                ? `: ${appointment.cancellationRequestNote}`
                : ""}
              {!partnerMode ? " — confirmați cu Anulează dacă sunteți de acord." : " — așteaptă decizia flotei."}
            </p>
          ) : null}
          {appointment.status === "needs_repropose" || appointment.driverDeclinedAt ? (
            <p className="mt-1 rounded border border-rose-800/50 bg-rose-950/30 px-2 py-1 text-[10px] text-rose-200">
              Șoferul nu poate la data programată
              {appointment.driverDeclineNote ? `: ${appointment.driverDeclineNote}` : "."}
              {partnerMode
                ? " — așteaptă propunere flotă sau repropune tu un slot."
                : " — propune altă dată (Repropune / Propune)."}
            </p>
          ) : null}
          {appointment.lastProposalNote ? (
            <p className="mt-1 rounded border border-zinc-700 bg-zinc-900/50 px-2 py-1 text-[10px] text-zinc-300">
              Ultima notă propunere: {appointment.lastProposalNote}
            </p>
          ) : null}
        </div>
        {!partnerMode && appointment.status !== "cancelled" && appointment.status !== "completed" ? (
          <div>
            <dt className="text-xs uppercase text-zinc-500">Confirmări WO</dt>
            <dd className="mt-1 space-y-0.5 text-xs text-zinc-400">
              <p className={appointment.managerConfirmedAt ? "text-emerald-400/90" : ""}>
                {appointment.managerConfirmedAt ? "✓ Manager" : "○ Manager — neconfirmat"}
              </p>
              <p className={appointment.driverAcknowledgedAt ? "text-sky-400/90" : ""}>
                {appointment.driverAcknowledgedAt ? "✓ Șofer (primire)" : "○ Șofer — Confirmă primire"}
              </p>
              {appointment.workOrders.length === 0 &&
              appointment.managerConfirmedAt &&
              !appointment.driverAcknowledgedAt ? (
                <p className="mt-1 rounded border border-amber-800/40 bg-amber-950/20 px-2 py-1 text-[10px] text-amber-200">
                  Comanda (WO) se creează automat după Confirmă primire (șofer) pe tichet.
                </p>
              ) : null}
              {appointment.workOrders.length === 0 &&
              appointment.managerConfirmedAt &&
              appointment.driverAcknowledgedAt ? (
                <p className="mt-1 text-[10px] text-zinc-500">Confirmări complete — reîncarcă dacă WO nu apare.</p>
              ) : null}
            </dd>
          </div>
        ) : null}
        {appointment.recurrenceRule !== "none" ? (
          <div>
            <dt className="text-xs uppercase text-zinc-500">Recurență</dt>
            <dd className="mt-0.5">{recurrenceLabel(appointment.recurrenceRule)}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs uppercase text-zinc-500">Vehicul</dt>
          <dd className="mt-0.5">
            {partnerMode ? (
              <span className="font-mono text-emerald-400">{appointment.registrationNumber}</span>
            ) : (
              <Link href={`/fleet/vehicles/${appointment.vehicleId}`} className="font-mono text-emerald-400 hover:underline">
                {appointment.registrationNumber}
              </Link>
            )}
            {" · "}
            {appointment.clientCode}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-zinc-500">Furnizor</dt>
          <dd className="mt-0.5">
            {appointment.supplierId ? (
              partnerMode ? (
                <span>
                  {appointment.supplierCode} — {appointment.supplierLegalName}
                </span>
              ) : (
                <Link href={`/fleet/suppliers/${appointment.supplierId}`} className="text-sky-300 hover:underline">
                  {appointment.supplierCode} — {appointment.supplierLegalName}
                </Link>
              )
            ) : (
              "—"
            )}
          </dd>
        </div>
        {appointment.location ? (
          <div>
            <dt className="text-xs uppercase text-zinc-500">Locație</dt>
            <dd className="mt-0.5">{appointment.location}</dd>
          </div>
        ) : null}
      </dl>

      {partnerMode && appointment.workOrders.length > 0 ? (
        <div className="mt-4 rounded-lg border border-violet-800/40 bg-violet-950/20 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-300">
            Recepție vehicul
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            Marcați când preluați mașina de la utilizator și când o predăți înapoi.
          </p>
          {fleetOdoNotice ? (
            <p className="mt-2 text-[11px] text-emerald-400/90">{fleetOdoNotice}</p>
          ) : null}
          <ul className="mt-2 space-y-2">
            {appointment.workOrders.map((wo) => {
              const label = wo.displayNumber ?? wo.id.slice(-6).toUpperCase();
              return (
                <li key={wo.id} className="rounded-md border border-zinc-800 bg-zinc-950/50 p-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      href={`/fleet/partner/work-orders/${wo.id}`}
                      className="font-mono text-xs text-sky-300 hover:underline"
                    >
                      {label}
                    </Link>
                    <span className="text-[10px] text-zinc-500">
                      In: {wo.inServiceAt ? new Date(wo.inServiceAt).toLocaleString("ro-RO") : "—"}
                      {" · "}
                      Out: {wo.outServiceAt ? new Date(wo.outServiceAt).toLocaleString("ro-RO") : "—"}
                    </span>
                  </div>
                  {canWrite ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {!wo.inServiceAt ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => void markVehicleService(wo.id, "inServiceAt")}
                          className="rounded-lg bg-violet-600 px-2.5 py-1 text-xs text-white hover:bg-violet-500 disabled:opacity-50"
                        >
                          Mașina a intrat
                        </button>
                      ) : null}
                      {wo.inServiceAt && !wo.outServiceAt ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => void markVehicleService(wo.id, "outServiceAt")}
                          className="rounded-lg border border-violet-500/50 px-2.5 py-1 text-xs text-violet-100 hover:bg-violet-950/40 disabled:opacity-50"
                        >
                          Mașina a ieșit
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {canWrite ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {appointment.status === "pending_supplier" || appointment.status === "needs_repropose" ? (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => void supplierValidate()}
                className="rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs text-white hover:bg-sky-500 disabled:opacity-50"
              >
                Validează (furnizor)
              </button>
              {!editing ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(true);
                    onRescheduleEditingChange?.(true);
                  }}
                  className="rounded-lg border border-amber-500/40 px-2.5 py-1.5 text-xs text-amber-200 hover:bg-amber-950/40"
                >
                  {appointment.status === "needs_repropose" ? "Propune / repropune dată" : "Propune altă dată"}
                </button>
              ) : null}
            </>
          ) : null}
          {appointment.status === "scheduled" && !partnerMode ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => void confirmAppointment()}
              className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Confirmă (manager)
            </button>
          ) : null}
          {appointment.status === "scheduled" && partnerMode ? (
            <p className="w-full rounded-lg border border-sky-800/40 bg-sky-950/20 px-2.5 py-2 text-[11px] text-sky-200">
              Validat de dvs. — așteaptă confirmarea managerului flotă / client.
            </p>
          ) : null}
          {appointment.status !== "cancelled" && appointment.status !== "completed" && !partnerMode ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => void setStatus("cancelled")}
              className="rounded-lg border border-red-500/40 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-50"
            >
              {appointment.cancellationRequestedAt ? "Confirmă anularea" : "Anulează"}
            </button>
          ) : null}
          {partnerMode &&
          appointment.status !== "cancelled" &&
          appointment.status !== "completed" &&
          !appointment.cancellationRequestedAt ? (
            requestingCancel ? (
              <div className="w-full space-y-2 rounded-lg border border-rose-800/40 bg-rose-950/20 p-2">
                <label className={OPS_LABEL_CLASS}>Motiv (opțional)</label>
                <input
                  value={cancelNote}
                  onChange={(e) => setCancelNote(e.target.value)}
                  className={OPS_INPUT_CLASS}
                  placeholder="Ex. capacitate full, confuzie dată…"
                />
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void requestCancel()}
                    className="rounded-lg bg-rose-700 px-2.5 py-1.5 text-xs text-white hover:bg-rose-600 disabled:opacity-50"
                  >
                    Trimite solicitarea
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRequestingCancel(false);
                      setCancelNote("");
                    }}
                    className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-zinc-900"
                  >
                    Renunță
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => setRequestingCancel(true)}
                className="rounded-lg border border-rose-500/40 px-2.5 py-1.5 text-xs text-rose-200 hover:bg-rose-950/40 disabled:opacity-50"
              >
                Solicită anulare
              </button>
            )
          ) : null}
        </div>
      ) : null}
    </>
  );

  if (mobile) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-40 max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-zinc-800 bg-zinc-950 p-4 lg:hidden">
        {panel}
      </div>
    );
  }

  return (
    <aside className="hidden w-72 shrink-0 flex-col overflow-y-auto border-l border-zinc-800 bg-zinc-950/60 p-4 lg:flex">
      {panel}
    </aside>
  );
}
