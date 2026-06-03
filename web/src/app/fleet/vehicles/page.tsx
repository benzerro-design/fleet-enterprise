import Link from "next/link";
import { FilterResetLink } from "@/components/fleet/FilterResetLink";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { DeleteVehicleButton } from "@/components/fleet/DeleteVehicleButton";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { type VehicleListPayload, VEHICLE_STATUSES, fleetBrowserBase } from "@/lib/fleet-api";
import { filterFormKey } from "@/lib/filter-form-key";
import { fleetServerFetch } from "@/lib/fleet-server";

type Search = {
  q?: string;
  status?: string;
  page?: string;
};

function buildListQuery(sp: Search): string {
  const p = new URLSearchParams();
  if (sp.q?.trim()) p.set("q", sp.q.trim());
  if (sp.status?.trim()) p.set("status", sp.status.trim());
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  p.set("page", String(page));
  p.set("pageSize", "20");
  return p.toString();
}

async function getVehiclesList(sp: Search): Promise<VehicleListPayload | null> {
  try {
    const res = await fleetServerFetch(`/fleet/vehicles?${buildListQuery(sp)}`);
    if (!res) return null;
    if (!res.ok) return null;
    return (await res.json()) as VehicleListPayload;
  } catch {
    return null;
  }
}

type PageProps = { searchParams: Promise<Search> };

export default async function FleetVehiclesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const [list, auth] = await Promise.all([getVehiclesList(sp), getAuthMeResult()]);
  const write = canManageFleet(auth);

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
    <FleetPageMain>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Fleet core</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Vehicule</h1>
            <p className="mt-3 max-w-2xl text-zinc-400">
              Căutare, filtru status, paginare și export CSV. Detaliu pe vehicul fără a intra direct în editare.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {write ? (
              <Link
                href="/fleet/vehicles/new"
                className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
              >
                Vehicul nou
              </Link>
            ) : null}
            <a
              href={exportHref}
              className="inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
            >
              Export CSV
            </a>
          </div>
        </div>

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

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-medium text-zinc-300">Listă paginată</h2>
            <p className="font-mono text-xs text-zinc-500 sm:text-sm">
              <span className="text-zinc-500">GET</span> /api/fleet/vehicles?page&amp;pageSize&amp;q&amp;status
            </p>
          </div>

          {!list ? (
            <p className="mt-4 text-amber-400">
              Nu am putut încărca vehiculele. Verifică API-ul, Postgres, cookie-ul de sesiune și că în{" "}
              <code className="rounded bg-zinc-950 px-1.5 py-0.5 text-zinc-200">web/.env.local</code> există{" "}
              <code className="rounded bg-zinc-950 px-1.5 py-0.5 text-zinc-200">API_URL</code> (server-only,
              spre Nest).
            </p>
          ) : vehicles.length === 0 ? (
            <p className="mt-4 text-zinc-400">
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
              <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-800">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-zinc-950 text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-3">Nr. înmatriculare</th>
                      <th className="px-4 py-3">Client</th>
                      <th className="px-4 py-3">Tip</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Km</th>
                      <th className="px-4 py-3">ITP expiră</th>
                      <th className="px-4 py-3 text-right">Detaliu</th>
                      {write ? <th className="px-4 py-3 text-right">Acțiuni</th> : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {vehicles.map((v) => (
                      <tr key={v.id} className="bg-zinc-900/30">
                        <td className="px-4 py-3 font-mono text-zinc-200">{v.registrationNumber}</td>
                        <td className="px-4 py-3 text-zinc-300">{v.clientId}</td>
                        <td className="px-4 py-3 text-zinc-300">{v.type}</td>
                        <td className="px-4 py-3 text-zinc-300">{v.status}</td>
                        <td className="px-4 py-3 font-mono text-zinc-300">{v.odometerKm}</td>
                        <td className="px-4 py-3 font-mono text-zinc-300">
                          {v.itpExpiresOn ? new Date(v.itpExpiresOn).toLocaleDateString("ro-RO") : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/fleet/vehicles/${v.id}`}
                            className="text-emerald-400 underline hover:text-emerald-300"
                          >
                            Vezi
                          </Link>
                        </td>
                        {write ? (
                          <td className="px-4 py-3">
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
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-400">
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
        </section>
    </FleetPageMain>
  );
}
