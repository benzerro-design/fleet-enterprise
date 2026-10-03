/** Aliniat cu api/src/clients/client-sla-settings.ts */

export type SlaPriorityKey = "urgent" | "high" | "normal" | "low";

export type SlaPriorityHours = {
  firstResponseHours: number;
  resolveHours: number;
};

export type ClientSlaSettings = {
  override: boolean;
  priorities: Record<SlaPriorityKey, SlaPriorityHours>;
};

export const DEFAULT_CLIENT_SLA_SETTINGS: ClientSlaSettings = {
  override: false,
  priorities: {
    urgent: { firstResponseHours: 1, resolveHours: 8 },
    high: { firstResponseHours: 4, resolveHours: 24 },
    normal: { firstResponseHours: 8, resolveHours: 72 },
    low: { firstResponseHours: 24, resolveHours: 120 },
  },
};

export const SLA_PRIORITY_LABELS: Record<SlaPriorityKey, string> = {
  urgent: "Urgent",
  high: "High",
  normal: "Normal",
  low: "Low",
};
