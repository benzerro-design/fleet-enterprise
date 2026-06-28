import type { TicketStatus } from "@/lib/tickets-api";
import { ticketStatusLabel } from "@/lib/tickets-api";

const STATUS_CLASS: Record<TicketStatus, string> = {
  open: "border-sky-800/60 bg-sky-950/30 text-sky-200",
  in_progress: "border-amber-800/60 bg-amber-950/30 text-amber-200",
  resolved: "border-emerald-800/60 bg-emerald-950/30 text-emerald-200",
  cancelled: "border-zinc-700 bg-zinc-900/50 text-zinc-400",
};

type Props = {
  status: TicketStatus;
  compact?: boolean;
};

export function TicketStatusBadge({ status, compact }: Props) {
  return (
    <span
      className={`rounded-md border px-2 py-0.5 font-medium ${compact ? "text-[10px]" : "text-xs"} ${STATUS_CLASS[status]}`}
    >
      {ticketStatusLabel(status)}
    </span>
  );
}
