import type { AppointmentStatus } from "@/lib/appointments-api";

/** Border + background accent for calendar blocks and list rows (status-first). */
export function appointmentStatusAccentClass(status: AppointmentStatus | string): string {
  switch (status) {
    case "pending_supplier":
      return "border-l-amber-500 bg-amber-950/35";
    case "scheduled":
      return "border-l-sky-500 bg-sky-950/30";
    case "confirmed":
      return "border-l-emerald-500 bg-emerald-950/30";
    case "completed":
      return "border-l-zinc-600 bg-zinc-900/80";
    case "cancelled":
      return "border-l-red-500/70 bg-red-950/20 opacity-60";
    case "no_show":
      return "border-l-rose-500 bg-rose-950/25";
    default:
      return "border-l-zinc-600 bg-zinc-900/80";
  }
}

export function appointmentStatusBadgeClass(status: AppointmentStatus | string): string {
  switch (status) {
    case "pending_supplier":
      return "bg-amber-950/60 text-amber-200 border-amber-800/50";
    case "scheduled":
      return "bg-sky-950/60 text-sky-200 border-sky-800/50";
    case "confirmed":
      return "bg-emerald-950/60 text-emerald-200 border-emerald-800/50";
    case "completed":
      return "bg-zinc-800/60 text-zinc-400 border-zinc-700/50";
    case "cancelled":
      return "bg-red-950/40 text-red-300 border-red-800/40";
    case "no_show":
      return "bg-rose-950/50 text-rose-200 border-rose-800/50";
    default:
      return "bg-zinc-800/60 text-zinc-400 border-zinc-700/50";
  }
}

export const APPOINTMENT_STATUS_LEGEND: { status: AppointmentStatus; label: string }[] = [
  { status: "pending_supplier", label: "De validat (furnizor)" },
  { status: "scheduled", label: "De confirmat (manager)" },
  { status: "confirmed", label: "Confirmat" },
  { status: "completed", label: "Finalizat" },
  { status: "cancelled", label: "Anulat" },
];
