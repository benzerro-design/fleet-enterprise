import { startOfWeekMonday } from "@/lib/scheduler-date-utils";
import type { AppointmentStatus } from "@/lib/appointments-api";

export type SchedulerViewMode = "split" | "grid" | "bands" | "list";

export type SchedulerInboxFilter = "all" | AppointmentStatus | "action";

export function schedulerHref(opts?: {
  basePath?: string;
  week?: Date;
  select?: string;
  view?: SchedulerViewMode;
  inbox?: SchedulerInboxFilter;
  ticket?: string;
  vehicle?: string;
  create?: boolean;
  /** După reprogramare / repropunere, UI poate întoarce userul la tichet. */
  returnToTicket?: boolean;
  extraSearch?: string;
}): string {
  const base = opts?.basePath ?? "/fleet/scheduler";
  const params = new URLSearchParams(opts?.extraSearch ?? "");
  if (opts?.week) {
    params.set("week", startOfWeekMonday(opts.week).toISOString());
  }
  if (opts?.select) {
    params.set("select", opts.select);
  }
  if (opts?.view && opts.view !== "split") {
    params.set("view", opts.view);
  }
  if (opts?.inbox && opts.inbox !== "all") {
    params.set("inbox", opts.inbox);
  }
  if (opts?.ticket?.trim()) {
    params.set("ticket", opts.ticket.trim());
  }
  if (opts?.vehicle?.trim()) {
    params.set("vehicle", opts.vehicle.trim());
  }
  if (opts?.create) {
    params.set("create", "1");
  }
  if (opts?.returnToTicket && opts?.ticket?.trim()) {
    params.set("return", "1");
  }
  const q = params.toString();
  return q ? `${base}?${q}` : base;
}

export function parseSchedulerWeekParam(raw?: string | null): Date | null {
  if (!raw?.trim()) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseSchedulerViewParam(raw?: string | null): SchedulerViewMode {
  if (raw === "grid" || raw === "bands" || raw === "list") return raw;
  return "split";
}

export function parseSchedulerInboxParam(raw?: string | null): SchedulerInboxFilter {
  if (!raw?.trim() || raw === "all") return "all";
  if (raw === "action") return "action";
  const allowed: AppointmentStatus[] = [
    "pending_supplier",
    "needs_repropose",
    "scheduled",
    "confirmed",
    "completed",
    "cancelled",
    "no_show",
  ];
  return allowed.includes(raw as AppointmentStatus) ? (raw as AppointmentStatus) : "all";
}

export function ticketDisplayIdFromTicketId(ticketId: string): string {
  return ticketId.slice(-6).toUpperCase();
}
