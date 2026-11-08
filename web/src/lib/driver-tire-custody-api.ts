import { fleetBrowserBase, fleetJsonHeaders } from "@/lib/fleet-api";
import type { TireCustodyProtocolKind } from "@/lib/tire-custody-api";
import { tireCustodyKindLabel } from "@/lib/tire-custody-api";

export type DriverVehicleCustodyPending = {
  protocolId: string;
  kind: TireCustodyProtocolKind;
  stayId: string;
  supplierName: string;
  locationText: string | null;
  setSeason: string | null;
  hasDriverInvite: boolean;
  driverInviteExpiresAt: string | null;
};

export async function listDriverVehicleCustodyPending(
  vehicleId: string,
): Promise<DriverVehicleCustodyPending[]> {
  const res = await fetch(
    `${fleetBrowserBase}/vehicles/${encodeURIComponent(vehicleId)}/tire-custody/driver-pending`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = (await res.json()) as { items?: DriverVehicleCustodyPending[] };
  return data.items ?? [];
}

export async function issueDriverVehicleCustodySignLink(
  vehicleId: string,
  protocolId: string,
): Promise<{ url: string; otp: string; expiresAt: string }> {
  const res = await fetch(
    `${fleetBrowserBase}/vehicles/${encodeURIComponent(vehicleId)}/tire-custody/protocols/${encodeURIComponent(protocolId)}/driver-sign-link`,
    { method: "POST", headers: fleetJsonHeaders(), body: "{}" },
  );
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { message?: string };
      if (j.message) msg = j.message;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return (await res.json()) as { url: string; otp: string; expiresAt: string };
}

export function custodyKindLabel(kind: TireCustodyProtocolKind): string {
  return tireCustodyKindLabel(kind);
}
