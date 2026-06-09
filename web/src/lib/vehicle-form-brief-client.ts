import { fleetBrowserBase } from "@/lib/fleet-api";
import type { VehicleFormBriefPayload } from "@/lib/vehicle-form-brief-types";

export async function fetchVehicleFormBrief(vehicleId: string): Promise<VehicleFormBriefPayload | null> {
  if (!vehicleId.trim()) return null;
  try {
    const res = await fetch(`${fleetBrowserBase}/vehicles/${encodeURIComponent(vehicleId)}/form-brief`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as VehicleFormBriefPayload;
  } catch {
    return null;
  }
}
