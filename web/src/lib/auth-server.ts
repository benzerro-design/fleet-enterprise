import { cache } from "react";
import { fleetServerFetch } from "./fleet-server";

export type ClientMembershipMe = {
  clientId: string;
  clientCode: string;
  role: "client_admin" | "client_dispatcher" | "client_viewer" | "driver";
};

export type AuthMe = {
  email?: string;
  tenantSlug: string;
  role: "tenant_admin" | "tenant_viewer" | "client_user";
  /** Set for client_user: fleet = manager/dispatcher/viewer; tickets = șofer only. */
  clientPortal?: "fleet" | "tickets";
  access?: {
    isTenantWide: boolean;
    clientMemberships: ClientMembershipMe[];
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

export function isClientPortalUser(auth: AuthMeResult): boolean {
  return auth.ok && auth.me.role === "client_user";
}

export function isClientTicketsOnly(auth: AuthMeResult): boolean {
  return auth.ok && auth.me.role === "client_user" && auth.me.clientPortal !== "fleet";
}

export function isClientFleetPortal(auth: AuthMeResult): boolean {
  return auth.ok && auth.me.role === "client_user" && auth.me.clientPortal === "fleet";
}

/** Pagină implicită după login — șoferi la tichete, manager client la panou scoped. */
export function getDefaultFleetHome(auth: AuthMeResult): string {
  if (isClientFleetPortal(auth)) return "/fleet/dashboard";
  if (isClientPortalUser(auth)) return "/fleet/tickets";
  return "/fleet/dashboard";
}
