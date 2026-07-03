import type { IamStrategyResponse } from "./types";

export const iamStrategyBrowserBase = "/api/tenant";

export async function fetchIamStrategyClient(): Promise<IamStrategyResponse | null> {
  try {
    const res = await fetch(`${iamStrategyBrowserBase}/iam-strategy`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as IamStrategyResponse;
  } catch {
    return null;
  }
}

export async function saveIamStrategy(nodes: IamStrategyResponse["nodes"]): Promise<IamStrategyResponse> {
  const res = await fetch(`${iamStrategyBrowserBase}/iam-strategy`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version: 1, nodes }),
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
  return (await res.json()) as IamStrategyResponse;
}

export async function resetIamStrategy(): Promise<IamStrategyResponse> {
  const res = await fetch(`${iamStrategyBrowserBase}/iam-strategy/reset`, { method: "POST" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as IamStrategyResponse;
}
