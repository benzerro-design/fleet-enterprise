import Link from "next/link";
import { notFound } from "next/navigation";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { TicketActionsPanel } from "@/components/fleet/TicketActionsPanel";
import { TicketStatusBadge } from "@/components/fleet/TicketStatusBadge";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";
import {
  ticketEventKindLabel,
  ticketPriorityLabel,
  ticketRoutingLabel,
  ticketTypeLabel,
  type TicketDetailPayload,
} from "@/lib/tickets-api";

async function loadDetail(id: string): Promise<TicketDetailPayload | null> {
  try {
    const res = await fleetServerFetch(`/tickets/${id}`);
    if (!res?.ok) return null;
    return (await res.json()) as TicketDetailPayload;
  } catch {
    return null;
  }
}

type PageProps = { params: Promise<{ id: string }> };

export default async function TicketDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [detail, auth] = await Promise.all([loadDetail(id), getAuthMeResult()]);
  if (!detail) notFound();
  const write = canManageFleet(auth);
  const { ticket, events } = detail;

  return (
    <FleetPageMain>
      <Link href="/fleet/tickets" className="text-sm text-zinc-400 hover:text-zinc-200">
        ← Tichete CRM
      </Link>

      <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/30 p-6">
        {ticket.registrationNumber ? (
          <div className="mb-6 border-b border-zinc-800 pb-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <Link
                  href={`/fleet/vehicles/${ticket.vehicleId}`}
                  className="font-mono text-3xl font-semibold tracking-tight text-emerald-400 hover:underline"
                >
                  {ticket.registrationNumber}
                </Link>
                <p className="mt-1 text-sm text-zinc-500">
                  {ticket.clientLegalName} ({ticket.clientCode})
                  {ticket.vehicleOdometerKm != null ? (
                    <>
                      {" "}
                      · <span className="font-mono text-sky-300">{ticket.vehicleOdometerKm.toLocaleString("ro-RO")} km</span>
                    </>
                  ) : null}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <TicketStatusBadge status={ticket.status} />
                <span className="rounded-md border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
                  {ticketRoutingLabel(ticket.routingLevel)}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-sm text-emerald-400">#{ticket.displayId}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">{ticket.subject}</h1>
              <span className="rounded-md border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
                {ticketTypeLabel(ticket.ticketType)}
              </span>
            </div>
            {ticket.description ? <p className="mt-3 text-sm text-zinc-400">{ticket.description}</p> : null}
            <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase text-zinc-500">Client</dt>
                <dd className="mt-1">{ticket.clientCode} — {ticket.clientLegalName}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-zinc-500">Prioritate</dt>
                <dd className="mt-1">{ticketPriorityLabel(ticket.priority)}</dd>
              </div>
              {ticket.driverFullName ? (
                <div>
                  <dt className="text-xs uppercase text-zinc-500">Șofer</dt>
                  <dd className="mt-1">{ticket.driverFullName}</dd>
                </div>
              ) : null}
              {ticket.reminderActionId ? (
                <div>
                  <dt className="text-xs uppercase text-zinc-500">Reminder</dt>
                  <dd className="mt-1">
                    <Link href={`/fleet/reminders/${ticket.reminderActionId}`} className="text-violet-400 hover:underline">
                      Vezi reminder
                    </Link>
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Timeline</h2>
          <ul className="mt-4 space-y-3">
            {events.map((ev) => (
              <li key={ev.id} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <span>{new Date(ev.createdAt).toLocaleString("ro-RO")}</span>
                  <span className="rounded border border-zinc-700 px-1.5 py-0.5">{ticketEventKindLabel(ev.kind)}</span>
                  {ev.actorEmail ? <span>{ev.actorEmail}</span> : null}
                </div>
                {ev.body ? <p className="mt-2 text-zinc-200">{ev.body}</p> : null}
              </li>
            ))}
          </ul>
        </section>

        <TicketActionsPanel detail={detail} canWrite={write} />
      </div>
    </FleetPageMain>
  );
}
