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
import { DeleteTripButton } from "@/components/fleet/DeleteTripButton";
import { TripSheetDocumentsList } from "@/components/fleet/TripSheetDocumentsList";
import { TripSheetWizard } from "@/components/fleet/TripSheetWizard";
import { ConsumptionFilterForm } from "@/components/fleet/ConsumptionFilterForm";
import { TripsConsumptionView } from "@/components/fleet/TripsConsumptionView";
import { TripTachographPlaceholder } from "@/components/fleet/TripTachographPlaceholder";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { tripsBrowserBase } from "@/lib/fleet-api";
import { filterFormKey } from "@/lib/filter-form-key";
import { formatDateTimeRo } from "@/lib/datetime-local";
import { fleetServerFetch } from "@/lib/fleet-server";
import type { ConsumptionPayload } from "@/lib/consumption-types";
import { parseFuelTypesCsv, resolveVehicleFuelType } from "@/lib/fuel-types";
import { TRIP_SHEET_DOC_TYPES } from "@/lib/trip-ops";

type Search = {
  page?: string;
  registrationNumber?: string;
  clientId?: string;
  q?: string;
  startedFrom?: string;
  startedTo?: string;
  ended?: string;
  view?: string;
  generated?: string;
  docType?: string;
  periodFrom?: string;
  periodTo?: string;
  vehicleIds?: string;
  fuelTypes?: string;
  createdFrom?: string;
  createdTo?: string;
};

type TripRow = {
  id: string;
  tenantSlug: string;
  vehicleId: string;
  registrationNumber: string;
  clientId: string;
  reference: string | null;
  startedAt: string;
  endedAt: string | null;
  originLabel: string | null;
  destLabel: string | null;
  distanceKm: number | null;
};

type TripListPayload = { items: TripRow[]; total: number; page: number; pageSize: number };

type TripSheetDocRow = {
  id: string;
  docType: string;
  docTypeLabel: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  driverName: string | null;
  createdAt: string;
};

type TripSheetListPayload = {
  items: TripSheetDocRow[];
  total: number;
  page: number;
  pageSize: number;
};

type VehicleOption = {
  id: string;
  registrationNumber: string;
  clientId: string;
  fuelType?: string | null;
  civProfile?: Record<string, string | number | null>;
};

type TripsView = "trips" | "documents" | "tachograph" | "consumption";

function resolveTripsView(sp: Search): TripsView {
  if (sp.view === "documents") return "documents";
  if (sp.view === "tachograph") return "tachograph";
  if (sp.view === "consumption") return "consumption";
  return "trips";
}

function defaultConsumptionPeriod(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return {
    from: from.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  };
}

function parseSelectedVehicleIds(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw.split(",").map((id) => id.trim()).filter(Boolean);
}

function tabLinkClass(active: boolean): string {
  return `rounded-t-md px-3 py-1.5 text-xs ${active ? "bg-zinc-900 text-emerald-400" : "text-zinc-400 hover:text-zinc-200"}`;
}

const tripActionBtn =
  "inline-flex shrink-0 items-center rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap";
const tripActionBtnPrimary = `${tripActionBtn} bg-emerald-500 text-zinc-950 hover:bg-emerald-400`;
const tripActionBtnOutline = `${tripActionBtn} border border-zinc-700 bg-zinc-900/40 text-zinc-200 hover:bg-zinc-900`;
const tripActionBtnEmeraldOutline = `${tripActionBtn} border border-emerald-700/60 bg-emerald-950/40 text-emerald-200 hover:bg-emerald-950/70`;

function buildQuery(sp: Search): string {
  const q = new URLSearchParams();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  q.set("page", String(page));
  q.set("pageSize", "20");
  if (sp.registrationNumber?.trim()) q.set("registrationNumber", sp.registrationNumber.trim());
  if (sp.clientId?.trim()) q.set("clientId", sp.clientId.trim());
  if (sp.q?.trim()) q.set("q", sp.q.trim());
  if (sp.startedFrom?.trim()) q.set("startedFrom", sp.startedFrom.trim());
  if (sp.startedTo?.trim()) q.set("startedTo", sp.startedTo.trim());
  if (sp.ended === "open" || sp.ended === "closed") q.set("ended", sp.ended);
  return q.toString();
}

function buildExportQuery(sp: Search): string {
  const q = new URLSearchParams();
  if (sp.registrationNumber?.trim()) q.set("registrationNumber", sp.registrationNumber.trim());
  if (sp.clientId?.trim()) q.set("clientId", sp.clientId.trim());
  if (sp.q?.trim()) q.set("q", sp.q.trim());
  if (sp.startedFrom?.trim()) q.set("startedFrom", sp.startedFrom.trim());
  if (sp.startedTo?.trim()) q.set("startedTo", sp.startedTo.trim());
  if (sp.ended === "open" || sp.ended === "closed") q.set("ended", sp.ended);
  return q.toString();
}

async function fetchTrips(sp: Search): Promise<TripListPayload | null> {
  const res = await fleetServerFetch(`/trips?${buildQuery(sp)}`);
  if (!res?.ok) return null;
  return (await res.json()) as TripListPayload;
}

function buildTripSheetsQuery(sp: Search): string {
  const q = new URLSearchParams();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  q.set("page", String(page));
  q.set("pageSize", "20");
  if (sp.registrationNumber?.trim()) q.set("registrationNumber", sp.registrationNumber.trim());
  if (sp.clientId?.trim()) q.set("clientId", sp.clientId.trim());
  if (sp.q?.trim()) q.set("q", sp.q.trim());
  if (sp.docType === "trip_sheet" || sp.docType === "faz_monthly") q.set("docType", sp.docType);
  if (sp.periodFrom?.trim()) q.set("periodFrom", sp.periodFrom.trim());
  if (sp.periodTo?.trim()) q.set("periodTo", sp.periodTo.trim());
  if (sp.createdFrom?.trim()) q.set("createdFrom", sp.createdFrom.trim());
  if (sp.createdTo?.trim()) q.set("createdTo", sp.createdTo.trim());
  return q.toString();
}

async function fetchTripSheets(sp: Search): Promise<TripSheetListPayload | null> {
  const res = await fleetServerFetch(`/trip-sheets?${buildTripSheetsQuery(sp)}`);
  if (!res?.ok) return null;
  return (await res.json()) as TripSheetListPayload;
}

async function fetchConsumption(sp: Search): Promise<ConsumptionPayload | null> {
  const defaults = defaultConsumptionPeriod();
  const from = sp.periodFrom?.trim() || defaults.from;
  const to = sp.periodTo?.trim() || defaults.to;
  const q = new URLSearchParams({ from, to });
  if (sp.vehicleIds?.trim()) q.set("vehicleIds", sp.vehicleIds.trim());
  if (sp.fuelTypes?.trim()) q.set("fuelTypes", sp.fuelTypes.trim());
  const res = await fleetServerFetch(`/trips/consumption?${q}`);
  if (!res?.ok) return null;
  return (await res.json()) as ConsumptionPayload;
}

async function fetchVehicleOptions(): Promise<VehicleOption[]> {
  const res = await fleetServerFetch("/fleet/vehicles?page=1&pageSize=200");
  if (!res?.ok) return [];
  const data = (await res.json()) as {
    items: Array<{
      id: string;
      registrationNumber: string;
      clientId: string;
      fuelType?: string | null;
      civProfile?: Record<string, string | number | null>;
    }>;
  };
  return data.items.map((v) => ({
    id: v.id,
    registrationNumber: v.registrationNumber,
    clientId: v.clientId,
    fuelType: v.fuelType ?? null,
    civProfile: v.civProfile ?? {},
  }));
}

type Props = { searchParams: Promise<Search> };

export default async function TripsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const view = resolveTripsView(sp);
  const showTrips = view === "trips";
  const showDocuments = view === "documents";
  const showTachograph = view === "tachograph";
  const showConsumption = view === "consumption";
  const consumptionDefaults = defaultConsumptionPeriod();
  const consumptionPeriodFrom = sp.periodFrom?.trim() || consumptionDefaults.from;
  const consumptionPeriodTo = sp.periodTo?.trim() || consumptionDefaults.to;
  const selectedVehicleIds = parseSelectedVehicleIds(sp.vehicleIds);
  const selectedFuelTypes = parseFuelTypesCsv(sp.fuelTypes);
  const [data, auth, documents, vehicles, consumption] = await Promise.all([
    showTrips ? fetchTrips(sp) : Promise.resolve(null),
    getAuthMeResult(),
    showDocuments ? fetchTripSheets(sp) : Promise.resolve(null),
    fetchVehicleOptions(),
    showConsumption ? fetchConsumption(sp) : Promise.resolve(null),
  ]);
  const consumptionVehicleOptions =
    selectedFuelTypes.length > 0
      ? vehicles.filter((v) => {
          const ft = resolveVehicleFuelType({ fuelType: v.fuelType, civProfile: v.civProfile });
          return ft != null && selectedFuelTypes.includes(ft);
        })
      : vehicles;
  const write = canManageFleet(auth);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 20));
  const docsPage = documents?.page ?? page;
  const docsTotalPages = Math.max(1, Math.ceil((documents?.total ?? 0) / 20));

  const exportQs = buildExportQuery(sp);
  const exportHref = `${tripsBrowserBase}/export${exportQs ? `?${exportQs}` : ""}`;

  const withPage = (nextPage: number) => {
    const p = new URLSearchParams();
    p.set("page", String(nextPage));
    if (sp.registrationNumber?.trim()) p.set("registrationNumber", sp.registrationNumber.trim());
    if (sp.clientId?.trim()) p.set("clientId", sp.clientId.trim());
    if (sp.q?.trim()) p.set("q", sp.q.trim());
    if (sp.startedFrom?.trim()) p.set("startedFrom", sp.startedFrom.trim());
    if (sp.startedTo?.trim()) p.set("startedTo", sp.startedTo.trim());
    if (sp.ended === "open" || sp.ended === "closed") p.set("ended", sp.ended);
    return `/fleet/trips?${p.toString()}`;
  };

  const withDocsPage = (nextPage: number) => {
    const p = new URLSearchParams();
    p.set("view", "documents");
    p.set("page", String(nextPage));
    if (sp.registrationNumber?.trim()) p.set("registrationNumber", sp.registrationNumber.trim());
    if (sp.clientId?.trim()) p.set("clientId", sp.clientId.trim());
    if (sp.q?.trim()) p.set("q", sp.q.trim());
    if (sp.docType === "trip_sheet" || sp.docType === "faz_monthly") p.set("docType", sp.docType);
    if (sp.periodFrom?.trim()) p.set("periodFrom", sp.periodFrom.trim());
    if (sp.periodTo?.trim()) p.set("periodTo", sp.periodTo.trim());
    if (sp.createdFrom?.trim()) p.set("createdFrom", sp.createdFrom.trim());
    if (sp.createdTo?.trim()) p.set("createdTo", sp.createdTo.trim());
    if (sp.generated?.trim()) p.set("generated", sp.generated.trim());
    return `/fleet/trips?${p.toString()}`;
  };

  return (
    <FleetPageMain fill>
      <FleetListPageLayout
        header={
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-baseline gap-3">
                <p className="text-xs font-medium uppercase tracking-widest text-emerald-400">Operațional</p>
                <h1 className="text-2xl font-semibold tracking-tight">Curse</h1>
              </div>
              <div className="flex shrink-0 flex-nowrap items-center gap-1.5 overflow-x-auto pb-0.5">
                {write ? (
                  <>
                    <Link href="/fleet/trips/new" className={tripActionBtnPrimary}>
                      Cursă nouă
                    </Link>
                    <TripSheetWizard vehicles={vehicles} triggerClassName={tripActionBtnEmeraldOutline} />
                  </>
                ) : null}
                <a href={exportHref} className={tripActionBtnOutline}>
                  Export CSV
                </a>
                <Link href="/fleet/vehicles" className={tripActionBtnOutline}>
                  Înapoi la vehicule
                </Link>
              </div>
            </div>

            <nav className="flex flex-wrap gap-1 border-b border-zinc-800">
              <Link href="/fleet/trips" className={tabLinkClass(showTrips)}>
                Listă curse
              </Link>
              <Link href="/fleet/trips?view=documents" className={tabLinkClass(showDocuments)}>
                Documente parcurs
              </Link>
              <Link href="/fleet/trips?view=consumption" className={tabLinkClass(showConsumption)}>
                Consum
              </Link>
              <Link href="/fleet/trips?view=tachograph" className={tabLinkClass(showTachograph)}>
                Tahograf
              </Link>
            </nav>
          </>
        }
        filters={
          showTachograph ? undefined : showConsumption ? (
            <ConsumptionFilterForm
              vehicles={consumptionVehicleOptions}
              periodFrom={consumptionPeriodFrom}
              periodTo={consumptionPeriodTo}
              selectedVehicleIds={selectedVehicleIds}
              selectedFuelTypes={selectedFuelTypes}
            />
          ) : showDocuments ? (
            <form
              key={`docs-${filterFormKey(sp)}`}
              action="/fleet/trips"
              method="get"
              className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:flex-row sm:flex-wrap sm:items-end"
            >
              <input type="hidden" name="view" value="documents" />
              <input type="hidden" name="page" value="1" />
              <div className="flex min-w-[10rem] flex-1 flex-col gap-1">
                <label className="text-xs font-medium text-zinc-500">Nr. înmatriculare</label>
                <input
                  name="registrationNumber"
                  defaultValue={sp.registrationNumber ?? ""}
                  placeholder="ex. B 123 ABC"
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
                <label className="text-xs font-medium text-zinc-500">Client</label>
                <input
                  name="clientId"
                  defaultValue={sp.clientId ?? ""}
                  placeholder="ex. Client A"
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
                <label className="text-xs font-medium text-zinc-500">Căutare text</label>
                <input
                  name="q"
                  defaultValue={sp.q ?? ""}
                  placeholder="Titlu, conducător…"
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex min-w-[10rem] flex-col gap-1">
                <label className="text-xs font-medium text-zinc-500">Tip document</label>
                <select
                  name="docType"
                  defaultValue={sp.docType ?? ""}
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                >
                  <option value="">Toate</option>
                  {TRIP_SHEET_DOC_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex min-w-[9rem] flex-col gap-1">
                <label className="text-xs font-medium text-zinc-500">Perioadă de la</label>
                <input
                  name="periodFrom"
                  type="date"
                  defaultValue={sp.periodFrom ?? ""}
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex min-w-[9rem] flex-col gap-1">
                <label className="text-xs font-medium text-zinc-500">Perioadă până la</label>
                <input
                  name="periodTo"
                  type="date"
                  defaultValue={sp.periodTo ?? ""}
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex min-w-[9rem] flex-col gap-1">
                <label className="text-xs font-medium text-zinc-500">Generat de la</label>
                <input
                  name="createdFrom"
                  type="date"
                  defaultValue={sp.createdFrom ?? ""}
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex min-w-[9rem] flex-col gap-1">
                <label className="text-xs font-medium text-zinc-500">Generat până la</label>
                <input
                  name="createdTo"
                  type="date"
                  defaultValue={sp.createdTo ?? ""}
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                />
              </div>
              <button type="submit" className="rounded-lg bg-zinc-800 px-4 py-2 text-sm">
                Aplică
              </button>
              <FilterResetLink href="/fleet/trips?view=documents" />
            </form>
          ) : (
            <form
              key={filterFormKey(sp)}
              action="/fleet/trips"
              method="get"
              className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:flex-row sm:flex-wrap sm:items-end"
            >
              <input type="hidden" name="page" value="1" />
              <div className="flex min-w-[10rem] flex-1 flex-col gap-1">
                <label className="text-xs font-medium text-zinc-500">Nr. înmatriculare</label>
                <input
                  name="registrationNumber"
                  defaultValue={sp.registrationNumber ?? ""}
                  placeholder="ex. B 123 ABC"
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
                <label className="text-xs font-medium text-zinc-500">Client</label>
                <input
                  name="clientId"
                  defaultValue={sp.clientId ?? ""}
                  placeholder="ex. Client A"
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
                <label className="text-xs font-medium text-zinc-500">Căutare text</label>
                <input
                  name="q"
                  defaultValue={sp.q ?? ""}
                  placeholder="Referință, origine, destinație…"
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex min-w-[9rem] flex-col gap-1">
                <label className="text-xs font-medium text-zinc-500">Start de la</label>
                <input
                  name="startedFrom"
                  type="date"
                  defaultValue={sp.startedFrom ?? ""}
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex min-w-[9rem] flex-col gap-1">
                <label className="text-xs font-medium text-zinc-500">Start până la</label>
                <input
                  name="startedTo"
                  type="date"
                  defaultValue={sp.startedTo ?? ""}
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex min-w-[10rem] flex-col gap-1">
                <label className="text-xs font-medium text-zinc-500">Stare cursă</label>
                <select
                  name="ended"
                  defaultValue={sp.ended ?? ""}
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                >
                  <option value="">Toate</option>
                  <option value="open">Deschisă (fără stop)</option>
                  <option value="closed">Închisă (cu stop)</option>
                </select>
              </div>
              <button type="submit" className="rounded-lg bg-zinc-800 px-4 py-2 text-sm">
                Aplică
              </button>
              <FilterResetLink href="/fleet/trips" />
            </form>
          )
        }
      >
        {showTachograph ? (
          <TripTachographPlaceholder />
        ) : showConsumption ? (
          !consumption ? (
            <p className="text-amber-400">Nu am putut încărca datele de consum.</p>
          ) : (
            <TripsConsumptionView data={consumption} />
          )
        ) : showDocuments ? (
          <>
            {sp.generated ? (
              <p className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
                Document generat. Descarcă PDF din tabelul de mai jos.
              </p>
            ) : null}

            {!documents ? (
              <p className="text-amber-400">Nu am putut încărca arhiva documentelor.</p>
            ) : documents.items.length === 0 ? (
              <p className="text-zinc-400">Nu există documente pentru filtrele curente.</p>
            ) : (
              <>
                <TripSheetDocumentsList items={documents.items} highlightId={sp.generated ?? null} />
                <div className="flex justify-between text-sm text-zinc-400">
                  <span>
                    Pagina {docsPage} / {docsTotalPages} · {documents.total} documente
                  </span>
                  <div className="flex gap-2">
                    {docsPage > 1 ? (
                      <Link href={withDocsPage(docsPage - 1)} className="text-emerald-400 hover:underline">
                        ← Anterior
                      </Link>
                    ) : null}
                    {docsPage < docsTotalPages ? (
                      <Link href={withDocsPage(docsPage + 1)} className="text-emerald-400 hover:underline">
                        Următor →
                      </Link>
                    ) : null}
                  </div>
                </div>
              </>
            )}
          </>
        ) : !data ? (
          <p className="text-amber-400">Nu am putut încărca cursele.</p>
        ) : data.items.length === 0 ? (
          <p className="text-zinc-400">Nu există curse pentru filtrele curente.</p>
        ) : (
          <>
            <FleetDataTable>
              <table className={fleetTableClass}>
                <thead className={fleetTheadClass}>
                  <tr>
                    <th className={fleetThClass}>Ref</th>
                    <th className={fleetThClass}>Nr. auto</th>
                    <th className={fleetThClass}>Client</th>
                    <th className={fleetThClass}>Start</th>
                    <th className={fleetThClass}>Stop</th>
                    <th className={fleetThClass}>Km</th>
                    <th className={fleetThRightClass}>Detaliu</th>
                    {write ? <th className={fleetThRightClass}>Acțiuni</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {data.items.map((row) => (
                    <tr key={row.id} className="bg-zinc-900/30">
                      <td className={`${fleetTdClass} font-mono`}>{row.reference ?? "—"}</td>
                      <td className={`${fleetTdClass} font-mono`}>{row.registrationNumber}</td>
                      <td className={fleetTdClass}>{row.clientId}</td>
                      <td className={fleetTdClass}>{formatDateTimeRo(row.startedAt)}</td>
                      <td className={fleetTdClass}>{formatDateTimeRo(row.endedAt)}</td>
                      <td className={`${fleetTdClass} font-mono`}>{row.distanceKm ?? "—"}</td>
                      <td className={`${fleetTdClass} text-right`}>
                        <Link href={`/fleet/trips/${row.id}`} className="text-emerald-400 hover:underline">
                          Vezi
                        </Link>
                      </td>
                      {write ? (
                        <td className={fleetTdClass}>
                          <div className="flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
                            <Link
                              href={`/fleet/trips/${row.id}/edit`}
                              className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
                            >
                              Editare
                            </Link>
                            <DeleteTripButton tripId={row.id} label={row.reference ?? row.id} />
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </FleetDataTable>
            <div className="flex justify-between text-sm text-zinc-400">
              <span>
                Pagina {page} / {totalPages} · {data.total} curse
              </span>
              <div className="flex gap-2">
                {page > 1 ? (
                  <Link href={withPage(page - 1)} className="text-emerald-400 hover:underline">
                    ← Anterior
                  </Link>
                ) : null}
                {page < totalPages ? (
                  <Link href={withPage(page + 1)} className="text-emerald-400 hover:underline">
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
