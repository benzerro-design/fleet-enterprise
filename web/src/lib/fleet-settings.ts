export type FleetCatalogItem = {
  code: string;
  label: string;
  enabled: boolean;
  system: boolean;
};

export type ReminderPresetSetting = {
  id: string;
  label: string;
  description: string;
  offsets: number[];
  enabled: boolean;
  system: boolean;
};

export type FleetSettings = {
  expiringSoonDays: number;
  reminderPresets: ReminderPresetSetting[];
  documentTypes: FleetCatalogItem[];
  equipmentKinds: FleetCatalogItem[];
  /** Coloane default pe grila vehicule (ordine). null = default din cod. */
  defaultVehicleColumnKeys: string[] | null;
};

const CODE_RE = /^[a-z][a-z0-9_]{0,47}$/;

function slugCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toLowerCase().replace(/\s+/g, '_');
  return CODE_RE.test(code) ? code : null;
}

export const DEFAULT_REMINDER_PRESET_SETTINGS: ReminderPresetSetting[] = [
  {
    id: 'standard',
    label: 'Standard flotă',
    description: '60, 30 și 7 zile înainte',
    offsets: [60, 30, 7],
    enabled: true,
    system: true,
  },
  {
    id: 'itp_rca',
    label: 'ITP / RCA / CASCO',
    description: '30, 14, 7 zile și în ziua expirării',
    offsets: [30, 14, 7, 1, 0],
    enabled: true,
    system: true,
  },
  {
    id: 'urgent',
    label: 'Doar urgent',
    description: '7 zile, 3 zile și ziua expirării',
    offsets: [7, 3, 0],
    enabled: true,
    system: true,
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Doar cu 7 zile înainte',
    offsets: [7],
    enabled: true,
    system: true,
  },
];

export const DEFAULT_FLEET_DOCUMENT_TYPES: FleetCatalogItem[] = [
  { code: 'rca', label: 'RCA', enabled: true, system: true },
  { code: 'casco', label: 'CASCO', enabled: true, system: true },
  { code: 'cert_inmatriculare', label: 'Certificat înmatriculare', enabled: true, system: true },
  { code: 'civ', label: 'CIV', enabled: true, system: true },
  { code: 'itp_cert', label: 'Certificat ITP', enabled: true, system: true },
  { code: 'licenta_transport', label: 'Licență transport', enabled: true, system: true },
  { code: 'altul', label: 'Alt document', enabled: true, system: true },
];

export const DEFAULT_EQUIPMENT_KINDS: FleetCatalogItem[] = [
  { code: 'tow_hitch', label: 'Cârlig remorcare', enabled: true, system: true },
  { code: 'fridge_unit', label: 'Agregat frigorific', enabled: true, system: true },
  { code: 'liftgate', label: 'Lift / hayon', enabled: true, system: true },
  { code: 'crane', label: 'Macara', enabled: true, system: true },
  { code: 'other', label: 'Altele', enabled: true, system: true },
];

const SYSTEM_DOC = new Set(DEFAULT_FLEET_DOCUMENT_TYPES.map((d) => d.code));
const SYSTEM_EQ = new Set(DEFAULT_EQUIPMENT_KINDS.map((d) => d.code));
const SYSTEM_PRESET = new Set(DEFAULT_REMINDER_PRESET_SETTINGS.map((d) => d.id));

function normalizeCatalog(
  raw: unknown,
  defaults: FleetCatalogItem[],
  systemCodes: Set<string>,
): FleetCatalogItem[] {
  const parsed: FleetCatalogItem[] = [];
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

function normalizeOffsets(raw: unknown, fallback: number[]): number[] {
  if (!Array.isArray(raw)) return [...fallback];
  const out: number[] = [];
  const seen = new Set<number>();
  for (const v of raw) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) continue;
    const n = Math.round(v);
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  out.sort((a, b) => b - a);
  return out.length ? out : [...fallback];
}

function normalizePresets(raw: unknown): ReminderPresetSetting[] {
  const parsed: ReminderPresetSetting[] = [];
  const seen = new Set<string>();
  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (!row || typeof row !== 'object') continue;
      const o = row as Record<string, unknown>;
      const id = slugCode(o.id ?? o.code);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const def = DEFAULT_REMINDER_PRESET_SETTINGS.find((d) => d.id === id);
      parsed.push({
        id,
        label: typeof o.label === 'string' && o.label.trim() ? o.label.trim() : def?.label ?? id,
        description:
          typeof o.description === 'string' ? o.description : (def?.description ?? ''),
        offsets: normalizeOffsets(o.offsets, def?.offsets ?? [7]),
        enabled: typeof o.enabled === 'boolean' ? o.enabled : (def?.enabled ?? true),
        system: SYSTEM_PRESET.has(id),
      });
    }
  }
  for (const d of DEFAULT_REMINDER_PRESET_SETTINGS) {
    if (!seen.has(d.id)) parsed.push({ ...d, offsets: [...d.offsets] });
  }
  return parsed;
}

export const DEFAULT_FLEET_SETTINGS: FleetSettings = {
  expiringSoonDays: 30,
  reminderPresets: DEFAULT_REMINDER_PRESET_SETTINGS.map((s) => ({
    ...s,
    offsets: [...s.offsets],
  })),
  documentTypes: DEFAULT_FLEET_DOCUMENT_TYPES.map((s) => ({ ...s })),
  equipmentKinds: DEFAULT_EQUIPMENT_KINDS.map((s) => ({ ...s })),
  defaultVehicleColumnKeys: null,
};

export function parseFleetSettings(raw: unknown): FleetSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ...DEFAULT_FLEET_SETTINGS,
      reminderPresets: DEFAULT_REMINDER_PRESET_SETTINGS.map((s) => ({
        ...s,
        offsets: [...s.offsets],
      })),
      documentTypes: DEFAULT_FLEET_DOCUMENT_TYPES.map((s) => ({ ...s })),
      equipmentKinds: DEFAULT_EQUIPMENT_KINDS.map((s) => ({ ...s })),
    };
  }
  const o = raw as Record<string, unknown>;
  const soon =
    typeof o.expiringSoonDays === 'number' &&
    Number.isFinite(o.expiringSoonDays) &&
    o.expiringSoonDays >= 1
      ? Math.min(365, Math.round(o.expiringSoonDays))
      : DEFAULT_FLEET_SETTINGS.expiringSoonDays;
  let cols: string[] | null = null;
  if (o.defaultVehicleColumnKeys === null) cols = null;
  else if (Array.isArray(o.defaultVehicleColumnKeys)) {
    cols = o.defaultVehicleColumnKeys
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .map((x) => x.trim());
    if (cols.length === 0) cols = null;
  }
  return {
    expiringSoonDays: soon,
    reminderPresets: normalizePresets(o.reminderPresets),
    documentTypes: normalizeCatalog(o.documentTypes, DEFAULT_FLEET_DOCUMENT_TYPES, SYSTEM_DOC),
    equipmentKinds: normalizeCatalog(o.equipmentKinds, DEFAULT_EQUIPMENT_KINDS, SYSTEM_EQ),
    defaultVehicleColumnKeys: cols,
  };
}

export function parseFleetSettingsPatch(body: unknown): Partial<FleetSettings> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid body');
  const o = body as Record<string, unknown>;
  const patch: Partial<FleetSettings> = {};
  if (o.expiringSoonDays !== undefined) {
    if (typeof o.expiringSoonDays !== 'number' || !Number.isFinite(o.expiringSoonDays) || o.expiringSoonDays < 1) {
      throw new Error('expiringSoonDays must be >= 1');
    }
    patch.expiringSoonDays = Math.min(365, Math.round(o.expiringSoonDays));
  }
  if (o.reminderPresets !== undefined) {
    if (!Array.isArray(o.reminderPresets) || o.reminderPresets.length === 0) {
      throw new Error('reminderPresets must be a non-empty array');
    }
    patch.reminderPresets = normalizePresets(o.reminderPresets);
  }
  if (o.documentTypes !== undefined) {
    if (!Array.isArray(o.documentTypes) || o.documentTypes.length === 0) {
      throw new Error('documentTypes must be a non-empty array');
    }
    patch.documentTypes = normalizeCatalog(o.documentTypes, DEFAULT_FLEET_DOCUMENT_TYPES, SYSTEM_DOC);
  }
  if (o.equipmentKinds !== undefined) {
    if (!Array.isArray(o.equipmentKinds) || o.equipmentKinds.length === 0) {
      throw new Error('equipmentKinds must be a non-empty array');
    }
    patch.equipmentKinds = normalizeCatalog(o.equipmentKinds, DEFAULT_EQUIPMENT_KINDS, SYSTEM_EQ);
  }
  if (o.defaultVehicleColumnKeys !== undefined) {
    if (o.defaultVehicleColumnKeys === null) {
      patch.defaultVehicleColumnKeys = null;
    } else if (Array.isArray(o.defaultVehicleColumnKeys)) {
      const cols = o.defaultVehicleColumnKeys
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((x) => x.trim());
      patch.defaultVehicleColumnKeys = cols.length ? cols : null;
    } else {
      throw new Error('defaultVehicleColumnKeys must be string[] or null');
    }
  }
  if (Object.keys(patch).length === 0) throw new Error('No settings to update');
  return patch;
}

export const fleetSettingsBrowserBase = "/api/tenant/fleet-settings";
