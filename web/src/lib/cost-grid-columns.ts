export type CostGridColumnKey =
  | "primary"
  | "asset"
  | "registration"
  | "client"
  | "provider"
  | "date"
  | "km"
  | "invoice"
  | "invoiceDate"
  | "document"
  | "amount"
  | "actions";

export type CostGridColumnDef = {
  key: CostGridColumnKey;
  label: string;
  defaultVisible: boolean;
  canHide: boolean;
  width?: string;
};

export const COST_GRID_COLUMNS: CostGridColumnDef[] = [
  { key: "primary", label: "Cost", defaultVisible: true, canHide: false, width: "18%" },
  { key: "asset", label: "Atribuit", defaultVisible: true, canHide: true, width: "10%" },
  { key: "registration", label: "Nr. auto", defaultVisible: false, canHide: true, width: "9%" },
  { key: "client", label: "Client", defaultVisible: true, canHide: true, width: "10%" },
  { key: "provider", label: "Furnizor", defaultVisible: true, canHide: true, width: "11%" },
  { key: "date", label: "Data", defaultVisible: true, canHide: true, width: "8%" },
  { key: "km", label: "Km", defaultVisible: true, canHide: true, width: "7%" },
  { key: "invoice", label: "Factură", defaultVisible: false, canHide: true, width: "9%" },
  { key: "invoiceDate", label: "Data factură", defaultVisible: false, canHide: true, width: "8%" },
  { key: "document", label: "Document", defaultVisible: false, canHide: true, width: "7%" },
  { key: "amount", label: "Sumă", defaultVisible: true, canHide: true, width: "9%" },
  { key: "actions", label: "Acțiuni", defaultVisible: true, canHide: false, width: "7.5rem" },
];

export const COST_GRID_STORAGE_KEY = "fleet-cost-grid-columns-v1";

export type CostGridLayout = {
  order: CostGridColumnKey[];
  hidden: CostGridColumnKey[];
  rowLines: boolean;
  colLines: boolean;
};

export function defaultCostGridLayout(): CostGridLayout {
  const order = COST_GRID_COLUMNS.map((c) => c.key);
  const hidden = COST_GRID_COLUMNS.filter((c) => !c.defaultVisible).map((c) => c.key);
  return { order, hidden, rowLines: true, colLines: false };
}

export function visibleCostColumns(layout: CostGridLayout): CostGridColumnDef[] {
  const hidden = new Set(layout.hidden);
  const byKey = new Map(COST_GRID_COLUMNS.map((c) => [c.key, c]));
  return layout.order
    .filter((key) => !hidden.has(key))
    .map((key) => byKey.get(key))
    .filter((c): c is CostGridColumnDef => Boolean(c));
}

export function readCostGridLayout(): CostGridLayout {
  if (typeof window === "undefined") return defaultCostGridLayout();
  try {
    const raw = localStorage.getItem(COST_GRID_STORAGE_KEY);
    if (!raw) return defaultCostGridLayout();
    const parsed = JSON.parse(raw) as Partial<CostGridLayout>;
    const validKeys = new Set(COST_GRID_COLUMNS.map((c) => c.key));
    const order = (parsed.order ?? []).filter((k) => validKeys.has(k as CostGridColumnKey));
    const hidden = (parsed.hidden ?? []).filter((k) => validKeys.has(k as CostGridColumnKey));
    for (const c of COST_GRID_COLUMNS) {
      if (!order.includes(c.key)) order.push(c.key);
    }
    return {
      order: order as CostGridColumnKey[],
      hidden: hidden as CostGridColumnKey[],
      rowLines: parsed.rowLines !== false,
      colLines: parsed.colLines === true,
    };
  } catch {
    return defaultCostGridLayout();
  }
}

export function writeCostGridLayout(layout: CostGridLayout): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(COST_GRID_STORAGE_KEY, JSON.stringify(layout));
}
