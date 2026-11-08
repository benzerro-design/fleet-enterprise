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
  /** Optional tenant webhook for stay check-in/out (product config). */
  webhookUrl?: string | null;
  /** HMAC secret for outbound stay webhooks (stored; never returned in GET). */
  webhookSecret?: string | null;
};

/** API-facing settings: secret is write-only. */
export type TireSettingsPublic = Omit<TireSettings, 'webhookSecret'> & {
  webhookSecretConfigured: boolean;
};

export const DEFAULT_TIRE_SETTINGS: TireSettings = {
  hotelBillingUnit: 'piece',
  hotelBillingPeriod: 'calendar_month',
  hotelMinBillableMonths: 1,
  hotelTicketHidesServiceFlow: true,
  seasonalSwapEnabled: true,
  webhookUrl: null,
  webhookSecret: null,
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
  if (o.webhookUrl === null) {
    base.webhookUrl = null;
  } else if (typeof o.webhookUrl === 'string') {
    const u = o.webhookUrl.trim();
    base.webhookUrl = u || null;
  }
  if (o.webhookSecret === null) {
    base.webhookSecret = null;
  } else if (typeof o.webhookSecret === 'string') {
    const s = o.webhookSecret.trim();
    base.webhookSecret = s || null;
  }
  return base;
}

export function toPublicTireSettings(settings: TireSettings): TireSettingsPublic {
  const { webhookSecret, ...rest } = settings;
  return {
    ...rest,
    webhookSecretConfigured: Boolean(webhookSecret?.trim()),
  };
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

  if ('webhookUrl' in o) {
    if (o.webhookUrl === null || o.webhookUrl === '') {
      patch.webhookUrl = null;
    } else if (typeof o.webhookUrl === 'string') {
      const u = o.webhookUrl.trim();
      if (u && !/^https?:\/\//i.test(u)) {
        throw new Error('webhookUrl must be http(s) URL');
      }
      patch.webhookUrl = u || null;
    } else {
      throw new Error('webhookUrl must be string or null');
    }
  }
  if ('webhookSecret' in o) {
    // Empty string = leave unchanged (write-only field UX); null clears.
    if (o.webhookSecret === null) {
      patch.webhookSecret = null;
    } else if (typeof o.webhookSecret === 'string') {
      if (o.webhookSecret.trim().length > 0) {
        patch.webhookSecret = o.webhookSecret.trim();
      }
      // empty string → omit from patch (keep existing)
    } else {
      throw new Error('webhookSecret must be string or null');
    }
  }
  return patch;
}
