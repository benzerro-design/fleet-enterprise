/** Servicii operaționale prestate de furnizor (multi-select). */
export type SupplierServiceKind =
  | "mechanics"
  | "electrical"
  | "bodywork_painting"
  | "damage_repair"
  | "itp"
  | "tire_service"
  | "periodic_maintenance"
  | "ac_climate"
  | "diagnostics"
  | "towing"
  | "glass_repair";

export type SupplierServiceCatalogEntry = {
  id: string;
  code: string;
  kind: string;
  label: string;
  description: string;
};

export const SUPPLIER_SERVICE_KINDS: SupplierServiceKind[] = [
  "mechanics",
  "electrical",
  "bodywork_painting",
  "damage_repair",
  "itp",
  "tire_service",
  "periodic_maintenance",
  "ac_climate",
  "diagnostics",
  "towing",
  "glass_repair",
];

export function supplierServiceLabel(kind: string): string {
  const map: Record<string, string> = {
    mechanics: "Mecanică",
    electrical: "Electrică",
    bodywork_painting: "Tinichigerie & vopsitorie",
    damage_repair: "Daune / constatare",
    itp: "ITP",
    tire_service: "Vulcanizare / anvelope",
    periodic_maintenance: "Revizie periodică",
    ac_climate: "Climatizare",
    diagnostics: "Diagnoză",
    towing: "Tractări",
    glass_repair: "Parbrize & geamuri",
  };
  return map[kind] ?? kind;
}

export function supplierServiceDescription(kind: string): string {
  const map: Record<string, string> = {
    mechanics: "Reparații mecanice, frâne, suspensie",
    electrical: "Instalații electrice, baterie",
    bodywork_painting: "Tinichigerie, vopsitorie",
    damage_repair: "Daune RCA/CASCO",
    itp: "Stație ITP autorizată",
    tire_service: "Montaj, echilibrare, vulcanizare",
    periodic_maintenance: "Revizii planificate",
    ac_climate: "Service climatizare",
    diagnostics: "Tester OBD",
    towing: "Tractări auto",
    glass_repair: "Parbrize & geamuri",
  };
  return map[kind] ?? "";
}

export function fallbackServiceCatalog(): SupplierServiceCatalogEntry[] {
  return SUPPLIER_SERVICE_KINDS.map((kind) => ({
    id: kind,
    code: kind,
    kind,
    label: supplierServiceLabel(kind),
    description: supplierServiceDescription(kind),
  }));
}
