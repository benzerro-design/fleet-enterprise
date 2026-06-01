import Link from "next/link";
import { DeleteTripButton } from "@/components/fleet/DeleteTripButton";
import { TripSheetDocumentsList } from "@/components/fleet/TripSheetDocumentsList";
import { TripSheetWizard } from "@/components/fleet/TripSheetWizard";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { tripsBrowserBase } from "@/lib/fleet-api";
import { fleetServerFetch } from "@/lib/fleet-server";
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

type VehicleOption = { id: string; registrationNumber: string; clientId: string };

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

async function fetchVehicleOptions(): Promise<VehicleOption[]> {
  const res = await fleetServerFetch("/fleet/vehicles?page=1&pageSize=200");
  if (!res?.ok) return [];
  const data = (await res.json()) as { items: VehicleOption[] };
  return data.items.map((v) => ({
    id: v.id,
    registrationNumber: v.registrationNumber,
    clientId: v.clientId,
  }));
}

type Props = { searchParams: Promise<Search> };

export default async function TripsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const showDocuments = sp.view === "documents";
  const [data, auth, documents, vehicles] = await Promise.all([
    showDocuments ? Promise.resolve(null) : fetchTrips(sp),
    getAuthMeResult(),
    showDocuments ? fetchTripSheets(sp) : Promise.resolve(null),
    fetchVehicleOptions(),
  ]);
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
    <div className="text-zinc-100">
      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Operațional</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Curse</h1>
            <p className="mt-3 text-zinc-400">
              Curse operaționale, generare foaie de parcurs / FAZ lunar (PDF) și arhivă documente. Conducătorul este text
              liber până la modulul Client.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {write ? (
              <>
                <Link
                  href="/fleet/trips/new"
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
                >
                  Cursă nouă
                </Link>
                <TripSheetWizard vehicles={vehicles} />
              </>
            ) : null}
            <a
              href={exportHref}
              className="rounded-lg border border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
            >
              Export CSV
            </a>
            <Link
              href="/fleet/vehicles"
              className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
            >
              Înapoi la vehicule
            </Link>
          </div>
        </div>

        <nav className="flex gap-2 border-b border-zinc-800 pb-1">
          <Link
            href="/fleet/trips"
            className={`rounded-t-lg px-4 py-2 text-sm ${!showDocuments ? "bg-zinc-900 text-emerald-400" : "text-zinc-400 hover:text-zinc-200"}`}
          >
            Listă curse
          </Link>
          <Link
            href="/fleet/trips?view=documents"
            className={`rounded-t-lg px-4 py-2 text-sm ${showDocuments ? "bg-zinc-900 text-emerald-400" : "text-zinc-400 hover:text-zinc-200"}`}
          >
            Documente parcurs
          </Link>
        </nav>

        {showDocuments ? (
          <section className="space-y-4">
            {sp.generated ? (
              <p className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
                Document generat. Descarcă PDF din tabelul de mai jos.
              </p>
            ) : null}

            <form
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
              <Link
                href="/fleet/trips?view=documents"
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400"
              >
                Resetează
              </Link>
            </form>

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
          </section>
        ) : (
          <>
        <form
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
          <Link href="/fleet/trips" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400">
            Resetează
          </Link>
        </form>

        {!data ? (
          <p className="text-amber-400">Nu am putut încărca cursele.</p>
        ) : data.items.length === 0 ? (
          <p className="text-zinc-400">Nu există curse pentru filtrele curente.</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-zinc-800">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-zinc-950 text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Ref</th>
                    <th className="px-4 py-3">Nr. auto</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Start</th>
                    <th className="px-4 py-3">Stop</th>
                    <th className="px-4 py-3">Km</th>
                    <th className="px-4 py-3 text-right">Detaliu</th>
                    {write ? <th className="px-4 py-3 text-right">Acțiuni</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {data.items.map((row) => (
                    <tr key={row.id} className="bg-zinc-900/30">
                      <td className="px-4 py-3 font-mono">{row.reference ?? "—"}</td>
                      <td className="px-4 py-3 font-mono">{row.registrationNumber}</td>
                      <td className="px-4 py-3">{row.clientId}</td>
                      <td className="px-4 py-3">{new Date(row.startedAt).toLocaleString("ro-RO")}</td>
                      <td className="px-4 py-3">{row.endedAt ? new Date(row.endedAt).toLocaleString("ro-RO") : "—"}</td>
                      <td className="px-4 py-3 font-mono">{row.distanceKm ?? "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/fleet/trips/${row.id}`} className="text-emerald-400 hover:underline">
                          Vezi
                        </Link>
                      </td>
                      {write ? (
                        <td className="px-4 py-3">
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
            </div>
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
          </>
        )}
      </main>
    </div>
  );
}
