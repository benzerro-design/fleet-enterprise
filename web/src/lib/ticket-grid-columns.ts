export type TicketGridColumnKey =
  | "pin"
  | "id"
  | "status"
  | "priority"
  | "type"
  | "subject"
  | "client"
  | "vehicle"
  | "driver"
  | "routing"
  | "owner"
  | "age"
  | "updated"
  | "created"
  | "resolved"
  | "queue"
  | "km"
  | "actions";

export type TicketGridColumnDef = {
  key: TicketGridColumnKey;
  label: string;
  defaultVisible: boolean;
  canHide: boolean;
  minWidth: number;
};

export const TICKET_GRID_COLUMNS: TicketGridColumnDef[] = [
  { key: "pin", label: "", defaultVisible: false, canHide: true, minWidth: 28 },
  { key: "id", label: "#", defaultVisible: true, canHide: false, minWidth: 72 },
  { key: "status", label: "Status", defaultVisible: true, canHide: true, minWidth: 100 },
  { key: "priority", label: "Prio", defaultVisible: true, canHide: true, minWidth: 64 },
  { key: "type", label: "Tip", defaultVisible: true, canHide: true, minWidth: 88 },
  { key: "subject", label: "Subiect", defaultVisible: true, canHide: false, minWidth: 200 },
  { key: "client", label: "Client", defaultVisible: true, canHide: true, minWidth: 88 },
  { key: "vehicle", label: "Vehicul", defaultVisible: true, canHide: true, minWidth: 96 },
  { key: "driver", label: "Șofer", defaultVisible: true, canHide: true, minWidth: 120 },
  { key: "routing", label: "Nivel", defaultVisible: true, canHide: true, minWidth: 56 },
  { key: "owner", label: "Owner", defaultVisible: true, canHide: true, minWidth: 120 },
  { key: "age", label: "Vârstă", defaultVisible: true, canHide: true, minWidth: 72 },
  { key: "updated", label: "Actualizat", defaultVisible: false, canHide: true, minWidth: 88 },
  { key: "created", label: "Creat", defaultVisible: false, canHide: true, minWidth: 88 },
  { key: "resolved", label: "Rezolvat", defaultVisible: false, canHide: true, minWidth: 88 },
  { key: "queue", label: "Coadă", defaultVisible: false, canHide: true, minWidth: 100 },
  { key: "km", label: "Km", defaultVisible: false, canHide: true, minWidth: 72 },
  { key: "actions", label: "Acțiuni", defaultVisible: true, canHide: false, minWidth: 140 },
];

export const TICKET_GRID_STORAGE_KEY = "fleet-ticket-grid-columns-v1";

export type TicketGridLayout = {
  order: TicketGridColumnKey[];
  hidden: TicketGridColumnKey[];
};

export function defaultTicketGridLayout(): TicketGridLayout {
  const order = TICKET_GRID_COLUMNS.map((c) => c.key);
  const hidden = TICKET_GRID_COLUMNS.filter((c) => !c.defaultVisible).map((c) => c.key);
  return { order, hidden };
}

export function visibleTicketColumns(layout: TicketGridLayout): TicketGridColumnDef[] {
  const hidden = new Set(layout.hidden);
  const byKey = new Map(TICKET_GRID_COLUMNS.map((c) => [c.key, c]));
  return layout.order
    .filter((key) => !hidden.has(key))
    .map((key) => byKey.get(key))
    .filter((c): c is TicketGridColumnDef => Boolean(c));
}

export function readTicketGridLayout(): TicketGridLayout {
  if (typeof window === "undefined") return defaultTicketGridLayout();
  try {
    const raw = localStorage.getItem(TICKET_GRID_STORAGE_KEY);
    if (!raw) return defaultTicketGridLayout();
    const parsed = JSON.parse(raw) as TicketGridLayout;
    const validKeys = new Set(TICKET_GRID_COLUMNS.map((c) => c.key));
    const order = (parsed.order ?? []).filter((k) => validKeys.has(k));
    const hidden = (parsed.hidden ?? []).filter((k) => validKeys.has(k));
    for (const c of TICKET_GRID_COLUMNS) {
      if (!order.includes(c.key)) order.push(c.key);
    }
    return { order, hidden };
  } catch {
    return defaultTicketGridLayout();
  }
}

export function writeTicketGridLayout(layout: TicketGridLayout): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TICKET_GRID_STORAGE_KEY, JSON.stringify(layout));
}
