const STORAGE_KEY = "fleet-work-order-grid-views-v1";

export type WorkOrderGridSavedView = {
  id: string;
  name: string;
  params: Record<string, string>;
  createdAt: string;
};

export function readWorkOrderGridViews(): WorkOrderGridSavedView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WorkOrderGridSavedView[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeWorkOrderGridViews(views: WorkOrderGridSavedView[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(views.slice(0, 20)));
}

export function saveWorkOrderGridView(name: string, params: Record<string, string>): WorkOrderGridSavedView[] {
  const views = readWorkOrderGridViews();
  const row: WorkOrderGridSavedView = {
    id: `v-${Date.now()}`,
    name: name.trim() || "Vizualizare",
    params,
    createdAt: new Date().toISOString(),
  };
  const next = [row, ...views.filter((v) => v.name !== row.name)].slice(0, 20);
  writeWorkOrderGridViews(next);
  return next;
}

export function deleteWorkOrderGridView(id: string): WorkOrderGridSavedView[] {
  const next = readWorkOrderGridViews().filter((v) => v.id !== id);
  writeWorkOrderGridViews(next);
  return next;
}

export function workOrderViewHref(params: Record<string, string>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v?.trim()) p.set(k, v.trim());
  }
  const qs = p.toString();
  return `/fleet/work-orders${qs ? `?${qs}` : ""}`;
}
