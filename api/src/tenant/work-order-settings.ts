export type WorkOrderSettings = {
  /** Km in / km out obligatorii la marcarea in/out service. */
  requireServiceKm: boolean;
  /** Actualizează odometrul flotă al vehiculului din km in/out (doar dacă >= km curent). */
  updateFleetOdometerFromServiceKm: boolean;
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
};

export const DEFAULT_WORK_ORDER_SETTINGS: WorkOrderSettings = {
  requireServiceKm: true,
  updateFleetOdometerFromServiceKm: true,
  requirePartCode: true,
  defaultPartsWarrantyMonths: 12,
  defaultPartsWarrantyKm: 20000,
  defaultLaborWarrantyMonths: 6,
  allowQuotePdfImport: true,
  allowPartsPriceVerify: true,
  allowPartsOrderLaunch: false,
  partsPriceSuspectPercent: 25,
};

function parseNonNegativeInt(
  raw: unknown,
  fallback: number,
): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return fallback;
  return Math.round(raw);
}

export function parseWorkOrderSettings(raw: unknown): WorkOrderSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_WORK_ORDER_SETTINGS };
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
  };
}

export function parseWorkOrderSettingsPatch(body: unknown): Partial<WorkOrderSettings> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Invalid body');
  }
  const o = body as Record<string, unknown>;
  const patch: Partial<WorkOrderSettings> = {};
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
  if (Object.keys(patch).length === 0) throw new Error('No settings to update');
  return patch;
}
