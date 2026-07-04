import type { WorkOrderDetail } from "@/lib/work-orders-api";

export type ServiceOrderTypeCode = "M" | "E" | "D" | "TV";

export const SERVICE_ORDER_TYPES: { code: ServiceOrderTypeCode; label: string }[] = [
  { code: "M", label: "Mecanică" },
  { code: "E", label: "Electrică" },
  { code: "D", label: "Daună" },
  { code: "TV", label: "Tinichigerie-Vopsitorie" },
];

export function serviceOrderTypeLabel(code: string): string {
  return SERVICE_ORDER_TYPES.find((s) => s.code === code)?.label ?? code;
}

export type WorkOrderMilestone = {
  id: string;
  label: string;
  done: boolean;
  active: boolean;
  date: string | null;
  canToggle?: boolean;
};

function fmt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("ro-RO", { dateStyle: "short", timeStyle: "short" });
}

export function buildWorkOrderMilestones(
  wo: WorkOrderDetail,
  opts?: { canMarkReady?: boolean },
): WorkOrderMilestone[] {
  const qs = wo.quoteSummary;
  const submitted = qs.status === "submitted" || qs.status === "approved";
  const approved = qs.status === "approved";
  const invoiced = !!qs.invoicedAt;
  const done = wo.status === "done";

  return [
    {
      id: "open",
      label: "Comandă deschisă",
      done: wo.status !== "draft",
      active: false,
      date: fmt(wo.createdAt),
    },
    {
      id: "received",
      label: "Vehicul recepționat",
      done: !!wo.inServiceAt,
      active: !wo.inServiceAt && wo.status !== "done",
      date: fmt(wo.inServiceAt),
    },
    {
      id: "in_progress",
      label: "În lucru",
      done: !!wo.inServiceAt && (submitted || wo.status === "in_progress" || wo.status === "waiting_parts"),
      active: !!wo.inServiceAt && !submitted && wo.status === "in_progress",
      date: fmt(wo.inServiceAt),
    },
    {
      id: "quote_sent",
      label: "Deviz trimis",
      done: submitted,
      active: qs.status === "submitted",
      date: fmt(qs.submittedAt),
    },
    {
      id: "quote_approved",
      label: "Deviz aprobat",
      done: approved,
      active: false,
      date: fmt(qs.approvedAt),
    },
    {
      id: "out_service",
      label: "Out service",
      done: !!wo.outServiceAt,
      active: approved && !wo.outServiceAt,
      date: fmt(wo.outServiceAt),
    },
    {
      id: "work_ready",
      label: "Lucrare gata",
      done: !!wo.readyAt,
      active: !wo.readyAt && approved && !!wo.outServiceAt,
      date: fmt(wo.readyAt),
      canToggle: opts?.canMarkReady && approved && !wo.readyAt,
    },
    {
      id: "invoiced",
      label: "Facturat",
      done: invoiced,
      active: !!wo.readyAt && !invoiced,
      date: fmt(qs.invoicedAt),
    },
    {
      id: "closed",
      label: "Comandă închisă",
      done,
      active: false,
      date: fmt(wo.completedAt),
    },
  ];
}
