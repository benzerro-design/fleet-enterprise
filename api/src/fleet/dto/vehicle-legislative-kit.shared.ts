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

export const KIT_PHOTO_KINDS = [
  'kit_extinguisher',
  'kit_medical',
  'kit_puncture',
  'kit_triangle',
  'kit_vest',
] as const;

export type KitPhotoKind = (typeof KIT_PHOTO_KINDS)[number];

export function isKitPhotoKind(v: unknown): v is KitPhotoKind {
  return (
    v === 'kit_extinguisher' ||
    v === 'kit_medical' ||
    v === 'kit_puncture' ||
    v === 'kit_triangle' ||
    v === 'kit_vest'
  );
}

export function normalizeLegislativeKit(raw: unknown): VehicleLegislativeKit {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_LEGISLATIVE_KIT };

  const o = raw as Record<string, unknown>;
  return {
    extinguisher: normalizeDated(o.extinguisher),
    medicalKit: normalizeDated(o.medicalKit),
    punctureKitPresent: o.punctureKitPresent === true,
    triangle: normalizeFlagQty(o.triangle),
    vest: normalizeFlagQty(o.vest),
    notes:
      o.notes === null || o.notes === undefined
        ? null
        : typeof o.notes === 'string'
          ? o.notes.trim() || null
          : null,
  };
}

function normalizeDated(raw: unknown): LegislativeKitDatedItem {
  if (!raw || typeof raw !== 'object') return { type: null, expiresOn: null };
  const o = raw as Record<string, unknown>;
  const type = typeof o.type === 'string' ? o.type.trim() || null : null;
  let expiresOn: string | null = null;
  if (typeof o.expiresOn === 'string' && o.expiresOn.trim()) {
    const d = o.expiresOn.trim().slice(0, 10);
    expiresOn = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
  }
  return { type, expiresOn };
}

function normalizeFlagQty(raw: unknown): LegislativeKitFlagQty {
  if (!raw || typeof raw !== 'object') return { present: false, quantity: null };
  const o = raw as Record<string, unknown>;
  const present = o.present === true;
  let quantity: number | null = null;
  if (typeof o.quantity === 'number' && Number.isFinite(o.quantity) && o.quantity >= 0) {
    quantity = Math.min(99, Math.round(o.quantity));
  }
  return { present, quantity: present ? quantity : null };
}

export function mergeLegislativeKitPatch(
  current: VehicleLegislativeKit,
  patch: {
    extinguisher?: { type?: string | null; expiresOn?: string | null };
    medicalKit?: { type?: string | null; expiresOn?: string | null };
    punctureKitPresent?: boolean;
    triangle?: { present?: boolean; quantity?: number | null };
    vest?: { present?: boolean; quantity?: number | null };
    notes?: string | null;
  },
): VehicleLegislativeKit {
  const next = { ...current, extinguisher: { ...current.extinguisher }, medicalKit: { ...current.medicalKit }, triangle: { ...current.triangle }, vest: { ...current.vest } };

  if (patch.extinguisher) {
    if ('type' in patch.extinguisher) {
      next.extinguisher.type =
        patch.extinguisher.type === null || patch.extinguisher.type === undefined
          ? null
          : String(patch.extinguisher.type).trim() || null;
    }
    if ('expiresOn' in patch.extinguisher) {
      next.extinguisher.expiresOn = normalizeDateOnly(patch.extinguisher.expiresOn);
    }
  }
  if (patch.medicalKit) {
    if ('type' in patch.medicalKit) {
      next.medicalKit.type =
        patch.medicalKit.type === null || patch.medicalKit.type === undefined
          ? null
          : String(patch.medicalKit.type).trim() || null;
    }
    if ('expiresOn' in patch.medicalKit) {
      next.medicalKit.expiresOn = normalizeDateOnly(patch.medicalKit.expiresOn);
    }
  }
  if (typeof patch.punctureKitPresent === 'boolean') {
    next.punctureKitPresent = patch.punctureKitPresent;
  }
  if (patch.triangle) {
    if (typeof patch.triangle.present === 'boolean') next.triangle.present = patch.triangle.present;
    if ('quantity' in patch.triangle) {
      const q = patch.triangle.quantity;
      next.triangle.quantity =
        q === null || q === undefined
          ? null
          : Number.isFinite(Number(q))
            ? Math.min(99, Math.max(0, Math.round(Number(q))))
            : null;
    }
    if (!next.triangle.present) next.triangle.quantity = null;
  }
  if (patch.vest) {
    if (typeof patch.vest.present === 'boolean') next.vest.present = patch.vest.present;
    if ('quantity' in patch.vest) {
      const q = patch.vest.quantity;
      next.vest.quantity =
        q === null || q === undefined
          ? null
          : Number.isFinite(Number(q))
            ? Math.min(99, Math.max(0, Math.round(Number(q))))
            : null;
    }
    if (!next.vest.present) next.vest.quantity = null;
  }
  if ('notes' in patch) {
    next.notes =
      patch.notes === null || patch.notes === undefined
        ? null
        : String(patch.notes).trim() || null;
  }

  return next;
}

function normalizeDateOnly(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const d = String(v).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}
