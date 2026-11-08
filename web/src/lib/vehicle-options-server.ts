import { fleetServerFetch } from "@/lib/fleet-server";
import type { OpsVehicleOption } from "@/lib/ops-form-context";

type VehiclesPayload = {
  items: Array<{
    id: string;
    registrationNumber: string;
    clientId: string;
    odometerKm: number;
    fuelType?: string | null;
    civProfile?: Record<string, string | number | null>;
    assignedDriverId?: string | null;
    assignedDriverName?: string | null;
  }>;
};

function mapVehicleOption(v: VehiclesPayload["items"][number]): OpsVehicleOption {
  return {
    id: v.id,
    registrationNumber: v.registrationNumber,
    clientId: v.clientId,
    odometerKm: v.odometerKm,
    fuelType: v.fuelType ?? null,
    civProfile: v.civProfile ?? {},
    assignedDriverId: v.assignedDriverId ?? null,
    assignedDriverName: v.assignedDriverName ?? null,
  };
}

export async function getVehicleOptions(): Promise<OpsVehicleOption[]> {
  const res = await fleetServerFetch("/fleet/vehicles?page=1&pageSize=200");
  if (!res?.ok) return [];
  const data = (await res.json()) as VehiclesPayload;
  return data.items.map(mapVehicleOption);
}

/** Vehicule pentru curse/doc parcurs — L0 include istoricul de curse. */
export async function getTripVehicleOptions(): Promise<OpsVehicleOption[]> {
  const res = await fleetServerFetch("/fleet/vehicles?page=1&pageSize=200&vehicleScope=trip_ops");
  if (!res?.ok) return getVehicleOptions();
  const data = (await res.json()) as VehiclesPayload;
  return data.items.map(mapVehicleOption);
}
