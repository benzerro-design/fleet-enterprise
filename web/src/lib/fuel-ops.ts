export const FUEL_COST_CATEGORY = "Combustibil";

export function isFuelCostCategory(category: string | null | undefined): boolean {
  return category?.trim().toLowerCase() === FUEL_COST_CATEGORY.toLowerCase();
}
