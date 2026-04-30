import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TripForm } from "@/components/fleet/TripForm";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";

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
type VehiclesPayload = { items: Array<{ id: string; registrationNumber: string; clientId: string }> };

async function getTrip(id: string): Promise<TripRecord | null> {
  const res = await fleetServerFetch(`/trips/${id}`);
  if (!res || res.status === 404 || !res.ok) return null;
  return (await res.json()) as TripRecord;
}

async function getVehicleOptions() {
  const res = await fleetServerFetch("/fleet/vehicles?page=1&pageSize=200");
  if (!res?.ok) return [];
  const data = (await res.json()) as VehiclesPayload;
  return data.items.map((v) => ({ id: v.id, registrationNumber: v.registrationNumber, clientId: v.clientId }));
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
    <div className="text-zinc-100">
      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Operațional</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Editare cursă</h1>
          </div>
          <Link href="/fleet/trips" className="inline-flex w-fit items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900">
            Înapoi la listă
          </Link>
        </div>
        <TripForm mode="edit" tripId={id} initial={trip} vehicles={vehicles} />
      </main>
    </div>
  );
}
