import Link from "next/link";
import { DriverAllocationBoard } from "@/components/fleet/DriverAllocationBoard";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { canWriteFleetOps, getAuthMeResult } from "@/lib/auth-server";
import type { DriverListPayload } from "@/lib/drivers-api";
import { fleetServerFetch } from "@/lib/fleet-server";

type VehiclesPayload = {
  items: Array<{
    id: string;
    registrationNumber: string;
    clientId: string;
    clientLegalName?: string;
    brand?: string | null;
    model?: string | null;
  }>;
};

async function loadVehicles() {
  try {
    const res = await fleetServerFetch("/fleet/vehicles?page=1&pageSize=200");
    if (!res?.ok) return [];
    const data = (await res.json()) as VehiclesPayload;
    return data.items;
  } catch {
    return [];
  }
}

async function loadDrivers() {
  try {
    const res = await fleetServerFetch("/drivers?status=active&pageSize=200");
    if (!res?.ok) return [];
    const data = (await res.json()) as DriverListPayload;
    return data.items;
  } catch {
    return [];
  }
}

export default async function DriverAllocationBoardPage() {
  const [vehicles, drivers, auth] = await Promise.all([
    loadVehicles(),
    loadDrivers(),
    getAuthMeResult(),
  ]);
  const write = canWriteFleetOps(auth);

  return (
    <FleetPageMain fill>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Clienți & CRM</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Alocare șoferi</h1>
          <p className="mt-3 max-w-2xl text-zinc-400">
            Vedere flotă: cine e pe ce vehicul. Un vehicul = un șofer activ; alocarea nouă închide
            automat alocarea anterioară pe același vehicul.
          </p>
        </div>
        <Link
          href="/fleet/drivers"
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
        >
          ← Lista șoferi
        </Link>
      </div>

      <DriverAllocationBoard vehicles={vehicles} drivers={drivers} canWrite={write} />
    </FleetPageMain>
  );
}
