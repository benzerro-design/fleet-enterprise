import type { TicketType } from "@/lib/tickets-api";
import type { TenantServiceType } from "./types";

/** Map catalog tenant → enum tichet CRM (până la migrare serviceTypeId pe ticket). */
export function serviceTypeCodeToTicketType(code: string): TicketType {
  if (code === "itp") return "itp";
  if (code === "damage_repair") return "damage";
  if (
    [
      "mechanics",
      "periodic_maintenance",
      "electrical",
      "diagnostics",
      "ac_climate",
      "tire_service",
      // hotel: tichet maintenance opțional; workflow WO R doar pentru tire_service
      "tire_storage",
      "bodywork_painting",
      "glass_repair",
    ].includes(code)
  ) {
    return "maintenance";
  }
  if (code === "towing") return "technical";
  return "other";
}

/** `/active` may omit `active`; treat missing as true. Full list still filters inactive. */
export function activeTenantServiceTypes(
  items: Array<Pick<TenantServiceType, "sortOrder"> & { active?: boolean }>,
): TenantServiceType[] {
  return [...items]
    .filter((i) => i.active !== false)
    .sort((a, b) => a.sortOrder - b.sortOrder) as TenantServiceType[];
}
