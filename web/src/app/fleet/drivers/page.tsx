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
import type { ClientListPayload } from "@/lib/clients-api";
import { driverStatusLabel, type DriverListPayload } from "@/lib/drivers-api";
import { fleetServerFetch } from "@/lib/fleet-server";

type Search = { q?: string; status?: string; clientId?: string; page?: string };

async function loadDrivers(sp: Search): Promise<DriverListPayload | null> {
  const p = new URLSearchParams();
  if (sp.q?.trim()) p.set("q", sp.q.trim());
  if (sp.status?.trim()) p.set("status", sp.status.trim());
  if (sp.clientId?.trim()) p.set("clientId", sp.clientId.trim());
  p.set("page", String(Math.max(1, parseInt(sp.page ?? "1", 10) || 1)));
  p.set("pageSize", "50");
  try {
    const res = await fleetServerFetch(`/drivers?${p.toString()}`);
    if (!res?.ok) return null;
    return (await res.json()) as DriverListPayload;
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

export default async function FleetDriversPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const [list, clients, auth] = await Promise.all([
    loadDrivers(sp),
    loadClientOptions(),
    getAuthMeResult(),
  ]);
  const write = canManageFleet(auth);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const withPage = (next: number) => {
    const p = new URLSearchParams();
    if (sp.q?.trim()) p.set("q", sp.q.trim());
    if (sp.status?.trim()) p.set("status", sp.status.trim());
    if (sp.clientId?.trim()) p.set("clientId", sp.clientId.trim());
    p.set("page", String(next));
    return `/fleet/drivers?${p.toString()}`;
  };

  return (
    <FleetPageMain fill>
      <FleetListPageLayout
        header={
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Clienți & CRM</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Șoferi</h1>
              <p className="mt-3 max-w-2xl text-zinc-400">
                Șoferi de flotă legați de client — alocări vehicule și istoric în jurnal.
              </p>
            </div>
            {write ? (
              <Link
                href="/fleet/drivers/new"
                className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
              >
                Șofer nou
              </Link>
            ) : null}
          </div>
        }
        filters={
          <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
            <div>
              <label className="text-xs text-zinc-500">Căutare</label>
              <input
                name="q"
                defaultValue={sp.q ?? ""}
                className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                placeholder="nume, telefon, permis"
              />
            </div>
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
              <label className="text-xs text-zinc-500">Status</label>
              <select
                name="status"
                defaultValue={sp.status ?? ""}
                className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="">Toate</option>
                <option value="active">Activ</option>
                <option value="inactive">Inactiv</option>
                <option value="suspended">Suspendat</option>
              </select>
            </div>
            <button
              type="submit"
              className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
            >
              Filtrează
            </button>
            <FilterResetLink href="/fleet/drivers" />
          </form>
        }
      >
        {!list ? (
          <p className="text-amber-400">Nu am putut încărca șoferii. Verifică migrarea și API-ul.</p>
        ) : list.items.length === 0 ? (
          <p className="text-zinc-500">Niciun șofer găsit.</p>
        ) : (
          <>
            <FleetDataTable>
              <table className={fleetTableClass}>
                <thead className={`${fleetTheadClass} tracking-wide`}>
                  <tr>
                    <th className={fleetThClass}>Nume</th>
                    <th className={fleetThClass}>Client</th>
                    <th className={fleetThClass}>Status</th>
                    <th className={fleetThClass}>Vehicule active</th>
                    <th className={fleetThClass}>Permis</th>
                    <th className={fleetThClass} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {list.items.map((row) => (
                    <tr key={row.id} className="text-zinc-200">
                      <td className={fleetTdClass}>
                        <Link href={`/fleet/drivers/${row.id}`} className="font-medium text-emerald-300/90 hover:underline">
                          {row.fullName}
                        </Link>
                        {row.employeeCode ? (
                          <span className="ml-2 font-mono text-xs text-zinc-500">{row.employeeCode}</span>
                        ) : null}
                      </td>
                      <td className={fleetTdClass}>
                        <Link
                          href={`/fleet/clients/${row.clientId}`}
                          className="text-zinc-300 hover:text-emerald-200 hover:underline"
                        >
                          {row.clientCode}
                        </Link>
                      </td>
                      <td className={fleetTdClass}>{driverStatusLabel(row.status)}</td>
                      <td className={`${fleetTdClass} font-mono text-sm text-zinc-400`}>
                        {row.activeVehicleRegistrations.length > 0
                          ? row.activeVehicleRegistrations.join(", ")
                          : "—"}
                      </td>
                      <td className={`${fleetTdClass} text-sm text-zinc-400`}>
                        {row.licenseNumber ?? "—"}
                        {row.licenseExpiresOn ? (
                          <span className="ml-1 text-xs text-zinc-600">
                            exp. {new Date(row.licenseExpiresOn).toLocaleDateString("ro-RO")}
                          </span>
                        ) : null}
                      </td>
                      <td className={`${fleetTdClass} text-right`}>
                        <Link href={`/fleet/drivers/${row.id}`} className="mr-3 text-zinc-400 hover:text-zinc-200 hover:underline">
                          Detalii
                        </Link>
                        {write ? (
                          <Link href={`/fleet/drivers/${row.id}/edit`} className="text-emerald-400 hover:underline">
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
