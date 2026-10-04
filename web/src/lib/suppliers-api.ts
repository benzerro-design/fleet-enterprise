import { fleetJsonHeaders } from "@/lib/fleet-api";
import {
  fallbackServiceCatalog,
  supplierServiceDescription,
  supplierServiceLabel,
  type SupplierServiceCatalogEntry,
  type SupplierServiceKind,
} from "@/lib/supplier-service-catalog";

export type { SupplierServiceCatalogEntry, SupplierServiceKind };
export { supplierServiceLabel, supplierServiceDescription };

export const suppliersBrowserBase = "/api/suppliers";
export { fleetJsonHeaders };

export type SupplierStatus = "active" | "inactive" | "blocked";
export type SupplierCategory = string;

export type SupplierRecord = {
  id: string;
  code: string;
  legalName: string;
  taxId: string | null;
  iban?: string | null;
  category: SupplierCategory;
  status: SupplierStatus;
  contactEmail: string | null;
  contactPhone: string | null;
  addressLine: string | null;
  city: string | null;
  county: string | null;
  notes: string | null;
  slotCapacity?: number;
  partsDiscountPercent: number;
  laborDiscountPercent: number;
  laborRateMechanicalCents?: number | null;
  laborRateBodyCents?: number | null;
  laborRatePaintCents?: number | null;
  laborRateDiagnosticCents?: number | null;
  partsPriceBasis?: "list" | "net";
  pricingNotes?: string | null;
  services: string[];
  integrationEnabled: boolean;
  integrationKeyLast4: string | null;
  menuItems?: SupplierMenuItemRecord[];
  workOrderCount: number;
  createdAt: string;
  updatedAt: string;
};

export type SupplierMenuLineType = "parts" | "labor" | "other";

export type SupplierMenuItemRecord = {
  id: string;
  supplierId: string;
  label: string;
  description: string | null;
  lineType: SupplierMenuLineType;
  unitNetCents: number;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type SupplierMenuItemInput = {
  label?: string | null;
  description?: string | null;
  lineType?: SupplierMenuLineType;
  unitNetRon?: number | string | null;
  unitNetCents?: number | null;
  active?: boolean;
  sortOrder?: number | null;
};

export type SupplierDocumentKind = string;

export type SupplierDocumentRecord = {
  id: string;
  supplierId: string;
  kind: SupplierDocumentKind;
  title: string;
  fileUrl: string;
  fileName: string;
  mimeType: string | null;
  expiresOn: string | null;
  required: boolean;
  expiryStatus: "valid" | "expiring_soon" | "expired" | "none";
  daysLeft: number | null;
  uploadedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SupplierDocumentCompliance = {
  ok: boolean;
  expiredRequired: Array<{ id: string; title: string; expiresOn: string }>;
  expiringSoon: Array<{ id: string; title: string; expiresOn: string; daysLeft: number }>;
  missingRequiredKinds?: Array<{ code: string; label: string }>;
};

export type SupplierListPayload = {
  items: SupplierRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export type SupplierClientAllocationItem = {
  clientId: string;
  code: string;
  legalName: string;
  status: string;
};

export type SupplierStats = {
  total: number;
  active: number;
  inactive: number;
  blocked: number;
  openWorkOrders: number;
};

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

export async function loadSupplierServiceCatalog(): Promise<SupplierServiceCatalogEntry[]> {
  try {
    const res = await fetch(`${suppliersBrowserBase}/catalog/services`, { cache: "no-store" });
    if (!res.ok) return fallbackServiceCatalog();
    return (await res.json()) as SupplierServiceCatalogEntry[];
  } catch {
    return fallbackServiceCatalog();
  }
}

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

export function supplierMenuLineTypeLabel(type: SupplierMenuLineType): string {
  if (type === "parts") return "Piese";
  if (type === "labor") return "Manoperă";
  return "Altele";
}

export async function loadSupplierMenuItems(
  supplierId: string,
  opts: { all?: boolean } = {},
): Promise<{ items: SupplierMenuItemRecord[] }> {
  const url = `${suppliersBrowserBase}/${supplierId}/menu-items${opts.all ? "?all=1" : ""}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as { items: SupplierMenuItemRecord[] };
}

export async function createSupplierMenuItem(
  supplierId: string,
  input: SupplierMenuItemInput,
): Promise<SupplierMenuItemRecord> {
  const res = await fetch(`${suppliersBrowserBase}/${supplierId}/menu-items`, {
    method: "POST",
    headers: fleetJsonHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(j.message ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as SupplierMenuItemRecord;
}

export async function patchSupplierMenuItem(
  supplierId: string,
  itemId: string,
  input: SupplierMenuItemInput,
): Promise<SupplierMenuItemRecord> {
  const res = await fetch(`${suppliersBrowserBase}/${supplierId}/menu-items/${itemId}`, {
    method: "PATCH",
    headers: fleetJsonHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(j.message ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as SupplierMenuItemRecord;
}

export async function deactivateSupplierMenuItem(supplierId: string, itemId: string): Promise<void> {
  const res = await fetch(`${suppliersBrowserBase}/${supplierId}/menu-items/${itemId}`, {
    method: "DELETE",
    headers: fleetJsonHeaders(),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(j.message ?? `HTTP ${res.status}`);
  }
}
