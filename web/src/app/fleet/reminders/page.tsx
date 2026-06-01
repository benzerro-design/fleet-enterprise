import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import Link from "next/link";
import { Suspense } from "react";
import { RemindersListView } from "@/components/fleet/RemindersListView";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { remindersBrowserBase } from "@/lib/fleet-api";

type Search = {
  page?: string;
  registrationNumber?: string;
  clientId?: string;
  vehicleId?: string;
  sourceType?: string;
  status?: string;
  q?: string;
  dueFrom?: string;
  dueTo?: string;
};

function buildExportQuery(sp: Search): string {
  const q = new URLSearchParams();
  if (sp.registrationNumber?.trim()) q.set("registrationNumber", sp.registrationNumber.trim());
  if (sp.clientId?.trim()) q.set("clientId", sp.clientId.trim());
  if (sp.vehicleId?.trim()) q.set("vehicleId", sp.vehicleId.trim());
  if (sp.sourceType?.trim()) q.set("sourceType", sp.sourceType.trim());
  if (sp.status?.trim()) q.set("status", sp.status.trim());
  if (sp.q?.trim()) q.set("q", sp.q.trim());
  if (sp.dueFrom?.trim()) q.set("dueFrom", sp.dueFrom.trim());
  if (sp.dueTo?.trim()) q.set("dueTo", sp.dueTo.trim());
  return q.toString();
}

type Props = { searchParams: Promise<Search> };

export default async function FleetRemindersPage({ searchParams }: Props) {
  const sp = await searchParams;
  const auth = await getAuthMeResult();
  const write = canManageFleet(auth);
  const exportQs = buildExportQuery(sp);
  const exportHref = `${remindersBrowserBase}/export${exportQs ? `?${exportQs}` : ""}`;

  return (
    <FleetPageMain>
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-violet-400">Conformitate</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Remindere</h1>
            <p className="mt-3 max-w-xl text-sm text-zinc-400">
              Acțiuni pe vehicul — documente, mentenanță sau operațiuni personalizate. Constrângeri pe timp și km.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {write ? (
              <Link
                href="/fleet/reminders/new"
                className="inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
              >
                Acțiune nouă
              </Link>
            ) : null}
            <a
              href={exportHref}
              className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
            >
              Export CSV
            </a>
            <Link
              href="/fleet/documents"
              className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
            >
              Documente
            </Link>
          </div>
        </div>

        <form method="get" className="mb-8 flex flex-wrap items-end gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          {sp.status?.trim() ? <input type="hidden" name="status" value={sp.status.trim()} /> : null}
          <div className="flex min-w-[10rem] flex-1 flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Nr. înmatriculare</label>
            <input
              name="registrationNumber"
              defaultValue={sp.registrationNumber ?? ""}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex min-w-[8rem] flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Client</label>
            <input name="clientId" defaultValue={sp.clientId ?? ""} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
          </div>
          <div className="flex min-w-[9rem] flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Tip</label>
            <select name="sourceType" defaultValue={sp.sourceType ?? ""} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
              <option value="">Toate</option>
              <option value="document">Document</option>
              <option value="maintenance">Mentenanță</option>
              <option value="cost">Cost</option>
              <option value="custom">Personalizat</option>
            </select>
          </div>
          <div className="flex min-w-[10rem] flex-1 flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Căutare</label>
            <input name="q" defaultValue={sp.q ?? ""} placeholder="Titlu…" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
          </div>
          <button type="submit" className="rounded-lg bg-zinc-800 px-4 py-2 text-sm">
            Aplică
          </button>
          <Link href="/fleet/reminders" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400">
            Resetează
          </Link>
        </form>

        <Suspense fallback={<p className="text-sm text-zinc-500">Se încarcă…</p>}>
          <RemindersListView backHref="/fleet/vehicles" write={write} />
        </Suspense>
    </FleetPageMain>
  );
}
