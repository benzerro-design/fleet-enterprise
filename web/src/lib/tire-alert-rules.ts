import type { VehicleTireSeason } from "@/lib/vehicle-wheels-types";

export const TIRE_TREAD_LOW_MM_SUMMER = 3.0;
export const TIRE_TREAD_LOW_MM_WINTER = 4.0;
export const TIRE_DOT_MAX_AGE_YEARS = 6;

export function parseDotManufactureYear(dot: string | null | undefined): number | null {
  if (!dot?.trim()) return null;
  const digits = dot.replace(/\D/g, "");
  if (digits.length < 4) return null;
  const wwyy = digits.slice(-4);
  const yy = parseInt(wwyy.slice(2, 4), 10);
  if (Number.isNaN(yy)) return null;
  return yy >= 90 ? 1900 + yy : 2000 + yy;
}

export function treadLowThresholdMm(season: VehicleTireSeason): number {
  return season === "winter" ? TIRE_TREAD_LOW_MM_WINTER : TIRE_TREAD_LOW_MM_SUMMER;
}

export function isTreadLow(treadMm: number | null | undefined, season: VehicleTireSeason): boolean {
  if (treadMm == null || Number.isNaN(treadMm)) return false;
  return treadMm < treadLowThresholdMm(season);
}

export function isDotAged(dot: string | null | undefined, now = new Date()): boolean {
  const year = parseDotManufactureYear(dot);
  if (year == null) return false;
  return now.getUTCFullYear() - year >= TIRE_DOT_MAX_AGE_YEARS;
}

export type FitmentAttention = "tread_low" | "dot_aged" | null;

export function fitmentAttention(
  treadMm: number | null | undefined,
  dot: string | null | undefined,
  season: VehicleTireSeason,
): FitmentAttention {
  if (isTreadLow(treadMm, season)) return "tread_low";
  if (isDotAged(dot)) return "dot_aged";
  return null;
}

export function fitmentAttentionLabel(kind: NonNullable<FitmentAttention>): string {
  if (kind === "tread_low") return "Uzură sub prag";
  return "DOT vechi";
}
