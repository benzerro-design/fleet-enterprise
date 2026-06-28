import { fleetJsonHeaders } from "@/lib/fleet-api";

/** Proxy Next → API Nest pentru tichete CRM. */
export const ticketsBrowserBase = "/api/tickets";

export type TicketStatus = "open" | "in_progress" | "resolved" | "cancelled";
export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type TicketRoutingLevel = "L0" | "L1" | "L1N" | "L_STAR";
export type TicketType =
  | "itp"
  | "damage"
  | "maintenance"
  | "document"
  | "transport"
  | "technical"
  | "other";
export type TicketEventKind = "comment" | "routing" | "transform" | "status";
export type TicketLinkEntityType = "maintenance" | "cost" | "trip" | "reminder" | "document";

export type TicketRecord = {
  id: string;
  displayId: string;
  clientId: string;
  clientCode: string;
  clientLegalName: string;
  ticketType: TicketType;
  subject: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  routingLevel: TicketRoutingLevel;
  assignedQueue: string;
  vehicleId: string | null;
  registrationNumber: string | null;
  vehicleOdometerKm: number | null;
  driverId: string | null;
  driverFullName: string | null;
  reminderActionId: string | null;
  createdByUserId: string | null;
  createdByEmail: string | null;
  ownerUserId: string | null;
  ownerEmail: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TicketEventRecord = {
  id: string;
  kind: TicketEventKind;
  body: string | null;
  payload: unknown;
  actorUserId: string | null;
  actorEmail: string | null;
  actorRoutingLevel: TicketRoutingLevel | null;
  actorDisplayName: string | null;
  createdAt: string;
};

export type TicketLinkRecord = {
  id: string;
  entityType: TicketLinkEntityType;
  entityId: string;
  createdAt: string;
};

export type TicketListPayload = {
  items: TicketRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export type TicketDetailPayload = {
  ticket: TicketRecord;
  events: TicketEventRecord[];
  links: TicketLinkRecord[];
};

export type TicketStats = {
  open: number;
  inProgress: number;
  lstarQueue: number;
  resolvedLast7Days: number;
};

export type TicketBoardPayload = {
  columns: Array<{ status: TicketStatus; items: TicketRecord[] }>;
  lstar: TicketRecord[];
};

export function ticketStatusLabel(status: TicketStatus): string {
  switch (status) {
    case "open":
      return "Deschis";
    case "in_progress":
      return "În lucru";
    case "resolved":
      return "Rezolvat";
    case "cancelled":
      return "Anulat";
  }
}

export function ticketPriorityLabel(priority: TicketPriority): string {
  switch (priority) {
    case "low":
      return "Scăzută";
    case "normal":
      return "Normală";
    case "high":
      return "Ridicată";
    case "urgent":
      return "Urgentă";
  }
}

export function ticketRoutingLabel(level: TicketRoutingLevel): string {
  switch (level) {
    case "L0":
      return "L0";
    case "L1":
      return "L1";
    case "L1N":
      return "L1+N";
    case "L_STAR":
      return "L★";
  }
}

export function ticketTypeLabel(type: TicketType): string {
  switch (type) {
    case "itp":
      return "ITP";
    case "damage":
      return "Daună";
    case "maintenance":
      return "Mentenanță";
    case "document":
      return "Document";
    case "transport":
      return "Transport";
    case "technical":
      return "Tehnic";
    case "other":
      return "Altele";
  }
}

export const TICKET_TYPES: Array<{ value: TicketType; label: string }> = [
  { value: "technical", label: "Tehnic" },
  { value: "maintenance", label: "Mentenanță" },
  { value: "itp", label: "ITP" },
  { value: "damage", label: "Daună" },
  { value: "document", label: "Document" },
  { value: "transport", label: "Transport" },
  { value: "other", label: "Altele" },
];

export function ticketEventKindLabel(kind: TicketEventKind): string {
  switch (kind) {
    case "comment":
      return "Comentariu";
    case "routing":
      return "Rutare";
    case "transform":
      return "Transformare";
    case "status":
      return "Status";
  }
}

export function ticketLinkHref(link: TicketLinkRecord): string | null {
  switch (link.entityType) {
    case "maintenance":
      return `/fleet/maintenance/${link.entityId}`;
    case "cost":
      return `/fleet/costs/${link.entityId}/edit`;
    case "trip":
      return `/fleet/trips`;
    case "reminder":
      return `/fleet/reminders/${link.entityId}`;
    case "document":
      return `/fleet/documents/${link.entityId}`;
    default:
      return null;
  }
}

export { fleetJsonHeaders };
