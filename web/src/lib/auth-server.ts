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

/** Pagină implicită după login — userii client merg la tichete, nu la panou. */
export function getDefaultFleetHome(auth: AuthMeResult): string {
  if (isClientPortalUser(auth)) return "/fleet/tickets";
  return "/fleet/dashboard";
}
