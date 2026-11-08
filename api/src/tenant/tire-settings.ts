/**
 * Setup → Anvelope — politică hotel (comercial) + default-uri operaționale.
 * Tarifele pe furnizor/client rămân pe Supplier / ClientSupplierAllocation;
 * aici e interpretarea și default-urile de produs.
 */

export type TireSettings = {
  /** Catalog rates = per piece (not per set). */
  hotelBillingUnit: 'piece';
  /** Billing period = calendar month (not stay duration in days). */
  hotelBillingPeriod: 'calendar_month';
  /** Minimum months billed at check-in / open-stay preview. */
  hotelMinBillableMonths: number;
  /** On tire_storage tickets, demote atelier service CTA. */
  hotelTicketHidesServiceFlow: boolean;
  /** Show seasonal out/in block on WO tip R. */
  seasonalSwapEnabled: boolean;
};

export const DEFAULT_TIRE_SETTINGS: TireSettings = {
  hotelBillingUnit: 'piece',
  hotelBillingPeriod: 'calendar_month',
  hotelMinBillableMonths: 1,
  hotelTicketHidesServiceFlow: true,
  seasonalSwapEnabled: true,
};

export function parseTireSettings(raw: unknown): TireSettings {
  const base = { ...DEFAULT_TIRE_SETTINGS };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;
  if (o.hotelBillingUnit === 'piece') base.hotelBillingUnit = 'piece';
  if (o.hotelBillingPeriod === 'calendar_month') base.hotelBillingPeriod = 'calendar_month';
  if (typeof o.hotelMinBillableMonths === 'number' && Number.isFinite(o.hotelMinBillableMonths)) {
    base.hotelMinBillableMonths = Math.min(24, Math.max(1, Math.floor(o.hotelMinBillableMonths)));
  }
  if (typeof o.hotelTicketHidesServiceFlow === 'boolean') {
    base.hotelTicketHidesServiceFlow = o.hotelTicketHidesServiceFlow;
  }
  if (typeof o.seasonalSwapEnabled === 'boolean') {
    base.seasonalSwapEnabled = o.seasonalSwapEnabled;
  }
  return base;
}

export function parseTireSettingsPatch(body: unknown): Partial<TireSettings> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('body must be an object');
  }
  const o = body as Record<string, unknown>;
  const patch: Partial<TireSettings> = {};
  if (o.hotelMinBillableMonths !== undefined) {
    const n = Number(o.hotelMinBillableMonths);
    if (!Number.isFinite(n) || n < 1 || n > 24) {
      throw new Error('hotelMinBillableMonths must be 1–24');
    }
    patch.hotelMinBillableMonths = Math.floor(n);
  }
  if (o.hotelTicketHidesServiceFlow !== undefined) {
    if (typeof o.hotelTicketHidesServiceFlow !== 'boolean') {
      throw new Error('hotelTicketHidesServiceFlow must be boolean');
    }
    patch.hotelTicketHidesServiceFlow = o.hotelTicketHidesServiceFlow;
  }
  if (o.seasonalSwapEnabled !== undefined) {
    if (typeof o.seasonalSwapEnabled !== 'boolean') {
      throw new Error('seasonalSwapEnabled must be boolean');
    }
    patch.seasonalSwapEnabled = o.seasonalSwapEnabled;
  }
  // Unit/period locked to real-world model — accept only canonical values if sent.
  if (o.hotelBillingUnit !== undefined && o.hotelBillingUnit !== 'piece') {
    throw new Error('hotelBillingUnit must be "piece"');
  }
  if (o.hotelBillingPeriod !== undefined && o.hotelBillingPeriod !== 'calendar_month') {
    throw new Error('hotelBillingPeriod must be "calendar_month"');
  }
  if (o.hotelBillingUnit === 'piece') patch.hotelBillingUnit = 'piece';
  if (o.hotelBillingPeriod === 'calendar_month') patch.hotelBillingPeriod = 'calendar_month';
  return patch;
}
