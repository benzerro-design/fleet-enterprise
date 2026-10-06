export type LegislativeKitDatedItem = {
  type: string | null;
  expiresOn: string | null;
};

export type LegislativeKitFlagQty = {
  present: boolean;
  quantity: number | null;
};

export type VehicleLegislativeKit = {
  extinguisher: LegislativeKitDatedItem;
  medicalKit: LegislativeKitDatedItem;
  /** true când mașina NU are roată de rezervă și folosește kit de pană */
  punctureKitPresent: boolean;
  triangle: LegislativeKitFlagQty;
  vest: LegislativeKitFlagQty;
  notes: string | null;
};

export const EMPTY_LEGISLATIVE_KIT: VehicleLegislativeKit = {
  extinguisher: { type: null, expiresOn: null },
  medicalKit: { type: null, expiresOn: null },
  punctureKitPresent: false,
  triangle: { present: false, quantity: null },
  vest: { present: false, quantity: null },
  notes: null,
};

export const LEGISLATIVE_KIT_PHOTO_KINDS = [
  "kit_extinguisher",
  "kit_medical",
  "kit_puncture",
  "kit_triangle",
  "kit_vest",
] as const;

export type LegislativeKitPhotoKind = (typeof LEGISLATIVE_KIT_PHOTO_KINDS)[number];

export function isLegislativeKitPhotoKind(v: string | null | undefined): v is LegislativeKitPhotoKind {
  return (
    v === "kit_extinguisher" ||
    v === "kit_medical" ||
    v === "kit_puncture" ||
    v === "kit_triangle" ||
    v === "kit_vest"
  );
}

export function legislativeKitPhotoKindLabel(kind: LegislativeKitPhotoKind): string {
  switch (kind) {
    case "kit_extinguisher":
      return "Stingător";
    case "kit_medical":
      return "Trusă medicală";
    case "kit_puncture":
      return "Kit de pană";
    case "kit_triangle":
      return "Triunghi reflectorizant";
    case "kit_vest":
      return "Vestă reflectorizantă";
  }
}

export type VehicleLegislativeKitPayload = {
  kit: VehicleLegislativeKit;
  /** Din tab Roti — există fitment pe poziția spare */
  spareWheelPresent: boolean;
  photos: Array<{
    id: string;
    vehicleId: string;
    fileUrl: string;
    fileName: string | null;
    caption: string | null;
    sessionLabel: string | null;
    kind: LegislativeKitPhotoKind | null;
    isHero: boolean;
    sortOrder: number;
    createdAt: string;
    uploadedByEmail: string | null;
  }>;
};

export function normalizeLegislativeKit(raw: unknown): VehicleLegislativeKit {
  if (!raw || typeof raw !== "object") return { ...EMPTY_LEGISLATIVE_KIT };

  const o = raw as Record<string, unknown>;
  const extinguisher = normalizeDated(o.extinguisher);
  const medicalKit = normalizeDated(o.medicalKit);
  const triangle = normalizeFlagQty(o.triangle);
  const vest = normalizeFlagQty(o.vest);
  const punctureKitPresent = o.punctureKitPresent === true;
  const notes =
    o.notes === null || o.notes === undefined
      ? null
      : typeof o.notes === "string"
        ? o.notes.trim() || null
        : null;

  return { extinguisher, medicalKit, punctureKitPresent, triangle, vest, notes };
}

function normalizeDated(raw: unknown): LegislativeKitDatedItem {
  if (!raw || typeof raw !== "object") return { type: null, expiresOn: null };
  const o = raw as Record<string, unknown>;
  const type = typeof o.type === "string" ? o.type.trim() || null : null;
  let expiresOn: string | null = null;
  if (typeof o.expiresOn === "string" && o.expiresOn.trim()) {
    const d = o.expiresOn.trim().slice(0, 10);
    expiresOn = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
  }
  return { type, expiresOn };
}

function normalizeFlagQty(raw: unknown): LegislativeKitFlagQty {
  if (!raw || typeof raw !== "object") return { present: false, quantity: null };
  const o = raw as Record<string, unknown>;
  const present = o.present === true;
  let quantity: number | null = null;
  if (typeof o.quantity === "number" && Number.isFinite(o.quantity) && o.quantity >= 0) {
    quantity = Math.min(99, Math.round(o.quantity));
  } else if (typeof o.quantity === "string" && o.quantity.trim()) {
    const n = Number(o.quantity);
    if (Number.isFinite(n) && n >= 0) quantity = Math.min(99, Math.round(n));
  }
  return { present, quantity: present ? quantity : null };
}
