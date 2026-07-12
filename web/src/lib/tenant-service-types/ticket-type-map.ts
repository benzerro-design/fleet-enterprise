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
      "bodywork_painting",
      "glass_repair",
    ].includes(code)
  ) {
    return "maintenance";
  }
  if (code === "towing") return "technical";
  return "other";
}

export function activeTenantServiceTypes(items: TenantServiceType[]): TenantServiceType[] {
  return [...items].filter((i) => i.active).sort((a, b) => a.sortOrder - b.sortOrder);
}
