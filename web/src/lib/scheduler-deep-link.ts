import { startOfWeekMonday } from "@/lib/scheduler-date-utils";

export type SchedulerViewMode = "grid" | "bands";

export function schedulerHref(opts?: {
  week?: Date;
  select?: string;
  view?: SchedulerViewMode;
  /** Leagă programarea nouă de tichet CRM (dosar service existent sau nou pe tichet). */
  ticket?: string;
  vehicle?: string;
  create?: boolean;
}): string {
  const params = new URLSearchParams();
  if (opts?.week) {
    params.set("week", startOfWeekMonday(opts.week).toISOString());
  }
  if (opts?.select) {
    params.set("select", opts.select);
  }
  if (opts?.view && opts.view !== "grid") {
    params.set("view", opts.view);
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
  const q = params.toString();
  return q ? `/fleet/scheduler?${q}` : "/fleet/scheduler";
}

export function parseSchedulerWeekParam(raw?: string | null): Date | null {
  if (!raw?.trim()) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function ticketDisplayIdFromTicketId(ticketId: string): string {
  return ticketId.slice(-6).toUpperCase();
}
