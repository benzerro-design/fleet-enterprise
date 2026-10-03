export type VehicleGridColumnKey =
  | "registration"
  | "brand"
  | "model"
  | "vin"
  | "client"
  | "utilizator"
  | "type"
  | "status"
  | "odometer"
  | "itp"
  | "actions";

export type VehicleGridColumnDef = {
  key: VehicleGridColumnKey;
  label: string;
  defaultVisible: boolean;
  canHide: boolean;
  /** Hint lățime (table-layout: fixed). */
  width?: string;
};

/**
 * Layout dens: nr. + marcă/model în aceeași celulă; tip/VIN opționale;
 * Vezi+Edit+Șterge într-o singură coloană Acțiuni.
 * „Utilizator” = șoferul alocat activ pe vehicul.
 */
export const VEHICLE_GRID_COLUMNS: VehicleGridColumnDef[] = [
  { key: "registration", label: "Vehicul", defaultVisible: true, canHide: false, width: "20%" },
  { key: "brand", label: "Marcă", defaultVisible: false, canHide: true, width: "8%" },
  { key: "model", label: "Model", defaultVisible: false, canHide: true, width: "8%" },
  { key: "vin", label: "VIN", defaultVisible: false, canHide: true, width: "12%" },
  { key: "client", label: "Client", defaultVisible: true, canHide: true, width: "13%" },
  { key: "utilizator", label: "Utilizator", defaultVisible: true, canHide: true, width: "14%" },
  { key: "type", label: "Tip", defaultVisible: false, canHide: true, width: "10%" },
  { key: "status", label: "Status", defaultVisible: true, canHide: true, width: "10%" },
  { key: "odometer", label: "Km", defaultVisible: true, canHide: true, width: "8%" },
  { key: "itp", label: "ITP", defaultVisible: true, canHide: true, width: "9%" },
  { key: "actions", label: "Acțiuni", defaultVisible: true, canHide: false, width: "7.5rem" },
];

/** v3 — coloană Utilizator (șofer alocat). Linii grid = câmpuri opționale pe același obiect. */
export const VEHICLE_GRID_STORAGE_KEY = "fleet-vehicle-grid-columns-v3";

export type VehicleGridLayout = {
  order: VehicleGridColumnKey[];
  hidden: VehicleGridColumnKey[];
  /** Linie fină orizontală între rânduri. */
  rowLines: boolean;
  /** Linie fină verticală între coloane. */
  colLines: boolean;
};

export function defaultVehicleGridLayout(): VehicleGridLayout {
  const order = VEHICLE_GRID_COLUMNS.map((c) => c.key);
  const hidden = VEHICLE_GRID_COLUMNS.filter((c) => !c.defaultVisible).map((c) => c.key);
  return { order, hidden, rowLines: true, colLines: false };
}

export function visibleVehicleColumns(layout: VehicleGridLayout): VehicleGridColumnDef[] {
  const hidden = new Set(layout.hidden);
  const byKey = new Map(VEHICLE_GRID_COLUMNS.map((c) => [c.key, c]));
  return layout.order
    .filter((key) => !hidden.has(key))
    .map((key) => byKey.get(key))
    .filter((c): c is VehicleGridColumnDef => Boolean(c));
}

export function readVehicleGridLayout(): VehicleGridLayout {
  if (typeof window === "undefined") return defaultVehicleGridLayout();
  try {
    const raw = localStorage.getItem(VEHICLE_GRID_STORAGE_KEY);
    if (!raw) return defaultVehicleGridLayout();
    const parsed = JSON.parse(raw) as Partial<VehicleGridLayout>;
    const validKeys = new Set(VEHICLE_GRID_COLUMNS.map((c) => c.key));
    const order = (parsed.order ?? []).filter((k) => validKeys.has(k as VehicleGridColumnKey));
    const hidden = (parsed.hidden ?? []).filter((k) => validKeys.has(k as VehicleGridColumnKey));
    for (const c of VEHICLE_GRID_COLUMNS) {
      if (!order.includes(c.key)) order.push(c.key);
    }
    return {
      order: order as VehicleGridColumnKey[],
      hidden: hidden as VehicleGridColumnKey[],
      // Migrează layout-uri v3 vechi fără câmpuri noi — fără reset coloane.
      rowLines: parsed.rowLines !== false,
      colLines: parsed.colLines === true,
    };
  } catch {
    return defaultVehicleGridLayout();
  }
}

export function writeVehicleGridLayout(layout: VehicleGridLayout): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(VEHICLE_GRID_STORAGE_KEY, JSON.stringify(layout));
}

/** Layout din Setup Flotă → defaultVehicleColumnKeys (vizibile = lista; restul hidden). */
export function layoutFromTenantColumnKeys(keys: string[] | null | undefined): VehicleGridLayout {
  const valid = new Set(VEHICLE_GRID_COLUMNS.map((c) => c.key));
  const forced = VEHICLE_GRID_COLUMNS.filter((c) => !c.canHide).map((c) => c.key);
  const preferred = (keys ?? [])
    .filter((k): k is VehicleGridColumnKey => valid.has(k as VehicleGridColumnKey));
  const visible = [...new Set<VehicleGridColumnKey>([...forced, ...preferred])];
  const order = [
    ...visible,
    ...VEHICLE_GRID_COLUMNS.map((c) => c.key).filter((k) => !visible.includes(k)),
  ];
  const hidden = order.filter((k) => !visible.includes(k));
  return { order, hidden, rowLines: true, colLines: false };
}

/** Seed o singură dată dacă localStorage e gol și tenantul are default. */
export function seedVehicleGridFromTenant(keys: string[] | null | undefined): VehicleGridLayout {
  if (typeof window === "undefined") return defaultVehicleGridLayout();
  const existing = localStorage.getItem(VEHICLE_GRID_STORAGE_KEY);
  if (existing) return readVehicleGridLayout();
  if (!keys?.length) return defaultVehicleGridLayout();
  const layout = layoutFromTenantColumnKeys(keys);
  writeVehicleGridLayout(layout);
  return layout;
}
