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
export type TicketCommentAttachment = {
  url: string;
  name: string;
  mimeType?: string;
};

export type TicketEventKind = "comment" | "routing" | "transform" | "status" | "odometer";
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
  eventOdometerKm: number | null;
  createdAt: string;
  updatedAt: string;
};

export type TicketEventRecord = {
  id: string;
  kind: TicketEventKind;
  body: string | null;
  payload: unknown;
  parentEventId: string | null;
  editedAt: string | null;
  actorUserId: string | null;
  actorEmail: string | null;
  actorRoutingLevel: TicketRoutingLevel | null;
  actorDisplayName: string | null;
  createdAt: string;
};

export type TicketEventReaction = {
  emoji: string;
  userId: string;
  displayName: string;
};

export type TicketNotificationRecord = {
  id: string;
  ticketId: string;
  eventId: string | null;
  kind: "mention";
  body: string;
  readAt: string | null;
  createdAt: string;
  ticketDisplayId: string;
  ticketSubject: string;
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
    case "odometer":
      return "Odometru";
  }
}

export function ticketEventAttachments(ev: TicketEventRecord): TicketCommentAttachment[] {
  if (!ev.payload || typeof ev.payload !== "object") return [];
  const raw = (ev.payload as { attachments?: unknown }).attachments;
  if (!Array.isArray(raw)) return [];
  const out: TicketCommentAttachment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const url = "url" in item && typeof item.url === "string" ? item.url.trim() : "";
    const name = "name" in item && typeof item.name === "string" ? item.name.trim() : "";
    if (!url || !name) continue;
    const mimeType =
      "mimeType" in item && typeof item.mimeType === "string" ? item.mimeType.trim() : undefined;
    out.push({ url, name, mimeType: mimeType || undefined });
  }
  return out;
}

export function ticketEventRawBody(ev: TicketEventRecord): string | null {
  if (!ev.payload || typeof ev.payload !== "object") return null;
  const raw = (ev.payload as { rawBody?: unknown }).rawBody;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export function ticketEventReactions(ev: TicketEventRecord): TicketEventReaction[] {
  if (!ev.payload || typeof ev.payload !== "object") return [];
  const raw = (ev.payload as { reactions?: unknown }).reactions;
  if (!Array.isArray(raw)) return [];
  const out: TicketEventReaction[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const emoji = "emoji" in item && typeof item.emoji === "string" ? item.emoji : "";
    const userId = "userId" in item && typeof item.userId === "string" ? item.userId : "";
    const displayName =
      "displayName" in item && typeof item.displayName === "string" ? item.displayName : "";
    if (!emoji || !userId) continue;
    out.push({ emoji, userId, displayName: displayName || "?" });
  }
  return out;
}

export function ticketEventForwardMeta(ev: TicketEventRecord): {
  ticketId: string;
  displayId: string;
} | null {
  if (!ev.payload || typeof ev.payload !== "object") return null;
  const p = ev.payload as { forwardedFromTicketId?: unknown; forwardedFromDisplayId?: unknown };
  const ticketId =
    typeof p.forwardedFromTicketId === "string" ? p.forwardedFromTicketId.trim() : "";
  const displayId =
    typeof p.forwardedFromDisplayId === "string" ? p.forwardedFromDisplayId.trim() : "";
  if (!ticketId) return null;
  return { ticketId, displayId: displayId || ticketId.slice(-6).toUpperCase() };
}

/** Prefer rawBody; fallback to stripping actor prefix from display body. */
export function ticketCommentText(ev: TicketEventRecord): string | null {
  const raw = ticketEventRawBody(ev);
  if (raw) return raw;
  const body = ev.body?.trim();
  if (!body) return null;
  const name = ev.actorDisplayName;
  if (!name) return body;
  const prefix = `${name} (`;
  if (body.startsWith(prefix)) {
    const close = body.indexOf("): ");
    if (close > 0) return body.slice(close + 3).trim() || null;
  }
  return body;
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
