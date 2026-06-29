import { FleetDashboardView } from "@/components/fleet/FleetDashboardView";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { getAuthMeResult, getDefaultFleetHome, isClientDriverPortal } from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";
import type { FleetDashboardSnapshot } from "@/lib/fleet-dashboard";
import Link from "next/link";
import { redirect } from "next/navigation";

async function loadDashboard(): Promise<FleetDashboardSnapshot | null> {
  const res = await fleetServerFetch("/fleet/dashboard");
  if (!res) return null;
  if (res.status === 401) redirect("/login?next=/fleet/dashboard");
  if (!res.ok) return null;
  return res.json() as Promise<FleetDashboardSnapshot>;
}

export default async function FleetDashboardPage() {
  const auth = await getAuthMeResult();
  if (isClientDriverPortal(auth)) {
    redirect(getDefaultFleetHome(auth));
  }

  const data = await loadDashboard();

  return (
    <FleetPageMain>
      <div className="mb-10">
        <p className="text-sm font-medium uppercase tracking-widest text-violet-400">Operațiuni</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Panou general</h1>
        <p className="mt-3 max-w-2xl text-sm text-zinc-400">
          Rezumat flotă pentru tenantul curent — vehicule, conformitate ITP și documente, remindere, costuri și curse din luna în curs.
        </p>
        {data ? (
          <p className="mt-2 text-xs text-zinc-600">
            Actualizat {new Date(data.generatedAt).toLocaleString("ro-RO")}
          </p>
        ) : null}
      </div>

      {data ? (
        <FleetDashboardView data={data} />
      ) : (
        <div className="rounded-xl border border-amber-900/50 bg-amber-950/30 p-6 text-sm text-amber-100">
          <p>Nu s-au putut încărca datele panoului.</p>
          <p className="mt-2 text-amber-200/80">
            Verifică că API-ul rulează și că ești autentificat. Poți reîncerca după reîmprospătare.
          </p>
          <Link href="/fleet/dashboard" className="mt-4 inline-block text-violet-400 hover:text-violet-300">
            Reîncarcă
          </Link>
        </div>
      )}
    </FleetPageMain>
  );
}
