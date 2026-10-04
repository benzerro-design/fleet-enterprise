export type TripGridColumnKey =
  | "primary"
  | "registration"
  | "client"
  | "driver"
  | "start"
  | "stop"
  | "km"
  | "status"
  | "actions";

export type TripGridColumnDef = {
  key: TripGridColumnKey;
  label: string;
  defaultVisible: boolean;
  canHide: boolean;
  width?: string;
};

export const TRIP_GRID_COLUMNS: TripGridColumnDef[] = [
  { key: "primary", label: "Cursă", defaultVisible: true, canHide: false, width: "22%" },
  { key: "registration", label: "Nr. auto", defaultVisible: false, canHide: true, width: "10%" },
  { key: "client", label: "Client", defaultVisible: true, canHide: true, width: "12%" },
  { key: "driver", label: "Șofer", defaultVisible: true, canHide: true, width: "14%" },
  { key: "start", label: "Start", defaultVisible: true, canHide: true, width: "12%" },
  { key: "stop", label: "Stop", defaultVisible: true, canHide: true, width: "12%" },
  { key: "km", label: "Km", defaultVisible: true, canHide: true, width: "7%" },
  { key: "status", label: "Stare", defaultVisible: true, canHide: true, width: "9%" },
  { key: "actions", label: "Acțiuni", defaultVisible: true, canHide: false, width: "7.5rem" },
];

export const TRIP_GRID_STORAGE_KEY = "fleet-trip-grid-columns-v1";

export type TripGridLayout = {
  order: TripGridColumnKey[];
  hidden: TripGridColumnKey[];
  rowLines: boolean;
  colLines: boolean;
};

export function defaultTripGridLayout(): TripGridLayout {
  const order = TRIP_GRID_COLUMNS.map((c) => c.key);
  const hidden = TRIP_GRID_COLUMNS.filter((c) => !c.defaultVisible).map((c) => c.key);
  return { order, hidden, rowLines: true, colLines: false };
}

export function visibleTripColumns(layout: TripGridLayout): TripGridColumnDef[] {
  const hidden = new Set(layout.hidden);
  const byKey = new Map(TRIP_GRID_COLUMNS.map((c) => [c.key, c]));
  return layout.order
    .filter((key) => !hidden.has(key))
    .map((key) => byKey.get(key))
    .filter((c): c is TripGridColumnDef => Boolean(c));
}

export function readTripGridLayout(): TripGridLayout {
  if (typeof window === "undefined") return defaultTripGridLayout();
  try {
    const raw = localStorage.getItem(TRIP_GRID_STORAGE_KEY);
    if (!raw) return defaultTripGridLayout();
    const parsed = JSON.parse(raw) as Partial<TripGridLayout>;
    const validKeys = new Set(TRIP_GRID_COLUMNS.map((c) => c.key));
    const order = (parsed.order ?? []).filter((k) => validKeys.has(k as TripGridColumnKey));
    const hidden = (parsed.hidden ?? []).filter((k) => validKeys.has(k as TripGridColumnKey));
    for (const c of TRIP_GRID_COLUMNS) {
      if (!order.includes(c.key)) order.push(c.key);
    }
    return {
      order: order as TripGridColumnKey[],
      hidden: hidden as TripGridColumnKey[],
      rowLines: parsed.rowLines !== false,
      colLines: parsed.colLines === true,
    };
  } catch {
    return defaultTripGridLayout();
  }
}

export function writeTripGridLayout(layout: TripGridLayout): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TRIP_GRID_STORAGE_KEY, JSON.stringify(layout));
}
