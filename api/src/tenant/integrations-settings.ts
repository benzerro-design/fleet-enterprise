export type PartsCatalogProviderId = 'intercars' | 'other';

export type PartsCatalogProviderSetting = {
  id: PartsCatalogProviderId;
  label: string;
  enabled: boolean;
};

/** IC REST gateway (webapi) sau Katalog ONLINE External (legacy kh_kod+token). */
export type InterCarsApiMode = 'gateway' | 'katalog_legacy';

export type InterCarsEnvironment = 'sandbox' | 'production';

/**
 * Credențiale Inter Cars pe tenant.
 * Secret-urile se salvează în JSON tenant; GET le maschează (doar *Set flags).
 */
export type InterCarsConnectorSettings = {
  mode: InterCarsApiMode;
  environment: InterCarsEnvironment;
  /** Override base URL (ex. https://dev.gw.intercars.eu). */
  baseUrl: string | null;
  /** OAuth token URL (gateway). Null = default pe environment. */
  tokenUrl: string | null;
  clientId: string | null;
  /** Scris doar la PATCH; nu e returnat în GET. */
  clientSecret: string | null;
  /** Bearer token manual (alternativă la client credentials). */
  accessToken: string | null;
  /** Katalog legacy: kh_kod. */
  customerCode: string | null;
  /** Katalog legacy: token header. */
  apiToken: string | null;
  /** Dacă API eșuează / fără credențiale — folosește stub determinist. */
  allowStubFallback: boolean;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastTestMessage: string | null;
};

export type TenantIntegrationsSettings = {
  audatexImportEnabled: boolean;
  partsCatalogEnabled: boolean;
  partsCatalogProviders: PartsCatalogProviderSetting[];
  partsOrderLaunchEnabled: boolean;
  interCars: InterCarsConnectorSettings;
};

export const DEFAULT_INTER_CARS_SETTINGS: InterCarsConnectorSettings = {
  mode: 'gateway',
  environment: 'sandbox',
  baseUrl: null,
  tokenUrl: null,
  clientId: null,
  clientSecret: null,
  accessToken: null,
  customerCode: null,
  apiToken: null,
  allowStubFallback: true,
  lastTestAt: null,
  lastTestOk: null,
  lastTestMessage: null,
};

export const DEFAULT_TENANT_INTEGRATIONS_SETTINGS: TenantIntegrationsSettings = {
  audatexImportEnabled: true,
  partsCatalogEnabled: false,
  partsCatalogProviders: [
    { id: 'intercars', label: 'Inter Cars', enabled: false },
    { id: 'other', label: 'Alt catalog (viitor)', enabled: false },
  ],
  partsOrderLaunchEnabled: false,
  interCars: { ...DEFAULT_INTER_CARS_SETTINGS },
};

/** Răspuns public — fără secrete. */
export type InterCarsConnectorPublic = Omit<
  InterCarsConnectorSettings,
  'clientSecret' | 'accessToken' | 'apiToken'
> & {
  clientSecretSet: boolean;
  accessTokenSet: boolean;
  apiTokenSet: boolean;
};

export type TenantIntegrationsSettingsPublic = Omit<TenantIntegrationsSettings, 'interCars'> & {
  interCars: InterCarsConnectorPublic;
};

function parseProviders(raw: unknown): PartsCatalogProviderSetting[] {
  const defaults = DEFAULT_TENANT_INTEGRATIONS_SETTINGS.partsCatalogProviders;
  if (!Array.isArray(raw)) return defaults.map((p) => ({ ...p }));
  const byId = new Map<string, PartsCatalogProviderSetting>();
  for (const d of defaults) byId.set(d.id, { ...d });
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    if (o.id !== 'intercars' && o.id !== 'other') continue;
    const prev = byId.get(o.id) ?? {
      id: o.id,
      label: o.id === 'intercars' ? 'Inter Cars' : 'Alt catalog (viitor)',
      enabled: false,
    };
    byId.set(o.id, {
      id: o.id,
      label: typeof o.label === 'string' && o.label.trim() ? o.label.trim() : prev.label,
      enabled: o.enabled === true,
    });
  }
  return [...byId.values()];
}

function parseOptionalString(raw: unknown): string | null {
  if (raw === null) return null;
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length ? t : null;
}

export function parseInterCarsSettings(raw: unknown): InterCarsConnectorSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_INTER_CARS_SETTINGS };
  }
  const o = raw as Record<string, unknown>;
  const mode: InterCarsApiMode = o.mode === 'katalog_legacy' ? 'katalog_legacy' : 'gateway';
  const environment: InterCarsEnvironment =
    o.environment === 'production' ? 'production' : 'sandbox';
  return {
    mode,
    environment,
    baseUrl: parseOptionalString(o.baseUrl),
    tokenUrl: parseOptionalString(o.tokenUrl),
    clientId: parseOptionalString(o.clientId),
    clientSecret: parseOptionalString(o.clientSecret),
    accessToken: parseOptionalString(o.accessToken),
    customerCode: parseOptionalString(o.customerCode),
    apiToken: parseOptionalString(o.apiToken),
    allowStubFallback:
      typeof o.allowStubFallback === 'boolean'
        ? o.allowStubFallback
        : DEFAULT_INTER_CARS_SETTINGS.allowStubFallback,
    lastTestAt: parseOptionalString(o.lastTestAt),
    lastTestOk: typeof o.lastTestOk === 'boolean' ? o.lastTestOk : null,
    lastTestMessage: parseOptionalString(o.lastTestMessage),
  };
}

export function toInterCarsPublic(cfg: InterCarsConnectorSettings): InterCarsConnectorPublic {
  return {
    mode: cfg.mode,
    environment: cfg.environment,
    baseUrl: cfg.baseUrl,
    tokenUrl: cfg.tokenUrl,
    clientId: cfg.clientId,
    customerCode: cfg.customerCode,
    allowStubFallback: cfg.allowStubFallback,
    lastTestAt: cfg.lastTestAt,
    lastTestOk: cfg.lastTestOk,
    lastTestMessage: cfg.lastTestMessage,
    clientSecretSet: Boolean(cfg.clientSecret),
    accessTokenSet: Boolean(cfg.accessToken),
    apiTokenSet: Boolean(cfg.apiToken),
  };
}

export function toIntegrationsSettingsPublic(
  settings: TenantIntegrationsSettings,
): TenantIntegrationsSettingsPublic {
  return {
    audatexImportEnabled: settings.audatexImportEnabled,
    partsCatalogEnabled: settings.partsCatalogEnabled,
    partsCatalogProviders: settings.partsCatalogProviders.map((p) => ({ ...p })),
    partsOrderLaunchEnabled: settings.partsOrderLaunchEnabled,
    interCars: toInterCarsPublic(settings.interCars),
  };
}

export function parseTenantIntegrationsSettings(raw: unknown): TenantIntegrationsSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ...DEFAULT_TENANT_INTEGRATIONS_SETTINGS,
      partsCatalogProviders: DEFAULT_TENANT_INTEGRATIONS_SETTINGS.partsCatalogProviders.map((p) => ({
        ...p,
      })),
      interCars: { ...DEFAULT_INTER_CARS_SETTINGS },
    };
  }
  const o = raw as Record<string, unknown>;
  return {
    audatexImportEnabled:
      typeof o.audatexImportEnabled === 'boolean'
        ? o.audatexImportEnabled
        : DEFAULT_TENANT_INTEGRATIONS_SETTINGS.audatexImportEnabled,
    partsCatalogEnabled:
      typeof o.partsCatalogEnabled === 'boolean'
        ? o.partsCatalogEnabled
        : DEFAULT_TENANT_INTEGRATIONS_SETTINGS.partsCatalogEnabled,
    partsCatalogProviders: parseProviders(o.partsCatalogProviders),
    partsOrderLaunchEnabled:
      typeof o.partsOrderLaunchEnabled === 'boolean'
        ? o.partsOrderLaunchEnabled
        : DEFAULT_TENANT_INTEGRATIONS_SETTINGS.partsOrderLaunchEnabled,
    interCars: parseInterCarsSettings(o.interCars),
  };
}

export function parseTenantIntegrationsSettingsPatch(
  body: unknown,
): Partial<TenantIntegrationsSettings> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Invalid body');
  }
  const o = body as Record<string, unknown>;
  const patch: Partial<TenantIntegrationsSettings> = {};
  if (o.audatexImportEnabled !== undefined) {
    if (typeof o.audatexImportEnabled !== 'boolean') {
      throw new Error('audatexImportEnabled must be boolean');
    }
    patch.audatexImportEnabled = o.audatexImportEnabled;
  }
  if (o.partsCatalogEnabled !== undefined) {
    if (typeof o.partsCatalogEnabled !== 'boolean') {
      throw new Error('partsCatalogEnabled must be boolean');
    }
    patch.partsCatalogEnabled = o.partsCatalogEnabled;
  }
  if (o.partsOrderLaunchEnabled !== undefined) {
    if (typeof o.partsOrderLaunchEnabled !== 'boolean') {
      throw new Error('partsOrderLaunchEnabled must be boolean');
    }
    patch.partsOrderLaunchEnabled = o.partsOrderLaunchEnabled;
  }
  if (o.partsCatalogProviders !== undefined) {
    patch.partsCatalogProviders = parseProviders(o.partsCatalogProviders);
  }
  if (o.interCars !== undefined) {
    if (!o.interCars || typeof o.interCars !== 'object' || Array.isArray(o.interCars)) {
      throw new Error('interCars must be an object');
    }
    const ic = o.interCars as Record<string, unknown>;
    const icPatch: Partial<InterCarsConnectorSettings> = {};
    if (ic.mode !== undefined) {
      if (ic.mode !== 'gateway' && ic.mode !== 'katalog_legacy') {
        throw new Error('interCars.mode must be gateway | katalog_legacy');
      }
      icPatch.mode = ic.mode;
    }
    if (ic.environment !== undefined) {
      if (ic.environment !== 'sandbox' && ic.environment !== 'production') {
        throw new Error('interCars.environment must be sandbox | production');
      }
      icPatch.environment = ic.environment;
    }
    if (ic.baseUrl !== undefined) icPatch.baseUrl = parseOptionalString(ic.baseUrl);
    if (ic.tokenUrl !== undefined) icPatch.tokenUrl = parseOptionalString(ic.tokenUrl);
    if (ic.clientId !== undefined) icPatch.clientId = parseOptionalString(ic.clientId);
    if (ic.clientSecret !== undefined) {
      // empty string clears; omit keeps previous (handled in service merge)
      if (typeof ic.clientSecret !== 'string') throw new Error('interCars.clientSecret must be string');
      icPatch.clientSecret = ic.clientSecret.trim() || null;
    }
    if (ic.accessToken !== undefined) {
      if (typeof ic.accessToken !== 'string') throw new Error('interCars.accessToken must be string');
      icPatch.accessToken = ic.accessToken.trim() || null;
    }
    if (ic.customerCode !== undefined) icPatch.customerCode = parseOptionalString(ic.customerCode);
    if (ic.apiToken !== undefined) {
      if (typeof ic.apiToken !== 'string') throw new Error('interCars.apiToken must be string');
      icPatch.apiToken = ic.apiToken.trim() || null;
    }
    if (ic.allowStubFallback !== undefined) {
      if (typeof ic.allowStubFallback !== 'boolean') {
        throw new Error('interCars.allowStubFallback must be boolean');
      }
      icPatch.allowStubFallback = ic.allowStubFallback;
    }
    if (Object.keys(icPatch).length === 0) {
      throw new Error('interCars: no fields to update');
    }
    patch.interCars = icPatch as InterCarsConnectorSettings;
  }
  if (Object.keys(patch).length === 0) throw new Error('No settings to update');
  return patch;
}

export function mergeInterCarsPatch(
  current: InterCarsConnectorSettings,
  patch: Partial<InterCarsConnectorSettings>,
): InterCarsConnectorSettings {
  return {
    ...current,
    ...patch,
    // Explicit null clears; undefined in patch already omitted by spread of defined keys
    clientSecret:
      patch.clientSecret !== undefined ? patch.clientSecret : current.clientSecret,
    accessToken: patch.accessToken !== undefined ? patch.accessToken : current.accessToken,
    apiToken: patch.apiToken !== undefined ? patch.apiToken : current.apiToken,
  };
}

export function defaultInterCarsBaseUrl(environment: InterCarsEnvironment, mode: InterCarsApiMode): string {
  if (mode === 'katalog_legacy') {
    return 'https://katalog.intercars.com.pl';
  }
  return environment === 'production'
    ? 'https://gw.intercars.eu'
    : 'https://dev.gw.intercars.eu';
}

export function defaultInterCarsTokenUrl(environment: InterCarsEnvironment): string {
  const base = defaultInterCarsBaseUrl(environment, 'gateway');
  return `${base}/token`;
}

export function interCarsHasCredentials(cfg: InterCarsConnectorSettings): boolean {
  if (cfg.mode === 'katalog_legacy') {
    return Boolean(cfg.customerCode && cfg.apiToken);
  }
  if (cfg.accessToken) return true;
  return Boolean(cfg.clientId && cfg.clientSecret);
}
