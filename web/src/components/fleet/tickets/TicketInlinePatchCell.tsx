"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FleetGlyphTooltip } from "@/components/fleet/FleetGlyphTooltip";
import { TicketPriorityGlyph, TicketStatusGlyph } from "@/components/fleet/tickets/TicketListGlyphs";
import { fleetJsonHeaders, ticketPriorityLabel, ticketStatusLabel, ticketsBrowserBase, type TicketRecord } from "@/lib/tickets-api";

type Props = {
  ticket: TicketRecord;
  field: "status" | "priority";
};

export function TicketInlinePatchCell({ ticket, field }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function patch(value: string) {
    setPending(true);
    try {
      await fetch(`${ticketsBrowserBase}/${ticket.id}`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify(field === "status" ? { status: value } : { priority: value }),
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (field === "status") {
    return (
      <span className="inline-flex items-center gap-1">
        <FleetGlyphTooltip label={ticketStatusLabel(ticket.status)}>
          <TicketStatusGlyph status={ticket.status} />
        </FleetGlyphTooltip>
        <select
          value={ticket.status}
          disabled={pending}
          onChange={(e) => void patch(e.target.value)}
          className="max-w-[110px] rounded border border-zinc-700 bg-zinc-950 px-1 py-0.5 text-[10px] text-zinc-200"
          onClick={(e) => e.stopPropagation()}
        >
          <option value="open">Deschis</option>
          <option value="in_progress">În lucru</option>
          <option value="resolved">Rezolvat</option>
          <option value="cancelled">Anulat</option>
        </select>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <FleetGlyphTooltip label={ticketPriorityLabel(ticket.priority)}>
        <TicketPriorityGlyph priority={ticket.priority} />
      </FleetGlyphTooltip>
      <select
        value={ticket.priority}
        disabled={pending}
        onChange={(e) => void patch(e.target.value)}
        className="max-w-[90px] rounded border border-zinc-700 bg-zinc-950 px-1 py-0.5 text-[10px] text-zinc-200"
        onClick={(e) => e.stopPropagation()}
      >
        <option value="low">Scăzută</option>
        <option value="normal">Normală</option>
        <option value="high">Ridicată</option>
        <option value="urgent">Urgentă</option>
      </select>
    </span>
  );
}
