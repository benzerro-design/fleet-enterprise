/** Valori trimise la API ca `category` (string). */
export const COST_CATEGORY_VALUES = [
  "Taxă pod",
  "RCA",
  "Rovinietă",
  "CASCO",
  "Spălătorie",
  "ITP",
  "Revizie",
  "Reparații",
  "Anvelope",
  "Combustibil",
  "Parcare",
  "Amendă",
  "Peaj",
  "Asistență rutieră",
  "Leasing / rate",
  "Taxe locale",
  "Altele",
] as const;

export type CostCategoryValue = (typeof COST_CATEGORY_VALUES)[number];

export function isKnownCostCategory(v: string): v is CostCategoryValue {
  return (COST_CATEGORY_VALUES as readonly string[]).includes(v);
}
