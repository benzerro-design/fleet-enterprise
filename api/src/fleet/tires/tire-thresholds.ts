import type { VehicleTireSeason } from '@prisma/client';

export const TIRE_TREAD_LOW_MM_SUMMER = 3.0;
export const TIRE_TREAD_LOW_MM_WINTER = 4.0;
export const TIRE_DOT_MAX_AGE_YEARS = 6;

export type DotManufactureParse =
  | { kind: 'wwyy'; isoYear: number; isoWeek: number }
  /** Week unknown — only calendar year from YY is reliable; age checks stay conservative. */
  | { kind: 'year_only'; isoYear: number };

/** DOT suffix WWYY — ISO week + year when parseable, else year-only from YY. */
export function parseDotManufacture(dot: string | null | undefined): DotManufactureParse | null {
  if (!dot?.trim()) return null;
  const digits = dot.replace(/\D/g, '');
  if (digits.length < 4) return null;
  const wwyy = digits.slice(-4);
  const ww = parseInt(wwyy.slice(0, 2), 10);
  const yy = parseInt(wwyy.slice(2, 4), 10);
  if (Number.isNaN(yy)) return null;
  const isoYear = yy >= 90 ? 1900 + yy : 2000 + yy;
  if (!Number.isNaN(ww) && ww >= 1 && ww <= 53) {
    return { kind: 'wwyy', isoYear, isoWeek: ww };
  }
  return { kind: 'year_only', isoYear };
}

/** @deprecated Prefer parseDotManufacture — year leg only. */
export function parseDotManufactureYear(dot: string | null | undefined): number | null {
  const parsed = parseDotManufacture(dot);
  return parsed?.isoYear ?? null;
}

/** Monday 00:00 UTC of the given ISO week. */
function isoWeekStartUtc(isoYear: number, isoWeek: number): Date {
  const jan4 = Date.UTC(isoYear, 0, 4);
  const dow = new Date(jan4).getUTCDay() || 7;
  const week1Monday = jan4 - (dow - 1) * 86_400_000;
  return new Date(week1Monday + (isoWeek - 1) * 7 * 86_400_000);
}

export function treadLowThresholdMm(season: VehicleTireSeason): number {
  return season === 'winter' ? TIRE_TREAD_LOW_MM_WINTER : TIRE_TREAD_LOW_MM_SUMMER;
}

export function isTreadLow(treadMm: number | null | undefined, season: VehicleTireSeason): boolean {
  if (treadMm == null || Number.isNaN(treadMm)) return false;
  return treadMm < treadLowThresholdMm(season);
}

export function isDotAged(dot: string | null | undefined, now = new Date()): boolean {
  const parsed = parseDotManufacture(dot);
  if (parsed == null) return false;
  if (parsed.kind === 'wwyy') {
    const mfg = isoWeekStartUtc(parsed.isoYear, parsed.isoWeek);
    const threshold = new Date(mfg);
    threshold.setUTCFullYear(threshold.getUTCFullYear() + TIRE_DOT_MAX_AGE_YEARS);
    return now.getTime() >= threshold.getTime();
  }
  // Year-only: do not alert until calendar year clearly exceeds max age (avoids early alerts).
  return now.getUTCFullYear() > parsed.isoYear + TIRE_DOT_MAX_AGE_YEARS;
}

/** Nov–Mar UTC ≈ sezon iarnă RO. */
export function isWinterDrivingSeason(now = new Date()): boolean {
  const m = now.getUTCMonth();
  return m === 10 || m === 11 || m === 0 || m === 1 || m === 2;
}

export function isSeasonMismatch(
  setSeason: VehicleTireSeason,
  mounted: boolean,
  now = new Date(),
): boolean {
  if (!mounted) return false;
  if (setSeason === 'unknown' || setSeason === 'all_season') return false;
  const winter = isWinterDrivingSeason(now);
  if (winter && setSeason === 'summer') return true;
  if (!winter && setSeason === 'winter') return true;
  return false;
}
