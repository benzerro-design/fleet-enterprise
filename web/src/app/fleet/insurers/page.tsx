import Link from "next/link";
import { redirect } from "next/navigation";
import { FleetListPageLayout } from "@/components/fleet/FleetListPageLayout";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { InsurersClientPanel } from "@/components/fleet/insurers/InsurersClientPanel";
import { canManageFleet, canReadSuppliers, getAuthMeResult, getDefaultFleetHome } from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";
import type { InsurerListPayload } from "@/lib/insurers-api";

type Search = { q?: string; active?: string; page?: string };

async function loadInsurers(sp: Search): Promise<InsurerListPayload | null> {
  const p = new URLSearchParams();
  if (sp.q?.trim()) p.set("q", sp.q.trim());
  if (sp.active === "true" || sp.active === "false") p.set("active", sp.active);
  p.set("page", String(Math.max(1, parseInt(sp.page ?? "1", 10) || 1)));
  p.set("pageSize", "100");
  try {
    const res = await fleetServerFetch(`/insurers?${p.toString()}`);
    if (!res?.ok) return null;
    return (await res.json()) as InsurerListPayload;
  } catch {
    return null;
  }
}

type PageProps = { searchParams: Promise<Search> };

export default async function FleetInsurersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const [list, auth] = await Promise.all([loadInsurers(sp), getAuthMeResult()]);
  if (!canReadSuppliers(auth)) redirect(getDefaultFleetHome(auth));
  const canWrite = canManageFleet(auth);

  return (
    <FleetPageMain fill>
      <FleetListPageLayout
        header={
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-widest text-sky-400">
                Daune & asigurări
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Asigurători</h1>
              <p className="mt-3 max-w-2xl text-zinc-400">
                Catalog societăți pentru dosare de daună — select pe dosar, email claims.
              </p>
            </div>
            <Link
              href="/fleet/suppliers"
              className="inline-flex items-center justify-center rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
            >
              Furnizori
            </Link>
          </div>
        }
      >
        <InsurersClientPanel initial={list} canWrite={canWrite} search={sp} />
      </FleetListPageLayout>
    </FleetPageMain>
  );
}
