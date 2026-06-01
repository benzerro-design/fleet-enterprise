export const TRIP_PURPOSE_OPTIONS = [
  { value: "", label: "— Nespecificat —" },
  { value: "business", label: "Serviciu" },
  { value: "personal", label: "Personal" },
  { value: "mixed", label: "Mixt" },
] as const;

export const TRIP_ROAD_TYPE_OPTIONS = [
  { value: "", label: "— Nespecificat —" },
  { value: "urban", label: "Urban" },
  { value: "extra_urban", label: "Extraurban" },
  { value: "highway", label: "Autostradă" },
  { value: "mixed", label: "Mixt" },
] as const;

export const TRIP_SHEET_DOC_TYPES = [
  { value: "trip_sheet", label: "Foaie de parcurs" },
  { value: "faz_monthly", label: "FAZ lunar (rezumat zilnic)" },
] as const;

export type TripPurposeValue = (typeof TRIP_PURPOSE_OPTIONS)[number]["value"];
export type TripRoadTypeValue = (typeof TRIP_ROAD_TYPE_OPTIONS)[number]["value"];

export function tripPurposeLabel(p: string | null | undefined): string {
  return TRIP_PURPOSE_OPTIONS.find((o) => o.value === p)?.label ?? "—";
}

export function tripRoadTypeLabel(r: string | null | undefined): string {
  return TRIP_ROAD_TYPE_OPTIONS.find((o) => o.value === r)?.label ?? "—";
}
