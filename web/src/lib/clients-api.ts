export const clientsBrowserBase = "/api/clients";

import type { DriverRecord } from "./drivers-api";
export type { DriverRecord };

export type ClientStatus = "active" | "inactive";

export type ClientRecord = {
  id: string;
  code: string;
  legalName: string;
  taxId: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  addressLine: string | null;
  tradeRegister: string | null;
  billingNotes: string | null;
  status: ClientStatus;
  notes: string | null;
  vehicleCount: number;
  remindersActionCount?: number;
  itpWithin30Days?: number;
  healthLabel?: string;
};

export type ClientListPayload = {
  items: ClientRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export type ClientSummaryVehicleRow = {
  id: string;
  registrationNumber: string;
  brand: string | null;
  model: string | null;
  status: string;
  odometerKm: number | null;
};

export type ClientSummaryActivityRow = {
  at: string;
  kind: "trip" | "cost" | "maintenance";
  label: string;
  vehicleId: string;
  registrationNumber: string;
};

export type ClientSummaryPayload = {
  client: ClientRecord;
  kpis: {
    vehiclesActive: number;
    vehiclesTotal: number;
    remindersActionCount: number;
    costsMonthCents: number;
    tripsMonthCount: number;
    itpWithin30Days: number;
  };
  vehicles: ClientSummaryVehicleRow[];
  recentActivity: ClientSummaryActivityRow[];
  subscriptions: ClientSubscriptionRow[];
  drivers: DriverRecord[];
};

export type ClientProfileTab =
  | "overview"
  | "vehicles"
  | "drivers"
  | "subscription"
  | "mail"
  | "pricing"
  | "suppliers";

export type ClientSupplierAllocationItem = {
  supplierId: string;
  code: string;
  legalName: string;
  category: string;
  status: string;
};

export type ClientSubscriptionRow = {
  assignmentId: string;
  status: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
  plan: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    billingCycle: string;
    priceCents: number;
    currency: string;
  };
};

export type ClientContactRecord = {
  id: string;
  clientId: string;
  fullName: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  sortOrder: number;
};

export type ClientDocumentRecord = {
  id: string;
  clientId: string;
  documentTypeCode: string;
  title: string;
  fileUrl: string;
  fileName: string | null;
  expiresOn: string | null;
  notes: string | null;
};

export function fleetJsonHeaders(): HeadersInit {
  return { "Content-Type": "application/json" };
}

export function clientOpsQuery(clientCode: string): string {
  return `clientId=${encodeURIComponent(clientCode)}`;
}
