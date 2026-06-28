export const clientsBrowserBase = "/api/clients";

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
};

export type ClientProfileTab = "overview" | "vehicles";

export function fleetJsonHeaders(): HeadersInit {
  return { "Content-Type": "application/json" };
}

export function clientOpsQuery(clientCode: string): string {
  return `clientId=${encodeURIComponent(clientCode)}`;
}
