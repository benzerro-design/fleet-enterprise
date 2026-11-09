export type PartnerTireHotelInventarColumnKey =
  | "plate"
  | "set"
  | "location"
  | "checkIn"
  | "fee"
  | "pv"
  | "actions";

export type PartnerTireHotelInventarColumnDef = {
  key: PartnerTireHotelInventarColumnKey;
  label: string;
  defaultVisible: boolean;
  canHide: boolean;
};

export const PARTNER_TIRE_HOTEL_INVENTAR_COLUMNS: PartnerTireHotelInventarColumnDef[] = [
  { key: "plate", label: "Nr. Înmatriculare", defaultVisible: true, canHide: false },
  { key: "set", label: "Set", defaultVisible: true, canHide: true },
  { key: "location", label: "Locație", defaultVisible: true, canHide: true },
  { key: "checkIn", label: "Check-in", defaultVisible: true, canHide: true },
  { key: "fee", label: "Tarif", defaultVisible: true, canHide: true },
  { key: "pv", label: "PV", defaultVisible: true, canHide: true },
  { key: "actions", label: "Acțiuni", defaultVisible: true, canHide: false },
];

export const PARTNER_TIRE_HOTEL_INVENTAR_STORAGE_KEY = "partner-tire-hotel-inventar";

export type PartnerTireHotelInventarLayout = {
  order: PartnerTireHotelInventarColumnKey[];
  hidden: PartnerTireHotelInventarColumnKey[];
  rowLines: boolean;
  colLines: boolean;
  density: "detailed" | "simple";
};

export function defaultPartnerTireHotelInventarLayout(): PartnerTireHotelInventarLayout {
  return {
    order: PARTNER_TIRE_HOTEL_INVENTAR_COLUMNS.map((c) => c.key),
    hidden: PARTNER_TIRE_HOTEL_INVENTAR_COLUMNS.filter((c) => !c.defaultVisible).map((c) => c.key),
    rowLines: true,
    colLines: false,
    density: "detailed",
  };
}

export function visiblePartnerTireHotelInventarColumns(
  layout: PartnerTireHotelInventarLayout,
): PartnerTireHotelInventarColumnDef[] {
  const hidden = new Set(layout.hidden);
  const byKey = new Map(PARTNER_TIRE_HOTEL_INVENTAR_COLUMNS.map((c) => [c.key, c]));
  return layout.order
    .filter((key) => !hidden.has(key))
    .map((key) => byKey.get(key))
    .filter((c): c is PartnerTireHotelInventarColumnDef => Boolean(c));
}

export function readPartnerTireHotelInventarLayout(): PartnerTireHotelInventarLayout {
  if (typeof window === "undefined") return defaultPartnerTireHotelInventarLayout();
  try {
    const raw = localStorage.getItem(PARTNER_TIRE_HOTEL_INVENTAR_STORAGE_KEY);
    if (!raw) return defaultPartnerTireHotelInventarLayout();
    const parsed = JSON.parse(raw) as Partial<PartnerTireHotelInventarLayout>;
    const validKeys = new Set(PARTNER_TIRE_HOTEL_INVENTAR_COLUMNS.map((c) => c.key));
    const order = (parsed.order ?? []).filter((k) =>
      validKeys.has(k as PartnerTireHotelInventarColumnKey),
    ) as PartnerTireHotelInventarColumnKey[];
    const hidden = (parsed.hidden ?? []).filter((k) =>
      validKeys.has(k as PartnerTireHotelInventarColumnKey),
    ) as PartnerTireHotelInventarColumnKey[];
    for (const c of PARTNER_TIRE_HOTEL_INVENTAR_COLUMNS) {
      if (!order.includes(c.key)) order.push(c.key);
    }
    return {
      order,
      hidden,
      rowLines: parsed.rowLines !== false,
      colLines: parsed.colLines === true,
      density: parsed.density === "simple" ? "simple" : "detailed",
    };
  } catch {
    return defaultPartnerTireHotelInventarLayout();
  }
}

export function writePartnerTireHotelInventarLayout(layout: PartnerTireHotelInventarLayout): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PARTNER_TIRE_HOTEL_INVENTAR_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    /* ignore */
  }
}
