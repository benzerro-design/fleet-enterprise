import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteTripButton } from "@/components/fleet/DeleteTripButton";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";

type TripRow = {
  id: string;
  tenantSlug: string;
  vehicleId: string;
  registrationNumber: string;
  clientId: string;
  reference: string | null;
  startedAt: string;
  endedAt: string | null;
  originLabel: string | null;
  destLabel: string | null;
  distanceKm: number | null;
};

async function getTrip(id: string): Promise<TripRow | null> {
  const res = await fleetServerFetch(`/trips/${id}`);
  if (!res || res.status === 404 || !res.ok) return null;
  return (await res.json()) as TripRow;
}

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [trip, auth] = await Promise.all([getTrip(id), getAuthMeResult()]);
  if (!trip) notFound();
  const write = canManageFleet(auth);

  return (
    <div className="text-zinc-100">
      <main className="mx-auto max-w-4xl px-6 py-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Trip</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{trip.reference ?? trip.id}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/fleet/trips" className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm">
              Înapoi la listă
            </Link>
            {write ? (
              <>
                <Link href={`/fleet/trips/${id}/edit`} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900">
                  Editare
                </Link>
                <DeleteTripButton tripId={id} label={trip.reference ?? id} redirectTo="/fleet/trips" />
              </>
            ) : null}
          </div>
        </div>
        <dl className="grid gap-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 sm:grid-cols-2">
          <div><dt className="text-xs uppercase text-zinc-500">Număr auto</dt><dd className="mt-1 font-mono">{trip.registrationNumber}</dd></div>
          <div><dt className="text-xs uppercase text-zinc-500">Client</dt><dd className="mt-1">{trip.clientId}</dd></div>
          <div><dt className="text-xs uppercase text-zinc-500">Tenant</dt><dd className="mt-1 font-mono">{trip.tenantSlug}</dd></div>
          <div><dt className="text-xs uppercase text-zinc-500">Start</dt><dd className="mt-1">{new Date(trip.startedAt).toLocaleString("ro-RO")}</dd></div>
          <div><dt className="text-xs uppercase text-zinc-500">Stop</dt><dd className="mt-1">{trip.endedAt ? new Date(trip.endedAt).toLocaleString("ro-RO") : "—"}</dd></div>
          <div><dt className="text-xs uppercase text-zinc-500">Origine</dt><dd className="mt-1">{trip.originLabel ?? "—"}</dd></div>
          <div><dt className="text-xs uppercase text-zinc-500">Destinație</dt><dd className="mt-1">{trip.destLabel ?? "—"}</dd></div>
          <div><dt className="text-xs uppercase text-zinc-500">Distanță</dt><dd className="mt-1 font-mono">{trip.distanceKm ?? "—"} km</dd></div>
          <div><dt className="text-xs uppercase text-zinc-500">Vehicle ID</dt><dd className="mt-1 font-mono text-xs text-zinc-400">{trip.vehicleId}</dd></div>
        </dl>
      </main>
    </div>
  );
}

