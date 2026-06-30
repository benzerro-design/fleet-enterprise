import Link from "next/link";
import { FilterResetLink } from "@/components/fleet/FilterResetLink";
import { FleetListPageLayout } from "@/components/fleet/FleetListPageLayout";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { TicketBoardView } from "@/components/fleet/TicketBoardView";
import { TicketDataGrid } from "@/components/fleet/tickets/TicketDataGrid";
import { TicketFocusView } from "@/components/fleet/TicketFocusView";
import { TicketKpiStrip } from "@/components/fleet/TicketKpiStrip";
import { canPatchTickets, canWriteTickets, getAuthMeResult } from "@/lib/auth-server";
import type { ClientListPayload } from "@/lib/clients-api";
import { fleetServerFetch } from "@/lib/fleet-server";
import { ticketsBrowserBase } from "@/lib/tickets-api";
import { getVehicleOptions } from "@/lib/vehicle-options-server";
import {
  TICKET_TYPES,
  type TicketBoardPayload,
  type TicketListPayload,
  type TicketStats,
} from "@/lib/tickets-api";

type Search = {
  q?: string;
  status?: string;
  clientId?: string;
  ticketType?: string;
  vehicleId?: string;
  routingLevel?: string;
  inbox?: string;
  view?: string;
  page?: string;
};

async function loadTickets(sp: Search): Promise<TicketListPayload | null> {
  const p = new URLSearchParams();
  if (sp.q?.trim()) p.set("q", sp.q.trim());
  if (sp.status?.trim()) p.set("status", sp.status.trim());
  if (sp.clientId?.trim()) p.set("clientId", sp.clientId.trim());
  if (sp.ticketType?.trim()) p.set("ticketType", sp.ticketType.trim());
  if (sp.vehicleId?.trim()) p.set("vehicleId", sp.vehicleId.trim());
  if (sp.routingLevel?.trim()) p.set("routingLevel", sp.routingLevel.trim());
  if (sp.inbox?.trim()) p.set("inbox", sp.inbox.trim());
  p.set("page", String(Math.max(1, parseInt(sp.page ?? "1", 10) || 1)));
  p.set("pageSize", "50");
  try {
    const res = await fleetServerFetch(`/tickets?${p.toString()}`);
    if (!res?.ok) return null;
    return (await res.json()) as TicketListPayload;
  } catch {
    return null;
  }
}

async function loadStats(clientId?: string): Promise<TicketStats | null> {
  const p = new URLSearchParams();
  if (clientId?.trim()) p.set("clientId", clientId.trim());
  try {
    const res = await fleetServerFetch(`/tickets/stats?${p.toString()}`);
    if (!res?.ok) return null;
    return (await res.json()) as TicketStats;
  } catch {
    return null;
  }
}

async function loadFocus(sp: Search): Promise<TicketListPayload | null> {
  const p = new URLSearchParams();
  if (sp.clientId?.trim()) p.set("clientId", sp.clientId.trim());
  p.set("page", String(Math.max(1, parseInt(sp.page ?? "1", 10) || 1)));
  p.set("pageSize", "50");
  try {
    const res = await fleetServerFetch(`/tickets/focus?${p.toString()}`);
    if (!res?.ok) return null;
    return (await res.json()) as TicketListPayload;
  } catch {
    return null;
  }
}

async function loadBoard(sp: Search): Promise<TicketBoardPayload | null> {
  const p = new URLSearchParams();
  if (sp.clientId?.trim()) p.set("clientId", sp.clientId.trim());
  if (sp.inbox?.trim()) p.set("inbox", sp.inbox.trim());
  try {
    const res = await fleetServerFetch(`/tickets/board?${p.toString()}`);
    if (!res?.ok) return null;
    return (await res.json()) as TicketBoardPayload;
  } catch {
    return null;
  }
}

async function loadClientOptions(): Promise<Array<{ code: string; legalName: string }>> {
  try {
    const res = await fleetServerFetch("/clients?status=active&pageSize=200");
    if (!res?.ok) return [];
    const data = (await res.json()) as ClientListPayload;
    return data.items.map((c) => ({ code: c.code, legalName: c.legalName }));
  } catch {
    return [];
  }
}

type PageProps = { searchParams: Promise<Search> };

export default async function FleetTicketsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const viewBoard = sp.view === "board";
  const viewFocus = sp.view === "focus";
  const [list, focus, stats, board, clients, vehicles, auth] = await Promise.all([
    viewBoard || viewFocus ? Promise.resolve(null) : loadTickets(sp),
    viewFocus ? loadFocus(sp) : Promise.resolve(null),
    loadStats(sp.clientId),
    viewBoard ? loadBoard(sp) : Promise.resolve(null),
    loadClientOptions(),
    getVehicleOptions(),
    getAuthMeResult(),
  ]);
  const write = canWriteTickets(auth);
  const patch = canPatchTickets(auth);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const withParams = (overrides: Partial<Search>) => {
    const p = new URLSearchParams();
    const merged = { ...sp, ...overrides };
    if (merged.q?.trim()) p.set("q", merged.q.trim());
    if (merged.status?.trim()) p.set("status", merged.status.trim());
    if (merged.clientId?.trim()) p.set("clientId", merged.clientId.trim());
    if (merged.ticketType?.trim()) p.set("ticketType", merged.ticketType.trim());
    if (merged.vehicleId?.trim()) p.set("vehicleId", merged.vehicleId.trim());
    if (merged.routingLevel?.trim()) p.set("routingLevel", merged.routingLevel.trim());
    if (merged.inbox?.trim()) p.set("inbox", merged.inbox.trim());
    if (merged.view?.trim()) p.set("view", merged.view.trim());
    if (merged.page && merged.page !== "1") p.set("page", merged.page);
    const qs = p.toString();
    return `/fleet/tickets${qs ? `?${qs}` : ""}`;
  };

  const withPage = (next: number) => withParams({ page: String(next) });

  const exportParams = new URLSearchParams();
  if (sp.q?.trim()) exportParams.set("q", sp.q.trim());
  if (sp.status?.trim()) exportParams.set("status", sp.status.trim());
  if (sp.clientId?.trim()) exportParams.set("clientId", sp.clientId.trim());
  if (sp.ticketType?.trim()) exportParams.set("ticketType", sp.ticketType.trim());
  if (sp.vehicleId?.trim()) exportParams.set("vehicleId", sp.vehicleId.trim());
  if (sp.routingLevel?.trim()) exportParams.set("routingLevel", sp.routingLevel.trim());
  if (sp.inbox?.trim()) exportParams.set("inbox", sp.inbox.trim());
  const exportQs = exportParams.toString();
  const exportHref = `${ticketsBrowserBase}/export${exportQs ? `?${exportQs}` : ""}`;

  const vehicleOptions = sp.clientId?.trim()
    ? vehicles.filter((v) => v.clientId.toLowerCase() === sp.clientId!.trim().toLowerCase())
    : vehicles;

  return (
    <FleetPageMain fill>
      <FleetListPageLayout
        header={
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Clienți & CRM</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Tichete CRM</h1>
              <p className="mt-3 max-w-2xl text-zinc-400">
                Solicitări flotă — inbox L1, escaladare L★, transformare în mentenanță.
              </p>
            </div>
            {write ? (
              <Link
                href="/fleet/tickets/new"
                className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
              >
                Solicitare nouă
              </Link>
            ) : null}
          </div>
        }
        filters={
          <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
            {viewBoard || viewFocus ? (
              <input type="hidden" name="view" value={sp.view ?? ""} />
            ) : null}
            <div>
              <label className="text-xs text-zinc-500">Căutare</label>
              <input
                name="q"
                defaultValue={sp.q ?? ""}
                className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                placeholder="subiect, descriere"
              />
            </div>
            {!viewBoard && !viewFocus ? (
              <div>
                <label className="text-xs text-zinc-500">Status</label>
                <select
                  name="status"
                  defaultValue={sp.status ?? ""}
                  className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                >
                  <option value="">Toate</option>
                  <option value="open">Deschis</option>
                  <option value="in_progress">În lucru</option>
                  <option value="resolved">Rezolvat</option>
                  <option value="cancelled">Anulat</option>
                </select>
              </div>
            ) : null}
            {!viewFocus ? (
              <div>
                <label className="text-xs text-zinc-500">Tip</label>
                <select
                  name="ticketType"
                  defaultValue={sp.ticketType ?? ""}
                  className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                >
                  <option value="">Toate</option>
                  {TICKET_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div>
              <label className="text-xs text-zinc-500">Client</label>
              <select
                name="clientId"
                defaultValue={sp.clientId ?? ""}
                className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="">Toți</option>
                {clients.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.legalName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500">Inbox</label>
              <select
                name="inbox"
                defaultValue={sp.inbox ?? ""}
                className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="">Toate</option>
                <option value="lstar">Doar L★</option>
              </select>
            </div>
            {!viewBoard && !viewFocus ? (
              <>
                <div>
                  <label className="text-xs text-zinc-500">Vehicul</label>
                  <select
                    name="vehicleId"
                    defaultValue={sp.vehicleId ?? ""}
                    className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  >
                    <option value="">Toate</option>
                    {vehicleOptions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.registrationNumber}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-500">Nivel rutare</label>
                  <select
                    name="routingLevel"
                    defaultValue={sp.routingLevel ?? ""}
                    className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  >
                    <option value="">Toate</option>
                    <option value="L0">L0</option>
                    <option value="L1">L1</option>
                    <option value="L1N">L1+N</option>
                    <option value="L_STAR">L★</option>
                  </select>
                </div>
              </>
            ) : null}
            <button
              type="submit"
              className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
            >
              Filtrează
            </button>
            <FilterResetLink href="/fleet/tickets" />
          </form>
        }
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={withParams({ view: undefined, page: "1" })}
              className={`rounded-lg px-3 py-1.5 text-sm ${!viewBoard ? "bg-emerald-600 text-white" : "border border-zinc-700 text-zinc-300 hover:bg-zinc-900"}`}
            >
              Listă
            </Link>
            <Link
              href={withParams({ view: "board", page: "1" })}
              className={`rounded-lg px-3 py-1.5 text-sm ${viewBoard ? "bg-emerald-600 text-white" : "border border-zinc-700 text-zinc-300 hover:bg-zinc-900"}`}
            >
              Board
            </Link>
            <Link
              href={withParams({ view: "focus", page: "1" })}
              className={`rounded-lg px-3 py-1.5 text-sm ${viewFocus ? "bg-amber-600 text-white" : "border border-zinc-700 text-zinc-300 hover:bg-zinc-900"}`}
            >
              Focus urgențe
            </Link>
          </div>
        }
      >
        {stats ? (
          <div className="mb-6">
            <TicketKpiStrip stats={stats} />
          </div>
        ) : null}

        {viewFocus && focus ? (
          <TicketFocusView items={focus.items} />
        ) : viewBoard && board ? (
          <TicketBoardView board={board} />
        ) : list ? (
          <>
            <TicketDataGrid items={list.items} canWrite={write} canPatch={patch} exportHref={exportHref} />
            {list.total > list.pageSize ? (
              <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
                <span>
                  Pagina {page} · {list.total} total
                </span>
                <div className="flex gap-2">
                  {page > 1 ? (
                    <Link href={withPage(page - 1)} className="rounded border border-zinc-700 px-3 py-1 hover:bg-zinc-900">
                      Înapoi
                    </Link>
                  ) : null}
                  {page * list.pageSize < list.total ? (
                    <Link href={withPage(page + 1)} className="rounded border border-zinc-700 px-3 py-1 hover:bg-zinc-900">
                      Înainte
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-zinc-500">Nu s-au putut încărca tichetele.</p>
        )}
      </FleetListPageLayout>
    </FleetPageMain>
  );
}
