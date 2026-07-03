import { startOfWeekMonday } from "@/lib/scheduler-date-utils";

export type SchedulerViewMode = "grid" | "bands";

export function schedulerHref(opts?: {
  week?: Date;
  select?: string;
  view?: SchedulerViewMode;
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
  const q = params.toString();
  return q ? `/fleet/scheduler?${q}` : "/fleet/scheduler";
}

export function parseSchedulerWeekParam(raw?: string | null): Date | null {
  if (!raw?.trim()) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}
