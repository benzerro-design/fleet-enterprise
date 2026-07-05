import Link from "next/link";
import {
  FleetDataTable,
  fleetTableClass,
  fleetTdClass,
  fleetThClass,
  fleetTheadClass,
} from "@/components/fleet/fleet-data-table";
import { FilterResetLink } from "@/components/fleet/FilterResetLink";
import { FleetListPageLayout } from "@/components/fleet/FleetListPageLayout";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { filterFormKey } from "@/lib/filter-form-key";
import { fleetServerFetch } from "@/lib/fleet-server";
import {
  SUPPLIER_CATEGORIES,
  supplierCategoryLabel,
  supplierStatusLabel,
  suppliersBrowserBase,
  type SupplierListPayload,
} from "@/lib/suppliers-api";

type Search = { q?: string; status?: string; category?: string; page?: string };

async function loadSuppliers(sp: Search): Promise<SupplierListPayload | null> {
  const p = new URLSearchParams();
  if (sp.q?.trim()) p.set("q", sp.q.trim());
  if (sp.status?.trim()) p.set("status", sp.status.trim());
  if (sp.category?.trim()) p.set("category", sp.category.trim());
  p.set("page", String(Math.max(1, parseInt(sp.page ?? "1", 10) || 1)));
  p.set("pageSize", "50");
  try {
    const res = await fleetServerFetch(`/suppliers?${p.toString()}`);
    if (!res?.ok) return null;
    return (await res.json()) as SupplierListPayload;
  } catch {
    return null;
  }
}

type PageProps = { searchParams: Promise<Search> };

export default async function FleetSuppliersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const [list, auth] = await Promise.all([loadSuppliers(sp), getAuthMeResult()]);
  const write = canManageFleet(auth);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const exportQs = new URLSearchParams();
  if (sp.q?.trim()) exportQs.set("q", sp.q.trim());
  if (sp.status?.trim()) exportQs.set("status", sp.status.trim());
  if (sp.category?.trim()) exportQs.set("category", sp.category.trim());
  const exportHref = `${suppliersBrowserBase}/export?${exportQs.toString()}`;

  const withPage = (next: number) => {
    const p = new URLSearchParams();
    if (sp.q?.trim()) p.set("q", sp.q.trim());
    if (sp.status?.trim()) p.set("status", sp.status.trim());
    if (sp.category?.trim()) p.set("category", sp.category.trim());
    p.set("page", String(next));
    return `/fleet/suppliers?${p.toString()}`;
  };

  return (
    <FleetPageMain fill>
      <FleetListPageLayout
        header={
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-widest text-sky-400">Furnizori & Parteneri</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Furnizori</h1>
              <p className="mt-3 max-w-2xl text-zinc-400">
                Service-uri, ITP, brokeri, asiguratori — legați de mentenanță, costuri și comenzi de lucru.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={exportHref}
                className="inline-flex items-center justify-center rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
              >
                Export CSV
              </a>
              {write ? (
                <Link
                  href="/fleet/suppliers/new"
                  className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
                >
                  Furnizor nou
                </Link>
              ) : null}
            </div>
          </div>
        }
        filters={
          <form
            key={filterFormKey(sp)}
            method="get"
            className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-4"
          >
            <div>
              <label className="text-xs text-zinc-500">Căutare</label>
              <input
                name="q"
                defaultValue={sp.q ?? ""}
                className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                placeholder="cod, denumire, CUI"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500">Status</label>
              <select
                name="status"
                defaultValue={sp.status ?? ""}
                className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="">Toate</option>
                <option value="active">Activ</option>
                <option value="inactive">Inactiv</option>
                <option value="blocked">Blocat</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500">Categorie</label>
              <select
                name="category"
                defaultValue={sp.category ?? ""}
                className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="">Toate</option>
                {SUPPLIER_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {supplierCategoryLabel(c)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
            >
              Filtrează
            </button>
            <FilterResetLink href="/fleet/suppliers" />
          </form>
        }
      >
        {!list ? (
          <p className="text-amber-400">Nu am putut încărca furnizorii. Rulează migrarea Prisma.</p>
        ) : list.items.length === 0 ? (
          <p className="text-zinc-500">Niciun furnizor găsit.</p>
        ) : (
          <>
            <FleetDataTable>
              <table className={fleetTableClass}>
                <thead className={`${fleetTheadClass} tracking-wide`}>
                  <tr>
                    <th className={fleetThClass}>Cod</th>
                    <th className={fleetThClass}>Denumire</th>
                    <th className={fleetThClass}>CUI</th>
                    <th className={fleetThClass}>Categorie</th>
                    <th className={fleetThClass}>Status</th>
                    <th className={fleetThClass}>Comenzi</th>
                    <th className={fleetThClass} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {list.items.map((row) => (
                    <tr key={row.id} className="text-zinc-200">
                      <td className={`${fleetTdClass} font-mono`}>
                        <Link href={`/fleet/suppliers/${row.id}`} className="text-sky-300/90 hover:underline">
                          {row.code}
                        </Link>
                      </td>
                      <td className={fleetTdClass}>
                        <Link href={`/fleet/suppliers/${row.id}`} className="hover:text-emerald-200 hover:underline">
                          {row.legalName}
                        </Link>
                      </td>
                      <td className={`${fleetTdClass} font-mono text-zinc-400`}>{row.taxId ?? "—"}</td>
                      <td className={fleetTdClass}>{supplierCategoryLabel(row.category)}</td>
                      <td className={fleetTdClass}>{supplierStatusLabel(row.status)}</td>
                      <td className={fleetTdClass}>{row.workOrderCount}</td>
                      <td className={`${fleetTdClass} text-right`}>
                        <Link href={`/fleet/suppliers/${row.id}`} className="mr-3 text-zinc-400 hover:text-zinc-200 hover:underline">
                          Detalii
                        </Link>
                        {write ? (
                          <Link href={`/fleet/suppliers/${row.id}/edit`} className="text-emerald-400 hover:underline">
                            Editare
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </FleetDataTable>
            {list.total > list.pageSize ? (
              <div className="flex gap-2 text-sm">
                {page > 1 ? (
                  <Link href={withPage(page - 1)} className="text-emerald-400 hover:underline">
                    ← Anterior
                  </Link>
                ) : null}
                {page * list.pageSize < list.total ? (
                  <Link href={withPage(page + 1)} className="text-emerald-400 hover:underline">
                    Următor →
                  </Link>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </FleetListPageLayout>
    </FleetPageMain>
  );
}
