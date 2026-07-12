import { cache } from "react";
import { fleetServerFetch } from "./fleet-server";

export type ClientMembershipMe = {
  clientId: string;
  clientCode: string;
  role: "client_admin" | "client_dispatcher" | "client_viewer" | "driver";
  driverId?: string | null;
};

export type SupplierMembershipMe = {
  supplierId: string;
  supplierCode: string;
  supplierLegalName: string;
  role: "supplier_manager" | "supplier_staff" | "supplier_accountant";
};

export type AuthMe = {
  userId?: string;
  email?: string;
  tenantSlug: string;
  role: "tenant_admin" | "tenant_viewer" | "client_user" | "supplier_user";
  /** Set for client_user: fleet = manager/dispatcher/viewer; driver = șofer cu flotă redusă. */
  clientPortal?: "fleet" | "driver";
  /** Set for supplier_user — portal partener. */
  partnerPortal?: boolean;
  access?: {
    isTenantWide: boolean;
    assignedVehicleIds?: string[];
    clientMemberships: ClientMembershipMe[];
    supplierMemberships: SupplierMembershipMe[];
  };
};

export type AuthMeResult =
  | { ok: true; me: AuthMe }
  | { ok: false; kind: "no_cookie" | "backend_error"; status?: number };

/** Dedupe între layout și pagini în același request. */
export const getAuthMeResult = cache(async (): Promise<AuthMeResult> => {
  const res = await fleetServerFetch("/auth/me");
  if (!res) return { ok: false, kind: "no_cookie" };
  if (!res.ok) return { ok: false, kind: "backend_error", status: res.status };
  try {
    const me = (await res.json()) as AuthMe;
    return { ok: true, me };
  } catch {
    return { ok: false, kind: "backend_error", status: res.status };
  }
});

export function canManageFleet(auth: AuthMeResult): boolean {
  return auth.ok && auth.me.role === "tenant_admin";
}

/** Meniu BOT — doar tenant_admin pe tenant demo (mediu dev/staging). */
export function canUseBot(auth: AuthMeResult): boolean {
  return auth.ok && auth.me.role === "tenant_admin" && auth.me.tenantSlug === "demo";
}

export function canWriteClientFleet(auth: AuthMeResult): boolean {
  if (!auth.ok) return false;
  if (auth.me.role === "tenant_admin") return true;
  if (auth.me.role === "client_user") {
    const roles = auth.me.access?.clientMemberships.map((m) => m.role) ?? [];
    return roles.some((r) => r === "client_admin" || r === "client_dispatcher");
  }
  return false;
}

/** Scriere operațională flotă — tenant_admin sau client_admin/dispatcher scoped. */
export function canWriteFleetOps(auth: AuthMeResult): boolean {
  return canManageFleet(auth) || canWriteClientFleet(auth);
}

export function defaultClientCodeForTickets(auth: AuthMeResult): string | undefined {
  if (!auth.ok || auth.me.role !== "client_user") return undefined;
  const memberships = auth.me.access?.clientMemberships ?? [];
  if (memberships.length === 1) return memberships[0].clientCode;
  return undefined;
}

/** CRM și acțiuni L0/L1 pentru useri client (nu client_viewer). */
export function canWriteTickets(auth: AuthMeResult): boolean {
  if (!auth.ok) return false;
  if (auth.me.role === "tenant_admin") return true;
  if (auth.me.role === "client_user") {
    const roles = auth.me.access?.clientMemberships.map((m) => m.role) ?? [];
    return roles.some((r) => r !== "client_viewer");
  }
  return false;
}

/** Dosar lucrare, programator, devize — manager client sau tenant_admin. */
export function canOperateServiceCase(auth: AuthMeResult): boolean {
  return canWriteClientFleet(auth) || canManageFleet(auth);
}

/** Aprobare deviz — client_admin sau tenant_admin. */
export function canApproveQuotes(auth: AuthMeResult): boolean {
  if (!auth.ok) return false;
  if (auth.me.role === "tenant_admin") return true;
  const roles = auth.me.access?.clientMemberships.map((m) => m.role) ?? [];
  return roles.some((r) => r === "client_admin");
}

/** Confirmare programare — manager, dispecer sau șofer scoped. */
export function canConfirmAppointment(auth: AuthMeResult): boolean {
  if (!auth.ok) return false;
  if (auth.me.role === "tenant_admin") return true;
  if (auth.me.role === "client_user") {
    const roles = auth.me.access?.clientMemberships.map((m) => m.role) ?? [];
    return roles.some(
      (r) => r === "client_admin" || r === "client_dispatcher" || r === "driver",
    );
  }
  return false;
}

/** Confirmare primire programare — șofer. */
export function canAckAppointment(auth: AuthMeResult): boolean {
  if (!auth.ok) return false;
  if (auth.me.role === "tenant_admin") return true;
  return isClientDriverPortal(auth);
}

/** Manager CRM — patch status/prioritate, nu doar comentarii L0. */
export function canPatchTickets(auth: AuthMeResult): boolean {
  return canWriteClientFleet(auth);
}

export function isClientPortalUser(auth: AuthMeResult): boolean {
  return auth.ok && auth.me.role === "client_user";
}

export function isPartnerPortalUser(auth: AuthMeResult): boolean {
  return auth.ok && (auth.me.role === "supplier_user" || auth.me.partnerPortal === true);
}

export function canWritePartnerOps(auth: AuthMeResult): boolean {
  if (!auth.ok || !isPartnerPortalUser(auth)) return false;
  const roles = auth.me.access?.supplierMemberships.map((m) => m.role) ?? [];
  return roles.some((r) => r === "supplier_manager" || r === "supplier_staff");
}

export function isClientDriverPortal(auth: AuthMeResult): boolean {
  return auth.ok && auth.me.role === "client_user" && auth.me.clientPortal === "driver";
}

export function isClientFleetPortal(auth: AuthMeResult): boolean {
  return auth.ok && auth.me.role === "client_user" && auth.me.clientPortal === "fleet";
}

export function canDriverWriteTrips(auth: AuthMeResult): boolean {
  return isClientDriverPortal(auth);
}

export function canDriverWriteCosts(auth: AuthMeResult): boolean {
  return isClientDriverPortal(auth);
}

export function canDriverWriteVehicleMedia(auth: AuthMeResult): boolean {
  return isClientDriverPortal(auth);
}

export function canWriteTrips(auth: AuthMeResult): boolean {
  return canWriteFleetOps(auth) || canDriverWriteTrips(auth);
}

export function canWriteCosts(auth: AuthMeResult): boolean {
  return canWriteFleetOps(auth) || canDriverWriteCosts(auth);
}

export function canWriteVehicleMedia(auth: AuthMeResult): boolean {
  return canWriteFleetOps(auth) || canDriverWriteVehicleMedia(auth);
}

export function driverIdFromAuth(auth: AuthMeResult): string | undefined {
  if (!auth.ok || auth.me.role !== "client_user") return undefined;
  for (const m of auth.me.access?.clientMemberships ?? []) {
    if (m.role === "driver" && m.driverId) return m.driverId;
  }
  return undefined;
}

export function driverNameFromAuth(auth: AuthMeResult): string | undefined {
  if (!auth.ok) return undefined;
  return auth.me.email?.split("@")[0];
}

/** Pagină implicită după login — șoferi la vehicule, manager client la panou scoped, partener la portal. */
export function getDefaultFleetHome(auth: AuthMeResult): string {
  if (isPartnerPortalUser(auth)) return "/fleet/partner";
  if (isClientFleetPortal(auth)) return "/fleet/dashboard";
  if (isClientDriverPortal(auth)) return "/fleet/vehicles";
  if (isClientPortalUser(auth)) return "/fleet/tickets";
  return "/fleet/dashboard";
}
