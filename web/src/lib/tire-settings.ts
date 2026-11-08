export type TireSettings = {
  hotelBillingUnit: "piece";
  hotelBillingPeriod: "calendar_month";
  hotelMinBillableMonths: number;
  hotelTicketHidesServiceFlow: boolean;
  seasonalSwapEnabled: boolean;
};

export const DEFAULT_TIRE_SETTINGS: TireSettings = {
  hotelBillingUnit: "piece",
  hotelBillingPeriod: "calendar_month",
  hotelMinBillableMonths: 1,
  hotelTicketHidesServiceFlow: true,
  seasonalSwapEnabled: true,
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
  return base;
}
