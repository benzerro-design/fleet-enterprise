import Link from "next/link";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { DeleteMaintenanceButton } from "@/components/fleet/DeleteMaintenanceButton";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { maintenanceBrowserBase } from "@/lib/fleet-api";
import { maintenanceCostAllocationLabel } from "@/lib/maintenance-cost-allocation";
import { fleetServerFetch } from "@/lib/fleet-server";
import { formatRonFromCents } from "@/lib/money";

type Search = {
  page?: string;
  registrationNumber?: string;
  clientId?: string;
  provider?: string;
  q?: string;
  performedFrom?: string;
  performedTo?: string;
};

type MaintenanceRow = {
  id: string;
  tenantSlug: string;
  vehicleId: string;
  registrationNumber: string;
  clientId: string;
  title: string;
  provider: string | null;
  costAllocationCode: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  invoiceAttachmentUrl: string | null;
  performedAt: string | null;
  odometerKm: number | null;
  notes: string | null;
  costCents: number | null;
};

type Payload = { items: MaintenanceRow[]; total: number; page: number; pageSize: number };

function buildQuery(sp: Search): string {
  const q = new URLSearchParams();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  q.set("page", String(page));
  q.set("pageSize", "20");
  if (sp.registrationNumber?.trim()) q.set("registrationNumber", sp.registrationNumber.trim());
  if (sp.clientId?.trim()) q.set("clientId", sp.clientId.trim());
  if (sp.provider?.trim()) q.set("provider", sp.provider.trim());
  if (sp.q?.trim()) q.set("q", sp.q.trim());
  if (sp.performedFrom?.trim()) q.set("performedFrom", sp.performedFrom.trim());
  if (sp.performedTo?.trim()) q.set("performedTo", sp.performedTo.trim());
  return q.toString();
}

function buildExportQuery(sp: Search): string {
  const q = new URLSearchParams();
  if (sp.registrationNumber?.trim()) q.set("registrationNumber", sp.registrationNumber.trim());
  if (sp.clientId?.trim()) q.set("clientId", sp.clientId.trim());
  if (sp.provider?.trim()) q.set("provider", sp.provider.trim());
  if (sp.q?.trim()) q.set("q", sp.q.trim());
  if (sp.performedFrom?.trim()) q.set("performedFrom", sp.performedFrom.trim());
  if (sp.performedTo?.trim()) q.set("performedTo", sp.performedTo.trim());
  return q.toString();
}

async function fetchRows(sp: Search): Promise<Payload | null> {
  const res = await fleetServerFetch(`/maintenance?${buildQuery(sp)}`);
  if (!res?.ok) return null;
  return (await res.json()) as Payload;
}

type Props = { searchParams: Promise<Search> };

export default async function MaintenancePage({ searchParams }: Props) {
  const sp = await searchParams;
  const [data, auth] = await Promise.all([fetchRows(sp), getAuthMeResult()]);
  const write = canManageFleet(auth);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 20));

  const exportQs = buildExportQuery(sp);
  const exportHref = `${maintenanceBrowserBase}/export${exportQs ? `?${exportQs}` : ""}`;

  const withPage = (nextPage: number) => {
    const p = new URLSearchParams();
    p.set("page", String(nextPage));
    if (sp.registrationNumber?.trim()) p.set("registrationNumber", sp.registrationNumber.trim());
    if (sp.clientId?.trim()) p.set("clientId", sp.clientId.trim());
    if (sp.provider?.trim()) p.set("provider", sp.provider.trim());
    if (sp.q?.trim()) p.set("q", sp.q.trim());
    if (sp.performedFrom?.trim()) p.set("performedFrom", sp.performedFrom.trim());
    if (sp.performedTo?.trim()) p.set("performedTo", sp.performedTo.trim());
    return `/fleet/maintenance?${p.toString()}`;
  };

  return (
    <FleetPageMain>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Operațional</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Mentenanță</h1>
            <p className="mt-3 text-zinc-400">
              Filtrare după nr. înmatriculare/client/furnizor, căutare în titlu/note, interval dată, export CSV.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {write ? (
              <Link
                href="/fleet/maintenance/new"
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
              >
                Intervenție nouă
              </Link>
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

        <form
          action="/fleet/maintenance"
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
            <label className="text-xs font-medium text-zinc-500">Furnizor</label>
            <input
              name="provider"
              defaultValue={sp.provider ?? ""}
              placeholder="ex. Service Auto X"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Căutare</label>
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Titlu, note…"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex min-w-[9rem] flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Data de la</label>
            <input
              name="performedFrom"
              type="date"
              defaultValue={sp.performedFrom ?? ""}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex min-w-[9rem] flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Data până la</label>
            <input
              name="performedTo"
              type="date"
              defaultValue={sp.performedTo ?? ""}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" className="rounded-lg bg-zinc-800 px-4 py-2 text-sm">
            Aplică
          </button>
          <Link
            href="/fleet/maintenance"
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400"
          >
            Resetează
          </Link>
        </form>

        {!data ? (
          <p className="text-amber-400">Nu am putut încărca mentenanța.</p>
        ) : data.items.length === 0 ? (
          <p className="text-zinc-400">Nu există înregistrări pentru filtrele curente.</p>
        ) : (
          <>
            <div className="space-y-3">
              {data.items.map((row) => (
                <article key={row.id} className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-base font-semibold text-zinc-100">{row.title}</h2>
                      <p className="mt-1 text-xs text-zinc-400">{maintenanceCostAllocationLabel(row.costAllocationCode)}</p>
                      <p className="mt-1 text-xs text-zinc-500">Furnizor: {row.provider ?? "—"}</p>
                    </div>
                    <p className="font-mono text-xs text-zinc-400">{row.registrationNumber}</p>
                    <p className="text-xs text-zinc-500">Client: {row.clientId}</p>
                  </div>
                  <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-zinc-500">Data</dt>
                      <dd>{row.performedAt ? new Date(row.performedAt).toLocaleDateString("ro-RO") : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-zinc-500">Km</dt>
                      <dd className="font-mono">{row.odometerKm ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-zinc-500">Factură</dt>
                      <dd className="font-mono text-xs">{row.invoiceNumber ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-zinc-500">Data factură</dt>
                      <dd>{row.invoiceDate ? new Date(row.invoiceDate).toLocaleDateString("ro-RO") : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-zinc-500">Cost (RON fără TVA)</dt>
                      <dd className="font-mono">{row.costCents != null ? formatRonFromCents(row.costCents) : "—"}</dd>
                    </div>
                  </dl>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Link href={`/fleet/maintenance/${row.id}`} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-100 hover:bg-zinc-800">
                      Vezi detaliu
                    </Link>
                    {row.invoiceAttachmentUrl ? (
                      <a
                        href={row.invoiceAttachmentUrl}
                        download
                        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-100 hover:bg-zinc-800"
                      >
                        Descarcă factură
                      </a>
                    ) : null}
                    {write ? (
                      <>
                        <Link
                          href={`/fleet/maintenance/${row.id}/edit`}
                          className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
                        >
                          Editare
                        </Link>
                        <DeleteMaintenanceButton entryId={row.id} label={row.title} />
                      </>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
            <div className="flex justify-between text-sm text-zinc-400">
              <span>
                Pagina {page} / {totalPages} · {data.total} înregistrări
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
    </FleetPageMain>
  );
}
