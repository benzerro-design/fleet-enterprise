import { workOrderStatusLabel, type WorkOrderStatus } from "@/lib/work-orders-api";

type Props = {
  status: WorkOrderStatus | string;
};

function badgeClass(status: string): string {
  switch (status) {
    case "draft":
      return "border-zinc-600 bg-zinc-800/60 text-zinc-300";
    case "sent":
      return "border-sky-800/60 bg-sky-950/30 text-sky-200";
    case "in_progress":
      return "border-emerald-800/60 bg-emerald-950/30 text-emerald-200";
    case "waiting_parts":
      return "border-amber-800/60 bg-amber-950/30 text-amber-200";
    case "done":
      return "border-zinc-700 bg-zinc-900/50 text-zinc-400";
    case "cancelled":
      return "border-rose-900/50 bg-rose-950/20 text-rose-300";
    default:
      return "border-zinc-700 text-zinc-300";
  }
}

export function WorkOrderStatusBadge({ status }: Props) {
  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${badgeClass(status)}`}>
      {workOrderStatusLabel(status)}
    </span>
  );
}
