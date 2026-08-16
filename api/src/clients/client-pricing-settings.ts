/** Setări comerciale pe client — override pe tenant workOrderSettings. */
export type ClientPricingSettings = {
  /**
   * Prag % peste oferta catalog pentru flag „suspect”.
   * `null` = moștenește Setup → WO → partsPriceSuspectPercent.
   */
  partsPriceSuspectPercent: number | null;
};

export const DEFAULT_CLIENT_PRICING_SETTINGS: ClientPricingSettings = {
  partsPriceSuspectPercent: null,
};

export function parseClientPricingSettings(raw: unknown): ClientPricingSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_CLIENT_PRICING_SETTINGS };
  }
  const o = raw as Record<string, unknown>;
  let partsPriceSuspectPercent: number | null = null;
  if (o.partsPriceSuspectPercent === null) {
    partsPriceSuspectPercent = null;
  } else if (
    typeof o.partsPriceSuspectPercent === 'number' &&
    Number.isFinite(o.partsPriceSuspectPercent) &&
    o.partsPriceSuspectPercent >= 0
  ) {
    partsPriceSuspectPercent = Math.min(500, Math.round(o.partsPriceSuspectPercent));
  }
  return { partsPriceSuspectPercent };
}

export function parseClientPricingSettingsPatch(body: unknown): Partial<ClientPricingSettings> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Invalid body');
  }
  const o = body as Record<string, unknown>;
  const patch: Partial<ClientPricingSettings> = {};
  if (o.partsPriceSuspectPercent !== undefined) {
    if (o.partsPriceSuspectPercent === null) {
      patch.partsPriceSuspectPercent = null;
    } else if (
      typeof o.partsPriceSuspectPercent === 'number' &&
      Number.isFinite(o.partsPriceSuspectPercent) &&
      o.partsPriceSuspectPercent >= 0
    ) {
      patch.partsPriceSuspectPercent = Math.min(500, Math.round(o.partsPriceSuspectPercent));
    } else {
      throw new Error('partsPriceSuspectPercent must be a non-negative number or null');
    }
  }
  return patch;
}
