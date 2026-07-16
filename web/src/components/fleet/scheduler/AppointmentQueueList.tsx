"use client";

import {
  appointmentStatusLabel,
  type CalendarAppointment,
} from "@/lib/appointments-api";
import { supplierDotClass } from "./supplier-colors";
import {
  appointmentStatusAccentClass,
  appointmentStatusBadgeClass,
} from "./appointment-status-colors";

type Props = {
  appointments: CalendarAppointment[];
  selectedId: string | null;
  canWrite: boolean;
  onSelect: (id: string) => void;
  onConfirm?: (id: string) => void;
  onCancel?: (id: string) => void;
  onSupplierValidate?: (id: string) => void;
  onRequestCancel?: (id: string) => void;
  partnerMode?: boolean;
  compact?: boolean;
};

export function AppointmentQueueList({
  appointments,
  selectedId,
  canWrite,
  onSelect,
  onConfirm,
  onCancel,
  onSupplierValidate,
  onRequestCancel,
  partnerMode,
  compact,
}: Props) {
  const sorted = [...appointments].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  if (sorted.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center p-6 text-center ${compact ? "min-h-[12rem]" : "min-h-[20rem]"}`}>
        <p className="text-sm text-zinc-500">Nicio programare în filtrul curent.</p>
      </div>
    );
  }

  return (
    <ul className={`divide-y divide-zinc-800/80 overflow-y-auto ${compact ? "max-h-full" : ""}`}>
      {sorted.map((a) => {
        const start = new Date(a.scheduledAt);
        const selected = a.id === selectedId;
        return (
          <li key={a.id}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => onSelect(a.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(a.id);
                }
              }}
              className={`cursor-pointer border-l-4 px-3 py-3 transition-colors ${
                selected ? "bg-zinc-800/50 ring-1 ring-inset ring-emerald-500/30" : "hover:bg-zinc-900/60"
              } ${appointmentStatusAccentClass(a.status)}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${supplierDotClass(a.supplierCategory)}`} />
                    <p className="truncate font-medium text-zinc-100">{a.title}</p>
                  </div>
                  <p className="mt-0.5 font-mono text-sm text-emerald-400/90">{a.registrationNumber}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {start.toLocaleDateString("ro-RO", { weekday: "short", day: "numeric", month: "short" })}{" "}
                    · {start.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}
                    {a.supplierCode ? ` · ${a.supplierCode}` : ""}
                  </p>
                  {(a.ticketDisplayId || a.workOrders.length > 0) ? (
                    <p className="mt-1 font-mono text-[10px] text-zinc-400">
                      {a.ticketDisplayId ? `Tichet #${a.ticketDisplayId}` : null}
                      {a.ticketDisplayId && a.workOrders.length > 0 ? " · " : null}
                      {a.workOrders
                        .map((wo) => `WO ${wo.displayNumber ?? wo.id.slice(-6).toUpperCase()}`)
                        .join(" · ")}
                    </p>
                  ) : null}
                </div>
                <span
                  className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${appointmentStatusBadgeClass(a.status)}`}
                >
                  {appointmentStatusLabel(a.status)}
                </span>
              </div>
              {a.cancellationRequestedAt ? (
                <p className="mt-1 text-[10px] font-medium text-rose-300">Anulare solicitată de furnizor</p>
              ) : null}

              {canWrite ? (
                <div className="mt-2 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {a.status === "pending_supplier" && onSupplierValidate ? (
                    <button
                      type="button"
                      onClick={() => onSupplierValidate(a.id)}
                      className="rounded-md bg-sky-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-sky-500"
                    >
                      Validează
                    </button>
                  ) : null}
                  {a.status === "scheduled" && onConfirm && !partnerMode ? (
                    <button
                      type="button"
                      onClick={() => onConfirm(a.id)}
                      className="rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-emerald-500"
                    >
                      Confirmă
                    </button>
                  ) : null}
                  {a.status !== "cancelled" && a.status !== "completed" && onCancel && !partnerMode ? (
                    <button
                      type="button"
                      onClick={() => onCancel(a.id)}
                      className="rounded-md border border-red-500/40 px-2 py-1 text-[10px] text-red-300 hover:bg-red-950/40"
                    >
                      Anulează
                    </button>
                  ) : null}
                  {partnerMode &&
                  onRequestCancel &&
                  !a.cancellationRequestedAt &&
                  a.status !== "cancelled" &&
                  a.status !== "completed" ? (
                    <button
                      type="button"
                      onClick={() => onRequestCancel(a.id)}
                      className="rounded-md border border-rose-500/40 px-2 py-1 text-[10px] text-rose-200 hover:bg-rose-950/40"
                    >
                      Solicită anulare
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
