import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import Link from "next/link";
import { redirect } from "next/navigation";
import { VehicleForm } from "@/components/fleet/VehicleForm";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";

export default async function NewVehiclePage() {
  const auth = await getAuthMeResult();
  if (!auth.ok && auth.kind === "backend_error" && auth.status === 401) {
    redirect("/login?next=/fleet/vehicles/new");
  }
  if (!canManageFleet(auth)) {
    redirect("/fleet/vehicles");
  }

  return (
    <FleetPageMain>
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Fleet core</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Vehicul nou</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Datele merg prin <code className="text-zinc-300">POST /api/fleet/vehicles</code> (proxy cu JWT).
            </p>
          </div>
          <Link
            href="/fleet/vehicles"
            className="inline-flex w-fit items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            Înapoi la listă
          </Link>
        </div>

        <VehicleForm />
    </FleetPageMain>
  );
}
