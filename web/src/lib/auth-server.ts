import { cache } from "react";
import { fleetServerFetch } from "./fleet-server";

export type AuthMe = {
  email?: string;
  tenantSlug: string;
  role: "tenant_admin" | "tenant_viewer";
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
