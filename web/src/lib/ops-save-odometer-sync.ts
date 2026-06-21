import type { VehicleOdometerSyncPayload } from "@/lib/vehicle-odometer-sync";

export async function readOpsSaveResponse(res: Response): Promise<{
  ok: boolean;
  error: string | null;
  vehicleOdometerSync: VehicleOdometerSyncPayload | null;
}> {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { message?: string | string[] };
      if (typeof j.message === "string") msg = j.message;
      else if (Array.isArray(j.message)) msg = j.message.join(", ");
    } catch {
      // ignore
    }
    return { ok: false, error: msg, vehicleOdometerSync: null };
  }

  try {
    const j = (await res.json()) as { vehicleOdometerSync?: VehicleOdometerSyncPayload | null };
    return {
      ok: true,
      error: null,
      vehicleOdometerSync: j.vehicleOdometerSync ?? null,
    };
  } catch {
    return { ok: true, error: null, vehicleOdometerSync: null };
  }
}
