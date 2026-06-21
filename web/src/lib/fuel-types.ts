export const FUEL_TYPE_OPTIONS = [
  { value: "diesel", label: "Motorină" },
  { value: "petrol", label: "Benzină" },
  { value: "hybrid", label: "Hybrid" },
  { value: "electric", label: "Electric" },
  { value: "lpg", label: "GPL" },
] as const;

export type FuelTypeValue = (typeof FUEL_TYPE_OPTIONS)[number]["value"];

export const CONSUMPTION_FUEL_FILTER_OPTIONS = [
  { value: "diesel", label: "Motorină" },
  { value: "petrol", label: "Benzină" },
  { value: "lpg", label: "GPL" },
  { value: "electric", label: "Electric (kWh)" },
  { value: "hybrid", label: "Hybrid" },
] as const;

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

export function fuelEnergyUnit(value: FuelTypeValue | string | null | undefined): "L" | "kWh" {
  return value === "electric" ? "kWh" : "L";
}

export function consumptionPer100Label(value: FuelTypeValue | string | null | undefined): string {
  return value === "electric" ? "kWh/100km" : "L/100km";
}

function normalizeText(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) return "";
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function parseCivFuelTypeText(raw: unknown): FuelTypeValue | null {
  const t = normalizeText(raw);
  if (!t) return null;

  if (FUEL_TYPE_OPTIONS.some((o) => o.value === t)) return t as FuelTypeValue;

  if (/(^|\b)(diesel|motorina|motorin|gasoil|mazut)(\b|$)/.test(t)) return "diesel";
  if (/(^|\b)(benzina|benzin|petrol|gasoline|essence|super)(\b|$)/.test(t)) return "petrol";
  if (/(^|\b)(gpl|lpg|gaz petrolier)(\b|$)/.test(t)) return "lpg";
  if (/(^|\b)(electric|electrica|kwh|kw\/h|battery|baterie)(\b|$)/.test(t)) return "electric";
  if (/(^|\b)(hybrid|hibrid)(\b|$)/.test(t)) return "hybrid";

  return null;
}

/** Cost Combustibil: auto din CIV P.3; null dacă lipsește. */
export function resolveVehicleFuelFromCivP3(
  civProfile: Record<string, string | number | null> | null | undefined,
): FuelTypeValue | null {
  return parseCivFuelTypeText(civProfile?.fuelType);
}

/** Consum: CIV P.3, apoi fuelType vehicul. */
export function resolveVehicleFuelType(input: {
  fuelType?: string | null;
  civProfile?: Record<string, string | number | null> | null;
}): FuelTypeValue | null {
  const fromCiv = parseCivFuelTypeText(input.civProfile?.fuelType);
  if (fromCiv) return fromCiv;
  if (input.fuelType && FUEL_TYPE_OPTIONS.some((o) => o.value === input.fuelType)) {
    return input.fuelType as FuelTypeValue;
  }
  return null;
}

export function parseFuelTypesCsv(raw: string | undefined): FuelTypeValue[] {
  if (!raw?.trim()) return [];
  const out: FuelTypeValue[] = [];
  for (const part of raw.split(",")) {
    const v = part.trim() as FuelTypeValue;
    if (FUEL_TYPE_OPTIONS.some((o) => o.value === v) && !out.includes(v)) out.push(v);
  }
  return out;
}
