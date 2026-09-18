/** Emitenți țintă FLEET-023 — fără conector live. */
export const FUEL_CARD_PROVIDERS = [
  "DKV",
  "UTA Edenred",
  "Eurowag",
  "E100",
  "OMV / Petrom (Routex)",
  "MOL",
  "Rompetrol Fill&Go",
  "Shell Fleet",
  "TotalEnergies / AS24",
  "Eni",
  "Circle K",
  "Aral",
  "Corpay",
  "WEX",
  "Radius",
  "Altul",
] as const;

export type FuelCardStatusValue = "active" | "inactive" | "blocked";

export const FUEL_CARD_STATUSES: { value: FuelCardStatusValue; label: string }[] = [
  { value: "active", label: "Activ" },
  { value: "inactive", label: "Inactiv" },
  { value: "blocked", label: "Blocat" },
];

export function fuelCardStatusLabel(v: string | null | undefined): string {
  if (!v) return "—";
  return FUEL_CARD_STATUSES.find((s) => s.value === v)?.label ?? v;
}
