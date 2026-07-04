"use client";

import Link from "next/link";
import { FleetAvatar } from "@/components/fleet/tickets/TicketListGlyphs";
import { TicketStatusBadge } from "@/components/fleet/TicketStatusBadge";
import { operationalHeadline } from "@/lib/ticket-operational-story";
import type { ServiceCaseRecord } from "@/lib/service-cases-api";
import type { TicketDetailPayload } from "@/lib/tickets-api";
import { ticketRoutingLabel } from "@/lib/tickets-api";

type Props = {
  detail: TicketDetailPayload;
  serviceCase: ServiceCaseRecord | null | undefined;
  closed: boolean;
  canWrite: boolean;
  onClaim?: () => void;
  claimPending?: boolean;
};

export function TicketCommandHeader({
  detail,
  serviceCase,
  closed,
  canWrite,
  onClaim,
  claimPending,
}: Props) {
  const { ticket } = detail;
  const headline = operationalHeadline(serviceCase, closed);
  const needsClaim = !ticket.ownerUserId && !closed && canWrite;

  return (
    <header className="rounded-xl border border-zinc-800 bg-gradient-to-b from-zinc-900/80 to-zinc-950/40 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
            <span className="font-mono text-emerald-400">#{ticket.displayId}</span>
            {ticket.registrationNumber ? (
              <>
                <span>·</span>
                <Link
                  href={`/fleet/vehicles/${ticket.vehicleId}`}
                  className="font-mono font-semibold text-emerald-300 hover:underline"
                >
                  {ticket.registrationNumber}
                </Link>
              </>
            ) : null}
            <span>·</span>
            <span>{ticket.clientLegalName}</span>
          </div>
          <h1 className="mt-2 text-xl font-semibold leading-tight text-zinc-50 sm:text-2xl">{ticket.subject}</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">{headline}</p>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
          <div className="flex flex-wrap gap-2">
            <TicketStatusBadge status={ticket.status} />
            <span className="rounded-md border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400">
              {ticketRoutingLabel(ticket.routingLevel)}
            </span>
          </div>
          <div className="text-right text-sm">
            <p className="text-[10px] uppercase text-zinc-500">Responsabil</p>
            {ticket.ownerEmail ? (
              <p className="mt-0.5 inline-flex items-center gap-2 text-zinc-200">
                <FleetAvatar name={ticket.ownerEmail.split("@")[0]} size={22} />
                {ticket.ownerEmail.split("@")[0]}
              </p>
            ) : needsClaim && onClaim ? (
              <button
                type="button"
                disabled={claimPending}
                onClick={onClaim}
                className="mt-1 rounded-lg bg-sky-600 px-3 py-1 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
              >
                Preia tichetul
              </button>
            ) : (
              <p className="mt-0.5 text-amber-400">Neasignat</p>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
