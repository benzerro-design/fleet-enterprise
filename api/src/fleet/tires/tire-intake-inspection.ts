import type { VehicleWheelPosition } from '@prisma/client';

const INTAKE_JSON_PREFIX = '{"v":';

export type TireIntakeAssetReading = {
  assetId: string;
  treadMm: number;
};

export type TireRimCondition = 'ok' | 'scratched' | 'damaged';

const RIM_CONDITIONS = new Set<TireRimCondition>(['ok', 'scratched', 'damaged']);

export type TireIntakeInspection = {
  wearUniform?: boolean;
  cracks?: boolean;
  treadMm?: Partial<Record<VehicleWheelPosition, number>>;
  assets?: TireIntakeAssetReading[];
  rimCondition?: TireRimCondition;
  rimNotes?: string;
  /** Human-readable fallback (legacy plain text). */
  summary?: string;
};

export type TireIntakeInspectionInput = {
  wearUniform?: boolean;
  cracks?: boolean;
  treadMm?: Partial<Record<VehicleWheelPosition, number>>;
  assets?: TireIntakeAssetReading[];
  rimCondition?: TireRimCondition;
  rimNotes?: string;
};

/** tyre_only sets carry no rims — drop rim fields before serialize/store. */
export function stripRimFieldsForTyreOnlyIntake(
  mountedAs: string | null | undefined,
  inspection: TireIntakeInspectionInput | undefined,
): TireIntakeInspectionInput | undefined {
  if (mountedAs !== 'tyre_only' || !inspection) return inspection;
  const { rimCondition: _rc, rimNotes: _rn, ...rest } = inspection;
  return rest;
}

function parseRimCondition(raw: unknown): TireRimCondition | undefined {
  if (typeof raw !== 'string') return undefined;
  return RIM_CONDITIONS.has(raw as TireRimCondition) ? (raw as TireRimCondition) : undefined;
}

/** Accepts finite numbers or numeric strings with digits; rejects "", whitespace, booleans, arrays, etc. */
export function coerceFiniteTreadMm(tread: unknown): number | null {
  if (typeof tread === 'number') {
    if (!Number.isFinite(tread) || tread < 0) return null;
    return tread;
  }
  if (typeof tread === 'string') {
    const t = tread.trim();
    if (!t || !/\d/.test(t)) return null;
    const n = Number(t.replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  }
  return null;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function parseAssetTreadEntry(
  raw: unknown,
  index: number,
): TireIntakeAssetReading | null {
  if (!isPlainObject(raw)) return null;
  const assetId = typeof raw.assetId === 'string' ? raw.assetId.trim() : '';
  if (!assetId) return null;
  if (raw.treadMm === undefined || raw.treadMm === null) return null;
  const treadMm = coerceFiniteTreadMm(raw.treadMm);
  if (treadMm === null) return null;
  return { assetId, treadMm };
}

/** Validates unique assetIds and finite treadMm >= 0. Throws on invalid input. */
export function applyIntakeAssetTreads(raw: unknown): TireIntakeAssetReading[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('assets trebuie să fie un array nevid');
  }
  const out: TireIntakeAssetReading[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < raw.length; i++) {
    const row = parseAssetTreadEntry(raw[i], i);
    if (!row) {
      throw new Error(`Profil (mm) invalid la anvelopa ${i + 1}`);
    }
    if (seen.has(row.assetId)) {
      throw new Error('assetId duplicat în lista de profil');
    }
    seen.add(row.assetId);
    out.push(row);
  }
  return out;
}

/** Every set item must have a tread reading; no extra unknown assetIds. */
export function assertAssetTreadsCoverSetItems(
  setAssetIds: string[],
  assets: TireIntakeAssetReading[] | undefined,
): void {
  if (!assets?.length) {
    throw new Error('Profil (mm) obligatoriu pentru fiecare anvelopă');
  }
  const byId = new Map(assets.map((a) => [a.assetId, a.treadMm]));
  for (const assetId of setAssetIds) {
    if (!byId.has(assetId)) {
      throw new Error('Profil (mm) obligatoriu pentru fiecare anvelopă');
    }
  }
  const setIdSet = new Set(setAssetIds);
  for (const a of assets) {
    if (!setIdSet.has(a.assetId)) {
      throw new Error(`assetId necunoscut în set: ${a.assetId}`);
    }
  }
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
      if (o.v === 2) {
        let assets: TireIntakeInspection['assets'];
        if (Array.isArray(o.assets)) {
          assets = [];
          for (const row of o.assets) {
            const parsed = parseAssetTreadEntry(row, assets.length);
            if (parsed) assets.push(parsed);
          }
          if (assets.length === 0) assets = undefined;
        }
        const rimNotes =
          typeof o.rimNotes === 'string' && o.rimNotes.trim() ? o.rimNotes.trim() : undefined;
        return {
          structured: {
            wearUniform: typeof o.wearUniform === 'boolean' ? o.wearUniform : undefined,
            cracks: typeof o.cracks === 'boolean' ? o.cracks : undefined,
            assets,
            rimCondition: parseRimCondition(o.rimCondition),
            rimNotes,
            summary: typeof o.summary === 'string' ? o.summary : undefined,
          },
          legacyText: null,
        };
      }
      if (o.v !== 1) return { structured: null, legacyText: s };
      const treadRaw = o.treadMm;
      let treadMm: TireIntakeInspection['treadMm'];
      if (isPlainObject(treadRaw)) {
        treadMm = {};
        for (const pos of ['fl', 'fr', 'rl', 'rr'] as const) {
          const v = treadRaw[pos];
          const mm = v !== undefined && v !== null ? coerceFiniteTreadMm(v) : null;
          if (mm !== null) treadMm[pos] = mm;
        }
      }
      const rimNotes =
        typeof o.rimNotes === 'string' && o.rimNotes.trim() ? o.rimNotes.trim() : undefined;
      return {
        structured: {
          wearUniform: typeof o.wearUniform === 'boolean' ? o.wearUniform : undefined,
          cracks: typeof o.cracks === 'boolean' ? o.cracks : undefined,
          treadMm,
          rimCondition: parseRimCondition(o.rimCondition),
          rimNotes,
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
  const hasAssets = (inspection.assets?.length ?? 0) > 0;
  const rimNotes = inspection.rimNotes?.trim() || undefined;
  const hasRim = inspection.rimCondition !== undefined || !!rimNotes;
  const summary = opts?.summary?.trim() || opts?.legacyText?.trim() || undefined;
  if (!hasBool && !hasTread && !hasAssets && !hasRim) return summary;

  function applyRimFields(payload: Record<string, unknown>) {
    if (inspection.rimCondition !== undefined) payload.rimCondition = inspection.rimCondition;
    if (rimNotes) payload.rimNotes = rimNotes;
  }

  if (hasAssets && inspection.assets) {
    const payload: Record<string, unknown> = {
      v: 2,
      assets: inspection.assets.map((a) => ({ assetId: a.assetId, treadMm: a.treadMm })),
    };
    if (inspection.wearUniform !== undefined) payload.wearUniform = inspection.wearUniform;
    if (inspection.cracks !== undefined) payload.cracks = inspection.cracks;
    applyRimFields(payload);
    if (summary) payload.summary = summary;
    return JSON.stringify(payload);
  }

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
  applyRimFields(payload);
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
      const mm = v !== undefined && v !== null ? coerceFiniteTreadMm(v) : null;
      if (mm !== null) treadMm[pos] = mm;
    }
  }
  const rimCondition = parseRimCondition(raw.rimCondition);
  const rimNotes =
    typeof raw.rimNotes === 'string' && raw.rimNotes.trim() ? raw.rimNotes.trim() : undefined;
  let assets: TireIntakeInspectionInput['assets'];
  if (raw.assets !== undefined && raw.assets !== null) {
    try {
      assets = applyIntakeAssetTreads(raw.assets);
    } catch {
      return undefined;
    }
  }
  if (
    wearUniform === undefined &&
    cracks === undefined &&
    (!treadMm || Object.keys(treadMm).length === 0) &&
    (!assets || assets.length === 0) &&
    rimCondition === undefined &&
    !rimNotes
  ) {
    return undefined;
  }
  return { wearUniform, cracks, treadMm, assets, rimCondition, rimNotes };
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

const WHEEL_POS_DISPLAY: Record<string, string> = {
  fl: 'FL',
  fr: 'FR',
  rl: 'RL',
  rr: 'RR',
};

const RIM_CONDITION_LABEL: Record<TireRimCondition, string> = {
  ok: 'OK',
  scratched: 'Zgâriate',
  damaged: 'Deteriorate',
};

/** Human-readable profil + rim summary for stored intakeTreadNotes (v1/v2 JSON or legacy text). */
export function formatIntakeTreadNotesForDisplay(raw: string | null | undefined): string | null {
  const s = raw?.trim();
  if (!s) return null;
  if (!s.startsWith(INTAKE_JSON_PREFIX)) return s;

  try {
    const o = JSON.parse(s) as Record<string, unknown>;
    const lines: string[] = [];
    const flags: string[] = [];
    if (o.wearUniform === true) flags.push('uzură uniformă');
    if (o.wearUniform === false) flags.push('uzură neuniformă');
    if (o.cracks === true) flags.push('crăpături');
    if (o.cracks === false) flags.push('fără crăpături');
    if (flags.length) lines.push(flags.join(' · '));

    if (o.v === 2 && Array.isArray(o.assets)) {
      const treadParts: string[] = [];
      for (const row of o.assets) {
        if (!isPlainObject(row)) continue;
        const assetId = typeof row.assetId === 'string' ? row.assetId.trim() : '';
        const treadMm = coerceFiniteTreadMm(row.treadMm);
        if (!assetId || treadMm === null) continue;
        treadParts.push(`${assetId.slice(0, 8)}… ${treadMm} mm`);
      }
      if (treadParts.length) lines.push(`Profil: ${treadParts.join('; ')}`);
    } else if (o.v === 1 && isPlainObject(o.treadMm)) {
      const treadParts: string[] = [];
      for (const pos of ['fl', 'fr', 'rl', 'rr'] as const) {
        const mm = coerceFiniteTreadMm(o.treadMm[pos]);
        if (mm !== null) treadParts.push(`${WHEEL_POS_DISPLAY[pos]} ${mm} mm`);
      }
      if (treadParts.length) lines.push(`Profil: ${treadParts.join('; ')}`);
    }

    const rimCondition = parseRimCondition(o.rimCondition);
    const rimNotes =
      typeof o.rimNotes === 'string' && o.rimNotes.trim() ? o.rimNotes.trim() : undefined;
    if (rimCondition) {
      const rimLine = `Jante: ${RIM_CONDITION_LABEL[rimCondition]}`;
      lines.push(rimNotes ? `${rimLine} — ${rimNotes}` : rimLine);
    } else if (rimNotes) {
      lines.push(`Jante: ${rimNotes}`);
    }

    const summary = typeof o.summary === 'string' ? o.summary.trim() : '';
    if (summary) lines.push(summary);

    if (lines.length) return lines.join('\n');
    return 'Recepție structurată (fără detalii)';
  } catch {
    return s;
  }
}
