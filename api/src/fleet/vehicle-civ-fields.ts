/** Chei pentru câmpurile din civProfile (JSON pe Vehicle). */
export type VehicleCivProfile = Record<string, string | number | null>;

export type CivFieldKind = 'text' | 'number' | 'year';

export type CivFieldGroupId =
  | 'identificare'
  | 'mase'
  | 'dimensiuni'
  | 'motor'
  | 'mediu'
  | 'capacitate'
  | 'roți';

export type CivFieldDef = {
  key: string;
  /** Rubrică canonică pe formatul CIV 2024 (Ordin 211/28/391/2024). */
  rubric: string;
  label: string;
  kind: CivFieldKind;
  group: CivFieldGroupId;
  unit?: string;
};

/** Format document CIV (instrucțiuni RAR / Anexa 2).
 * - 1993: layout vechi (grilă) — algoritm separat
 * - 2016: Ordin 26/36/542/2016 (D.1, P.x…) — ex. Logan emis 2022
 * - 2024: Ordin 211/2024 (același layout tehnic, fără proprietar)
 */
export type CivDocumentFormat = '2024' | '2016' | '1993' | 'unknown';

export const CIV_FIELD_GROUPS: { id: CivFieldGroupId; label: string }[] = [
  { id: 'identificare', label: 'Identificare (pag. 1)' },
  { id: 'mase', label: 'Mase și remorcare' },
  { id: 'dimensiuni', label: 'Dimensiuni' },
  { id: 'motor', label: 'Motor / propulsie' },
  { id: 'mediu', label: 'Mediu și omologare' },
  { id: 'capacitate', label: 'Capacitate și performanță' },
  { id: 'roți', label: 'Roți, suspensie, rezervor' },
];

/**
 * Rubrici CIV standard (format 2024+) — valorile se stochează în Vehicle.civProfile.
 * Sursă: Anexa 1 la Instrucțiunile CIV (RAR), consolidate cu Ordinul 211/28/391/2024.
 * VIN (E), serie CIV, dată eliberare, reprezentanță RAR, Mențiuni = coloane dedicate pe Vehicle.
 */
export const CIV_PROFILE_FIELDS: CivFieldDef[] = [
  { key: 'brand', rubric: 'D.1', label: 'Marcă', kind: 'text', group: 'identificare' },
  { key: 'typeVariantVersion', rubric: 'D.2', label: 'Tip – variantă – versiune', kind: 'text', group: 'identificare' },
  { key: 'commercialName', rubric: 'D.3', label: 'Denumire comercială', kind: 'text', group: 'identificare' },
  { key: 'manufactureYear', rubric: '1', label: 'An fabricație', kind: 'year', group: 'identificare' },
  { key: 'homologationCategory', rubric: 'J', label: 'Categorie omologare', kind: 'text', group: 'identificare' },
  { key: 'usageCategory', rubric: '2', label: 'Categorie de folosință', kind: 'text', group: 'identificare' },
  { key: 'vehicleClass', rubric: '3', label: 'Clasă (M2, M3…)', kind: 'text', group: 'identificare' },
  { key: 'bodyType', rubric: '4', label: 'Caroserie', kind: 'text', group: 'identificare' },
  { key: 'typeApprovalNumber', rubric: 'K', label: 'Număr omologare de tip', kind: 'text', group: 'identificare' },
  { key: 'nationalRegisterNumber', rubric: '5', label: 'Număr național de registru', kind: 'text', group: 'identificare' },
  { key: 'axleCount', rubric: 'L', label: 'Număr axe', kind: 'number', group: 'mase' },
  { key: 'maxTechnicalMassKg', rubric: 'F.1', label: 'Masă maximă tehnic admisă', kind: 'number', group: 'mase', unit: 'kg' },
  { key: 'maxTrainMassKg', rubric: '6', label: 'MTMA ansamblu vehicule', kind: 'number', group: 'mase', unit: 'kg' },
  { key: 'axle1MaxMassKg', rubric: 'N.1', label: 'MTMA axa 1', kind: 'number', group: 'mase', unit: 'kg' },
  { key: 'axle2MaxMassKg', rubric: 'N.2', label: 'MTMA axa 2', kind: 'number', group: 'mase', unit: 'kg' },
  { key: 'axle3MaxMassKg', rubric: 'N.3', label: 'MTMA axa 3', kind: 'number', group: 'mase', unit: 'kg' },
  { key: 'axle4MaxMassKg', rubric: 'N.4', label: 'MTMA axa 4', kind: 'number', group: 'mase', unit: 'kg' },
  { key: 'axle5MaxMassKg', rubric: 'N.5', label: 'MTMA axa 5', kind: 'number', group: 'mase', unit: 'kg' },
  { key: 'curbMassKg', rubric: 'G', label: 'Masă în ordine de mers', kind: 'number', group: 'mase', unit: 'kg' },
  { key: 'actualMassKg', rubric: '7', label: 'Masă reală', kind: 'number', group: 'mase', unit: 'kg' },
  { key: 'maxBrakedTrailerMassKg', rubric: 'O.1', label: 'Masă remorcabilă cu frână', kind: 'number', group: 'mase', unit: 'kg' },
  { key: 'maxUnbrakedTrailerMassKg', rubric: 'O.2', label: 'Masă remorcabilă fără frână', kind: 'number', group: 'mase', unit: 'kg' },
  { key: 'maxCouplingMassKg', rubric: '8', label: 'Masă max. punct cuplare', kind: 'number', group: 'mase', unit: 'kg' },
  { key: 'lengthMm', rubric: '9', label: 'Lungime', kind: 'number', group: 'dimensiuni', unit: 'mm' },
  { key: 'widthMm', rubric: '10', label: 'Lățime', kind: 'number', group: 'dimensiuni', unit: 'mm' },
  { key: 'heightMm', rubric: '11', label: 'Înălțime', kind: 'number', group: 'dimensiuni', unit: 'mm' },
  { key: 'wheelbaseMm', rubric: '12', label: 'Distanță între axe', kind: 'number', group: 'dimensiuni', unit: 'mm' },
  { key: 'engineCode', rubric: '13', label: 'Cod motor', kind: 'text', group: 'motor' },
  { key: 'engineCapacityCm3', rubric: 'P.1', label: 'Capacitate cilindrică', kind: 'number', group: 'motor', unit: 'cm³' },
  { key: 'enginePowerKw', rubric: 'P.2', label: 'Putere', kind: 'number', group: 'motor', unit: 'kW' },
  { key: 'fuelType', rubric: 'P.3', label: 'Combustibil / sursă energie', kind: 'text', group: 'motor' },
  { key: 'engineRpm', rubric: 'P.4', label: 'Turație nominală', kind: 'number', group: 'motor', unit: 'min⁻¹' },
  { key: 'engineSerial', rubric: 'P.5', label: 'Serie motor', kind: 'text', group: 'motor' },
  { key: 'propulsionSystem', rubric: '14', label: 'Sistem propulsie', kind: 'text', group: 'motor' },
  { key: 'electricMotorPowerKw', rubric: '15', label: 'Putere motor electric', kind: 'number', group: 'motor', unit: 'kW' },
  { key: 'driveType', rubric: '17', label: 'Tracțiune', kind: 'text', group: 'motor' },
  { key: 'emissionStandard', rubric: 'V.9', label: 'Normă poluare', kind: 'text', group: 'mediu' },
  { key: 'nationalEmissionCode', rubric: '16', label: 'Cod național emisii', kind: 'text', group: 'mediu' },
  { key: 'co2Gkm', rubric: 'V.7', label: 'CO₂', kind: 'number', group: 'mediu', unit: 'g/km' },
  { key: 'color', rubric: 'R', label: 'Culoare', kind: 'text', group: 'capacitate' },
  { key: 'seatsIncludingDriver', rubric: 'S.1', label: 'Număr locuri (cu șofer)', kind: 'number', group: 'capacitate' },
  { key: 'standingPlaces', rubric: 'S.2', label: 'Locuri în picioare', kind: 'number', group: 'capacitate' },
  { key: 'maxSpeedKmh', rubric: 'T', label: 'Viteză maximă', kind: 'number', group: 'capacitate', unit: 'km/h' },
  { key: 'powerToMassRatio', rubric: 'Q', label: 'Raport putere/masă', kind: 'number', group: 'capacitate', unit: 'kW/kg' },
  { key: 'stationaryNoiseDb', rubric: 'U.1', label: 'Nivel sonor staționare', kind: 'number', group: 'capacitate', unit: 'dB(A)' },
  { key: 'stationaryNoiseRpm', rubric: 'U.2', label: 'Turație la măsurare zgomot', kind: 'number', group: 'capacitate', unit: 'min⁻¹' },
  { key: 'movingNoiseDb', rubric: 'U.3', label: 'Nivel sonor în mers', kind: 'number', group: 'capacitate', unit: 'dB(A)' },
  { key: 'tyresFront', rubric: '18.1', label: 'Anvelope/jante față', kind: 'text', group: 'roți' },
  { key: 'tyresRear', rubric: '18.2', label: 'Anvelope/jante spate', kind: 'text', group: 'roți' },
  { key: 'suspensionFront', rubric: '19.1', label: 'Suspensie față', kind: 'text', group: 'roți' },
  { key: 'suspensionRear', rubric: '19.2', label: 'Suspensie spate', kind: 'text', group: 'roți' },
  { key: 'fuelTankCapacityL', rubric: 'W', label: 'Capacitate rezervor', kind: 'number', group: 'roți', unit: 'l' },
];

/**
 * Aliasuri de rubrici pe CIV 2016 → cheie civProfile (model 2024).
 * Numerele care s-au renumerotat (Anexa 2 RAR). Codurile literă (D.1, P.3…) rămân identice.
 */
export const CIV_RUBRIC_ALIASES_2016: Record<string, string> = {
  '2': 'manufactureYear',
  '3': 'usageCategory',
  '4': 'vehicleClass',
  // '5' pe 2016 = Caroserie, dar și „5. Număr național de registru” rămâne 5 pe 2024 —
  // nu mapăm bare „5” → bodyType (coliziune). Folosește eticheta „Caroserie” / format+context.
  '7': 'maxTrainMassKg',
  '8': 'actualMassKg',
  '9': 'maxCouplingMassKg',
  '10': 'lengthMm',
  '11': 'widthMm',
  '12': 'heightMm',
  '13': 'wheelbaseMm',
  '14': 'engineCode',
  '15': 'propulsionSystem',
  '16': 'electricMotorPowerKw',
  '17': 'nationalEmissionCode',
  '18': 'driveType',
  '19.1': 'tyresFront',
  '19.2': 'tyresRear',
  '20.1': 'suspensionFront',
  '20.2': 'suspensionRear',
  caroserie: 'bodyType',
};

/**
 * Etichete / coduri pe CIV-uri foarte vechi (instrucțiuni 1993) → cheie.
 * Cheile sunt normalizate (fără diacritice, lower-case) — vezi `normalizeCivRubricToken`.
 */
export const CIV_RUBRIC_ALIASES_1993: Record<string, string> = {
  marca: 'brand',
  tipul: 'typeVariantVersion',
  varianta: 'typeVariantVersion',
  caroseria: 'bodyType',
  anul_fabricatiei: 'manufactureYear',
  numarul_de_omologare: 'nationalRegisterNumber',
  proprie: 'curbMassKg',
  total_max_autorizata: 'maxTechnicalMassKg',
  sarcina_pe_carligul_de_remorcare: 'maxCouplingMassKg',
  remorcabila_cu_disp_de_franare: 'maxBrakedTrailerMassKg',
  remorcabila_fara_disp_de_franare: 'maxUnbrakedTrailerMassKg',
  tipul_motor: 'engineCode',
  serie: 'engineSerial',
  cilindree: 'engineCapacityCm3',
  putere_max: 'enginePowerKw',
  sursa_de_energie: 'fuelType',
  turatie: 'engineRpm',
  numarul_axelor: 'axleCount',
  tractiunea: 'driveType',
  in_mers: 'movingNoiseDb',
  in_stationare: 'stationaryNoiseDb',
  vit_max_constructiva: 'maxSpeedKmh',
  capacitatea_rezervorului: 'fuelTankCapacityL',
  culoarea: 'color',
};

/** Ținte în afara civProfile (coloane Vehicle / meta CIV). */
export type CivMetaTarget =
  | { kind: 'vin' }
  | { kind: 'civSeries' }
  | { kind: 'civIssuedOn' }
  | { kind: 'civRarOffice' }
  | { kind: 'civMentions' };

export type CivRubricResolution =
  | { kind: 'profile'; field: CivFieldDef }
  | CivMetaTarget
  | null;

const PROFILE_BY_KEY = new Map(CIV_PROFILE_FIELDS.map((f) => [f.key, f]));

export function normalizeCivRubricToken(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '_')
    .replace(/^_|_$/g, '');
}

const PROFILE_BY_RUBRIC_2024 = new Map(
  CIV_PROFILE_FIELDS.map((f) => [normalizeCivRubricToken(f.rubric), f]),
);

/** Meta / identificare care nu stau în civProfile. */
const META_BY_RUBRIC: Record<string, CivMetaTarget> = {
  e: { kind: 'vin' },
  vin: { kind: 'vin' },
  numar_de_identificare: { kind: 'vin' },
  numar_de_identificare_vehicul: { kind: 'vin' },
  serie_civ: { kind: 'civSeries' },
  x: { kind: 'civSeries' },
  y: { kind: 'civSeries' },
  data_eliberare: { kind: 'civIssuedOn' },
  reprezentanta_rar: { kind: 'civRarOffice' },
  mentiuni: { kind: 'civMentions' },
};

/**
 * Rezolvă o rubrică citită (OCR / import) către câmpul Fleet.
 * Important: numerele 1–20 diferă între 2016 și 2024 — pentru `unknown` mapăm
 * doar coduri stabile (litere: D.1, P.3…) + 2024; aliasurile numerice 2016 cer `format: '2016'`.
 */
export function resolveCivRubric(
  rawRubric: string,
  format: CivDocumentFormat = 'unknown',
): CivRubricResolution {
  const token = normalizeCivRubricToken(rawRubric);
  if (!token) return null;

  const meta = META_BY_RUBRIC[token];
  if (meta) return meta;

  if (format === '2016') {
    const key2016 = CIV_RUBRIC_ALIASES_2016[token];
    if (key2016) {
      const field = PROFILE_BY_KEY.get(key2016);
      if (field) return { kind: 'profile', field };
    }
  }

  if (format === '1993') {
    const key1993 = CIV_RUBRIC_ALIASES_1993[token];
    if (key1993) {
      const field = PROFILE_BY_KEY.get(key1993);
      if (field) return { kind: 'profile', field };
    }
  }

  const by2024 = PROFILE_BY_RUBRIC_2024.get(token);
  if (by2024 && !isAmbiguousRubricToken(token, format)) {
    return { kind: 'profile', field: by2024 };
  }

  // Coduri literă stabile (dacă OCR a citit „d1” / „p.3”).
  if (format === 'unknown' || format === '2016' || format === '1993') {
    const letterish = token.replace(/_/g, '.');
    const again = PROFILE_BY_RUBRIC_2024.get(letterish);
    if (again && !isAmbiguousRubricToken(letterish, format)) {
      return { kind: 'profile', field: again };
    }
  }

  // Pe format unknown / 1993: etichete text (marca, cilindree, …).
  if (format === 'unknown' || format === '1993') {
    const key1993 = CIV_RUBRIC_ALIASES_1993[token];
    if (key1993) {
      const field = PROFILE_BY_KEY.get(key1993);
      if (field) return { kind: 'profile', field };
    }
  }

  return null;
}

/** Rubrici 1 / 9 / L / G — ambigue între formatele CIV; pe `unknown` le ignorăm. */
function isAmbiguousRubricToken(token: string, format: CivDocumentFormat): boolean {
  if (format === '2024' || format === '2016') return false;
  if (/^\d+(\.\d+)?$/.test(token)) return true;
  if (/^[a-z]$/.test(token)) return true;
  return false;
}

export function normalizeCivProfile(raw: unknown): VehicleCivProfile {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: VehicleCivProfile = {};
  for (const f of CIV_PROFILE_FIELDS) {
    const v = (raw as Record<string, unknown>)[f.key];
    if (v === undefined || v === null || v === '') continue;
    if (f.kind === 'number' || f.kind === 'year') {
      const n = typeof v === 'number' ? v : Number(v);
      if (Number.isFinite(n)) out[f.key] = n;
    } else if (typeof v === 'string') {
      const t = v.trim();
      if (t) out[f.key] = t;
    }
  }
  return out;
}

export function civProfileFilledCount(profile: VehicleCivProfile): number {
  return CIV_PROFILE_FIELDS.filter((f) => profile[f.key] != null && profile[f.key] !== '').length;
}
