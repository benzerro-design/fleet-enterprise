import Link from "next/link";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import type { ClientListPayload } from "@/lib/clients-api";
import { fleetServerFetch } from "@/lib/fleet-server";

type Search = { q?: string; status?: string; page?: string };

async function loadClients(sp: Search): Promise<ClientListPayload | null> {
  const p = new URLSearchParams();
  if (sp.q?.trim()) p.set("q", sp.q.trim());
  if (sp.status?.trim()) p.set("status", sp.status.trim());
  p.set("page", String(Math.max(1, parseInt(sp.page ?? "1", 10) || 1)));
  p.set("pageSize", "50");
  try {
    const res = await fleetServerFetch(`/clients?${p.toString()}`);
    if (!res?.ok) return null;
    return (await res.json()) as ClientListPayload;
  } catch {
    return null;
  }
}

type PageProps = { searchParams: Promise<Search> };

export default async function FleetClientsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const [list, auth] = await Promise.all([loadClients(sp), getAuthMeResult()]);
  const write = canManageFleet(auth);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const withPage = (next: number) => {
    const p = new URLSearchParams();
    if (sp.q?.trim()) p.set("q", sp.q.trim());
    if (sp.status?.trim()) p.set("status", sp.status.trim());
    p.set("page", String(next));
    return `/fleet/clients?${p.toString()}`;
  };

  return (
    <FleetPageMain>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Clienți & CRM</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Clienți (organizații)</h1>
          <p className="mt-3 max-w-2xl text-zinc-400">
            Organizații contractuale — vehiculele și rapoartele FAZ se leagă de client.
          </p>
        </div>
        {write ? (
          <Link
            href="/fleet/clients/new"
            className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
          >
            Client nou
          </Link>
        ) : null}
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
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
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
        >
          Filtrează
        </button>
      </form>

      {!list ? (
        <p className="text-amber-400">Nu am putut încărca clienții. Verifică migrarea și API-ul.</p>
      ) : list.items.length === 0 ? (
        <p className="text-zinc-500">Niciun client găsit.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-900/50 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Cod</th>
                <th className="px-4 py-3">Denumire</th>
                <th className="px-4 py-3">CUI</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Vehicule</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {list.items.map((row) => (
                <tr key={row.id} className="text-zinc-200">
                  <td className="px-4 py-3 font-mono text-emerald-300/90">{row.code}</td>
                  <td className="px-4 py-3">{row.legalName}</td>
                  <td className="px-4 py-3 font-mono text-zinc-400">{row.taxId ?? "—"}</td>
                  <td className="px-4 py-3 capitalize">{row.status}</td>
                  <td className="px-4 py-3">{row.vehicleCount}</td>
                  <td className="px-4 py-3 text-right">
                    {write ? (
                      <Link
                        href={`/fleet/clients/${row.id}/edit`}
                        className="text-emerald-400 hover:underline"
                      >
                        Editare
                      </Link>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {list && list.total > list.pageSize ? (
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
    </FleetPageMain>
  );
}
