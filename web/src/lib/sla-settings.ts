/** Tipuri aliniate cu api/src/tenant/sla-settings.ts (CRM-010 / SETUP-004). */

export type PriorityKey = "urgent" | "high" | "normal" | "low";

export type TicketTypeKey =
  | "damage"
  | "technical"
  | "maintenance"
  | "itp"
  | "transport"
  | "document"
  | "other";

export type SlaPriorityHours = {
  firstResponseHours: number;
  resolveHours: number;
};

export type TenantSlaSettings = {
  enabled: boolean;
  autoPrioritizeFromType: boolean;
  priorities: Record<PriorityKey, SlaPriorityHours>;
  priorityByType: Record<TicketTypeKey, PriorityKey>;
};

export const PRIORITY_LABELS: Record<PriorityKey, string> = {
  urgent: "Urgentă",
  high: "Ridicată",
  normal: "Normală",
  low: "Scăzută",
};

export const TICKET_TYPE_LABELS: Record<TicketTypeKey, string> = {
  damage: "Daună",
  technical: "Tehnic",
  maintenance: "Mentenanță",
  itp: "ITP",
  transport: "Transport",
  document: "Document",
  other: "Altele",
};

export const TICKET_TYPES_FOR_SLA: TicketTypeKey[] = [
  "damage",
  "technical",
  "maintenance",
  "itp",
  "transport",
  "document",
  "other",
];

export const DEFAULT_PRIORITY_BY_TYPE: Record<TicketTypeKey, PriorityKey> = {
  damage: "urgent",
  technical: "high",
  maintenance: "normal",
  itp: "normal",
  transport: "normal",
  document: "low",
  other: "normal",
};

export const DEFAULT_SLA_SETTINGS: TenantSlaSettings = {
  enabled: true,
  autoPrioritizeFromType: true,
  priorities: {
    urgent: { firstResponseHours: 1, resolveHours: 8 },
    high: { firstResponseHours: 4, resolveHours: 24 },
    normal: { firstResponseHours: 8, resolveHours: 72 },
    low: { firstResponseHours: 24, resolveHours: 120 },
  },
  priorityByType: { ...DEFAULT_PRIORITY_BY_TYPE },
};

export function normalizeSlaSettings(raw: Partial<TenantSlaSettings> | null | undefined): TenantSlaSettings {
  const base = DEFAULT_SLA_SETTINGS;
  if (!raw || typeof raw !== "object") {
    return {
      ...base,
      priorities: {
        urgent: { ...base.priorities.urgent },
        high: { ...base.priorities.high },
        normal: { ...base.priorities.normal },
        low: { ...base.priorities.low },
      },
      priorityByType: { ...base.priorityByType },
    };
  }
  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : base.enabled,
    autoPrioritizeFromType:
      typeof raw.autoPrioritizeFromType === "boolean"
        ? raw.autoPrioritizeFromType
        : base.autoPrioritizeFromType,
    priorities: {
      urgent: { ...base.priorities.urgent, ...(raw.priorities?.urgent ?? {}) },
      high: { ...base.priorities.high, ...(raw.priorities?.high ?? {}) },
      normal: { ...base.priorities.normal, ...(raw.priorities?.normal ?? {}) },
      low: { ...base.priorities.low, ...(raw.priorities?.low ?? {}) },
    },
    priorityByType: {
      ...base.priorityByType,
      ...(raw.priorityByType ?? {}),
    },
  };
}
