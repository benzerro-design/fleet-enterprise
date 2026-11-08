export type TireSettings = {
  hotelBillingUnit: "piece";
  hotelBillingPeriod: "calendar_month";
  hotelMinBillableMonths: number;
  hotelTicketHidesServiceFlow: boolean;
  seasonalSwapEnabled: boolean;
  webhookUrl?: string | null;
  /** Never returned from API; UI uses webhookSecretConfigured. */
  webhookSecretConfigured?: boolean;
};

export const DEFAULT_TIRE_SETTINGS: TireSettings = {
  hotelBillingUnit: "piece",
  hotelBillingPeriod: "calendar_month",
  hotelMinBillableMonths: 1,
  hotelTicketHidesServiceFlow: true,
  seasonalSwapEnabled: true,
  webhookUrl: null,
  webhookSecretConfigured: false,
};

export const tireSettingsBrowserBase = "/api/tenant/tire-settings";

export function parseTireSettings(raw: unknown): TireSettings {
  const base = { ...DEFAULT_TIRE_SETTINGS };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;
  if (typeof o.hotelMinBillableMonths === "number" && Number.isFinite(o.hotelMinBillableMonths)) {
    base.hotelMinBillableMonths = Math.min(24, Math.max(1, Math.floor(o.hotelMinBillableMonths)));
  }
  if (typeof o.hotelTicketHidesServiceFlow === "boolean") {
    base.hotelTicketHidesServiceFlow = o.hotelTicketHidesServiceFlow;
  }
  if (typeof o.seasonalSwapEnabled === "boolean") {
    base.seasonalSwapEnabled = o.seasonalSwapEnabled;
  }
  if (o.webhookUrl === null) base.webhookUrl = null;
  else if (typeof o.webhookUrl === "string") base.webhookUrl = o.webhookUrl.trim() || null;
  if (typeof o.webhookSecretConfigured === "boolean") {
    base.webhookSecretConfigured = o.webhookSecretConfigured;
  }
  return base;
}
