"use client";

import {
  extractAppointmentProposalHistory,
  formatProposalHistoryWhen,
} from "@/lib/appointment-proposal-history";
import type { TicketEventRecord } from "@/lib/tickets-api";

type Props = {
  events: TicketEventRecord[];
  appointmentId?: string | null;
};

export function AppointmentProposalHistoryList({ events, appointmentId }: Props) {
  const entries = extractAppointmentProposalHistory(events, { appointmentId });

  if (entries.length === 0) {
    return (
      <p className="mt-2 text-[11px] text-zinc-500">
        Nicio propunere înregistrată încă pe acest tichet. După repropose / altă oră de la furnizor,
        apar aici.
      </p>
    );
  }

  return (
    <ul className="mt-2 space-y-2">
      {entries.map((e) => (
        <li
          key={e.id}
          className="rounded-md border border-zinc-800/80 bg-zinc-900/40 px-2.5 py-2 text-[11px]"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200/90">
              {e.actorLabel}
            </span>
            <span className="font-mono text-[10px] text-zinc-500">
              {formatProposalHistoryWhen(e.at)}
            </span>
          </div>
          {e.scheduledAt ? (
            <p className="mt-1 text-sm font-medium text-zinc-100">
              Slot: {formatProposalHistoryWhen(e.scheduledAt)}
            </p>
          ) : null}
          {e.note ? (
            <p className="mt-0.5 text-zinc-400">„{e.note}”</p>
          ) : null}
          <p className="mt-1 text-zinc-500">{e.summary}</p>
        </li>
      ))}
    </ul>
  );
}
