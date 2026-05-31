import type { ReminderActionStatus } from "@/lib/reminder-actions";

export function planStatusLabel(status: ReminderActionStatus): string {
  switch (status) {
    case "expired":
    case "km_overdue":
      return "Depășit";
    case "due_today":
      return "Scadent azi";
    case "due_soon":
    case "km_due_soon":
      return "Scade curând";
    case "scheduled":
      return "Planificat";
    case "inactive":
      return "Inactiv";
    case "no_constraints":
      return "Fără termen";
    default:
      return "OK";
  }
}

export function planStatusStyles(status: ReminderActionStatus): string {
  switch (status) {
    case "expired":
    case "km_overdue":
      return "border-rose-900/50 bg-rose-950/30 text-rose-300";
    case "due_today":
      return "border-amber-900/50 bg-amber-950/30 text-amber-200";
    case "due_soon":
    case "km_due_soon":
      return "border-orange-900/50 bg-orange-950/30 text-orange-200";
    case "scheduled":
      return "border-sky-900/50 bg-sky-950/30 text-sky-300";
    case "inactive":
      return "border-zinc-700 bg-zinc-900/40 text-zinc-500";
    default:
      return "border-emerald-900/40 bg-emerald-950/20 text-emerald-300";
  }
}

export function planAccentBar(status: ReminderActionStatus): string {
  switch (status) {
    case "expired":
    case "km_overdue":
      return "bg-rose-500";
    case "due_today":
      return "bg-amber-500";
    case "due_soon":
    case "km_due_soon":
      return "bg-orange-500";
    case "scheduled":
      return "bg-sky-500";
    case "inactive":
      return "bg-zinc-600";
    default:
      return "bg-emerald-500";
  }
}
