export const clientsBrowserBase = "/api/clients";

export type ClientStatus = "active" | "inactive";

export type ClientRecord = {
  id: string;
  code: string;
  legalName: string;
  taxId: string | null;
  status: ClientStatus;
  notes: string | null;
  vehicleCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ClientListPayload = {
  items: ClientRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export function fleetJsonHeaders(): HeadersInit {
  return { "Content-Type": "application/json" };
}
