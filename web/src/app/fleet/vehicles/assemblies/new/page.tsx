import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { VehicleAssemblyPlaceholder } from "@/components/fleet/VehicleAssemblyPlaceholder";
import Link from "next/link";
import { redirect } from "next/navigation";
import { canWriteFleetOps, getAuthMeResult } from "@/lib/auth-server";

export default async function NewVehicleAssemblyPage() {
  const auth = await getAuthMeResult();
  if (!auth.ok && auth.kind === "backend_error" && auth.status === 401) {
    redirect("/login?next=/fleet/vehicles/assemblies/new");
  }
  if (!canWriteFleetOps(auth)) {
    redirect("/fleet/vehicles");
  }

  return (
    <FleetPageMain>
      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Fleet core</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Ansamblu nou</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Compunere rutieră: vehicul tractor + vehicul tractat, condus ca un singur vehicul în operațiuni.
          </p>
        </div>
        <Link
          href="/fleet/vehicles"
          className="inline-flex w-fit items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
        >
          Înapoi la listă
        </Link>
      </div>

      <VehicleAssemblyPlaceholder />
    </FleetPageMain>
  );
}
