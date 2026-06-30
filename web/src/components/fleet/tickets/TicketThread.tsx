"use client";

import { FleetAvatar } from "@/components/fleet/tickets/TicketListGlyphs";
import { ticketRoutingLabel, type TicketEventRecord } from "@/lib/tickets-api";

function actorLabel(ev: TicketEventRecord): string {
  if (ev.actorDisplayName) {
    const level =
      ev.actorRoutingLevel === "L_STAR"
        ? "L★"
        : ev.actorRoutingLevel
          ? ticketRoutingLabel(ev.actorRoutingLevel)
          : "";
    return level ? `${ev.actorDisplayName} (${level})` : ev.actorDisplayName;
  }
  return ev.actorEmail ?? "Sistem";
}

export function TicketThread({ events }: { events: TicketEventRecord[] }) {
  const comments = events.filter((e) => e.kind === "comment");

  if (comments.length === 0) {
    return <p className="text-sm text-zinc-500">Niciun mesaj în conversație.</p>;
  }

  return (
    <ul className="space-y-4">
      {comments.map((ev) => {
        const name = actorLabel(ev);
        return (
          <li key={ev.id} className="flex gap-3">
            <FleetAvatar name={name} size={32} />
            <div className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span className="font-medium text-zinc-300">{name}</span>
                <span>{new Date(ev.createdAt).toLocaleString("ro-RO")}</span>
              </div>
              {ev.body ? <p className="mt-1.5 whitespace-pre-wrap text-sm text-zinc-200">{ev.body}</p> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
