import Link from "next/link";
import {
  FleetDataTable,
  fleetTableClass,
  fleetTdClass,
  fleetThClass,
  fleetThRightClass,
  fleetTheadClass,
} from "@/components/fleet/fleet-data-table";
import { FilterResetLink } from "@/components/fleet/FilterResetLink";
import { FleetListPageLayout } from "@/components/fleet/FleetListPageLayout";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { DeleteVehicleButton } from "@/components/fleet/DeleteVehicleButton";
import { DriverHomeView, type DriverHomeTrip } from "@/components/fleet/DriverHomeView";
import {
  canWriteFleetOps,
  driverIdFromAuth,
  driverNameFromAuth,
  getAuthMeResult,
  isClientDriverPortal,
} from "@/lib/auth-server";
import { type VehicleListPayload, VEHICLE_STATUSES, fleetBrowserBase } from "@/lib/fleet-api";
import { filterFormKey } from "@/lib/filter-form-key";
import { fleetServerFetch } from "@/lib/fleet-server";
import type { ReminderActionRow } from "@/lib/reminder-actions";
import type { TicketListPayload } from "@/lib/tickets-api";

type Search = {
  q?: string;
  status?: string;
  page?: string;
};

function buildListQuery(sp: Search, pageSize = 20): string {
  const p = new URLSearchParams();
  if (sp.q?.trim()) p.set("q", sp.q.trim());
  if (sp.status?.trim()) p.set("status", sp.status.trim());
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  p.set("page", String(page));
  p.set("pageSize", String(pageSize));
  return p.toString();
}

async function getVehiclesList(sp: Search, pageSize = 20): Promise<VehicleListPayload | null> {
  try {
    const res = await fleetServerFetch(`/fleet/vehicles?${buildListQuery(sp, pageSize)}`);
    if (!res) return null;
    if (!res.ok) return null;
    return (await res.json()) as VehicleListPayload;
  } catch {
    return null;
  }
}

type TripListPayload = { items: DriverHomeTrip[] };
type ReminderListPayload = { items: ReminderActionRow[] };

async function loadDriverHomeData(driverId?: string) {
  const tripQs = new URLSearchParams({ page: "1", pageSize: "8", ended: "open" });
  if (driverId) tripQs.set("driverId", driverId);
  const [tripsRes, remindersRes, ticketsRes] = await Promise.all([
    fleetServerFetch(`/trips?${tripQs.toString()}`),
    fleetServerFetch("/reminders?status=action&page=1&pageSize=8"),
    fleetServerFetch("/tickets?page=1&pageSize=20"),
  ]);
  let trips: DriverHomeTrip[] = [];
  let reminders: ReminderActionRow[] = [];
  let tickets: TicketListPayload["items"] = [];
  try {
    if (tripsRes?.ok) trips = ((await tripsRes.json()) as TripListPayload).items ?? [];
  } catch {
    trips = [];
  }
  try {
    if (remindersRes?.ok) reminders = ((await remindersRes.json()) as ReminderListPayload).items ?? [];
  } catch {
    reminders = [];
  }
  try {
    if (ticketsRes?.ok) {
      const payload = (await ticketsRes.json()) as TicketListPayload;
      tickets = (payload.items ?? []).filter((t) => t.status === "open" || t.status === "in_progress").slice(0, 8);
    }
  } catch {
    tickets = [];
  }
  return { trips, reminders, tickets };
}

type PageProps = { searchParams: Promise<Search> };

export default async function FleetVehiclesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const auth = await getAuthMeResult();
  const write = canWriteFleetOps(auth);
  const driverPortal = isClientDriverPortal(auth);

  if (driverPortal) {
    const [list, extra] = await Promise.all([
      getVehiclesList({ page: "1" }, 50),
      loadDriverHomeData(driverIdFromAuth(auth)),
    ]);
    return (
      <DriverHomeView
        driverName={driverNameFromAuth(auth)}
        vehicles={list?.items ?? []}
        vehiclesLoadFailed={!list}
        trips={extra.trips}
        reminders={extra.reminders}
        tickets={extra.tickets}
      />
    );
  }

  const list = await getVehiclesList(sp);

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const pageSize = 20;
  const total = list?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const vehicles = list?.items ?? [];
  const exportQs = new URLSearchParams();
  if (sp.q?.trim()) exportQs.set("q", sp.q.trim());
  if (sp.status?.trim()) exportQs.set("status", sp.status.trim());
  const exportHref = `${fleetBrowserBase}/vehicles/export?${exportQs.toString()}`;

  const withPage = (nextPage: number) => {
    const p = new URLSearchParams();
    if (sp.q?.trim()) p.set("q", sp.q.trim());
    if (sp.status?.trim()) p.set("status", sp.status.trim());
    p.set("page", String(nextPage));
    return `/fleet/vehicles?${p.toString()}`;
  };

  return (
    <FleetPageMain fill>
      <FleetListPageLayout
        header={
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">
                {driverPortal ? "Cont șofer" : "Fleet core"}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                {driverPortal ? "Vehiculele tale" : "Vehicule"}
              </h1>
              <p className="mt-3 max-w-2xl text-zinc-400">
                {driverPortal
                  ? "Vehiculele alocate ție. Deschide un vehicul pentru curse, costuri și documente."
                  : "Căutare, filtru status, paginare și export CSV. Detaliu pe vehicul fără a intra direct în editare."}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {write ? (
                <>
                  <Link
                    href="/fleet/vehicles/new"
                    className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
                  >
                    Vehicul nou
                  </Link>
                  <Link
                    href="/fleet/vehicles/assemblies/new"
                    className="inline-flex items-center justify-center rounded-lg border border-emerald-600/50 bg-emerald-950/30 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-950/50"
                  >
                    Ansamblu nou
                  </Link>
                </>
              ) : null}
              {!driverPortal ? (
                <a
                  href={exportHref}
                  className="inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
                >
                  Export CSV
                </a>
              ) : null}
            </div>
          </div>
        }
        filters={
          <form
            key={filterFormKey(sp)}
            action="/fleet/vehicles"
            method="get"
            className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:flex-row sm:flex-wrap sm:items-end"
          >
            <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">Căutare</label>
              <input
                name="q"
                defaultValue={sp.q ?? ""}
                placeholder="Nr. înmatriculare, client, VIN…"
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
              />
            </div>
            <div className="flex min-w-[10rem] flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">Status</label>
              <select
                name="status"
                defaultValue={sp.status ?? ""}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
              >
                <option value="">Toate</option>
                {VEHICLE_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
            >
              Aplică
            </button>
            <FilterResetLink href="/fleet/vehicles" />
          </form>
        }
      >
        {!list ? (
          <p className="text-amber-400">
            Nu am putut încărca vehiculele. Verifică API-ul și sesiunea.
          </p>
        ) : vehicles.length === 0 ? (
          <p className="text-zinc-400">
            Nu există vehicule pentru filtrele curente.
            {write ? (
              <>
                {" "}
                <Link href="/fleet/vehicles/new" className="text-emerald-400 underline hover:text-emerald-300">
                  Adaugă vehicul
                </Link>
                .
              </>
            ) : (
              <> Contul tău are rol de citire; un administrator poate adăuga vehicule.</>
            )}
          </p>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {vehicles.map((v) => (
                <article key={v.id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                  <p className="font-mono text-sm font-medium text-zinc-100">{v.registrationNumber}</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {v.clientId}
                    {v.type ? ` · ${v.type}` : ""}
                    {v.status ? ` · ${v.status}` : ""}
                  </p>
                  <p className="mt-2 font-mono text-xs text-zinc-300">
                    {v.odometerKm.toLocaleString("ro-RO")} km
                    {" · ITP "}
                    {v.itpExpiresOn ? new Date(v.itpExpiresOn).toLocaleDateString("ro-RO") : "—"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={`/fleet/vehicles/${v.id}`}
                      className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-zinc-800"
                    >
                      Vezi
                    </Link>
                    {write ? (
                      <>
                        <Link
                          href={`/fleet/vehicles/${v.id}/edit`}
                          className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
                        >
                          Editare
                        </Link>
                        <DeleteVehicleButton vehicleId={v.id} registrationNumber={v.registrationNumber} />
                      </>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
            <div className="hidden md:block">
            <FleetDataTable>
                <table className={fleetTableClass}>
                  <thead className={`${fleetTheadClass} tracking-wide`}>
                    <tr>
                      <th className={fleetThClass}>Nr. înmatriculare</th>
                      <th className={fleetThClass}>Client</th>
                      <th className={fleetThClass}>Tip</th>
                      <th className={fleetThClass}>Status</th>
                      <th className={fleetThClass}>Km</th>
                      <th className={fleetThClass}>ITP expiră</th>
                      <th className={fleetThRightClass}>Detaliu</th>
                      {write ? <th className={fleetThRightClass}>Acțiuni</th> : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {vehicles.map((v) => (
                      <tr key={v.id} className="bg-zinc-900/30">
                        <td className={`${fleetTdClass} font-mono text-zinc-200`}>{v.registrationNumber}</td>
                        <td className={`${fleetTdClass} text-zinc-300`}>{v.clientId}</td>
                        <td className={`${fleetTdClass} text-zinc-300`}>{v.type}</td>
                        <td className={`${fleetTdClass} text-zinc-300`}>{v.status}</td>
                        <td className={`${fleetTdClass} font-mono text-zinc-300`}>{v.odometerKm}</td>
                        <td className={`${fleetTdClass} font-mono text-zinc-300`}>
                          {v.itpExpiresOn ? new Date(v.itpExpiresOn).toLocaleDateString("ro-RO") : "—"}
                        </td>
                        <td className={`${fleetTdClass} text-right`}>
                          <Link
                            href={`/fleet/vehicles/${v.id}`}
                            className="text-emerald-400 underline hover:text-emerald-300"
                          >
                            Vezi
                          </Link>
                        </td>
                        {write ? (
                          <td className={fleetTdClass}>
                            <div className="flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
                              <Link
                                href={`/fleet/vehicles/${v.id}/edit`}
                                className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
                              >
                                Editare
                              </Link>
                              <DeleteVehicleButton vehicleId={v.id} registrationNumber={v.registrationNumber} />
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </FleetDataTable>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-400">
                <p>
                  Pagina {page} din {totalPages} · {total} vehicule
                </p>
                <div className="flex gap-2">
                  {page > 1 ? (
                    <Link
                      href={withPage(page - 1)}
                      className="rounded-lg border border-zinc-700 px-3 py-1.5 hover:bg-zinc-900"
                    >
                      ← Anterior
                    </Link>
                  ) : null}
                  {page < totalPages ? (
                    <Link
                      href={withPage(page + 1)}
                      className="rounded-lg border border-zinc-700 px-3 py-1.5 hover:bg-zinc-900"
                    >
                      Următor →
                    </Link>
                  ) : null}
                </div>
              </div>
            </>
          )}
      </FleetListPageLayout>
    </FleetPageMain>
  );
}
