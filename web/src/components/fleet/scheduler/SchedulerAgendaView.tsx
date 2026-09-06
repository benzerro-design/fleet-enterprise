"use client";

import Link from "next/link";
import {
  appointmentStatusLabel,
  type SlottedCalendarAppointment,
} from "@/lib/appointments-api";
import { addDays, isSameDay, startOfDay } from "@/lib/scheduler-date-utils";
import { appointmentStatusAccentClass, appointmentStatusBadgeClass } from "./appointment-status-colors";
import { supplierDotClass } from "./supplier-colors";

type Props = {
  weekStart: Date;
  appointments: SlottedCalendarAppointment[];
  selectedId: string | null;
  partnerMode?: boolean;
  onSelect: (id: string) => void;
};

export function SchedulerAgendaView({ weekStart, appointments, selectedId, partnerMode, onSelect }: Props) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="flex-1 overflow-y-auto p-3 lg:hidden">
      {days.map((day) => {
        const dayAppts = appointments
          .filter((a) => isSameDay(new Date(a.scheduledAt), day))
          .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
        if (dayAppts.length === 0) return null;

        const isToday = isSameDay(day, new Date());
        return (
          <section key={day.toISOString()} className="mb-5">
            <h3
              className={`mb-2 text-xs font-semibold uppercase tracking-wide ${
                isToday ? "text-emerald-400" : "text-zinc-500"
              }`}
            >
              {day.toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long" })}
            </h3>
            <ul className="space-y-2">
              {dayAppts.map((a) => {
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
                      className={`w-full cursor-pointer rounded-xl border px-3 py-3 text-left transition-colors ${
                        selected
                          ? "ring-1 ring-emerald-500/50"
                          : "border-zinc-800 hover:border-zinc-700"
                      } border-l-4 ${appointmentStatusAccentClass(a.status)}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-zinc-100">{a.title}</p>
                          <p className="mt-0.5 font-mono text-sm text-emerald-400/90">{a.registrationNumber}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold tabular-nums">
                            {start.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                          <p className="text-xs text-zinc-500">{a.durationMin} min</p>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${supplierDotClass(a.supplierCategory)}`} />
                        {a.supplierCode ?? "—"} ·{" "}
                        <span className={`rounded border px-1 py-0.5 ${appointmentStatusBadgeClass(a.status)}`}>
                          {appointmentStatusLabel(a.status)}
                        </span>
                      </div>
                      {(a.ticketDisplayId || a.workOrders.length > 0) ? (
                        <p className="mt-1 font-mono text-[11px] text-zinc-400">
                          {a.ticketDisplayId && a.sourceTicketId && !partnerMode ? (
                            <Link
                              href={`/fleet/tickets/${a.sourceTicketId}`}
                              className="text-sky-400 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Tichet #{a.ticketDisplayId}
                            </Link>
                          ) : a.ticketDisplayId ? (
                            <span>Tichet #{a.ticketDisplayId}</span>
                          ) : null}
                          {a.ticketDisplayId && a.workOrders.length > 0 ? " · " : null}
                          {a.workOrders.map((wo, i) => {
                            const label = wo.displayNumber ?? wo.id.slice(-6).toUpperCase();
                            const href = partnerMode
                              ? `/fleet/partner/work-orders/${wo.id}`
                              : `/fleet/work-orders/${wo.id}`;
                            return (
                              <span key={wo.id}>
                                {i > 0 ? " · " : null}
                                <Link
                                  href={href}
                                  className="text-sky-400 hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  WO {label}
                                </Link>
                              </span>
                            );
                          })}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {appointments.length === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-500">Nicio programare în această perioadă.</p>
      ) : null}
    </div>
  );
}

export function SchedulerAgendaEmptyHint() {
  return (
    <p className="px-3 py-2 text-xs text-zinc-500 lg:hidden">
      Pe mobil vezi <strong className="font-medium text-zinc-400">agenda</strong> — pe desktop, grila săptămânii.
    </p>
  );
}
