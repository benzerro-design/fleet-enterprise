export type SupplierGridColumnKey =
  | "status"
  | "code"
  | "legalName"
  | "category"
  | "services"
  | "workOrderCount"
  | "taxId"
  | "contactEmail"
  | "city"
  | "actions";

export type SupplierGridColumnDef = {
  key: SupplierGridColumnKey;
  label: string;
  defaultVisible: boolean;
  canHide: boolean;
  minWidth: number;
};

export const SUPPLIER_GRID_COLUMNS: SupplierGridColumnDef[] = [
  { key: "status", label: "St.", defaultVisible: true, canHide: true, minWidth: 36 },
  { key: "code", label: "Cod", defaultVisible: true, canHide: true, minWidth: 72 },
  { key: "legalName", label: "Denumire", defaultVisible: true, canHide: false, minWidth: 120 },
  { key: "category", label: "Categorie", defaultVisible: true, canHide: true, minWidth: 88 },
  { key: "services", label: "Servicii", defaultVisible: true, canHide: true, minWidth: 96 },
  { key: "workOrderCount", label: "WO", defaultVisible: true, canHide: true, minWidth: 40 },
  { key: "taxId", label: "CUI", defaultVisible: true, canHide: true, minWidth: 72 },
  { key: "contactEmail", label: "Email", defaultVisible: false, canHide: true, minWidth: 120 },
  { key: "city", label: "Oraș", defaultVisible: false, canHide: true, minWidth: 80 },
  { key: "actions", label: "", defaultVisible: true, canHide: false, minWidth: 72 },
];

export const SUPPLIER_GRID_STORAGE_KEY = "fleet-supplier-grid-columns-v1";

export type SupplierGridLayout = {
  order: SupplierGridColumnKey[];
  hidden: SupplierGridColumnKey[];
};

export function defaultSupplierGridLayout(): SupplierGridLayout {
  const order = SUPPLIER_GRID_COLUMNS.map((c) => c.key);
  const hidden = SUPPLIER_GRID_COLUMNS.filter((c) => !c.defaultVisible).map((c) => c.key);
  return { order, hidden };
}

export function visibleSupplierColumns(layout: SupplierGridLayout): SupplierGridColumnDef[] {
  const hidden = new Set(layout.hidden);
  const byKey = new Map(SUPPLIER_GRID_COLUMNS.map((c) => [c.key, c]));
  return layout.order
    .filter((key) => !hidden.has(key))
    .map((key) => byKey.get(key))
    .filter((c): c is SupplierGridColumnDef => Boolean(c));
}

export function readSupplierGridLayout(): SupplierGridLayout {
  if (typeof window === "undefined") return defaultSupplierGridLayout();
  try {
    const raw = localStorage.getItem(SUPPLIER_GRID_STORAGE_KEY);
    if (!raw) return defaultSupplierGridLayout();
    const parsed = JSON.parse(raw) as SupplierGridLayout;
    const validKeys = new Set(SUPPLIER_GRID_COLUMNS.map((c) => c.key));
    const order = (parsed.order ?? []).filter((k) => validKeys.has(k as SupplierGridColumnKey));
    const hidden = (parsed.hidden ?? []).filter((k) => validKeys.has(k as SupplierGridColumnKey));
    for (const c of SUPPLIER_GRID_COLUMNS) {
      if (!order.includes(c.key)) order.push(c.key);
    }
    return { order, hidden };
  } catch {
    return defaultSupplierGridLayout();
  }
}

export function writeSupplierGridLayout(layout: SupplierGridLayout): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SUPPLIER_GRID_STORAGE_KEY, JSON.stringify(layout));
}
