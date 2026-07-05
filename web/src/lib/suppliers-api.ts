import { fleetJsonHeaders } from "@/lib/fleet-api";

export const suppliersBrowserBase = "/api/suppliers";
export { fleetJsonHeaders };

export type SupplierStatus = "active" | "inactive" | "blocked";
export type SupplierCategory =
  | "service_auto"
  | "itp"
  | "fuel"
  | "tires"
  | "insurer"
  | "broker"
  | "dealer"
  | "roadside_assistance"
  | "rent"
  | "other";

export const SUPPLIER_CATEGORIES: SupplierCategory[] = [
  "service_auto",
  "itp",
  "fuel",
  "tires",
  "insurer",
  "broker",
  "dealer",
  "roadside_assistance",
  "rent",
  "other",
];

export type SupplierRecord = {
  id: string;
  code: string;
  legalName: string;
  taxId: string | null;
  category: SupplierCategory;
  status: SupplierStatus;
  contactEmail: string | null;
  contactPhone: string | null;
  addressLine: string | null;
  city: string | null;
  county: string | null;
  notes: string | null;
  workOrderCount: number;
  createdAt: string;
  updatedAt: string;
};

export type SupplierListPayload = {
  items: SupplierRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export function supplierCategoryLabel(c: SupplierCategory): string {
  const map: Record<SupplierCategory, string> = {
    service_auto: "Service auto",
    itp: "ITP",
    fuel: "Carburant",
    tires: "Anvelope / roți",
    insurer: "Asigurator",
    broker: "Broker",
    dealer: "Dealer",
    roadside_assistance: "Asistență rutieră",
    rent: "Rent",
    other: "Altele",
  };
  return map[c] ?? c;
}

export function supplierStatusLabel(s: SupplierStatus): string {
  if (s === "active") return "Activ";
  if (s === "inactive") return "Inactiv";
  return "Blocat";
}
