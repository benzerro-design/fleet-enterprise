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
  }>;
};

export async function getVehicleOptions(): Promise<OpsVehicleOption[]> {
  const res = await fleetServerFetch("/fleet/vehicles?page=1&pageSize=200");
  if (!res?.ok) return [];
  const data = (await res.json()) as VehiclesPayload;
  return data.items.map((v) => ({
    id: v.id,
    registrationNumber: v.registrationNumber,
    clientId: v.clientId,
    odometerKm: v.odometerKm,
    fuelType: v.fuelType ?? null,
    civProfile: v.civProfile ?? {},
  }));
}
