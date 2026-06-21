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
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { DeleteCostButton } from "@/components/fleet/DeleteCostButton";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { costsBrowserBase } from "@/lib/fleet-api";
import { filterFormKey } from "@/lib/filter-form-key";
import { fleetServerFetch } from "@/lib/fleet-server";
import { formatRonFromCents } from "@/lib/money";

type Search = {
  page?: string;
  registrationNumber?: string;
  clientId?: string;
  category?: string;
  provider?: string;
  q?: string;
  incurredFrom?: string;
  incurredTo?: string;
};

type CostRow = {
  id: string;
  tenantSlug: string;
  vehicleId: string;
  registrationNumber: string;
  clientId: string;
  category: string;
  provider: string | null;
  amountCents: number;
  odometerKm: number | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  invoiceAttachmentUrl: string | null;
  incurredOn: string;
  notes: string | null;
};

type Payload = { items: CostRow[]; total: number; page: number; pageSize: number };

function buildQuery(sp: Search): string {
  const q = new URLSearchParams();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  q.set("page", String(page));
  q.set("pageSize", "20");
  if (sp.registrationNumber?.trim()) q.set("registrationNumber", sp.registrationNumber.trim());
  if (sp.clientId?.trim()) q.set("clientId", sp.clientId.trim());
  if (sp.category?.trim()) q.set("category", sp.category.trim());
  if (sp.provider?.trim()) q.set("provider", sp.provider.trim());
  if (sp.q?.trim()) q.set("q", sp.q.trim());
  if (sp.incurredFrom?.trim()) q.set("incurredFrom", sp.incurredFrom.trim());
  if (sp.incurredTo?.trim()) q.set("incurredTo", sp.incurredTo.trim());
  return q.toString();
}

function buildExportQuery(sp: Search): string {
  const q = new URLSearchParams();
  if (sp.registrationNumber?.trim()) q.set("registrationNumber", sp.registrationNumber.trim());
  if (sp.clientId?.trim()) q.set("clientId", sp.clientId.trim());
  if (sp.category?.trim()) q.set("category", sp.category.trim());
  if (sp.provider?.trim()) q.set("provider", sp.provider.trim());
  if (sp.q?.trim()) q.set("q", sp.q.trim());
  if (sp.incurredFrom?.trim()) q.set("incurredFrom", sp.incurredFrom.trim());
  if (sp.incurredTo?.trim()) q.set("incurredTo", sp.incurredTo.trim());
  return q.toString();
}

async function fetchRows(sp: Search): Promise<Payload | null> {
  const res = await fleetServerFetch(`/costs?${buildQuery(sp)}`);
  if (!res?.ok) return null;
  return (await res.json()) as Payload;
}

type Props = { searchParams: Promise<Search> };

export default async function CostsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const [data, auth] = await Promise.all([fetchRows(sp), getAuthMeResult()]);
  const write = canManageFleet(auth);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 20));

  const exportQs = buildExportQuery(sp);
  const exportHref = `${costsBrowserBase}/export${exportQs ? `?${exportQs}` : ""}`;

  const withPage = (nextPage: number) => {
    const p = new URLSearchParams();
    p.set("page", String(nextPage));
    if (sp.registrationNumber?.trim()) p.set("registrationNumber", sp.registrationNumber.trim());
    if (sp.clientId?.trim()) p.set("clientId", sp.clientId.trim());
    if (sp.category?.trim()) p.set("category", sp.category.trim());
    if (sp.provider?.trim()) p.set("provider", sp.provider.trim());
    if (sp.q?.trim()) p.set("q", sp.q.trim());
    if (sp.incurredFrom?.trim()) p.set("incurredFrom", sp.incurredFrom.trim());
    if (sp.incurredTo?.trim()) p.set("incurredTo", sp.incurredTo.trim());
    return `/fleet/costs?${p.toString()}`;
  };

  return (
    <FleetPageMain>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Operațional</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Costuri</h1>
            <p className="mt-3 text-zinc-400">
              Filtrare după nr. înmatriculare/client, categorie, furnizor, text în categorie/note, interval dată, export CSV.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {write ? (
              <Link
                href="/fleet/costs/new"
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
              >
                Cost nou
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
          key={filterFormKey(sp)}
          action="/fleet/costs"
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
          <div className="flex min-w-[10rem] flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Client</label>
            <input
              name="clientId"
              defaultValue={sp.clientId ?? ""}
              placeholder="ex. Client A"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex min-w-[10rem] flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Categorie (exact)</label>
            <input
              name="category"
              defaultValue={sp.category ?? ""}
              placeholder="ex. combustibil"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Furnizor</label>
            <input
              name="provider"
              defaultValue={sp.provider ?? ""}
              placeholder="ex. Petrom"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Căutare text</label>
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Categorie, note…"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex min-w-[9rem] flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Data de la</label>
            <input
              name="incurredFrom"
              type="date"
              defaultValue={sp.incurredFrom ?? ""}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex min-w-[9rem] flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Data până la</label>
            <input
              name="incurredTo"
              type="date"
              defaultValue={sp.incurredTo ?? ""}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" className="rounded-lg bg-zinc-800 px-4 py-2 text-sm">
            Aplică
          </button>
          <FilterResetLink href="/fleet/costs" />
        </form>

        {!data ? (
          <p className="text-amber-400">Nu am putut încărca costurile.</p>
        ) : data.items.length === 0 ? (
          <p className="text-zinc-400">Nu există costuri pentru filtrele curente.</p>
        ) : (
          <>
            <FleetDataTable>
              <table className={fleetTableClass}>
                <thead className={fleetTheadClass}>
                  <tr>
                    <th className={fleetThClass}>Categorie</th>
                    <th className={fleetThClass}>Nr. auto</th>
                    <th className={fleetThClass}>Client</th>
                    <th className={fleetThClass}>Furnizor</th>
                    <th className={fleetThClass}>Data</th>
                    <th className={fleetThClass}>Km</th>
                    <th className={fleetThClass}>Factură</th>
                    <th className={fleetThClass}>Data factură</th>
                    <th className={fleetThClass}>Document</th>
                    <th className={fleetThClass}>Suma (RON fără TVA)</th>
                    <th className={fleetThRightClass}>Detaliu</th>
                    {write ? <th className={fleetThRightClass}>Acțiuni</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {data.items.map((row) => (
                    <tr key={row.id} className="bg-zinc-900/30">
                      <td className={fleetTdClass}>{row.category}</td>
                      <td className={`${fleetTdClass} font-mono`}>{row.registrationNumber}</td>
                      <td className={fleetTdClass}>{row.clientId}</td>
                      <td className={fleetTdClass}>{row.provider ?? "—"}</td>
                      <td className={fleetTdClass}>{new Date(row.incurredOn).toLocaleDateString("ro-RO")}</td>
                      <td className={`${fleetTdClass} font-mono`}>{row.odometerKm ?? "—"}</td>
                      <td className={`${fleetTdClass} font-mono text-xs`}>{row.invoiceNumber ?? "—"}</td>
                      <td className={fleetTdClass}>{row.invoiceDate ? new Date(row.invoiceDate).toLocaleDateString("ro-RO") : "—"}</td>
                      <td className={fleetTdClass}>
                        {row.invoiceAttachmentUrl ? (
                          <a href={row.invoiceAttachmentUrl} download className="text-emerald-400 hover:underline">
                            Descarcă
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={`${fleetTdClass} font-mono`}>{formatRonFromCents(row.amountCents)}</td>
                      <td className={`${fleetTdClass} text-right`}>
                        <Link href={`/fleet/costs/${row.id}`} className="text-emerald-400 hover:underline">
                          Vezi
                        </Link>
                      </td>
                      {write ? (
                        <td className={fleetTdClass}>
                          <div className="flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
                            <Link
                              href={`/fleet/costs/${row.id}/edit`}
                              className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
                            >
                              Editare
                            </Link>
                            <DeleteCostButton entryId={row.id} label={row.category} />
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
                Pagina {page} / {totalPages} · {data.total} costuri
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
