import Link from "next/link";
import type { TicketRecord } from "@/lib/tickets-api";
import { ticketPriorityLabel, ticketRoutingLabel, ticketTypeLabel } from "@/lib/tickets-api";
import { TicketStatusBadge } from "@/components/fleet/TicketStatusBadge";

type Props = {
  items: TicketRecord[];
};

export function TicketFocusView({ items }: Props) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-8 text-center text-sm text-zinc-500">
        Niciun tichet urgent în focus — L★ fără owner sau prioritate ridicată.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((ticket) => {
        const unownedLstar = ticket.routingLevel === "L_STAR" && !ticket.ownerUserId;
        return (
          <Link
            key={ticket.id}
            href={`/fleet/tickets/${ticket.id}`}
            className={`block rounded-xl border bg-zinc-950/60 p-4 transition hover:border-zinc-600 ${
              unownedLstar ? "border-amber-800/50" : "border-zinc-800"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-emerald-400">#{ticket.displayId}</span>
                  <span className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400">
                    {ticketTypeLabel(ticket.ticketType)}
                  </span>
                  <TicketStatusBadge status={ticket.status} compact />
                </div>
                <p className="mt-2 font-medium text-zinc-100">{ticket.subject}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {ticket.clientCode}
                  {ticket.registrationNumber ? (
                    <>
                      {" "}
                      · <span className="font-mono text-zinc-400">{ticket.registrationNumber}</span>
                    </>
                  ) : null}
                  {" "}
                  · {ticketRoutingLabel(ticket.routingLevel)} · {ticketPriorityLabel(ticket.priority)}
                </p>
              </div>
              {unownedLstar ? (
                <span className="shrink-0 rounded-md border border-amber-700/50 bg-amber-950/30 px-2 py-1 text-[10px] font-medium text-amber-200">
                  L★ fără owner
                </span>
              ) : null}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
