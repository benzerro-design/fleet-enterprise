/** Mirror API supplier-rate-card helpers for UI. */

export type PartsPriceBasis = "list" | "net";

export function centsToRonInput(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return "";
  return (Math.round(cents) / 100).toFixed(2).replace(/\.00$/, "");
}

export function defaultLaborUnitLei(rates: {
  laborRateMechanicalCents?: number | null;
  laborRateBodyCents?: number | null;
  laborRatePaintCents?: number | null;
  laborRateDiagnosticCents?: number | null;
} | null | undefined): string {
  if (!rates) return "";
  const candidates = [
    rates.laborRateMechanicalCents,
    rates.laborRateBodyCents,
    rates.laborRatePaintCents,
    rates.laborRateDiagnosticCents,
  ];
  for (const cents of candidates) {
    if (cents != null && Number.isFinite(cents) && cents > 0) {
      return (Math.round(cents) / 100).toFixed(2);
    }
  }
  return "";
}

export function effectivePartsDiscountForBasis(
  basis: PartsPriceBasis | undefined,
  partsDiscountPercent: number,
): number {
  if (basis === "net") return 0;
  return Number(partsDiscountPercent) || 0;
}
