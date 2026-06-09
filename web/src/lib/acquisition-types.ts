import type { AcquisitionType } from "@/lib/vehicle-profile-types";

export const ACQUISITION_TYPES: { value: AcquisitionType; label: string }[] = [
  { value: "cash", label: "Cash / plată integrală" },
  { value: "financial_leasing", label: "Leasing financiar" },
  { value: "operational_leasing", label: "Leasing operațional" },
];

export function acquisitionTypeLabel(type: AcquisitionType | null | undefined): string {
  if (!type) return "—";
  return ACQUISITION_TYPES.find((t) => t.value === type)?.label ?? type;
}
