import { cookies } from "next/headers";

function backendBase(): string {
  return process.env.API_URL ?? "http://localhost:4000";
}

/** Apel server → Nest, cu JWT din cookie (fără expunere în browser). */
export async function fleetServerFetch(
  path: string,
  init?: RequestInit,
): Promise<Response | null> {
  const token = (await cookies()).get("fleet_access")?.value;
  if (!token) return null;

  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);

  return fetch(`${backendBase()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}

/** Alias pentru rute Nest în afara `/fleet/*` (ex. `/tenant/*`). */
export const apiServerFetch = fleetServerFetch;
