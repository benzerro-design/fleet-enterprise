export type VehicleGridColumnKey =
  | "registration"
  | "brand"
  | "model"
  | "vin"
  | "client"
  | "type"
  | "status"
  | "odometer"
  | "itp"
  | "detail"
  | "actions";

export type VehicleGridColumnDef = {
  key: VehicleGridColumnKey;
  label: string;
  defaultVisible: boolean;
  canHide: boolean;
};

export const VEHICLE_GRID_COLUMNS: VehicleGridColumnDef[] = [
  { key: "registration", label: "Nr. înmatriculare", defaultVisible: true, canHide: false },
  { key: "brand", label: "Marcă", defaultVisible: false, canHide: true },
  { key: "model", label: "Model", defaultVisible: false, canHide: true },
  { key: "vin", label: "VIN", defaultVisible: false, canHide: true },
  { key: "client", label: "Client", defaultVisible: true, canHide: true },
  { key: "type", label: "Tip", defaultVisible: true, canHide: true },
  { key: "status", label: "Status", defaultVisible: true, canHide: true },
  { key: "odometer", label: "Km", defaultVisible: true, canHide: true },
  { key: "itp", label: "ITP expiră", defaultVisible: true, canHide: true },
  { key: "detail", label: "Detaliu", defaultVisible: true, canHide: true },
  { key: "actions", label: "Acțiuni", defaultVisible: true, canHide: false },
];

export const VEHICLE_GRID_STORAGE_KEY = "fleet-vehicle-grid-columns-v1";

export type VehicleGridLayout = {
  order: VehicleGridColumnKey[];
  hidden: VehicleGridColumnKey[];
};

export function defaultVehicleGridLayout(): VehicleGridLayout {
  const order = VEHICLE_GRID_COLUMNS.map((c) => c.key);
  const hidden = VEHICLE_GRID_COLUMNS.filter((c) => !c.defaultVisible).map((c) => c.key);
  return { order, hidden };
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
    const parsed = JSON.parse(raw) as VehicleGridLayout;
    const validKeys = new Set(VEHICLE_GRID_COLUMNS.map((c) => c.key));
    const order = (parsed.order ?? []).filter((k) => validKeys.has(k as VehicleGridColumnKey));
    const hidden = (parsed.hidden ?? []).filter((k) => validKeys.has(k as VehicleGridColumnKey));
    for (const c of VEHICLE_GRID_COLUMNS) {
      if (!order.includes(c.key)) order.push(c.key);
    }
    return {
      order: order as VehicleGridColumnKey[],
      hidden: hidden as VehicleGridColumnKey[],
    };
  } catch {
    return defaultVehicleGridLayout();
  }
}

export function writeVehicleGridLayout(layout: VehicleGridLayout): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(VEHICLE_GRID_STORAGE_KEY, JSON.stringify(layout));
}
