import Link from "next/link";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { notFound } from "next/navigation";
import { DeleteTripButton } from "@/components/fleet/DeleteTripButton";
import { DriverDetailActionBar } from "@/components/fleet/DriverDetailActionBar";
import { canWriteTrips, getAuthMeResult, isClientDriverPortal } from "@/lib/auth-server";
import { formatDateTimeRo } from "@/lib/datetime-local";
import { fleetServerFetch } from "@/lib/fleet-server";
import { formatRonFromCents } from "@/lib/money";
import { tripPurposeLabel, tripRoadTypeLabel } from "@/lib/trip-ops";

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
  purpose?: string | null;
  roadType?: string | null;
  isRoundTrip?: boolean;
  odometerStartKm?: number | null;
  odometerEndKm?: number | null;
  driverId?: string | null;
  driverName?: string | null;
};

type LinkedCost = {
  id: string;
  category: string;
  amountCents: number;
  incurredOn: string;
  fuelLiters: number | null;
};

async function getTrip(id: string): Promise<TripRow | null> {
  const res = await fleetServerFetch(`/trips/${id}`);
  if (!res || res.status === 404 || !res.ok) return null;
  return (await res.json()) as TripRow;
}

async function getLinkedCosts(tripId: string): Promise<LinkedCost[]> {
  const res = await fleetServerFetch(`/costs?pageSize=50&tripId=${encodeURIComponent(tripId)}`);
  if (!res?.ok) return [];
  const data = (await res.json()) as { items?: LinkedCost[] };
  return data.items ?? [];
}

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [trip, auth, linkedCosts] = await Promise.all([
    getTrip(id),
    getAuthMeResult(),
    getLinkedCosts(id),
  ]);
  if (!trip) notFound();
  const write = canWriteTrips(auth);
  const driverPortal = isClientDriverPortal(auth);
  const title = trip.reference ?? trip.registrationNumber;

  return (
    <FleetPageMain narrow="md" className={driverPortal ? "min-w-0 overflow-x-hidden" : undefined}>
      {driverPortal ? (
        <DriverDetailActionBar
          backHref="/fleet/trips"
          backLabel="Curse"
          title={title}
          editHref={write ? `/fleet/trips/${id}/edit` : undefined}
          deleteSlot={
            write ? (
              <DeleteTripButton tripId={id} label={trip.reference ?? id} redirectTo="/fleet/trips" variant="icon" />
            ) : null
          }
        />
      ) : null}

      <div className={`mb-8 items-end justify-between gap-4 ${driverPortal ? "hidden lg:flex" : "flex"}`}>
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
              <Link
                href={`/fleet/trips/${id}/edit`}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
              >
                Editare
              </Link>
              <DeleteTripButton tripId={id} label={trip.reference ?? id} redirectTo="/fleet/trips" />
            </>
          ) : null}
        </div>
      </div>

      {driverPortal ? (
        <h1 className="mb-4 text-2xl font-semibold tracking-tight lg:hidden">{title}</h1>
      ) : null}

      <dl
        className={`grid gap-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 sm:grid-cols-2 ${
          driverPortal ? "gap-4 p-4 sm:gap-6 sm:p-6" : ""
        }`}
      >
        <div>
          <dt className="text-xs uppercase text-zinc-500">Număr auto</dt>
          <dd className="mt-1 font-mono">{trip.registrationNumber}</dd>
        </div>
        {!driverPortal ? (
          <>
            <div>
              <dt className="text-xs uppercase text-zinc-500">Client</dt>
              <dd className="mt-1">{trip.clientId}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-zinc-500">Tenant</dt>
              <dd className="mt-1 font-mono">{trip.tenantSlug}</dd>
            </div>
          </>
        ) : null}
        <div>
          <dt className="text-xs uppercase text-zinc-500">Start</dt>
          <dd className="mt-1">{formatDateTimeRo(trip.startedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-zinc-500">Stop</dt>
          <dd className="mt-1">{formatDateTimeRo(trip.endedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-zinc-500">Origine</dt>
          <dd className="mt-1">{trip.originLabel ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-zinc-500">Destinație</dt>
          <dd className="mt-1">{trip.destLabel ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-zinc-500">Distanță</dt>
          <dd className="mt-1 font-mono">{trip.distanceKm ?? "—"} km</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-zinc-500">Dus / dus-întors</dt>
          <dd className="mt-1">{trip.isRoundTrip ? "Dus-întors" : "Doar dus"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-zinc-500">Scop</dt>
          <dd className="mt-1">{tripPurposeLabel(trip.purpose)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-zinc-500">Tip drum</dt>
          <dd className="mt-1">{tripRoadTypeLabel(trip.roadType)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-zinc-500">Odometru start</dt>
          <dd className="mt-1 font-mono">{trip.odometerStartKm ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-zinc-500">Odometru final</dt>
          <dd className="mt-1 font-mono">{trip.odometerEndKm ?? "—"}</dd>
        </div>
        {!driverPortal ? (
          <>
            <div>
              <dt className="text-xs uppercase text-zinc-500">Șofer</dt>
              <dd className="mt-1">
                {trip.driverId ? (
                  <Link href={`/fleet/drivers/${trip.driverId}`} className="text-emerald-400 hover:underline">
                    {trip.driverName ?? "—"}
                  </Link>
                ) : (
                  (trip.driverName ?? "—")
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-zinc-500">Vehicle ID</dt>
              <dd className="mt-1 font-mono text-xs text-zinc-400">{trip.vehicleId}</dd>
            </div>
          </>
        ) : null}
      </dl>

      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-widest text-zinc-500">Costuri legate</h2>
        {linkedCosts.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Niciun cost cu această cursă.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-800 rounded-xl border border-zinc-800">
            {linkedCosts.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <Link href={`/fleet/costs/${c.id}`} className="text-emerald-400 hover:underline">
                  {c.category}
                  {c.fuelLiters != null ? ` · ${c.fuelLiters} L` : ""}
                </Link>
                <span className="font-mono text-zinc-300">{formatRonFromCents(c.amountCents)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </FleetPageMain>
  );
}
