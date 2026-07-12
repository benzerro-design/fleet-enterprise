import { fleetJsonHeaders } from "@/lib/suppliers-api";
import type {
  CreateTenantServiceTypeInput,
  PatchTenantServiceTypeInput,
  TenantServiceType,
  TenantServiceTypesResponse,
} from "./types";

export const tenantServiceTypesBrowserBase = "/api/tenant/service-types";

async function parseError(res: Response): Promise<string> {
  let msg = `HTTP ${res.status}`;
  try {
    const j = (await res.json()) as { message?: string | string[] };
    if (typeof j.message === "string") msg = j.message;
    else if (Array.isArray(j.message)) msg = j.message.join(", ");
  } catch {
    /* ignore */
  }
  return msg;
}

export async function fetchTenantServiceTypesClient(): Promise<TenantServiceTypesResponse | null> {
  try {
    const res = await fetch(tenantServiceTypesBrowserBase, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as TenantServiceTypesResponse;
  } catch {
    return null;
  }
}

export async function createTenantServiceType(
  input: CreateTenantServiceTypeInput,
): Promise<TenantServiceType> {
  const res = await fetch(tenantServiceTypesBrowserBase, {
    method: "POST",
    headers: fleetJsonHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as TenantServiceType;
}

export async function patchTenantServiceType(
  id: string,
  input: PatchTenantServiceTypeInput,
): Promise<TenantServiceType> {
  const res = await fetch(`${tenantServiceTypesBrowserBase}/${id}`, {
    method: "PATCH",
    headers: fleetJsonHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as TenantServiceType;
}

export async function deleteTenantServiceType(id: string): Promise<void> {
  const res = await fetch(`${tenantServiceTypesBrowserBase}/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await parseError(res));
}
