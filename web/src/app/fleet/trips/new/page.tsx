import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { OpsFormLayout } from "@/components/fleet/OpsFormLayout";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TripForm } from "@/components/fleet/TripForm";
import {
  canWriteTrips,
  driverIdFromAuth,
  driverNameFromAuth,
  getAuthMeResult,
  isClientDriverPortal,
} from "@/lib/auth-server";
import { resolveCurrentVehicleId } from "@/lib/driver-portal-server";
import { getTripVehicleOptions, getVehicleOptions } from "@/lib/vehicle-options-server";

export default async function NewTripPage({ searchParams }: { searchParams: Promise<{ vehicleId?: string }> }) {
  const sp = await searchParams;
  const auth = await getAuthMeResult();
  if (!auth.ok && auth.kind === "backend_error" && auth.status === 401) {
    redirect("/login?next=/fleet/trips/new");
  }
  if (!canWriteTrips(auth)) {
    redirect("/fleet/trips");
  }
  const driverPortal = isClientDriverPortal(auth);
  const lockedDriverId = driverPortal ? driverIdFromAuth(auth) : undefined;
  const currentVehicleId = driverPortal ? await resolveCurrentVehicleId(lockedDriverId) : null;
  const defaultVehicleId = sp.vehicleId ?? (driverPortal ? (currentVehicleId ?? undefined) : undefined);
  let vehicles = driverPortal ? await getTripVehicleOptions() : await getVehicleOptions();
  if (driverPortal && defaultVehicleId) {
    vehicles = vehicles.filter((v) => v.id === defaultVehicleId);
  }

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
        formTitle="Cursă nouă"
        vehicles={vehicles}
        defaultVehicleId={defaultVehicleId}
        hideVehicleBrief={driverPortal}
      >
        <TripForm
          mode="create"
          vehicles={vehicles}
          defaultVehicleId={defaultVehicleId}
          lockedDriverId={lockedDriverId}
          lockedDriverName={driverPortal ? driverNameFromAuth(auth) : undefined}
        />
      </OpsFormLayout>
    </FleetPageMain>
  );
}
