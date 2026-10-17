import { redirect } from "next/navigation";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { ProceduresEditor, type ProcedureRow } from "@/components/fleet/ProceduresEditor";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";

export default async function ProceduresPage() {
  const auth = await getAuthMeResult();
  if (!auth.ok || (auth.me.role !== "tenant_admin" && auth.me.role !== "tenant_viewer")) {
    redirect("/fleet/dashboard");
  }
  const res = await fleetServerFetch("/tenant/procedures");
  const data = res?.ok ? ((await res.json()) as { items: ProcedureRow[] }) : { items: [] };

  return (
    <FleetPageMain narrow="md">
      <div>
        <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Administrare</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-50">Proceduri</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Cum lucrează echipa abonatului. Nu înlocuiește Help-ul de produs și nu se generează din fluxuri.
          Clientul și partenerul rămân pentru felia următoare.
        </p>
      </div>
      <ProceduresEditor items={data.items} canWrite={canManageFleet(auth)} />
    </FleetPageMain>
  );
}
