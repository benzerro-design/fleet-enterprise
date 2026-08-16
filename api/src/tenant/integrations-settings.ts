export type PartsCatalogProviderId = 'intercars' | 'other';

export type PartsCatalogProviderSetting = {
  id: PartsCatalogProviderId;
  label: string;
  enabled: boolean;
};

export type TenantIntegrationsSettings = {
  /** Import PDF / Audatex → linii de deviz (preview + ciornă). */
  audatexImportEnabled: boolean;
  /** Lookup / verificare preț piese (conectori — stub până la API real). */
  partsCatalogEnabled: boolean;
  partsCatalogProviders: PartsCatalogProviderSetting[];
  /** Lansare comenzi piese după aprobare (stub UI până la conectori). */
  partsOrderLaunchEnabled: boolean;
};

export const DEFAULT_TENANT_INTEGRATIONS_SETTINGS: TenantIntegrationsSettings = {
  audatexImportEnabled: true,
  partsCatalogEnabled: false,
  partsCatalogProviders: [
    { id: 'intercars', label: 'Inter Cars', enabled: false },
    { id: 'other', label: 'Alt catalog (viitor)', enabled: false },
  ],
  partsOrderLaunchEnabled: false,
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

export function parseTenantIntegrationsSettings(raw: unknown): TenantIntegrationsSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ...DEFAULT_TENANT_INTEGRATIONS_SETTINGS,
      partsCatalogProviders: DEFAULT_TENANT_INTEGRATIONS_SETTINGS.partsCatalogProviders.map((p) => ({
        ...p,
      })),
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
  if (Object.keys(patch).length === 0) throw new Error('No settings to update');
  return patch;
}
