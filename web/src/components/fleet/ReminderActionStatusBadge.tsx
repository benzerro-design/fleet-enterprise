import type { ReminderActionSummary } from "@/lib/reminder-actions";
import { reminderActionStatusMeta } from "@/lib/reminder-actions";

type Props = {
  summary: ReminderActionSummary;
  compact?: boolean;
};

export function ReminderActionStatusBadge({ summary, compact }: Props) {
  const meta = reminderActionStatusMeta(summary.status);
  return (
    <span
      className={`rounded-md border px-2 py-0.5 font-medium ${compact ? "text-[10px]" : "text-xs"} ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}
