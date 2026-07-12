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
  kind: SupplierServiceKind;
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

export function supplierServiceLabel(kind: SupplierServiceKind): string {
  const map: Record<SupplierServiceKind, string> = {
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

export function supplierServiceDescription(kind: SupplierServiceKind): string {
  const map: Record<SupplierServiceKind, string> = {
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
    kind,
    label: supplierServiceLabel(kind),
    description: supplierServiceDescription(kind),
  }));
}
