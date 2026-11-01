import type { TireMountedAs } from '@prisma/client';

/** Bandă tarif hotel: diametru jantă ≤ maxRimInch. */
export type TireStorageFeeBand = {
  maxRimInch: number;
  tyreOnlyCents: number | null;
  onRimCents: number | null;
};

export type TireStorageFeeCatalog = {
  tireStorageFeeTyreOnlyCents?: number | null;
  tireStorageFeeOnRimCents?: number | null;
  tireStorageFeeBands?: unknown;
};

/** Extrage diametrul jantei (inch) din size tip `205/55 R16` / `205/55R16`. */
export function parseRimInchFromTireSize(size: string | null | undefined): number | null {
  if (!size?.trim()) return null;
  const m = size.trim().match(/(\d{3})\s*\/\s*(\d{2})\s*R\s*(\d{2})/i);
  if (!m) return null;
  const rim = Number.parseInt(m[3]!, 10);
  return Number.isFinite(rim) && rim > 0 ? rim : null;
}

/** Dominant rim from a set's asset sizes (mode; ties → max). */
export function dominantRimInchFromSizes(sizes: Array<string | null | undefined>): number | null {
  const counts = new Map<number, number>();
  for (const size of sizes) {
    const rim = parseRimInchFromTireSize(size);
    if (rim == null) continue;
    counts.set(rim, (counts.get(rim) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  let bestRim: number | null = null;
  let bestCount = -1;
  for (const [rim, count] of counts) {
    if (count > bestCount || (count === bestCount && (bestRim == null || rim > bestRim))) {
      bestRim = rim;
      bestCount = count;
    }
  }
  return bestRim;
}

/** Read bands stored as cents JSON on Supplier. */
export function parseTireStorageFeeBands(raw: unknown): TireStorageFeeBand[] {
  if (raw == null || raw === '') return [];
  if (!Array.isArray(raw)) return [];
  const bands: TireStorageFeeBand[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const o = row as Record<string, unknown>;
    const maxRimInch = Number(o.maxRimInch);
    if (!Number.isFinite(maxRimInch) || maxRimInch < 10 || maxRimInch > 30) continue;
    bands.push({
      maxRimInch: Math.round(maxRimInch),
      tyreOnlyCents: optionalNonNegInt(o.tyreOnlyCents),
      onRimCents: optionalNonNegInt(o.onRimCents),
    });
  }
  return bands.sort((a, b) => a.maxRimInch - b.maxRimInch);
}

function optionalNonNegInt(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

/**
 * Parse bands from PATCH body.
 * Accepts `{ maxRimInch, tyreOnlyRon, onRimRon }` and/or `*Cents`.
 * `null` clears all bands → `[]`. `undefined` = absent.
 */
export function parseTireStorageFeeBandsInput(raw: unknown): TireStorageFeeBand[] | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return [];
  if (!Array.isArray(raw)) {
    throw new Error('tireStorageFeeBands must be an array');
  }
  const bands: TireStorageFeeBand[] = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error(`tireStorageFeeBands[${i}] invalid`);
    }
    const o = row as Record<string, unknown>;
    const maxRimInch = Number(o.maxRimInch);
    if (!Number.isFinite(maxRimInch) || maxRimInch < 10 || maxRimInch > 30) {
      throw new Error(`tireStorageFeeBands[${i}].maxRimInch must be 10–30`);
    }
    let tyreOnlyCents: number | null = null;
    let onRimCents: number | null = null;
    if (o.tyreOnlyRon !== undefined) {
      tyreOnlyCents = ronToCents(o.tyreOnlyRon, `tireStorageFeeBands[${i}].tyreOnlyRon`);
    } else if (o.tyreOnlyCents !== undefined) {
      tyreOnlyCents = requireCents(o.tyreOnlyCents, `tireStorageFeeBands[${i}].tyreOnlyCents`);
    }
    if (o.onRimRon !== undefined) {
      onRimCents = ronToCents(o.onRimRon, `tireStorageFeeBands[${i}].onRimRon`);
    } else if (o.onRimCents !== undefined) {
      onRimCents = requireCents(o.onRimCents, `tireStorageFeeBands[${i}].onRimCents`);
    }
    bands.push({
      maxRimInch: Math.round(maxRimInch),
      tyreOnlyCents,
      onRimCents,
    });
  }
  return bands.sort((a, b) => a.maxRimInch - b.maxRimInch);
}

function ronToCents(raw: unknown, field: string): number | null {
  if (raw === null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number.parseFloat(String(raw).trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) throw new Error(`${field} must be a non-negative RON amount`);
  return Math.round(n * 100);
}

function requireCents(raw: unknown, field: string): number | null {
  if (raw === null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${field} must be a non-negative integer (cents)`);
  return Math.round(n);
}

/**
 * Pick fee: first band with maxRimInch >= rim; else last band if rim larger; else flat default.
 */
export function resolveTireStorageFeeCents(input: {
  catalog: TireStorageFeeCatalog;
  mountedAs: TireMountedAs | string | null | undefined;
  rimInch?: number | null;
}): number | null {
  const onRim = input.mountedAs === 'on_rim';
  const bands = parseTireStorageFeeBands(input.catalog.tireStorageFeeBands);
  const rim = input.rimInch ?? null;

  if (rim != null && bands.length > 0) {
    const match = bands.find((b) => rim <= b.maxRimInch) ?? bands[bands.length - 1]!;
    const fromBand = onRim ? match.onRimCents : match.tyreOnlyCents;
    if (fromBand != null) return fromBand;
  }

  const flat = onRim
    ? input.catalog.tireStorageFeeOnRimCents
    : input.catalog.tireStorageFeeTyreOnlyCents;
  return flat != null && Number.isFinite(flat) ? Math.round(flat) : null;
}
