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
  mobilityStatusLabel,
  type MobilityAssignmentStatus,
  type MobilityListPayload,
} from "@/lib/mobility-api";

type Search = { q?: string; status?: string; page?: string };

async function loadAssignments(sp: Search): Promise<MobilityListPayload | null> {
  const p = new URLSearchParams();
  if (sp.q?.trim()) p.set("q", sp.q.trim());
  if (sp.status?.trim()) p.set("status", sp.status.trim());
  p.set("page", String(Math.max(1, parseInt(sp.page ?? "1", 10) || 1)));
  p.set("pageSize", "50");
  try {
    const res = await fleetServerFetch(`/mobility/assignments?${p.toString()}`);
    if (!res?.ok) return null;
    return (await res.json()) as MobilityListPayload;
  } catch {
    return null;
  }
}

const STATUSES: MobilityAssignmentStatus[] = [
  "active",
  "reserved",
  "returned",
  "waived",
  "cancelled",
];

type PageProps = { searchParams: Promise<Search> };

export default async function ReplacementCarsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const [list, auth] = await Promise.all([loadAssignments(sp), getAuthMeResult()]);
  const write = canManageFleet(auth);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const withPage = (next: number) => {
    const p = new URLSearchParams();
    if (sp.q?.trim()) p.set("q", sp.q.trim());
    if (sp.status?.trim()) p.set("status", sp.status.trim());
    p.set("page", String(next));
    return `/fleet/mobility/replacement-cars?${p.toString()}`;
  };

  return (
    <FleetPageMain fill>
      <FleetListPageLayout
        header={
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Link href="/fleet/mobility" className="text-sm text-zinc-400 hover:text-zinc-200">
                ← Mobilitate
              </Link>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Mașini la schimb</h1>
              <p className="mt-3 max-w-2xl text-zinc-400">
                Alocări MOB legate de comenzi service — eligibilitate după 72h imobilizare.
              </p>
            </div>
            {write ? (
              <Link
                href="/fleet/mobility/replacement-cars/new"
                className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
              >
                Alocare nouă
              </Link>
            ) : null}
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
                placeholder="MOB, nr. înmatriculare"
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
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {mobilityStatusLabel(s)}
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
            <FilterResetLink href="/fleet/mobility/replacement-cars" />
          </form>
        }
      >
        {!list ? (
          <p className="text-amber-400">Nu am putut încărca alocările. Rulează migrarea Prisma.</p>
        ) : list.items.length === 0 ? (
          <p className="text-zinc-500">Nicio alocare găsită.</p>
        ) : (
          <>
            <FleetDataTable>
              <table className={fleetTableClass}>
                <thead className={`${fleetTheadClass} tracking-wide`}>
                  <tr>
                    <th className={fleetThClass}>MOB</th>
                    <th className={fleetThClass}>Mașină acoperită</th>
                    <th className={fleetThClass}>Mașină schimb</th>
                    <th className={fleetThClass}>Client</th>
                    <th className={fleetThClass}>Status</th>
                    <th className={fleetThClass}>Comandă</th>
                    <th className={fleetThClass} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {list.items.map((row) => (
                    <tr key={row.id} className="text-zinc-200">
                      <td className={`${fleetTdClass} font-mono`}>
                        <Link
                          href={`/fleet/mobility/replacement-cars/${row.id}`}
                          className="text-violet-300/90 hover:underline"
                        >
                          {row.displayNumber ?? "—"}
                        </Link>
                      </td>
                      <td className={`${fleetTdClass} font-mono`}>{row.coveredVehicleReg ?? "—"}</td>
                      <td className={`${fleetTdClass} font-mono`}>{row.replacementRegistration ?? "—"}</td>
                      <td className={fleetTdClass}>{row.clientLegalName}</td>
                      <td className={fleetTdClass}>{mobilityStatusLabel(row.status)}</td>
                      <td className={fleetTdClass}>
                        <Link href={`/fleet/work-orders/${row.workOrderId}`} className="text-sky-300 hover:underline">
                          {row.workOrderDisplayNumber ?? "Comandă"}
                        </Link>
                      </td>
                      <td className={`${fleetTdClass} text-right`}>
                        <Link
                          href={`/fleet/mobility/replacement-cars/${row.id}`}
                          className="text-emerald-400 hover:underline"
                        >
                          Detalii
                        </Link>
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
