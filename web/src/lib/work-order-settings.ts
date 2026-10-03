export type DamagePipelineStepSetting = {
  code: string;
  label: string;
  enabled: boolean;
  /** Pași din produs — nu se șterg, doar dezactivează / redenumesc. */
  system: boolean;
  /** Închide fluxul asigurător (ex. Accept plată). */
  isFinal: boolean;
  /** Cere PDF pe dosar (ex. Accept plată). */
  requiresPdf: boolean;
};

export type WorkshopStatusSetting = {
  code: string;
  label: string;
  enabled: boolean;
};

export type ServiceTypeSettings = {
  requirePhotosIn: boolean;
  requirePhotosOut: boolean;
  /** null = moștenește setările generale. */
  defaultPartsWarrantyMonths: number | null;
  defaultPartsWarrantyKm: number | null;
  defaultLaborWarrantyMonths: number | null;
  workshopStatuses: WorkshopStatusSetting[];
};

export type ServiceTypeSettingsKey = 'M' | 'E' | 'TV';

export const DEFAULT_DAMAGE_PIPELINE_STEPS: DamagePipelineStepSetting[] = [
  { code: 'docs_pending', label: '1. Documente', enabled: true, system: true, isFinal: false, requiresPdf: false },
  { code: 'ready_to_notify', label: '2. Pregătit avizare', enabled: true, system: true, isFinal: false, requiresPdf: false },
  { code: 'notified', label: '3. Avizat', enabled: true, system: true, isFinal: false, requiresPdf: false },
  { code: 'inspection_note', label: '4. Notă constatare', enabled: true, system: true, isFinal: false, requiresPdf: false },
  { code: 'reinspection_requested', label: '4b. Reconstatare', enabled: true, system: true, isFinal: false, requiresPdf: false },
  { code: 'air', label: '4c. AIR — acord intrare în reparație', enabled: true, system: true, isFinal: false, requiresPdf: false },
  { code: 'quote_ready', label: '5. Deviz gata', enabled: true, system: true, isFinal: false, requiresPdf: false },
  {
    code: 'payment_accepted',
    label: '6. Accept plată',
    enabled: true,
    system: true,
    isFinal: true,
    requiresPdf: true,
  },
];

const SYSTEM_PIPELINE_CODES = new Set(DEFAULT_DAMAGE_PIPELINE_STEPS.map((s) => s.code));

const DEFAULT_TV_WORKSHOP_STATUSES: WorkshopStatusSetting[] = [
  { code: 'demontare', label: 'Demontare', enabled: true },
  { code: 'vopsitorie', label: 'Vopsitorie', enabled: true },
  { code: 'montaj', label: 'Montaj', enabled: true },
  { code: 'control_calitate', label: 'Control calitate', enabled: true },
];

export const DEFAULT_SERVICE_TYPE_SETTINGS: Record<ServiceTypeSettingsKey, ServiceTypeSettings> = {
  M: {
    requirePhotosIn: false,
    requirePhotosOut: false,
    defaultPartsWarrantyMonths: null,
    defaultPartsWarrantyKm: null,
    defaultLaborWarrantyMonths: null,
    workshopStatuses: [],
  },
  E: {
    requirePhotosIn: false,
    requirePhotosOut: true,
    defaultPartsWarrantyMonths: null,
    defaultPartsWarrantyKm: null,
    defaultLaborWarrantyMonths: null,
    workshopStatuses: [],
  },
  TV: {
    requirePhotosIn: true,
    requirePhotosOut: true,
    defaultPartsWarrantyMonths: null,
    defaultPartsWarrantyKm: null,
    defaultLaborWarrantyMonths: null,
    workshopStatuses: DEFAULT_TV_WORKSHOP_STATUSES.map((s) => ({ ...s })),
  },
};

const CODE_RE = /^[a-z][a-z0-9_]{0,47}$/;

function slugCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toLowerCase().replace(/\s+/g, '_');
  if (!CODE_RE.test(code)) return null;
  return code;
}

function parseWorkshopStatuses(raw: unknown): WorkshopStatusSetting[] {
  if (!Array.isArray(raw)) return [];
  const out: WorkshopStatusSetting[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const code = slugCode(o.code);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    const label = typeof o.label === 'string' && o.label.trim() ? o.label.trim() : code;
    out.push({
      code,
      label,
      enabled: typeof o.enabled === 'boolean' ? o.enabled : true,
    });
  }
  return out;
}

function parseOneServiceType(
  raw: unknown,
  fallback: ServiceTypeSettings,
): ServiceTypeSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ...fallback,
      workshopStatuses: fallback.workshopStatuses.map((s) => ({ ...s })),
    };
  }
  const o = raw as Record<string, unknown>;
  const nullableInt = (v: unknown): number | null => {
    if (v === null) return null;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return null;
    return Math.round(v);
  };
  return {
    requirePhotosIn:
      typeof o.requirePhotosIn === 'boolean' ? o.requirePhotosIn : fallback.requirePhotosIn,
    requirePhotosOut:
      typeof o.requirePhotosOut === 'boolean' ? o.requirePhotosOut : fallback.requirePhotosOut,
    defaultPartsWarrantyMonths:
      o.defaultPartsWarrantyMonths === null
        ? null
        : o.defaultPartsWarrantyMonths !== undefined
          ? nullableInt(o.defaultPartsWarrantyMonths)
          : fallback.defaultPartsWarrantyMonths,
    defaultPartsWarrantyKm:
      o.defaultPartsWarrantyKm === null
        ? null
        : o.defaultPartsWarrantyKm !== undefined
          ? nullableInt(o.defaultPartsWarrantyKm)
          : fallback.defaultPartsWarrantyKm,
    defaultLaborWarrantyMonths:
      o.defaultLaborWarrantyMonths === null
        ? null
        : o.defaultLaborWarrantyMonths !== undefined
          ? nullableInt(o.defaultLaborWarrantyMonths)
          : fallback.defaultLaborWarrantyMonths,
    workshopStatuses:
      o.workshopStatuses !== undefined
        ? parseWorkshopStatuses(o.workshopStatuses)
        : fallback.workshopStatuses.map((s) => ({ ...s })),
  };
}

export function normalizeServiceTypeSettings(
  raw: unknown,
): Record<ServiceTypeSettingsKey, ServiceTypeSettings> {
  const o =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  return {
    M: parseOneServiceType(o.M, DEFAULT_SERVICE_TYPE_SETTINGS.M),
    E: parseOneServiceType(o.E, DEFAULT_SERVICE_TYPE_SETTINGS.E),
    TV: parseOneServiceType(o.TV, DEFAULT_SERVICE_TYPE_SETTINGS.TV),
  };
}

export function normalizeDamagePipelineSteps(raw: unknown): DamagePipelineStepSetting[] {
  const parsed: DamagePipelineStepSetting[] = [];
  const seen = new Set<string>();

  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (!row || typeof row !== 'object') continue;
      const o = row as Record<string, unknown>;
      const code = slugCode(o.code);
      if (!code || seen.has(code)) continue;
      seen.add(code);
      const system = SYSTEM_PIPELINE_CODES.has(code);
      const def = DEFAULT_DAMAGE_PIPELINE_STEPS.find((d) => d.code === code);
      parsed.push({
        code,
        label:
          typeof o.label === 'string' && o.label.trim()
            ? o.label.trim()
            : def?.label ?? code,
        enabled: typeof o.enabled === 'boolean' ? o.enabled : (def?.enabled ?? true),
        system,
        isFinal:
          typeof o.isFinal === 'boolean' ? o.isFinal : (def?.isFinal ?? false),
        requiresPdf:
          typeof o.requiresPdf === 'boolean' ? o.requiresPdf : (def?.requiresPdf ?? false),
      });
    }
  }

  for (const d of DEFAULT_DAMAGE_PIPELINE_STEPS) {
    if (seen.has(d.code)) continue;
    parsed.push({ ...d });
  }

  return parsed;
}

/** Coduri pipeline valide (inclusiv custom din setări). */
export function damagePipelineCodeSet(steps: DamagePipelineStepSetting[]): Set<string> {
  return new Set(steps.map((s) => s.code));
}

export function isDamagePipelineFinal(
  status: string | null | undefined,
  steps?: DamagePipelineStepSetting[] | null,
): boolean {
  if (!status) return false;
  if (status === 'payment_accepted') return true;
  const list = steps?.length ? steps : DEFAULT_DAMAGE_PIPELINE_STEPS;
  return list.some((s) => s.code === status && s.isFinal);
}

export type WorkOrderSettings = {
  /** Km in / km out obligatorii la marcarea in/out service. */
  requireServiceKm: boolean;
  /** Actualizează odometrul flotă al vehiculului din km in/out (doar dacă >= km curent). */
  updateFleetOdometerFromServiceKm: boolean;
  /**
   * Șoferul poate marca Service Out (km + poze) pe comenzile vehiculelor alocate.
   * Partenerul / ops rămân oricum.
   */
  allowDriverServiceOut: boolean;
  /** Cod piesă obligatoriu pe liniile de deviz de tip piese, cu excepție explicită "fără cod". */
  requirePartCode: boolean;
  /** Garanție implicită piese, în luni. */
  defaultPartsWarrantyMonths: number;
  /** Garanție implicită piese, în km. */
  defaultPartsWarrantyKm: number;
  /** Garanție implicită manoperă, în luni. */
  defaultLaborWarrantyMonths: number;
  /** Permite Import PDF → preview → ciornă pe WO (dacă și Integrări.audatexImportEnabled). */
  allowQuotePdfImport: boolean;
  /** Permite „Verifică preț” pe linii (când catalogul e activ în Integrări). */
  allowPartsPriceVerify: boolean;
  /** Permite lansare comenzi piese după aprobare (când e activ în Integrări). */
  allowPartsOrderLaunch: boolean;
  /** Prag % peste cel mai ieftin catalog pentru flag „preț suspect” (verificare). */
  partsPriceSuspectPercent: number;
  /**
   * Facturare pe comandă:
   * - per_work_order = o factură din liniile aprobate consolidate
   * - per_quote = factură separată pe fiecare deviz aprobat
   */
  quoteInvoiceMode: 'per_work_order' | 'per_quote';
  /** Pași pipeline asigurător pe daună (ordine, etichete, custom). */
  damagePipelineSteps: DamagePipelineStepSetting[];
  /** Setări pe tip de comandă M / E / TV. */
  serviceTypeSettings: Record<ServiceTypeSettingsKey, ServiceTypeSettings>;
};

export const DEFAULT_WORK_ORDER_SETTINGS: WorkOrderSettings = {
  requireServiceKm: true,
  updateFleetOdometerFromServiceKm: true,
  allowDriverServiceOut: false,
  requirePartCode: true,
  defaultPartsWarrantyMonths: 12,
  defaultPartsWarrantyKm: 20000,
  defaultLaborWarrantyMonths: 6,
  allowQuotePdfImport: true,
  allowPartsPriceVerify: true,
  allowPartsOrderLaunch: false,
  partsPriceSuspectPercent: 25,
  quoteInvoiceMode: 'per_quote',
  damagePipelineSteps: DEFAULT_DAMAGE_PIPELINE_STEPS.map((s) => ({ ...s })),
  serviceTypeSettings: {
    M: {
      ...DEFAULT_SERVICE_TYPE_SETTINGS.M,
      workshopStatuses: [],
    },
    E: {
      ...DEFAULT_SERVICE_TYPE_SETTINGS.E,
      workshopStatuses: [],
    },
    TV: {
      ...DEFAULT_SERVICE_TYPE_SETTINGS.TV,
      workshopStatuses: DEFAULT_TV_WORKSHOP_STATUSES.map((s) => ({ ...s })),
    },
  },
};

function parseNonNegativeInt(raw: unknown, fallback: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return fallback;
  return Math.round(raw);
}

export function parseWorkOrderSettings(raw: unknown): WorkOrderSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ...DEFAULT_WORK_ORDER_SETTINGS,
      damagePipelineSteps: DEFAULT_DAMAGE_PIPELINE_STEPS.map((s) => ({ ...s })),
      serviceTypeSettings: normalizeServiceTypeSettings(undefined),
    };
  }
  const o = raw as Record<string, unknown>;
  return {
    requireServiceKm:
      typeof o.requireServiceKm === 'boolean'
        ? o.requireServiceKm
        : DEFAULT_WORK_ORDER_SETTINGS.requireServiceKm,
    updateFleetOdometerFromServiceKm:
      typeof o.updateFleetOdometerFromServiceKm === 'boolean'
        ? o.updateFleetOdometerFromServiceKm
        : DEFAULT_WORK_ORDER_SETTINGS.updateFleetOdometerFromServiceKm,
    allowDriverServiceOut:
      typeof o.allowDriverServiceOut === 'boolean'
        ? o.allowDriverServiceOut
        : DEFAULT_WORK_ORDER_SETTINGS.allowDriverServiceOut,
    requirePartCode:
      typeof o.requirePartCode === 'boolean'
        ? o.requirePartCode
        : DEFAULT_WORK_ORDER_SETTINGS.requirePartCode,
    defaultPartsWarrantyMonths: parseNonNegativeInt(
      o.defaultPartsWarrantyMonths,
      DEFAULT_WORK_ORDER_SETTINGS.defaultPartsWarrantyMonths,
    ),
    defaultPartsWarrantyKm: parseNonNegativeInt(
      o.defaultPartsWarrantyKm,
      DEFAULT_WORK_ORDER_SETTINGS.defaultPartsWarrantyKm,
    ),
    defaultLaborWarrantyMonths: parseNonNegativeInt(
      o.defaultLaborWarrantyMonths,
      DEFAULT_WORK_ORDER_SETTINGS.defaultLaborWarrantyMonths,
    ),
    allowQuotePdfImport:
      typeof o.allowQuotePdfImport === 'boolean'
        ? o.allowQuotePdfImport
        : DEFAULT_WORK_ORDER_SETTINGS.allowQuotePdfImport,
    allowPartsPriceVerify:
      typeof o.allowPartsPriceVerify === 'boolean'
        ? o.allowPartsPriceVerify
        : DEFAULT_WORK_ORDER_SETTINGS.allowPartsPriceVerify,
    allowPartsOrderLaunch:
      typeof o.allowPartsOrderLaunch === 'boolean'
        ? o.allowPartsOrderLaunch
        : DEFAULT_WORK_ORDER_SETTINGS.allowPartsOrderLaunch,
    partsPriceSuspectPercent: parseNonNegativeInt(
      o.partsPriceSuspectPercent,
      DEFAULT_WORK_ORDER_SETTINGS.partsPriceSuspectPercent,
    ),
    quoteInvoiceMode:
      o.quoteInvoiceMode === 'per_work_order' || o.quoteInvoiceMode === 'per_quote'
        ? o.quoteInvoiceMode
        : DEFAULT_WORK_ORDER_SETTINGS.quoteInvoiceMode,
    damagePipelineSteps: normalizeDamagePipelineSteps(o.damagePipelineSteps),
    serviceTypeSettings: normalizeServiceTypeSettings(o.serviceTypeSettings),
  };
}

export type WorkOrderSettingsPatch = Partial<
  Omit<WorkOrderSettings, 'serviceTypeSettings'>
> & {
  serviceTypeSettings?: Partial<Record<ServiceTypeSettingsKey, ServiceTypeSettings>>;
};

export function parseWorkOrderSettingsPatch(body: unknown): WorkOrderSettingsPatch {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Invalid body');
  }
  const o = body as Record<string, unknown>;
  const patch: WorkOrderSettingsPatch = {};
  if (o.requireServiceKm !== undefined) {
    if (typeof o.requireServiceKm !== 'boolean') throw new Error('requireServiceKm must be boolean');
    patch.requireServiceKm = o.requireServiceKm;
  }
  if (o.updateFleetOdometerFromServiceKm !== undefined) {
    if (typeof o.updateFleetOdometerFromServiceKm !== 'boolean') {
      throw new Error('updateFleetOdometerFromServiceKm must be boolean');
    }
    patch.updateFleetOdometerFromServiceKm = o.updateFleetOdometerFromServiceKm;
  }
  if (o.allowDriverServiceOut !== undefined) {
    if (typeof o.allowDriverServiceOut !== 'boolean') {
      throw new Error('allowDriverServiceOut must be boolean');
    }
    patch.allowDriverServiceOut = o.allowDriverServiceOut;
  }
  if (o.requirePartCode !== undefined) {
    if (typeof o.requirePartCode !== 'boolean') throw new Error('requirePartCode must be boolean');
    patch.requirePartCode = o.requirePartCode;
  }
  if (o.defaultPartsWarrantyMonths !== undefined) {
    if (
      typeof o.defaultPartsWarrantyMonths !== 'number' ||
      !Number.isFinite(o.defaultPartsWarrantyMonths) ||
      o.defaultPartsWarrantyMonths < 0
    ) {
      throw new Error('defaultPartsWarrantyMonths must be a non-negative number');
    }
    patch.defaultPartsWarrantyMonths = Math.round(o.defaultPartsWarrantyMonths);
  }
  if (o.defaultPartsWarrantyKm !== undefined) {
    if (
      typeof o.defaultPartsWarrantyKm !== 'number' ||
      !Number.isFinite(o.defaultPartsWarrantyKm) ||
      o.defaultPartsWarrantyKm < 0
    ) {
      throw new Error('defaultPartsWarrantyKm must be a non-negative number');
    }
    patch.defaultPartsWarrantyKm = Math.round(o.defaultPartsWarrantyKm);
  }
  if (o.defaultLaborWarrantyMonths !== undefined) {
    if (
      typeof o.defaultLaborWarrantyMonths !== 'number' ||
      !Number.isFinite(o.defaultLaborWarrantyMonths) ||
      o.defaultLaborWarrantyMonths < 0
    ) {
      throw new Error('defaultLaborWarrantyMonths must be a non-negative number');
    }
    patch.defaultLaborWarrantyMonths = Math.round(o.defaultLaborWarrantyMonths);
  }
  if (o.allowQuotePdfImport !== undefined) {
    if (typeof o.allowQuotePdfImport !== 'boolean') throw new Error('allowQuotePdfImport must be boolean');
    patch.allowQuotePdfImport = o.allowQuotePdfImport;
  }
  if (o.allowPartsPriceVerify !== undefined) {
    if (typeof o.allowPartsPriceVerify !== 'boolean') {
      throw new Error('allowPartsPriceVerify must be boolean');
    }
    patch.allowPartsPriceVerify = o.allowPartsPriceVerify;
  }
  if (o.allowPartsOrderLaunch !== undefined) {
    if (typeof o.allowPartsOrderLaunch !== 'boolean') {
      throw new Error('allowPartsOrderLaunch must be boolean');
    }
    patch.allowPartsOrderLaunch = o.allowPartsOrderLaunch;
  }
  if (o.partsPriceSuspectPercent !== undefined) {
    if (
      typeof o.partsPriceSuspectPercent !== 'number' ||
      !Number.isFinite(o.partsPriceSuspectPercent) ||
      o.partsPriceSuspectPercent < 0
    ) {
      throw new Error('partsPriceSuspectPercent must be a non-negative number');
    }
    patch.partsPriceSuspectPercent = Math.round(o.partsPriceSuspectPercent);
  }
  if (o.quoteInvoiceMode !== undefined) {
    if (o.quoteInvoiceMode !== 'per_work_order' && o.quoteInvoiceMode !== 'per_quote') {
      throw new Error('quoteInvoiceMode must be per_work_order or per_quote');
    }
    patch.quoteInvoiceMode = o.quoteInvoiceMode;
  }
  if (o.damagePipelineSteps !== undefined) {
    if (!Array.isArray(o.damagePipelineSteps)) {
      throw new Error('damagePipelineSteps must be an array');
    }
    if (o.damagePipelineSteps.length === 0) {
      throw new Error('damagePipelineSteps cannot be empty');
    }
    patch.damagePipelineSteps = normalizeDamagePipelineSteps(o.damagePipelineSteps);
  }
  if (o.serviceTypeSettings !== undefined) {
    if (!o.serviceTypeSettings || typeof o.serviceTypeSettings !== 'object' || Array.isArray(o.serviceTypeSettings)) {
      throw new Error('serviceTypeSettings must be an object');
    }
    const st = o.serviceTypeSettings as Record<string, unknown>;
    const base = normalizeServiceTypeSettings(undefined);
    const partial: Partial<Record<ServiceTypeSettingsKey, ServiceTypeSettings>> = {};
    if (st.M !== undefined) partial.M = parseOneServiceType(st.M, base.M);
    if (st.E !== undefined) partial.E = parseOneServiceType(st.E, base.E);
    if (st.TV !== undefined) partial.TV = parseOneServiceType(st.TV, base.TV);
    if (Object.keys(partial).length === 0) {
      throw new Error('serviceTypeSettings must include M, E and/or TV');
    }
    patch.serviceTypeSettings = partial;
  }
  if (Object.keys(patch).length === 0) throw new Error('No settings to update');
  return patch;
}

export const workOrderSettingsBrowserBase = "/api/tenant/work-order-settings";
