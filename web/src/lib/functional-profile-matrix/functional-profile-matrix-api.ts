import type { FunctionalProfileMatrixOverride, FunctionalProfileMatrixResponse } from "./types";

export const functionalProfileMatrixBrowserBase = "/api/tenant";

export async function fetchFunctionalProfileMatrixClient(): Promise<FunctionalProfileMatrixResponse | null> {
  try {
    const res = await fetch(`${functionalProfileMatrixBrowserBase}/functional-profile-matrix`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as FunctionalProfileMatrixResponse;
  } catch {
    return null;
  }
}

export async function saveFunctionalProfileMatrix(
  override: FunctionalProfileMatrixOverride,
): Promise<FunctionalProfileMatrixResponse> {
  const res = await fetch(`${functionalProfileMatrixBrowserBase}/functional-profile-matrix`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ override }),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { message?: string | string[] };
      if (typeof j.message === "string") msg = j.message;
      else if (Array.isArray(j.message)) msg = j.message.join(", ");
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return (await res.json()) as FunctionalProfileMatrixResponse;
}

export async function resetFunctionalProfileMatrix(): Promise<FunctionalProfileMatrixResponse> {
  const res = await fetch(`${functionalProfileMatrixBrowserBase}/functional-profile-matrix/reset`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as FunctionalProfileMatrixResponse;
}
