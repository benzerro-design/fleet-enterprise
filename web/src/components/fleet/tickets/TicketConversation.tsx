"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TicketAttachmentsPanel } from "@/components/fleet/tickets/TicketAttachmentsPanel";
import { TicketComposer } from "@/components/fleet/tickets/TicketComposer";
import { TicketThread } from "@/components/fleet/tickets/TicketThread";
import { ticketEventAttachments, type TicketDetailPayload } from "@/lib/tickets-api";
import { TICKET_POLL_INTERVAL_MS } from "@/lib/ticket-messaging";

type Props = {
  initial: TicketDetailPayload;
  canWrite: boolean;
  closed: boolean;
  currentUserId?: string;
};

export function TicketConversation({ initial, canWrite, closed, currentUserId }: Props) {
  const router = useRouter();
  const [live, setLive] = useState(true);

  useEffect(() => {
    if (!live) return;
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = window.setInterval(tick, TICKET_POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [live, router]);

  const legacyFromEvents = initial.events.flatMap((ev) => ticketEventAttachments(ev));

  return (
    <div>
      <TicketAttachmentsPanel
        ticketId={initial.ticket.id}
        attachments={initial.attachments ?? []}
        legacyFromEvents={legacyFromEvents}
        canWrite={canWrite}
        closed={closed}
      />
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">Conversație</p>
        <button
          type="button"
          onClick={() => setLive((v) => !v)}
          className="text-[10px] text-zinc-500 hover:text-zinc-300"
          title={live ? "Oprește reîncărcarea automată" : "Reia reîncărcarea automată"}
        >
          {live ? "Live · Pauză" : "Live oprit · Reia"}
        </button>
      </div>
      <TicketThread
        events={initial.events}
        ticketId={initial.ticket.id}
        canWrite={canWrite}
        currentUserId={currentUserId}
      />
      <div className="mt-4">
        <TicketComposer
          ticket={initial.ticket}
          canWrite={canWrite}
          closed={closed}
          routeTargets={initial.routeTargets}
          currentUserId={currentUserId}
        />
      </div>
    </div>
  );
}
