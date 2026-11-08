import type { VehicleWheelPosition } from '@prisma/client';

const INTAKE_JSON_PREFIX = '{"v":1';

export type TireIntakeInspection = {
  wearUniform?: boolean;
  cracks?: boolean;
  treadMm?: Partial<Record<VehicleWheelPosition, number>>;
  /** Human-readable fallback (legacy plain text). */
  summary?: string;
};

export type TireIntakeInspectionInput = {
  wearUniform?: boolean;
  cracks?: boolean;
  treadMm?: Partial<Record<VehicleWheelPosition, number>>;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

export function parseIntakeTreadNotes(raw: string | null | undefined): {
  structured: TireIntakeInspection | null;
  legacyText: string | null;
} {
  const s = raw?.trim();
  if (!s) return { structured: null, legacyText: null };
  if (s.startsWith(INTAKE_JSON_PREFIX)) {
    try {
      const o = JSON.parse(s) as Record<string, unknown>;
      if (o.v !== 1) return { structured: null, legacyText: s };
      const treadRaw = o.treadMm;
      let treadMm: TireIntakeInspection['treadMm'];
      if (isPlainObject(treadRaw)) {
        treadMm = {};
        for (const pos of ['fl', 'fr', 'rl', 'rr'] as const) {
          const v = treadRaw[pos];
          if (v !== undefined && v !== null && Number.isFinite(Number(v))) {
            treadMm[pos] = Number(v);
          }
        }
      }
      return {
        structured: {
          wearUniform: typeof o.wearUniform === 'boolean' ? o.wearUniform : undefined,
          cracks: typeof o.cracks === 'boolean' ? o.cracks : undefined,
          treadMm,
          summary: typeof o.summary === 'string' ? o.summary : undefined,
        },
        legacyText: null,
      };
    } catch {
      return { structured: null, legacyText: s };
    }
  }
  return { structured: null, legacyText: s };
}

export function serializeIntakeTreadNotes(
  inspection: TireIntakeInspectionInput,
  opts?: { summary?: string | null; legacyText?: string | null },
): string | undefined {
  const hasBool = inspection.wearUniform !== undefined || inspection.cracks !== undefined;
  const tread = inspection.treadMm;
  const hasTread =
    tread && Object.values(tread).some((v) => v !== undefined && v !== null && Number.isFinite(v));
  const summary = opts?.summary?.trim() || opts?.legacyText?.trim() || undefined;
  if (!hasBool && !hasTread) return summary;

  const payload: Record<string, unknown> = { v: 1 };
  if (inspection.wearUniform !== undefined) payload.wearUniform = inspection.wearUniform;
  if (inspection.cracks !== undefined) payload.cracks = inspection.cracks;
  if (hasTread && tread) {
    const treadMm: Record<string, number> = {};
    for (const pos of ['fl', 'fr', 'rl', 'rr'] as const) {
      const v = tread[pos];
      if (v !== undefined && v !== null && Number.isFinite(v)) treadMm[pos] = Number(v);
    }
    if (Object.keys(treadMm).length > 0) payload.treadMm = treadMm;
  }
  if (summary) payload.summary = summary;
  return JSON.stringify(payload);
}

export function buildIntakeInspectionFromDemountReadings(
  readings: Array<{ position: VehicleWheelPosition; treadMm: number }>,
  extras?: { wearUniform?: boolean; cracks?: boolean },
): TireIntakeInspectionInput {
  const treadMm: Partial<Record<VehicleWheelPosition, number>> = {};
  for (const r of readings) {
    treadMm[r.position] = r.treadMm;
  }
  return {
    ...extras,
    treadMm,
  };
}

export function parseIntakeInspectionBody(
  raw: unknown,
): TireIntakeInspectionInput | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!isPlainObject(raw)) return undefined;
  const wearUniform = typeof raw.wearUniform === 'boolean' ? raw.wearUniform : undefined;
  const cracks = typeof raw.cracks === 'boolean' ? raw.cracks : undefined;
  let treadMm: TireIntakeInspectionInput['treadMm'];
  if (isPlainObject(raw.treadMm)) {
    treadMm = {};
    for (const pos of ['fl', 'fr', 'rl', 'rr'] as const) {
      const v = raw.treadMm[pos];
      if (v !== undefined && v !== null && Number.isFinite(Number(v))) {
        treadMm[pos] = Number(v);
      }
    }
  }
  if (
    wearUniform === undefined &&
    cracks === undefined &&
    (!treadMm || Object.keys(treadMm).length === 0)
  ) {
    return undefined;
  }
  return { wearUniform, cracks, treadMm };
}

/**
 * Bay/location for tyre-close auto hotel check-in.
 * Explicit code required — no silent `AUTO` placeholder (F4 bay quality).
 */
export function defaultWoAutoStayLocationCode(explicit?: string | null): string {
  const t = explicit?.trim();
  if (!t) {
    throw new Error('locationCode (bay/raft) is required for hotel check-in from work order');
  }
  return t.toUpperCase();
}
