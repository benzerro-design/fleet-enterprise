"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { toDatetimeLocalValue } from "@/lib/scheduler-date-utils";
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
}: Props) {
  const router = useRouter();
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

  useEffect(() => {
    if (!appointment) return;
    setEditScheduledAt(toDatetimeLocalValue(appointment.scheduledAt));
    setEditDurationMin(String(appointment.durationMin));
    setEditing(false);
  }, [appointment?.id, appointment?.scheduledAt, appointment?.durationMin]);

  useEffect(() => {
    if (createMode && initialCreateScheduledAt) {
      setScheduledAt(initialCreateScheduledAt);
    }
  }, [createMode, initialCreateScheduledAt]);

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
    if (!editScheduledAt) return;
    await patchAppointment({
      scheduledAt: new Date(editScheduledAt).toISOString(),
      durationMin: parseInt(editDurationMin, 10) || 60,
    });
    setEditing(false);
  }

  async function setStatus(status: string) {
    await patchAppointment({ status });
  }

  async function ensureWorkOrder() {
    if (!appointment) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${serviceCasesBrowserBase}/${appointment.serviceCaseId}/advance`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          targetStage: "work_order",
          supplierId: appointment.supplierId,
        }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { message?: string };
        setError(j.message ?? `HTTP ${res.status}`);
        return;
      }
      onUpdated();
      router.refresh();
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
        <div className="space-y-3 overflow-y-auto">
          <div>
            <label className={OPS_LABEL_CLASS}>Vehicul</label>
            <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className={OPS_INPUT_CLASS}>
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
            <SupplierCombobox value={supplierId} onChange={setSupplierId} />
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
        {mobile && onClose ? (
          <button type="button" onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-300">
            Închide
          </button>
        ) : null}
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {appointment.sourceTicketId && appointment.ticketDisplayId ? (
          <Link
            href={`/fleet/tickets/${appointment.sourceTicketId}`}
            className="rounded-md border border-zinc-700 px-2 py-1 text-[10px] font-medium text-emerald-400 hover:bg-zinc-900"
          >
            Tichet #{appointment.ticketDisplayId}
          </Link>
        ) : null}
        {appointment.workOrders.map((wo) => (
          <Link
            key={wo.id}
            href={`/fleet/work-orders/${wo.id}`}
            className="rounded-md border border-zinc-700 px-2 py-1 text-[10px] font-medium text-sky-300 hover:bg-zinc-900"
          >
            WO · {wo.title}
          </Link>
        ))}
        <Link
          href={`/fleet/vehicles/${appointment.vehicleId}`}
          className="rounded-md border border-zinc-700 px-2 py-1 font-mono text-[10px] text-zinc-300 hover:bg-zinc-900"
        >
          {appointment.registrationNumber}
        </Link>
      </div>

      {error ? <p className="mb-2 text-sm text-red-400">{error}</p> : null}

      {editing && editable ? (
        <div className="mb-4 space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
          <p className="text-xs font-semibold uppercase text-zinc-500">Reprogramare</p>
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
              Salvează
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-zinc-900"
            >
              Anulează
            </button>
          </div>
        </div>
      ) : null}

      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-xs uppercase text-zinc-500">Interval</dt>
          <dd className="mt-0.5 flex items-center gap-2">
            <span>
              {start.toLocaleString("ro-RO")} · {appointment.durationMin} min
            </span>
            {editable && !editing ? (
              <button type="button" onClick={() => setEditing(true)} className="text-[10px] text-sky-400 hover:underline">
                Editează
              </button>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-zinc-500">Status</dt>
          <dd className="mt-0.5">{appointmentStatusLabel(appointment.status)}</dd>
        </div>
        {appointment.recurrenceRule !== "none" ? (
          <div>
            <dt className="text-xs uppercase text-zinc-500">Recurență</dt>
            <dd className="mt-0.5">{recurrenceLabel(appointment.recurrenceRule)}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs uppercase text-zinc-500">Vehicul</dt>
          <dd className="mt-0.5">
            <Link href={`/fleet/vehicles/${appointment.vehicleId}`} className="font-mono text-emerald-400 hover:underline">
              {appointment.registrationNumber}
            </Link>
            {" · "}
            {appointment.clientCode}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-zinc-500">Furnizor</dt>
          <dd className="mt-0.5">
            {appointment.supplierId ? (
              <Link href={`/fleet/suppliers/${appointment.supplierId}`} className="text-sky-300 hover:underline">
                {appointment.supplierCode} — {appointment.supplierLegalName}
              </Link>
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

      {canWrite ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {appointment.status === "scheduled" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => void setStatus("confirmed")}
              className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Confirmă
            </button>
          ) : null}
          {appointment.status !== "cancelled" && appointment.status !== "completed" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => void setStatus("cancelled")}
              className="rounded-lg border border-red-500/40 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-50"
            >
              Anulează
            </button>
          ) : null}
          {appointment.workOrders.length === 0 && editable ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => void ensureWorkOrder()}
              className="rounded-lg border border-sky-500/40 px-2.5 py-1.5 text-xs text-sky-300 hover:bg-sky-950/40 disabled:opacity-50"
            >
              Creează WO
            </button>
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
