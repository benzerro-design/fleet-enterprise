export type CatalogItem = {
  code: string;
  label: string;
  enabled: boolean;
  system: boolean;
};

export type OnboardingDocKindSetting = CatalogItem & {
  /** Implicit „obligatoriu” la upload pe fișa furnizorului. */
  requiredByDefault: boolean;
};

export type SupplierSettings = {
  /** Blochează accept/alocare WO dacă există docs required expirate. */
  blockOrdersOnExpiredRequiredDocs: boolean;
  /** Blochează dacă lipsește vreun tip de doc marcat requiredByDefault + enabled. */
  blockOrdersOnMissingRequiredKinds: boolean;
  /** Zile până la „expiră curând”. */
  expiringSoonDays: number;
  /** Capacitate slot implicită la onboarding. */
  defaultSlotCapacity: number;
  onboardingDocKinds: OnboardingDocKindSetting[];
  categories: CatalogItem[];
};

const CODE_RE = /^[a-z][a-z0-9_]{0,47}$/;

function slugCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toLowerCase().replace(/\s+/g, '_');
  return CODE_RE.test(code) ? code : null;
}

export const DEFAULT_ONBOARDING_DOC_KINDS: OnboardingDocKindSetting[] = [
  { code: 'onrc', label: 'Certificat ONRC', enabled: true, system: true, requiredByDefault: true },
  { code: 'cui_fiscal', label: 'CUI / Certificat fiscal', enabled: true, system: true, requiredByDefault: true },
  { code: 'rar_auth', label: 'Autorizație RAR service', enabled: true, system: true, requiredByDefault: false },
  { code: 'itp_auth', label: 'Autorizație ITP', enabled: true, system: true, requiredByDefault: false },
  { code: 'rc_professional', label: 'Poliță RC profesională', enabled: true, system: true, requiredByDefault: true },
  { code: 'other', label: 'Alt document', enabled: true, system: true, requiredByDefault: false },
];

export const DEFAULT_SUPPLIER_CATEGORIES: CatalogItem[] = [
  { code: 'service_auto', label: 'Service auto', enabled: true, system: true },
  { code: 'itp', label: 'ITP', enabled: true, system: true },
  { code: 'fuel', label: 'Combustibil', enabled: true, system: true },
  { code: 'tires', label: 'Anvelope', enabled: true, system: true },
  { code: 'insurer', label: 'Asigurător', enabled: true, system: true },
  { code: 'broker', label: 'Broker', enabled: true, system: true },
  { code: 'dealer', label: 'Dealer', enabled: true, system: true },
  { code: 'roadside_assistance', label: 'Asistență rutieră', enabled: true, system: true },
  { code: 'rent', label: 'Închirieri', enabled: true, system: true },
  { code: 'other', label: 'Altele', enabled: true, system: true },
];

const SYSTEM_DOC = new Set(DEFAULT_ONBOARDING_DOC_KINDS.map((d) => d.code));
const SYSTEM_CAT = new Set(DEFAULT_SUPPLIER_CATEGORIES.map((d) => d.code));

function normalizeCatalog(
  raw: unknown,
  defaults: CatalogItem[],
  systemCodes: Set<string>,
): CatalogItem[] {
  const parsed: CatalogItem[] = [];
  const seen = new Set<string>();
  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (!row || typeof row !== 'object') continue;
      const o = row as Record<string, unknown>;
      const code = slugCode(o.code);
      if (!code || seen.has(code)) continue;
      seen.add(code);
      const def = defaults.find((d) => d.code === code);
      parsed.push({
        code,
        label: typeof o.label === 'string' && o.label.trim() ? o.label.trim() : def?.label ?? code,
        enabled: typeof o.enabled === 'boolean' ? o.enabled : (def?.enabled ?? true),
        system: systemCodes.has(code),
      });
    }
  }
  for (const d of defaults) {
    if (!seen.has(d.code)) parsed.push({ ...d });
  }
  return parsed;
}

function normalizeDocKinds(raw: unknown): OnboardingDocKindSetting[] {
  const base = normalizeCatalog(raw, DEFAULT_ONBOARDING_DOC_KINDS, SYSTEM_DOC);
  const byCode = new Map<string, { requiredByDefault?: boolean }>();
  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (!row || typeof row !== 'object') continue;
      const o = row as Record<string, unknown>;
      const code = slugCode(o.code);
      if (!code) continue;
      byCode.set(code, {
        requiredByDefault: typeof o.requiredByDefault === 'boolean' ? o.requiredByDefault : undefined,
      });
    }
  }
  return base.map((b) => {
    const def = DEFAULT_ONBOARDING_DOC_KINDS.find((d) => d.code === b.code);
    const ov = byCode.get(b.code);
    return {
      ...b,
      requiredByDefault:
        ov?.requiredByDefault !== undefined
          ? ov.requiredByDefault
          : (def?.requiredByDefault ?? false),
    };
  });
}

export const DEFAULT_SUPPLIER_SETTINGS: SupplierSettings = {
  blockOrdersOnExpiredRequiredDocs: true,
  blockOrdersOnMissingRequiredKinds: false,
  expiringSoonDays: 60,
  defaultSlotCapacity: 1,
  onboardingDocKinds: DEFAULT_ONBOARDING_DOC_KINDS.map((s) => ({ ...s })),
  categories: DEFAULT_SUPPLIER_CATEGORIES.map((s) => ({ ...s })),
};

export function parseSupplierSettings(raw: unknown): SupplierSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ...DEFAULT_SUPPLIER_SETTINGS,
      onboardingDocKinds: DEFAULT_ONBOARDING_DOC_KINDS.map((s) => ({ ...s })),
      categories: DEFAULT_SUPPLIER_CATEGORIES.map((s) => ({ ...s })),
    };
  }
  const o = raw as Record<string, unknown>;
  const slot =
    typeof o.defaultSlotCapacity === 'number' &&
    Number.isFinite(o.defaultSlotCapacity) &&
    o.defaultSlotCapacity >= 1
      ? Math.min(50, Math.round(o.defaultSlotCapacity))
      : DEFAULT_SUPPLIER_SETTINGS.defaultSlotCapacity;
  const soon =
    typeof o.expiringSoonDays === 'number' &&
    Number.isFinite(o.expiringSoonDays) &&
    o.expiringSoonDays >= 1
      ? Math.min(365, Math.round(o.expiringSoonDays))
      : DEFAULT_SUPPLIER_SETTINGS.expiringSoonDays;
  return {
    blockOrdersOnExpiredRequiredDocs:
      typeof o.blockOrdersOnExpiredRequiredDocs === 'boolean'
        ? o.blockOrdersOnExpiredRequiredDocs
        : DEFAULT_SUPPLIER_SETTINGS.blockOrdersOnExpiredRequiredDocs,
    blockOrdersOnMissingRequiredKinds:
      typeof o.blockOrdersOnMissingRequiredKinds === 'boolean'
        ? o.blockOrdersOnMissingRequiredKinds
        : DEFAULT_SUPPLIER_SETTINGS.blockOrdersOnMissingRequiredKinds,
    expiringSoonDays: soon,
    defaultSlotCapacity: slot,
    onboardingDocKinds: normalizeDocKinds(o.onboardingDocKinds),
    categories: normalizeCatalog(o.categories, DEFAULT_SUPPLIER_CATEGORIES, SYSTEM_CAT),
  };
}

export function parseSupplierSettingsPatch(body: unknown): Partial<SupplierSettings> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid body');
  const o = body as Record<string, unknown>;
  const patch: Partial<SupplierSettings> = {};
  if (o.blockOrdersOnExpiredRequiredDocs !== undefined) {
    if (typeof o.blockOrdersOnExpiredRequiredDocs !== 'boolean') {
      throw new Error('blockOrdersOnExpiredRequiredDocs must be boolean');
    }
    patch.blockOrdersOnExpiredRequiredDocs = o.blockOrdersOnExpiredRequiredDocs;
  }
  if (o.blockOrdersOnMissingRequiredKinds !== undefined) {
    if (typeof o.blockOrdersOnMissingRequiredKinds !== 'boolean') {
      throw new Error('blockOrdersOnMissingRequiredKinds must be boolean');
    }
    patch.blockOrdersOnMissingRequiredKinds = o.blockOrdersOnMissingRequiredKinds;
  }
  if (o.expiringSoonDays !== undefined) {
    if (typeof o.expiringSoonDays !== 'number' || !Number.isFinite(o.expiringSoonDays) || o.expiringSoonDays < 1) {
      throw new Error('expiringSoonDays must be >= 1');
    }
    patch.expiringSoonDays = Math.min(365, Math.round(o.expiringSoonDays));
  }
  if (o.defaultSlotCapacity !== undefined) {
    if (
      typeof o.defaultSlotCapacity !== 'number' ||
      !Number.isFinite(o.defaultSlotCapacity) ||
      o.defaultSlotCapacity < 1
    ) {
      throw new Error('defaultSlotCapacity must be >= 1');
    }
    patch.defaultSlotCapacity = Math.min(50, Math.round(o.defaultSlotCapacity));
  }
  if (o.onboardingDocKinds !== undefined) {
    if (!Array.isArray(o.onboardingDocKinds) || o.onboardingDocKinds.length === 0) {
      throw new Error('onboardingDocKinds must be a non-empty array');
    }
    patch.onboardingDocKinds = normalizeDocKinds(o.onboardingDocKinds);
  }
  if (o.categories !== undefined) {
    if (!Array.isArray(o.categories) || o.categories.length === 0) {
      throw new Error('categories must be a non-empty array');
    }
    patch.categories = normalizeCatalog(o.categories, DEFAULT_SUPPLIER_CATEGORIES, SYSTEM_CAT);
  }
  if (Object.keys(patch).length === 0) throw new Error('No settings to update');
  return patch;
}

export function enabledSupplierCategoryCodes(settings: SupplierSettings): Set<string> {
  return new Set(settings.categories.filter((c) => c.enabled).map((c) => c.code));
}

export function requiredOnboardingKindCodes(settings: SupplierSettings): string[] {
  return settings.onboardingDocKinds
    .filter((k) => k.enabled && k.requiredByDefault)
    .map((k) => k.code);
}

export const supplierSettingsBrowserBase = "/api/tenant/supplier-settings";
