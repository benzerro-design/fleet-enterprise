import { fleetBrowserBase, fleetJsonHeaders } from "@/lib/fleet-api";
import type { TireCustodyProtocolKind } from "@/lib/tire-custody-api";
import { tireCustodyKindLabel } from "@/lib/tire-custody-api";

export type DriverCustodyPhase =
  | "needs_driver_sign"
  | "awaiting_partner_finalize"
  | "done";

export type DriverVehicleCustodyPending = {
  protocolId: string;
  kind: TireCustodyProtocolKind;
  stayId: string;
  supplierName: string;
  locationText: string | null;
  setSeason: string | null;
  hasDriverInvite: boolean;
  driverInviteExpiresAt: string | null;
  phase: DriverCustodyPhase;
  status: "draft" | "signed" | "voided";
  driverSignedAt: string | null;
  partnerSigned: boolean;
  stayCheckedOut: boolean;
  ticketId: string | null;
};

export type VehicleTicketCustodyProgress = {
  ticketId: string | null;
  stayId: string | null;
  stayCheckedOut: boolean;
  supplierName: string | null;
  plate: string | null;
  checkIn: { protocolId: string; status: string; signed: boolean } | null;
  release: {
    protocolId: string;
    kind: string;
    status: string;
    signed: boolean;
    driverSigned: boolean;
    driverSignedAt: string | null;
    partnerSigned: boolean;
    customerSigned: boolean;
  } | null;
  steps: Array<{ key: string; label: string; done: boolean; detail: string | null }>;
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
  return (data.items ?? []).map((item) => ({
    ...item,
    phase: item.phase ?? (item.hasDriverInvite ? "needs_driver_sign" : "needs_driver_sign"),
    status: item.status ?? "draft",
    driverSignedAt: item.driverSignedAt ?? null,
    partnerSigned: item.partnerSigned ?? false,
    stayCheckedOut: item.stayCheckedOut ?? false,
    ticketId: item.ticketId ?? null,
  }));
}

export async function fetchVehicleTicketCustodyProgress(
  vehicleId: string,
  ticketId?: string | null,
): Promise<VehicleTicketCustodyProgress> {
  const qs = ticketId ? `?ticketId=${encodeURIComponent(ticketId)}` : "";
  const res = await fetch(
    `${fleetBrowserBase}/vehicles/${encodeURIComponent(vehicleId)}/tire-custody/ticket-progress${qs}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as VehicleTicketCustodyProgress;
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

export function driverCustodyPhaseLabel(phase: DriverCustodyPhase): string {
  if (phase === "needs_driver_sign") return "Semnătura ta e necesară";
  if (phase === "awaiting_partner_finalize") return "Ai semnat — hotelul finalizează predarea";
  return "Predare finalizată";
}
