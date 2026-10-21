export type GridViewKey = "tickets" | "work_orders";

export type GridViewResponse = {
  gridKey: string;
  name: string;
  layout: unknown | null;
  updatedAt: string | null;
};

const browserBase = "/api/iam/grid-views";

export async function fetchGridViewLayout(gridKey: GridViewKey): Promise<GridViewResponse | null> {
  try {
    const res = await fetch(`${browserBase}/${gridKey}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as GridViewResponse;
  } catch {
    return null;
  }
}

export async function saveGridViewLayout(gridKey: GridViewKey, layout: unknown): Promise<void> {
  try {
    await fetch(`${browserBase}/${gridKey}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layout }),
    });
  } catch {
    /* offline — localStorage cache remains */
  }
}
