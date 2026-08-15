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

const DAMAGE_PIPELINE_RANK: Record<string, number> = {
  docs_pending: 0,
  ready_to_notify: 1,
  notified: 2,
  inspection_note: 3,
  reinspection_requested: 3,
  quote_ready: 4,
  payment_accepted: 5,
};

function damagePipelineRank(status: string | null | undefined): number {
  if (!status) return -1;
  return DAMAGE_PIPELINE_RANK[status] ?? -1;
}

function buildDamageWorkOrderMilestones(
  wo: WorkOrderDetail,
  opts?: { canMarkReady?: boolean },
): WorkOrderMilestone[] {
  const qs = wo.quoteSummary;
  const pipeline = wo.damageInsurerPipelineStatus ?? null;
  const rank = damagePipelineRank(pipeline);
  const mail = wo.damageInsurerMailLog ?? [];
  const avizareAt = mail.find((m) => m.kind === "avizare" && m.status !== "failed")?.at ?? null;
  const quoteMailAt = mail.find((m) => (m.kind === "quote" || !m.kind) && m.status !== "failed")
    ?.at;
  const quoteSubmitted = qs.status === "submitted" || qs.status === "approved" || rank >= 4;
  const quoteApproved =
    qs.status === "approved" ||
    pipeline === "payment_accepted" ||
    !!wo.damageInsurerAgreedAt;
  const supplementActive = !!wo.supplementRepairAt && !wo.readyAt;
  const verifyingDone = rank >= 2 || !!wo.damageInspectionNotePdfUrl;
  const verifyingActive = verifyingDone && !quoteSubmitted;
  const invoiced = !!qs.invoicedAt;
  const done = wo.status === "done";
  const repairActive =
    quoteApproved &&
    !wo.readyAt &&
    (wo.status === "in_progress" || wo.status === "waiting_parts" || !!wo.inServiceAt);

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
      id: "verifying",
      label: "Verificare",
      done: verifyingDone,
      active: verifyingActive,
      date: fmt(
        wo.damageInspectionNoteReceivedAt ??
          avizareAt ??
          (verifyingDone ? wo.updatedAt : null),
      ),
    },
    {
      id: "quote_sent",
      label: "Deviz trimis",
      done: quoteSubmitted,
      active: quoteSubmitted && !quoteApproved,
      date: fmt(
        qs.submittedAt ??
          quoteMailAt ??
          (wo.damageInsurerQuotePdfUrl ? wo.updatedAt : null),
      ),
    },
    {
      id: "quote_approved",
      label: "Deviz aprobat",
      done: quoteApproved,
      active: false,
      date: fmt(
        qs.approvedAt ??
          wo.damagePaymentAcceptanceReceivedAt ??
          wo.damageInsurerAgreedAt,
      ),
    },
    {
      id: "repair_in_progress",
      label: supplementActive
        ? `În lucru (supliment v${wo.supplementQuoteVersion ?? "?"})`
        : "În lucru",
      done: quoteApproved && (!!wo.readyAt || wo.status === "done") && !supplementActive,
      active: repairActive,
      date: fmt(wo.supplementRepairAt ?? wo.readyAt ?? wo.inServiceAt),
    },
    {
      id: "work_ready",
      label: "Lucrare gata",
      done: !!wo.readyAt && !supplementActive,
      active: quoteApproved && !wo.readyAt,
      date: fmt(wo.readyAt),
      canToggle: opts?.canMarkReady && quoteApproved && !wo.readyAt,
    },
    {
      id: "invoiced",
      label: "Facturat",
      done: invoiced,
      active: !!wo.readyAt && !invoiced,
      date: fmt(qs.invoicedAt),
    },
    {
      id: "out_service",
      label: "Out service",
      done: !!wo.outServiceAt,
      active: invoiced && !wo.outServiceAt,
      date: fmt(wo.outServiceAt),
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

export function buildWorkOrderMilestones(
  wo: WorkOrderDetail,
  opts?: { canMarkReady?: boolean },
): WorkOrderMilestone[] {
  if (wo.workflowType === "damage") {
    return buildDamageWorkOrderMilestones(wo, opts);
  }

  const qs = wo.quoteSummary;
  const submitted = qs.status === "submitted" || qs.status === "approved";
  const approved = qs.status === "approved";
  const invoiced = !!qs.invoicedAt;
  const done = wo.status === "done";
  const repairActive =
    approved &&
    !wo.readyAt &&
    (wo.status === "in_progress" || wo.status === "waiting_parts" || !!wo.inServiceAt);

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
      id: "verifying",
      label: "Verificare",
      done: !!wo.inServiceAt && submitted,
      active: !!wo.inServiceAt && !submitted,
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
      id: "repair_in_progress",
      label: "În lucru",
      done: approved && (!!wo.readyAt || wo.status === "done"),
      active: repairActive,
      date: fmt(wo.readyAt ?? wo.inServiceAt),
    },
    {
      id: "work_ready",
      label: "Lucrare gata",
      done: !!wo.readyAt,
      active: approved && !wo.readyAt,
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
      id: "out_service",
      label: "Out service",
      done: !!wo.outServiceAt,
      active: invoiced && !wo.outServiceAt,
      date: fmt(wo.outServiceAt),
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
