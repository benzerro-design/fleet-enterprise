import { TicketAttachmentList } from "@/components/fleet/tickets/TicketAttachmentList";
import { ticketEventAttachments, type TicketEventRecord } from "@/lib/tickets-api";

export function TicketAttachmentGallery({ events }: { events: TicketEventRecord[] }) {
  const attachments = events
    .filter((e) => e.kind === "comment")
    .flatMap((e) => ticketEventAttachments(e));

  if (attachments.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        Atașamente ({attachments.length})
      </p>
      <div className="mt-2">
        <TicketAttachmentList attachments={attachments} />
      </div>
    </div>
  );
}
