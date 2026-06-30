const STORAGE_KEY = "fleet-ticket-grid-views-v1";

export type TicketGridSavedView = {
  id: string;
  name: string;
  params: Record<string, string>;
  createdAt: string;
};

export function readTicketGridViews(): TicketGridSavedView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TicketGridSavedView[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeTicketGridViews(views: TicketGridSavedView[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(views.slice(0, 20)));
}

export function saveTicketGridView(name: string, params: Record<string, string>): TicketGridSavedView[] {
  const views = readTicketGridViews();
  const row: TicketGridSavedView = {
    id: `v-${Date.now()}`,
    name: name.trim() || "Vizualizare",
    params,
    createdAt: new Date().toISOString(),
  };
  const next = [row, ...views.filter((v) => v.name !== row.name)].slice(0, 20);
  writeTicketGridViews(next);
  return next;
}

export function deleteTicketGridView(id: string): TicketGridSavedView[] {
  const next = readTicketGridViews().filter((v) => v.id !== id);
  writeTicketGridViews(next);
  return next;
}

export function ticketViewHref(params: Record<string, string>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v?.trim()) p.set(k, v.trim());
  }
  const qs = p.toString();
  return `/fleet/tickets${qs ? `?${qs}` : ""}`;
}
