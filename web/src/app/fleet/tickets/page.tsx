import Link from "next/link";
import { cookies } from "next/headers";
import { FilterResetLink } from "@/components/fleet/FilterResetLink";
import { FleetIndexFilterChips, type FleetIndexFilterChip } from "@/components/fleet/FleetIndexFilterChips";
import { FleetListPageLayout } from "@/components/fleet/FleetListPageLayout";
import { DriverPager, DriverRecordList, DriverStatusBand } from "@/components/fleet/DriverPortalList";
import { DriverViewportSplit } from "@/components/fleet/DriverViewportSplit";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { TicketBoardView } from "@/components/fleet/TicketBoardView";
import { TicketDataGrid } from "@/components/fleet/tickets/TicketDataGrid";
import { TicketFocusView } from "@/components/fleet/TicketFocusView";
import { TicketKpiStrip } from "@/components/fleet/TicketKpiStrip";
import { canPatchTickets, canUseTicketListBulk, canWriteTickets, driverIdFromAuth, getAuthMeResult, isClientDriverPortal, isClientPortalUser } from "@/lib/auth-server";
import { filterDriverPortalTickets } from "@/lib/driver-portal-server";
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
import { t } from "@/lib/i18n/t";
import { LOCALE_COOKIE_NAME, parseLocale } from "@/lib/i18n/types";

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
  const cookieStore = await cookies();
  const locale = parseLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  const auth = await getAuthMeResult();
  const driverPortal = isClientDriverPortal(auth);
  const viewBoard = !driverPortal && sp.view === "board";
  const viewFocus = !driverPortal && sp.view === "focus";
  const clientScoped = isClientPortalUser(auth);
  const [list, focus, stats, board, clients, vehicles] = await Promise.all([
    viewBoard || viewFocus ? Promise.resolve(null) : loadTickets(sp),
    viewFocus ? loadFocus(sp) : Promise.resolve(null),
    loadStats(sp.clientId),
    viewBoard ? loadBoard(sp) : Promise.resolve(null),
    clientScoped ? Promise.resolve([]) : loadClientOptions(),
    getVehicleOptions(),
  ]);
  const write = canWriteTickets(auth);

  const patch = canPatchTickets(auth);
  const enableBulk = canUseTicketListBulk(auth);
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

  const filterParams: Record<string, string> = {};
  if (sp.q?.trim()) filterParams.q = sp.q.trim();
  if (sp.status?.trim()) filterParams.status = sp.status.trim();
  if (sp.clientId?.trim()) filterParams.clientId = sp.clientId.trim();
  if (sp.ticketType?.trim()) filterParams.ticketType = sp.ticketType.trim();
  if (sp.vehicleId?.trim()) filterParams.vehicleId = sp.vehicleId.trim();
  if (sp.routingLevel?.trim()) filterParams.routingLevel = sp.routingLevel.trim();
  if (sp.inbox?.trim()) filterParams.inbox = sp.inbox.trim();

  const filterChips: FleetIndexFilterChip[] = [];
  if (sp.q?.trim()) {
    filterChips.push({ key: "q", label: `Căutare: ${sp.q.trim()}`, clearHref: withParams({ q: undefined, page: "1" }) });
  }
  if (sp.status?.trim()) {
    filterChips.push({ key: "status", label: `Status: ${sp.status}`, clearHref: withParams({ status: undefined, page: "1" }) });
  }
  if (sp.ticketType?.trim()) {
    const typeLabel = TICKET_TYPES.find((t) => t.value === sp.ticketType)?.label ?? sp.ticketType;
    filterChips.push({
      key: "ticketType",
      label: `Tip: ${typeLabel}`,
      clearHref: withParams({ ticketType: undefined, page: "1" }),
    });
  }
  if (sp.clientId?.trim()) {
    filterChips.push({
      key: "clientId",
      label: `Client: ${sp.clientId}`,
      clearHref: withParams({ clientId: undefined, page: "1" }),
    });
  }
  if (sp.inbox?.trim()) {
    filterChips.push({
      key: "inbox",
      label: `Inbox: ${sp.inbox === "lstar" ? "L★" : sp.inbox}`,
      clearHref: withParams({ inbox: undefined, page: "1" }),
    });
  }
  if (sp.vehicleId?.trim()) {
    const v = vehicles.find((x) => x.id === sp.vehicleId);
    filterChips.push({
      key: "vehicleId",
      label: `Vehicul: ${v?.registrationNumber ?? sp.vehicleId}`,
      clearHref: withParams({ vehicleId: undefined, page: "1" }),
    });
  }
  if (sp.routingLevel?.trim()) {
    filterChips.push({
      key: "routingLevel",
      label: `Rutare: ${sp.routingLevel}`,
      clearHref: withParams({ routingLevel: undefined, page: "1" }),
    });
  }

  const desktop = (
    <FleetPageMain fill>
      <FleetListPageLayout
        header={
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">{t(locale, "pages.tickets.eyebrow")}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t(locale, "pages.tickets.title")}</h1>
              <p className="mt-3 max-w-2xl text-zinc-400">
                {t(locale, "pages.tickets.description")}
              </p>
            </div>
            {write ? (
              <Link
                href="/fleet/tickets/new"
                className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
              >
                {t(locale, "pages.tickets.newRequest")}
              </Link>
            ) : null}
          </div>
        }
        filters={
          <form method="get" className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 shadow-sm shadow-black/20">
            {viewBoard || viewFocus ? (
              <input type="hidden" name="view" value={sp.view ?? ""} />
            ) : null}
            <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-zinc-500">{t(locale, "common.filters.search")}</label>
              <input
                name="q"
                defaultValue={sp.q ?? ""}
                className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                placeholder={t(locale, "pages.tickets.searchPlaceholder")}
              />
            </div>
            {!viewBoard && !viewFocus ? (
              <div>
                <label className="text-xs text-zinc-500">{t(locale, "common.filters.status")}</label>
                <select
                  name="status"
                  defaultValue={sp.status ?? ""}
                  className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                >
                  <option value="">{t(locale, "common.filters.all")}</option>
                  <option value="open">{t(locale, "ops.grids.tickets.status.open")}</option>
                  <option value="in_progress">{t(locale, "ops.grids.tickets.status.in_progress")}</option>
                  <option value="resolved">{t(locale, "ops.grids.tickets.status.resolved")}</option>
                  <option value="cancelled">{t(locale, "ops.grids.tickets.status.cancelled")}</option>
                </select>
              </div>
            ) : null}
            {!viewFocus ? (
              <div>
                <label className="text-xs text-zinc-500">{t(locale, "pages.tickets.type")}</label>
                <select
                  name="ticketType"
                  defaultValue={sp.ticketType ?? ""}
                  className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                >
                  <option value="">{t(locale, "common.filters.all")}</option>
                  {TICKET_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {t(locale, `ops.grids.tickets.type.${type.value}`)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {!clientScoped ? (
            <div>
              <label className="text-xs text-zinc-500">{t(locale, "common.filters.client")}</label>
              <select
                name="clientId"
                defaultValue={sp.clientId ?? ""}
                className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="">{t(locale, "common.filters.all")}</option>
                {clients.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.legalName}
                  </option>
                ))}
              </select>
            </div>
            ) : null}
            <div>
              <label className="text-xs text-zinc-500">{t(locale, "pages.tickets.inbox")}</label>
              <select
                name="inbox"
                defaultValue={sp.inbox ?? ""}
                className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="">{t(locale, "common.filters.all")}</option>
                <option value="lstar">Doar L★</option>
              </select>
            </div>
            {!viewBoard && !viewFocus ? (
              <>
                <div>
                  <label className="text-xs text-zinc-500">{t(locale, "common.filters.vehicle")}</label>
                  <select
                    name="vehicleId"
                    defaultValue={sp.vehicleId ?? ""}
                    className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  >
                    <option value="">{t(locale, "common.filters.all")}</option>
                    {vehicleOptions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.registrationNumber}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-500">{t(locale, "pages.tickets.routingLevel")}</label>
                  <select
                    name="routingLevel"
                    defaultValue={sp.routingLevel ?? ""}
                    className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  >
                    <option value="">{t(locale, "common.filters.all")}</option>
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
              {t(locale, "common.actions.filter")}
            </button>
            <FilterResetLink href="/fleet/tickets" />
            </div>
            <FleetIndexFilterChips chips={filterChips} resetHref="/fleet/tickets" />
          </form>
        }
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={withParams({ view: undefined, page: "1" })}
              className={`rounded-lg px-3 py-1.5 text-sm ${!viewBoard ? "bg-emerald-600 text-white" : "border border-zinc-700 text-zinc-300 hover:bg-zinc-900"}`}
            >
              {t(locale, "pages.tickets.list")}
            </Link>
            <Link
              href={withParams({ view: "board", page: "1" })}
              className={`rounded-lg px-3 py-1.5 text-sm ${viewBoard ? "bg-emerald-600 text-white" : "border border-zinc-700 text-zinc-300 hover:bg-zinc-900"}`}
            >
              {t(locale, "pages.tickets.board")}
            </Link>
            <Link
              href={withParams({ view: "focus", page: "1" })}
              className={`rounded-lg px-3 py-1.5 text-sm ${viewFocus ? "bg-amber-600 text-white" : "border border-zinc-700 text-zinc-300 hover:bg-zinc-900"}`}
            >
              {t(locale, "pages.tickets.focus")}
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
            <TicketDataGrid
              items={list.items}
              canWrite={write}
              canPatch={patch}
              enableBulk={enableBulk}
              exportHref={exportHref}
              filterParams={filterParams}
            />
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

  if (!driverPortal) return desktop;

  const driverId = driverIdFromAuth(auth);
  const userId = auth.ok ? auth.me.userId : undefined;
  const status = sp.status === "open" || sp.status === "in_progress" || sp.status === "resolved" ? sp.status : "all";
  const bandHref = (next: string) => (next === "all" ? "/fleet/tickets" : `/fleet/tickets?status=${next}`);
  const mobilePageHref = (nextPage: number) => {
    const p = new URLSearchParams();
    if (status !== "all") p.set("status", status);
    if (nextPage > 1) p.set("page", String(nextPage));
    const qs = p.toString();
    return `/fleet/tickets${qs ? `?${qs}` : ""}`;
  };
  const driverItems = list ? filterDriverPortalTickets(list.items, userId, driverId) : [];
  const filteredByStatus = status === "all" ? driverItems : driverItems.filter((row) => row.status === status);
  const pageSize = 50;
  const mobileTotalPages = Math.max(1, Math.ceil(filteredByStatus.length / pageSize));
  const pageItems = filteredByStatus.slice((page - 1) * pageSize, page * pageSize);
  const statusLabel = (value: string) => {
    const key = `ops.grids.tickets.status.${value}`;
    const label = t(locale, key);
    return label === key ? value : label;
  };

  const mobile = (
    <FleetPageMain narrow="sm">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t(locale, "driverLists.tickets")}</h1>
        {write ? (
          <Link href="/fleet/tickets/new" className="text-sm font-medium text-emerald-400">
            {t(locale, "driver.home.newTicket")}
          </Link>
        ) : null}
      </div>
      <DriverStatusBand
        items={[
          { href: bandHref("all"), label: t(locale, "driverLists.all"), active: status === "all" },
          { href: bandHref("open"), label: t(locale, "driverLists.open"), active: status === "open" },
          { href: bandHref("in_progress"), label: t(locale, "driverLists.inProgress"), active: status === "in_progress" },
        ]}
      />
      {list ? (
        <DriverRecordList
          empty={t(locale, "driverLists.empty")}
          items={pageItems.map((row) => ({
            href: `/fleet/tickets/${row.id}`,
            title: row.subject,
            meta: [row.displayId, row.registrationNumber].filter(Boolean).join(" · "),
            badge: statusLabel(row.status),
          }))}
        />
      ) : (
        <p className="py-8 text-sm text-amber-400">{t(locale, "driverLists.loadFailed")}</p>
      )}
      <DriverPager
        page={page}
        totalPages={mobileTotalPages}
        prevHref={page > 1 ? mobilePageHref(page - 1) : null}
        nextHref={page < mobileTotalPages ? mobilePageHref(page + 1) : null}
        prevLabel={t(locale, "driverLists.prev")}
        nextLabel={t(locale, "driverLists.next")}
      />
    </FleetPageMain>
  );

  return <DriverViewportSplit mobile={mobile} desktop={desktop} />;
}
