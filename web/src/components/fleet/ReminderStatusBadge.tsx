import type { DocumentReminderSummary } from "@/lib/document-reminders";
import { reminderStatusMeta } from "@/lib/document-reminders";

type Props = { reminder: DocumentReminderSummary; compact?: boolean };

export function ReminderStatusBadge({ reminder, compact }: Props) {
  const meta = reminderStatusMeta(reminder.status);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-medium ${compact ? "text-[10px]" : "text-xs"} ${meta.className}`}
    >
      {meta.label}
      {!compact && reminder.daysUntilNextReminder != null && reminder.status !== "due_today" ? (
        <span className="ml-1 opacity-80">· în {reminder.daysUntilNextReminder}z</span>
      ) : null}
    </span>
  );
}
