export type WorkOrderGridColumnKey =
  | "number"
  | "status"
  | "type"
  | "title"
  | "total"
  | "vehicle"
  | "client"
  | "partner"
  | "stage"
  | "estimated"
  | "ticket"
  | "updated"
  | "actions";

export type WorkOrderGridColumnDef = {
  key: WorkOrderGridColumnKey;
  label: string;
  defaultVisible: boolean;
  canHide: boolean;
  minWidth: number;
};

export const WORK_ORDER_GRID_COLUMNS: WorkOrderGridColumnDef[] = [
  { key: "number", label: "#", defaultVisible: true, canHide: false, minWidth: 72 },
  { key: "status", label: "St.", defaultVisible: true, canHide: true, minWidth: 36 },
  { key: "type", label: "Tip", defaultVisible: true, canHide: true, minWidth: 32 },
  { key: "title", label: "Titlu", defaultVisible: true, canHide: false, minWidth: 56 },
  { key: "total", label: "Total", defaultVisible: true, canHide: true, minWidth: 80 },
  { key: "vehicle", label: "Auto", defaultVisible: true, canHide: true, minWidth: 80 },
  { key: "client", label: "Cl.", defaultVisible: true, canHide: true, minWidth: 44 },
  { key: "partner", label: "Partener", defaultVisible: true, canHide: true, minWidth: 96 },
  { key: "stage", label: "Etapă", defaultVisible: true, canHide: true, minWidth: 36 },
  { key: "estimated", label: "Est.", defaultVisible: true, canHide: true, minWidth: 36 },
  { key: "ticket", label: "Tichet", defaultVisible: true, canHide: true, minWidth: 36 },
  { key: "updated", label: "Actualizat", defaultVisible: false, canHide: true, minWidth: 72 },
  { key: "actions", label: "", defaultVisible: true, canHide: false, minWidth: 28 },
];

export const WORK_ORDER_GRID_STORAGE_KEY = "fleet-work-order-grid-columns-v2";

export type WorkOrderGridLayout = {
  order: WorkOrderGridColumnKey[];
  hidden: WorkOrderGridColumnKey[];
};

export function defaultWorkOrderGridLayout(): WorkOrderGridLayout {
  const order = WORK_ORDER_GRID_COLUMNS.map((c) => c.key);
  const hidden = WORK_ORDER_GRID_COLUMNS.filter((c) => !c.defaultVisible).map((c) => c.key);
  return { order, hidden };
}

export function visibleWorkOrderColumns(layout: WorkOrderGridLayout): WorkOrderGridColumnDef[] {
  const hidden = new Set(layout.hidden);
  const byKey = new Map(WORK_ORDER_GRID_COLUMNS.map((c) => [c.key, c]));
  return layout.order
    .filter((key) => !hidden.has(key))
    .map((key) => byKey.get(key))
    .filter((c): c is WorkOrderGridColumnDef => Boolean(c));
}

export function readWorkOrderGridLayout(): WorkOrderGridLayout {
  if (typeof window === "undefined") return defaultWorkOrderGridLayout();
  try {
    const raw = localStorage.getItem(WORK_ORDER_GRID_STORAGE_KEY);
    if (!raw) return defaultWorkOrderGridLayout();
    const parsed = JSON.parse(raw) as WorkOrderGridLayout;
    const validKeys = new Set(WORK_ORDER_GRID_COLUMNS.map((c) => c.key));
    const order = (parsed.order ?? []).filter((k) => validKeys.has(k as WorkOrderGridColumnKey));
    const hidden = (parsed.hidden ?? []).filter((k) => validKeys.has(k as WorkOrderGridColumnKey));
    for (const c of WORK_ORDER_GRID_COLUMNS) {
      if (!order.includes(c.key)) order.push(c.key);
    }
    return { order, hidden };
  } catch {
    return defaultWorkOrderGridLayout();
  }
}

export function writeWorkOrderGridLayout(layout: WorkOrderGridLayout): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(WORK_ORDER_GRID_STORAGE_KEY, JSON.stringify(layout));
}
