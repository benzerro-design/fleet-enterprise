export const FUEL_TYPE_OPTIONS = [
  { value: "diesel", label: "Motorină" },
  { value: "petrol", label: "Benzină" },
  { value: "hybrid", label: "Hybrid" },
  { value: "electric", label: "Electric" },
  { value: "lpg", label: "GPL" },
] as const;

export type FuelTypeValue = (typeof FUEL_TYPE_OPTIONS)[number]["value"];

const LABELS: Record<FuelTypeValue, string> = {
  diesel: "Motorină",
  petrol: "Benzină",
  hybrid: "Hybrid",
  electric: "Electric",
  lpg: "GPL",
};

export function fuelTypeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return LABELS[value as FuelTypeValue] ?? value;
}
