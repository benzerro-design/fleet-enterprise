import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { OpsFormLayout } from "@/components/fleet/OpsFormLayout";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TripForm } from "@/components/fleet/TripForm";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";
import { getVehicleOptions } from "@/lib/vehicle-options-server";

type TripRecord = {
  id: string;
  vehicleId: string;
  clientId: string;
  reference: string | null;
  startedAt: string;
  endedAt: string | null;
  originLabel: string | null;
  destLabel: string | null;
  distanceKm: number | null;
};

async function getTrip(id: string): Promise<TripRecord | null> {
  const res = await fleetServerFetch(`/trips/${id}`);
  if (!res || res.status === 404 || !res.ok) return null;
  return (await res.json()) as TripRecord;
}

export default async function EditTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getAuthMeResult();
  if (!auth.ok && auth.kind === "backend_error" && auth.status === 401) {
    redirect(`/login?next=${encodeURIComponent(`/fleet/trips/${id}/edit`)}`);
  }
  if (!canManageFleet(auth)) {
    redirect("/fleet/trips");
  }
  const [trip, vehicles] = await Promise.all([getTrip(id), getVehicleOptions()]);
  if (!trip) notFound();

  return (
    <FleetPageMain>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Operațional</p>
        <Link
          href="/fleet/trips"
          className="inline-flex w-fit items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
        >
          Înapoi la listă
        </Link>
      </div>
      <OpsFormLayout
        module="trips"
        mode="edit"
        formTitle="Editare cursă"
        vehicles={vehicles}
        defaultVehicleId={trip.vehicleId}
      >
        <TripForm mode="edit" tripId={id} initial={trip} vehicles={vehicles} />
      </OpsFormLayout>
    </FleetPageMain>
  );
}
