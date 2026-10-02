/**
 * SUPP-041 — discount piese/manoperă doar pe profil atelier / anvelope.
 */
const ELIGIBLE = new Set(["service_auto", "tires"]);

export function supplierSupportsQuoteDiscountDefaults(
  category: string | null | undefined,
): boolean {
  if (!category) return false;
  return ELIGIBLE.has(category);
}

export function effectiveSupplierDiscountDefaults(
  category: string | null | undefined,
  parts: number | null | undefined,
  labor: number | null | undefined,
): { partsDiscountPercent: number; laborDiscountPercent: number } {
  if (!supplierSupportsQuoteDiscountDefaults(category)) {
    return { partsDiscountPercent: 0, laborDiscountPercent: 0 };
  }
  return {
    partsDiscountPercent: Number(parts) || 0,
    laborDiscountPercent: Number(labor) || 0,
  };
}
