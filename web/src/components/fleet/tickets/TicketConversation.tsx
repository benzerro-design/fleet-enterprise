"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TicketAttachmentGallery } from "@/components/fleet/tickets/TicketAttachmentGallery";
import { TicketComposer } from "@/components/fleet/tickets/TicketComposer";
import { TicketThread } from "@/components/fleet/tickets/TicketThread";
import { TICKET_POLL_INTERVAL_MS } from "@/lib/ticket-messaging";
import type { TicketDetailPayload } from "@/lib/tickets-api";

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

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] text-zinc-500">
          {live ? "Actualizare automată la 15s" : "Actualizare automată oprită"}
        </p>
        <button
          type="button"
          onClick={() => setLive((v) => !v)}
          className="text-[10px] text-zinc-400 hover:text-zinc-200"
        >
          {live ? "Pauză" : "Reia"}
        </button>
      </div>
      <TicketAttachmentGallery events={initial.events} />
      <TicketThread
        events={initial.events}
        ticketId={initial.ticket.id}
        canWrite={canWrite}
        currentUserId={currentUserId}
      />
      <div className="mt-4">
        <TicketComposer ticket={initial.ticket} canWrite={canWrite} closed={closed} />
      </div>
    </div>
  );
}
