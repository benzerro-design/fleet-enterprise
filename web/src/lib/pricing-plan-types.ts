export type BillingCycle = "monthly" | "quarterly" | "yearly" | "custom";

export type ClientPlanAssignmentStatus = "active" | "scheduled" | "expired" | "cancelled";

const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: "Lunar",
  quarterly: "Trimestrial",
  yearly: "Anual",
  custom: "Personalizat",
};

const ASSIGNMENT_STATUS_LABELS: Record<ClientPlanAssignmentStatus, string> = {
  active: "Activ",
  scheduled: "Programat",
  expired: "Expirat",
  cancelled: "Anulat",
};

export function billingCycleLabel(cycle: string): string {
  return BILLING_CYCLE_LABELS[cycle as BillingCycle] ?? cycle;
}

export function planAssignmentStatusLabel(status: string): string {
  return ASSIGNMENT_STATUS_LABELS[status as ClientPlanAssignmentStatus] ?? status;
}

export function planAssignmentStatusClass(status: string): string {
  switch (status) {
    case "active":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
    case "scheduled":
      return "border-sky-500/40 bg-sky-500/10 text-sky-300";
    case "expired":
      return "border-zinc-500/40 bg-zinc-500/10 text-zinc-400";
    case "cancelled":
      return "border-rose-500/40 bg-rose-500/10 text-rose-300";
    default:
      return "border-zinc-600/40 bg-zinc-800 text-zinc-300";
  }
}
