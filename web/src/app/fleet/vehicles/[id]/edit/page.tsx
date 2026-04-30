import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { VehicleForm } from "@/components/fleet/VehicleForm";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { type VehicleRecord } from "@/lib/fleet-api";
import { fleetServerFetch } from "@/lib/fleet-server";

async function getVehicle(id: string): Promise<VehicleRecord | null> {
  try {
    const res = await fleetServerFetch(`/fleet/vehicles/${id}`);
    if (!res) return null;
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return (await res.json()) as VehicleRecord;
  } catch {
    return null;
  }
}
export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getAuthMeResult();
  if (!auth.ok && auth.kind === "backend_error" && auth.status === 401) {
    redirect(`/login?next=${encodeURIComponent(`/fleet/vehicles/${id}/edit`)}`);
  }
  if (!canManageFleet(auth)) {
    redirect("/fleet/vehicles");
  }
  const vehicle = await getVehicle(id);
  if (!vehicle) notFound();

  return (
    <div className="text-zinc-100">
      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Fleet core</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Editare vehicul</h1>
            <p className="mt-2 font-mono text-sm text-zinc-400">{vehicle.registrationNumber}</p>
          </div>
          <Link
            href="/fleet/vehicles"
            className="inline-flex w-fit items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            Înapoi la listă
          </Link>
        </div>

        <VehicleForm mode="edit" vehicleId={id} initial={vehicle} />
      </main>
    </div>
  );
}
