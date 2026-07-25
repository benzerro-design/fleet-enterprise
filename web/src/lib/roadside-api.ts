import { fleetJsonHeaders } from "@/lib/fleet-api";

export const roadsideBrowserBase = "/api/roadside";
export { fleetJsonHeaders };

export type RoadsideInterventionKind =
  | "tow"
  | "jump_start"
  | "tire_change"
  | "lockout"
  | "fuel_delivery"
  | "other";

export type RoadsideInterventionStatus =
  | "draft"
  | "requested"
  | "dispatched"
  | "on_site"
  | "completed"
  | "cancelled";

export const ROADSIDE_KINDS: RoadsideInterventionKind[] = [
  "tow",
  "jump_start",
  "tire_change",
  "lockout",
  "fuel_delivery",
  "other",
];

export const ROADSIDE_STATUSES: RoadsideInterventionStatus[] = [
  "draft",
  "requested",
  "dispatched",
  "on_site",
  "completed",
  "cancelled",
];

export type RoadsideInterventionRecord = {
  id: string;
  displayNumber: string | null;
  serviceCaseId: string;
  sourceTicketId: string | null;
  workOrderId: string | null;
  clientId: string;
  clientLegalName: string;
  vehicleId: string | null;
  vehicleReg: string | null;
  supplierId: string | null;
  supplierLegalName: string | null;
  kind: RoadsideInterventionKind;
  status: RoadsideInterventionStatus;
  locationText: string | null;
  requestedAt: string | null;
  dispatchedAt: string | null;
  onSiteAt: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RoadsideListPayload = {
  items: RoadsideInterventionRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export function roadsideKindLabel(kind: RoadsideInterventionKind | string): string {
  const map: Record<string, string> = {
    tow: "Tractare",
    jump_start: "Pornire acumulator",
    tire_change: "Schimbare roată",
    lockout: "Deblocare",
    fuel_delivery: "Alimentare",
    other: "Altele",
  };
  return map[kind] ?? kind;
}

export function roadsideStatusLabel(status: RoadsideInterventionStatus | string): string {
  const map: Record<string, string> = {
    draft: "Ciornă",
    requested: "Solicitată",
    dispatched: "Dispecerizată",
    on_site: "Pe loc",
    completed: "Finalizată",
    cancelled: "Anulată",
  };
  return map[status] ?? status;
}

export function isRoadsideActive(status: RoadsideInterventionStatus | string): boolean {
  return status === "requested" || status === "dispatched" || status === "on_site" || status === "completed";
}
