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
  /** Podea la resize / table-fixed. */
  minWidth: number;
  /** Lățime implicită (px). Subiect fără override = restul spațiului. */
  defaultWidth: number;
  maxWidth: number;
  /** Coloană fluidă: fără width fix până la resize manual. */
  fluid?: boolean;
};

export const TICKET_GRID_COLUMNS: TicketGridColumnDef[] = [
  { key: "pin", label: "", defaultVisible: false, canHide: true, minWidth: 28, defaultWidth: 28, maxWidth: 40 },
  { key: "id", label: "#", defaultVisible: true, canHide: false, minWidth: 96, defaultWidth: 112, maxWidth: 160 },
  { key: "status", label: "Status", defaultVisible: true, canHide: true, minWidth: 120, defaultWidth: 136, maxWidth: 200 },
  { key: "priority", label: "Prioritate", defaultVisible: true, canHide: true, minWidth: 132, defaultWidth: 148, maxWidth: 200 },
  { key: "type", label: "Tip", defaultVisible: true, canHide: true, minWidth: 36, defaultWidth: 40, maxWidth: 64 },
  {
    key: "subject",
    label: "Subiect",
    defaultVisible: true,
    canHide: false,
    minWidth: 140,
    defaultWidth: 220,
    maxWidth: 560,
    fluid: true,
  },
  { key: "client", label: "Client", defaultVisible: true, canHide: true, minWidth: 72, defaultWidth: 96, maxWidth: 200 },
  { key: "vehicle", label: "Vehicul", defaultVisible: true, canHide: true, minWidth: 88, defaultWidth: 112, maxWidth: 180 },
  { key: "driver", label: "Șofer", defaultVisible: true, canHide: true, minWidth: 140, defaultWidth: 168, maxWidth: 240 },
  { key: "routing", label: "Nivel", defaultVisible: true, canHide: true, minWidth: 40, defaultWidth: 44, maxWidth: 72 },
  { key: "owner", label: "Owner", defaultVisible: true, canHide: true, minWidth: 120, defaultWidth: 148, maxWidth: 220 },
  { key: "age", label: "Vârstă", defaultVisible: true, canHide: true, minWidth: 48, defaultWidth: 56, maxWidth: 80 },
  { key: "updated", label: "Actualizat", defaultVisible: false, canHide: true, minWidth: 80, defaultWidth: 100, maxWidth: 160 },
  { key: "created", label: "Creat", defaultVisible: false, canHide: true, minWidth: 80, defaultWidth: 100, maxWidth: 160 },
  { key: "resolved", label: "Rezolvat", defaultVisible: false, canHide: true, minWidth: 80, defaultWidth: 100, maxWidth: 160 },
  { key: "queue", label: "Coadă", defaultVisible: false, canHide: true, minWidth: 72, defaultWidth: 88, maxWidth: 140 },
  { key: "km", label: "Km", defaultVisible: false, canHide: true, minWidth: 56, defaultWidth: 72, maxWidth: 100 },
  { key: "actions", label: "Acțiuni", defaultVisible: true, canHide: false, minWidth: 112, defaultWidth: 128, maxWidth: 200 },
];

export const TICKET_GRID_STORAGE_KEY = "fleet-ticket-grid-columns-v3";

export type TicketGridLayout = {
  order: TicketGridColumnKey[];
  hidden: TicketGridColumnKey[];
  /** Override-uri px; lipsă = default / fluid. */
  widths?: Partial<Record<TicketGridColumnKey, number>>;
};

const BY_KEY = new Map(TICKET_GRID_COLUMNS.map((c) => [c.key, c]));

export function ticketColumnDef(key: TicketGridColumnKey): TicketGridColumnDef | undefined {
  return BY_KEY.get(key);
}

export function defaultTicketGridLayout(): TicketGridLayout {
  const order = TICKET_GRID_COLUMNS.map((c) => c.key);
  const hidden = TICKET_GRID_COLUMNS.filter((c) => !c.defaultVisible).map((c) => c.key);
  return { order, hidden, widths: {} };
}

export function visibleTicketColumns(layout: TicketGridLayout): TicketGridColumnDef[] {
  const hidden = new Set(layout.hidden);
  return layout.order
    .filter((key) => !hidden.has(key))
    .map((key) => BY_KEY.get(key))
    .filter((c): c is TicketGridColumnDef => Boolean(c));
}

export function clampColumnWidth(key: TicketGridColumnKey, px: number): number {
  const def = BY_KEY.get(key);
  if (!def) return Math.round(px);
  return Math.max(def.minWidth, Math.min(def.maxWidth, Math.round(px)));
}

/**
 * Lățime efectivă pentru col / resize.
 * Subiect fluid fără override → null (ocupă restul în table-fixed).
 */
export function resolveColumnWidthPx(
  layout: TicketGridLayout,
  key: TicketGridColumnKey,
): number | null {
  const def = BY_KEY.get(key);
  if (!def) return null;
  const custom = layout.widths?.[key];
  if (typeof custom === "number" && Number.isFinite(custom)) {
    return clampColumnWidth(key, custom);
  }
  if (def.fluid) return null;
  return def.defaultWidth;
}

export function withColumnWidth(
  layout: TicketGridLayout,
  key: TicketGridColumnKey,
  px: number,
): TicketGridLayout {
  return {
    ...layout,
    widths: { ...layout.widths, [key]: clampColumnWidth(key, px) },
  };
}

export function clearColumnWidths(layout: TicketGridLayout): TicketGridLayout {
  return { ...layout, widths: {} };
}

export function readTicketGridLayout(): TicketGridLayout {
  if (typeof window === "undefined") return defaultTicketGridLayout();
  try {
    const raw = localStorage.getItem(TICKET_GRID_STORAGE_KEY);
    if (!raw) {
      // Migrează doar ordine/hidden din v1/v2 — fără widths strâmte.
      for (const legacyKey of ["fleet-ticket-grid-columns-v2", "fleet-ticket-grid-columns-v1"]) {
        const legacy = localStorage.getItem(legacyKey);
        if (!legacy) continue;
        const parsed = JSON.parse(legacy) as TicketGridLayout;
        return normalizeLayout({ order: parsed.order, hidden: parsed.hidden, widths: {} });
      }
      return defaultTicketGridLayout();
    }
    return normalizeLayout(JSON.parse(raw) as TicketGridLayout);
  } catch {
    return defaultTicketGridLayout();
  }
}

function normalizeLayout(parsed: TicketGridLayout): TicketGridLayout {
  const validKeys = new Set(TICKET_GRID_COLUMNS.map((c) => c.key));
  const order = (parsed.order ?? []).filter((k) => validKeys.has(k));
  const hidden = (parsed.hidden ?? []).filter((k) => validKeys.has(k));
  for (const c of TICKET_GRID_COLUMNS) {
    if (!order.includes(c.key)) order.push(c.key);
  }
  const widths: Partial<Record<TicketGridColumnKey, number>> = {};
  if (parsed.widths && typeof parsed.widths === "object") {
    for (const [k, v] of Object.entries(parsed.widths)) {
      if (!validKeys.has(k as TicketGridColumnKey)) continue;
      if (typeof v !== "number" || !Number.isFinite(v)) continue;
      widths[k as TicketGridColumnKey] = clampColumnWidth(k as TicketGridColumnKey, v);
    }
  }
  return { order, hidden, widths };
}

export function writeTicketGridLayout(layout: TicketGridLayout): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TICKET_GRID_STORAGE_KEY, JSON.stringify(layout));
}
