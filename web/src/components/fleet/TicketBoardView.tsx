import Link from "next/link";
import type { TicketBoardPayload, TicketRecord } from "@/lib/tickets-api";
import { ticketRoutingLabel } from "@/lib/tickets-api";

type Props = {
  board: TicketBoardPayload;
};

function TicketCard({ ticket }: { ticket: TicketRecord }) {
  const stale = ticket.status !== "resolved" && !ticket.ownerUserId;
  return (
    <Link
      href={`/fleet/tickets/${ticket.id}`}
      className={`block rounded-lg border bg-zinc-950/80 p-3 transition hover:border-zinc-600 ${
        stale ? "border-l-2 border-l-amber-500 border-zinc-800" : "border-zinc-800"
      }`}
    >
      <div className="font-mono text-[10px] text-emerald-400">#{ticket.displayId}</div>
      <div className="mt-1 text-sm font-medium text-zinc-100">{ticket.subject}</div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-zinc-500">
        <span>{ticket.clientCode}</span>
        {ticket.registrationNumber ? (
          <span className="font-mono text-zinc-400">{ticket.registrationNumber}</span>
        ) : null}
        <span>{ticketRoutingLabel(ticket.routingLevel)}</span>
      </div>
      {stale ? <div className="mt-2 text-[10px] text-amber-400/90">Fără owner</div> : null}
    </Link>
  );
}

export function TicketBoardView({ board }: Props) {
  const columnTitle: Record<string, string> = {
    open: "Nou",
    in_progress: "În lucru",
    resolved: "Rezolvat",
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        {board.columns.map((col) => (
          <div key={col.status} className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-3">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                {columnTitle[col.status] ?? col.status}
              </h3>
              <span className="text-xs text-zinc-600">{col.items.length}</span>
            </div>
            <div className="space-y-2">
              {col.items.length === 0 ? (
                <p className="py-4 text-center text-xs text-zinc-600">—</p>
              ) : (
                col.items.map((t) => <TicketCard key={t.id} ticket={t} />)
              )}
            </div>
          </div>
        ))}
      </div>

      {board.lstar.length > 0 ? (
        <div className="rounded-xl border border-amber-900/40 bg-amber-950/10 p-4">
          <h3 className="text-sm font-medium text-amber-200">L★ FlotaX — în lucru</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {board.lstar.map((t) => (
              <TicketCard key={t.id} ticket={t} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
