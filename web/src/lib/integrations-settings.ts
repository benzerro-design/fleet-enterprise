export type PartsCatalogProviderId = "intercars" | "other";

export type PartsCatalogProviderSetting = {
  id: PartsCatalogProviderId;
  label: string;
  enabled: boolean;
};

export type InterCarsApiMode = "gateway" | "katalog_legacy";
export type InterCarsEnvironment = "sandbox" | "production";

export type InterCarsConnectorPublic = {
  mode: InterCarsApiMode;
  environment: InterCarsEnvironment;
  baseUrl: string | null;
  tokenUrl: string | null;
  clientId: string | null;
  customerCode: string | null;
  allowStubFallback: boolean;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastTestMessage: string | null;
  clientSecretSet: boolean;
  accessTokenSet: boolean;
  apiTokenSet: boolean;
};

export type TenantIntegrationsSettings = {
  audatexImportEnabled: boolean;
  partsCatalogEnabled: boolean;
  partsCatalogProviders: PartsCatalogProviderSetting[];
  partsOrderLaunchEnabled: boolean;
  interCars: InterCarsConnectorPublic;
};

export const DEFAULT_TENANT_INTEGRATIONS_SETTINGS: TenantIntegrationsSettings = {
  audatexImportEnabled: true,
  partsCatalogEnabled: false,
  partsCatalogProviders: [
    { id: "intercars", label: "Inter Cars", enabled: false },
    { id: "other", label: "Alt catalog (viitor)", enabled: false },
  ],
  partsOrderLaunchEnabled: false,
  interCars: {
    mode: "gateway",
    environment: "sandbox",
    baseUrl: null,
    tokenUrl: null,
    clientId: null,
    customerCode: null,
    allowStubFallback: true,
    lastTestAt: null,
    lastTestOk: null,
    lastTestMessage: null,
    clientSecretSet: false,
    accessTokenSet: false,
    apiTokenSet: false,
  },
};

export const integrationsSettingsBrowserBase = "/api/tenant/integrations-settings";
