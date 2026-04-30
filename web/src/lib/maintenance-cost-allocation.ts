/** Coduri alocare cost mentenanță — păstrate în sync cu API (`maintenance-cost-allocation.ts`). */
export const MAINTENANCE_COST_ALLOCATION_OPTIONS: ReadonlyArray<{ code: string; label: string }> = [
  { code: "revizie", label: "Revizie" },
  { code: "reparatie_mecanica", label: "Reparație mecanică" },
  { code: "reparatie_electrica", label: "Reparație electrică" },
  { code: "dauna", label: "Daună" },
  { code: "service_roti", label: "Service roți" },
  { code: "diagnoza", label: "Diagnoză" },
  { code: "tinichigerie", label: "Tinichigerie / vopsitorie" },
  { code: "altele", label: "Altele" },
] as const;

export function maintenanceCostAllocationLabel(code: string | null | undefined): string {
  if (!code?.trim()) return "—";
  const row = MAINTENANCE_COST_ALLOCATION_OPTIONS.find((o) => o.code === code);
  return row?.label ?? code;
}
