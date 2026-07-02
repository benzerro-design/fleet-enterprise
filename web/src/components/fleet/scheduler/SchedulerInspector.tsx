"use client";

import Link from "next/link";
import { useState } from "react";
import { SupplierCombobox } from "@/components/fleet/SupplierCombobox";
import { OPS_INPUT_CLASS, OPS_LABEL_CLASS } from "@/components/fleet/ops-form-primitives";
import {
  appointmentStatusLabel,
  appointmentsBrowserBase,
  workflowTypeLabel,
  type CalendarAppointment,
} from "@/lib/appointments-api";
import { fleetJsonHeaders } from "@/lib/fleet-api";
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
}: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMin, setDurationMin] = useState("60");
  const [location, setLocation] = useState("");

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

  async function setStatus(status: string) {
    if (!appointment) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${appointmentsBrowserBase}/${appointment.id}`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({ status }),
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
      {error ? <p className="mb-2 text-sm text-red-400">{error}</p> : null}
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-xs uppercase text-zinc-500">Interval</dt>
          <dd className="mt-0.5">
            {start.toLocaleString("ro-RO")} · {appointment.durationMin} min
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-zinc-500">Status</dt>
          <dd className="mt-0.5">{appointmentStatusLabel(appointment.status)}</dd>
        </div>
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
        {appointment.ticketDisplayId ? (
          <div>
            <dt className="text-xs uppercase text-zinc-500">Tichet</dt>
            <dd className="mt-0.5">
              <Link href={`/fleet/tickets/${appointment.sourceTicketId}`} className="font-mono text-emerald-400 hover:underline">
                #{appointment.ticketDisplayId}
              </Link>
            </dd>
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
