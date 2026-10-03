export type ImportEntitySetting = {
  code: string;
  label: string;
  enabled: boolean;
  system: boolean;
};

export type ImportTemplateSetting = {
  id: string;
  entity: string;
  name: string;
  columns: string[];
  enabled: boolean;
  system: boolean;
};

export type ImportSettings = {
  allowTenantAdminImport: boolean;
  allowClientAdminImport: boolean;
  requireDryRun: boolean;
  entities: ImportEntitySetting[];
  templates: ImportTemplateSetting[];
};

const CODE_RE = /^[a-z][a-z0-9_]{0,47}$/;

function slugCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toLowerCase().replace(/\s+/g, '_');
  return CODE_RE.test(code) ? code : null;
}

export const DEFAULT_IMPORT_ENTITIES: ImportEntitySetting[] = [
  { code: 'vehicles', label: 'Vehicule', enabled: true, system: true },
  { code: 'drivers', label: 'Șoferi', enabled: true, system: true },
  { code: 'suppliers', label: 'Furnizori', enabled: true, system: true },
  { code: 'costs', label: 'Costuri', enabled: true, system: true },
  { code: 'documents', label: 'Documente flotă', enabled: true, system: true },
];

export const DEFAULT_IMPORT_TEMPLATES: ImportTemplateSetting[] = [
  {
    id: 'vehicles_basic',
    entity: 'vehicles',
    name: 'Vehicule — de bază',
    columns: ['registrationNumber', 'vin', 'brand', 'model', 'year', 'clientCode'],
    enabled: true,
    system: true,
  },
  {
    id: 'drivers_basic',
    entity: 'drivers',
    name: 'Șoferi — de bază',
    columns: ['fullName', 'phone', 'email', 'licenseNumber', 'clientCode'],
    enabled: true,
    system: true,
  },
  {
    id: 'suppliers_basic',
    entity: 'suppliers',
    name: 'Furnizori — de bază',
    columns: ['code', 'legalName', 'taxId', 'category', 'contactEmail', 'contactPhone'],
    enabled: true,
    system: true,
  },
  {
    id: 'costs_basic',
    entity: 'costs',
    name: 'Costuri — de bază',
    columns: [
      'registrationNumber',
      'category',
      'amountCents',
      'provider',
      'invoiceNumber',
      'incurredOn',
      'notes',
    ],
    enabled: true,
    system: true,
  },
  {
    id: 'documents_basic',
    entity: 'documents',
    name: 'Documente — de bază',
    columns: ['registrationNumber', 'documentTypeCode', 'title', 'expiresOn'],
    enabled: true,
    system: true,
  },
];

const SYSTEM_ENT = new Set(DEFAULT_IMPORT_ENTITIES.map((e) => e.code));
const SYSTEM_TPL = new Set(DEFAULT_IMPORT_TEMPLATES.map((t) => t.id));

function normalizeEntities(raw: unknown): ImportEntitySetting[] {
  const parsed: ImportEntitySetting[] = [];
  const seen = new Set<string>();
  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (!row || typeof row !== 'object') continue;
      const o = row as Record<string, unknown>;
      const code = slugCode(o.code);
      if (!code || seen.has(code)) continue;
      seen.add(code);
      const def = DEFAULT_IMPORT_ENTITIES.find((d) => d.code === code);
      parsed.push({
        code,
        label: typeof o.label === 'string' && o.label.trim() ? o.label.trim() : def?.label ?? code,
        enabled: typeof o.enabled === 'boolean' ? o.enabled : (def?.enabled ?? true),
        system: SYSTEM_ENT.has(code),
      });
    }
  }
  for (const d of DEFAULT_IMPORT_ENTITIES) {
    if (!seen.has(d.code)) parsed.push({ ...d });
  }
  return parsed;
}

function normalizeTemplates(raw: unknown): ImportTemplateSetting[] {
  const parsed: ImportTemplateSetting[] = [];
  const seen = new Set<string>();
  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (!row || typeof row !== 'object') continue;
      const o = row as Record<string, unknown>;
      const id = slugCode(o.id);
      const entity = slugCode(o.entity);
      if (!id || !entity || seen.has(id)) continue;
      seen.add(id);
      const def = DEFAULT_IMPORT_TEMPLATES.find((d) => d.id === id);
      const columns = Array.isArray(o.columns)
        ? o.columns
            .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
            .map((c) => c.trim())
        : def?.columns ?? [];
      if (columns.length === 0) continue;
      parsed.push({
        id,
        entity,
        name: typeof o.name === 'string' && o.name.trim() ? o.name.trim() : def?.name ?? id,
        columns,
        enabled: typeof o.enabled === 'boolean' ? o.enabled : (def?.enabled ?? true),
        system: SYSTEM_TPL.has(id),
      });
    }
  }
  for (const d of DEFAULT_IMPORT_TEMPLATES) {
    if (!seen.has(d.id)) parsed.push({ ...d, columns: [...d.columns] });
  }
  return parsed;
}

export const DEFAULT_IMPORT_SETTINGS: ImportSettings = {
  allowTenantAdminImport: true,
  allowClientAdminImport: false,
  requireDryRun: true,
  entities: DEFAULT_IMPORT_ENTITIES.map((e) => ({ ...e })),
  templates: DEFAULT_IMPORT_TEMPLATES.map((t) => ({ ...t, columns: [...t.columns] })),
};

export function parseImportSettings(raw: unknown): ImportSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ...DEFAULT_IMPORT_SETTINGS,
      entities: DEFAULT_IMPORT_ENTITIES.map((e) => ({ ...e })),
      templates: DEFAULT_IMPORT_TEMPLATES.map((t) => ({ ...t, columns: [...t.columns] })),
    };
  }
  const o = raw as Record<string, unknown>;
  return {
    allowTenantAdminImport:
      typeof o.allowTenantAdminImport === 'boolean'
        ? o.allowTenantAdminImport
        : DEFAULT_IMPORT_SETTINGS.allowTenantAdminImport,
    allowClientAdminImport:
      typeof o.allowClientAdminImport === 'boolean'
        ? o.allowClientAdminImport
        : DEFAULT_IMPORT_SETTINGS.allowClientAdminImport,
    requireDryRun:
      typeof o.requireDryRun === 'boolean'
        ? o.requireDryRun
        : DEFAULT_IMPORT_SETTINGS.requireDryRun,
    entities: normalizeEntities(o.entities),
    templates: normalizeTemplates(o.templates),
  };
}

export function parseImportSettingsPatch(body: unknown): Partial<ImportSettings> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid body');
  const o = body as Record<string, unknown>;
  const patch: Partial<ImportSettings> = {};
  if (o.allowTenantAdminImport !== undefined) {
    if (typeof o.allowTenantAdminImport !== 'boolean') throw new Error('allowTenantAdminImport must be boolean');
    patch.allowTenantAdminImport = o.allowTenantAdminImport;
  }
  if (o.allowClientAdminImport !== undefined) {
    if (typeof o.allowClientAdminImport !== 'boolean') throw new Error('allowClientAdminImport must be boolean');
    patch.allowClientAdminImport = o.allowClientAdminImport;
  }
  if (o.requireDryRun !== undefined) {
    if (typeof o.requireDryRun !== 'boolean') throw new Error('requireDryRun must be boolean');
    patch.requireDryRun = o.requireDryRun;
  }
  if (o.entities !== undefined) {
    if (!Array.isArray(o.entities) || o.entities.length === 0) {
      throw new Error('entities must be a non-empty array');
    }
    patch.entities = normalizeEntities(o.entities);
  }
  if (o.templates !== undefined) {
    if (!Array.isArray(o.templates)) throw new Error('templates must be an array');
    patch.templates = normalizeTemplates(o.templates);
  }
  if (Object.keys(patch).length === 0) throw new Error('No settings to update');
  return patch;
}
