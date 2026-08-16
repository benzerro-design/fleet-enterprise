export type PartsCatalogProviderId = "intercars" | "other";

export type PartsCatalogProviderSetting = {
  id: PartsCatalogProviderId;
  label: string;
  enabled: boolean;
};

export type TenantIntegrationsSettings = {
  audatexImportEnabled: boolean;
  partsCatalogEnabled: boolean;
  partsCatalogProviders: PartsCatalogProviderSetting[];
  partsOrderLaunchEnabled: boolean;
};

export const DEFAULT_TENANT_INTEGRATIONS_SETTINGS: TenantIntegrationsSettings = {
  audatexImportEnabled: true,
  partsCatalogEnabled: false,
  partsCatalogProviders: [
    { id: "intercars", label: "Inter Cars", enabled: false },
    { id: "other", label: "Alt catalog (viitor)", enabled: false },
  ],
  partsOrderLaunchEnabled: false,
};

export const integrationsSettingsBrowserBase = "/api/tenant/integrations-settings";
