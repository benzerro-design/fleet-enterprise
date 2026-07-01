"use client";

import { FleetAvatar } from "@/components/fleet/tickets/TicketListGlyphs";
import { ticketEventKindLabel, ticketRoutingLabel, type TicketEventRecord } from "@/lib/tickets-api";

const ACTION_KINDS = new Set(["routing", "transform", "status", "odometer", "workflow_advance"]);

function actorLabel(ev: TicketEventRecord): string | null {
  if (ev.actorDisplayName) {
    const level =
      ev.actorRoutingLevel === "L_STAR"
        ? "L★"
        : ev.actorRoutingLevel
          ? ticketRoutingLabel(ev.actorRoutingLevel)
          : "";
    return level ? `${ev.actorDisplayName} (${level})` : ev.actorDisplayName;
  }
  return ev.actorEmail;
}

function OdometerGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-sky-400" aria-hidden>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4 L8 8 L11 10" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function TicketActionTimeline({ events }: { events: TicketEventRecord[] }) {
  const actions = events.filter((e) => ACTION_KINDS.has(e.kind));

  if (actions.length === 0) {
    return <p className="text-sm text-zinc-500">Nicio acțiune înregistrată încă.</p>;
  }

  return (
    <ul className="space-y-3">
      {actions.map((ev) => (
        <li key={ev.id} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-sm">
          <div className="flex items-start gap-2">
            {ev.kind === "odometer" ? <OdometerGlyph /> : null}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span>{new Date(ev.createdAt).toLocaleString("ro-RO")}</span>
                <span className="rounded border border-zinc-700 px-1.5 py-0.5">
                  {ticketEventKindLabel(ev.kind)}
                </span>
                {actorLabel(ev) ? (
                  <span className="inline-flex items-center gap-1.5">
                    <FleetAvatar name={actorLabel(ev)!} size={18} />
                    {actorLabel(ev)}
                  </span>
                ) : null}
              </div>
              {ev.body ? <p className="mt-2 text-zinc-200">{ev.body}</p> : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
