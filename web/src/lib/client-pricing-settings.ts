export type ClientPricingSettings = {
  /** null = moștenește Setup → WO */
  partsPriceSuspectPercent: number | null;
};

export const DEFAULT_CLIENT_PRICING_SETTINGS: ClientPricingSettings = {
  partsPriceSuspectPercent: null,
};
