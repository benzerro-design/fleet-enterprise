import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DocumentRemindersView } from "@/components/fleet/DocumentRemindersView";
import { fleetServerFetch } from "@/lib/fleet-server";

async function getVehicle(id: string) {
  const res = await fleetServerFetch(`/fleet/vehicles/${id}`);
  if (!res || res.status === 404 || !res.ok) return null;
  return (await res.json()) as { id: string; registrationNumber: string; clientId: string };
}

export default async function VehicleRemindersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vehicle = await getVehicle(id);
  if (!vehicle) notFound();

  return (
    <div className="text-zinc-100">
      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-violet-400">Remindere vehicul</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{vehicle.registrationNumber}</h1>
            <p className="mt-2 text-sm text-zinc-400">Client {vehicle.clientId}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/fleet/vehicles/${id}`}
              className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
            >
              Detaliu vehicul
            </Link>
            <Link
              href="/fleet/reminders"
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              Toate reminderele
            </Link>
          </div>
        </div>
        <Suspense fallback={<p className="text-sm text-zinc-500">Se încarcă…</p>}>
          <DocumentRemindersView
            vehicleId={vehicle.id}
            registrationNumber={vehicle.registrationNumber}
            vehicleLabel={vehicle.registrationNumber}
            backHref={`/fleet/vehicles/${id}`}
          />
        </Suspense>
      </main>
    </div>
  );
}
