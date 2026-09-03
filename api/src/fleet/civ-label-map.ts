/**
 * Mapare CIV pe denumiri de câmp (formular), fără indici de rubrică (17 vs 18, D.1…).
 * Layout: etichetă stânga terminată cu ":" → valoare dreapta (text / alfanumeric / "-").
 */

import { CIV_PROFILE_FIELDS, type CivFieldKind } from './vehicle-civ-fields';
import { isPlausibleCivValue, isPlausibleVin } from './civ-text-quality';

export type CivLabelTargetKind =
  | 'profile'
  | 'vin'
  | 'civSeries'
  | 'civIssuedOn'
  | 'civRarOffice'
  | 'civMentions';

export type CivLabelFieldSpec = {
  /** Cheie civProfile sau meta. */
  key: string;
  kind: CivLabelTargetKind;
  fieldKind?: CivFieldKind;
  /** Etichete CIV / formular (fără ":"). Ordinea = prioritate. */
  labels: string[];
  /** Validare valoare; false → nu mapăm. */
  validate?: (value: string) => boolean;
};

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '');
}

/** Normalizare pentru comparare etichete. */
export function normalizeCivLabel(raw: string): string {
  return stripDiacritics(raw)
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isEmptyCivValue(raw: string): boolean {
  const v = raw.trim();
  if (!v) return true;
  // „-” pe CIV = lipsă; OCR confundă uneori cu ) ( . ; /
  if (v === '-' || v === '—' || v === '–' || /^-+$/.test(v)) return true;
  if (/^[)(\]\[}{.;,:\/\\|_*]+$/.test(v)) return true;
  return false;
}

function isYear(v: string): boolean {
  return /^(19|20)\d{2}$/.test(v.trim());
}

function isPositiveNumber(v: string, min: number, max: number): boolean {
  const cleaned = String(v)
    .replace(/\s/g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= min && n <= max;
}

function isFuel(v: string): boolean {
  return /^(MOTORINA|MOTORINA|BENZINA|BENZINA|GPL|ELECTRIC|HIBRID|HIBRIDA|MOTORINĂ|BENZINĂ|HIBRIDĂ)$/i.test(
    stripDiacritics(v).replace(/\s+/g, ''),
  );
}

function isDrive(v: string): boolean {
  return /^(FATA|FATA|SPATE|INTEGRALA|INTEGRALA|4X4)$/i.test(
    stripDiacritics(v).replace(/\s+/g, ''),
  );
}

function looksLikeLabelNotValue(v: string): boolean {
  const n = normalizeCivLabel(v);
  if (!n) return true;
  if (/^(marca|tip|varianta|versiune|caroserie|categorie|culoare|tractiune|serie|an |data |numar)/i.test(n)) {
    return true;
  }
  // Etichetă lungă tip „combustibil sau sursa de energie”
  if (n.length > 48 && /\s/.test(n) && !/\d/.test(n)) return true;
  return false;
}

/**
 * Catalog: câmp formular → denumiri pe CIV.
 * Indicii (D.1, 18, P.5) NU sunt folosite ca cheie de mapare.
 */
export const CIV_LABEL_FIELDS: CivLabelFieldSpec[] = [
  // --- meta (în afara civProfile) ---
  {
    key: 'vin',
    kind: 'vin',
    labels: [
      'Număr de identificare',
      'Numarul de identificare',
      'Numărul de identificare',
      'Numar de identificare',
      'VIN',
    ],
    validate: (v) => isPlausibleVin(v.replace(/\s+/g, '')),
  },
  {
    key: 'civSeries',
    kind: 'civSeries',
    labels: ['Serie CIV', 'Seria CIV', 'Seria C.I.V.', 'Serie C.I.V.'],
    validate: (v) => isCivSeriesCode(v),
  },
  {
    key: 'civIssuedOn',
    kind: 'civIssuedOn',
    labels: [
      'Data eliberării',
      'Data eliberarii',
      'Dată eliberare',
      'Data eliberare',
      'Data emiterii',
    ],
    validate: (v) => /\d{1,2}[.\-/]\d{1,2}[.\-/]\d{4}/.test(v) || /^\d{4}-\d{2}-\d{2}$/.test(v),
  },
  {
    key: 'civRarOffice',
    kind: 'civRarOffice',
    labels: [
      'Reprezentanță RAR',
      'Reprezentanta RAR',
      'Reprezentanţa RAR',
      'Reprezentanta R.A.R.',
      'Reprezentanță R.A.R.',
    ],
    validate: (v) => {
      const t = v.trim();
      if (isEmptyCivValue(t) || looksLikeLabelNotValue(t)) return false;
      if (/^\d+([.,]\d+)?$/.test(t)) return false; // nu mase (580)
      if (!/[A-Za-zĂÂÎȘȚăâîșț]/.test(t)) return false;
      return isPlausibleCivValue(t, { maxLen: 80 }) && t.length >= 3;
    },
  },
  {
    key: 'civMentions',
    kind: 'civMentions',
    labels: ['Mențiuni', 'Mentiuni', 'Menţiuni'],
    validate: (v) => isPlausibleCivValue(v, { maxLen: 2000 }) && !isEmptyCivValue(v),
  },

  // --- identificare ---
  {
    key: 'brand',
    kind: 'profile',
    fieldKind: 'text',
    labels: ['Marcă', 'Marca'],
    validate: (v) => {
      const t = v.trim();
      if (!t || /\d/.test(t)) return false; // mărci fără cifre; respinge coduri motor
      if (/clas[aă]|categorie|an fabric|cod|motor/i.test(t)) return false;
      // Evită engleza „seat” din „driver's seat”; permite marca SEAT (majuscule).
      if (/^seats?$/i.test(t) && t !== 'SEAT') return false;
      return /^[A-ZĂÂÎȘȚ][A-Za-zăâîșțĂÂÎȘȚ \-]{1,24}$/.test(t);
    },
  },
  {
    key: 'typeVariantVersion',
    kind: 'profile',
    fieldKind: 'text',
    labels: [
      'Tip – variantă – versiune',
      'Tip - variantă - versiune',
      'Tip / variantă / versiune',
      'Tipul / varianta / versiunea',
    ],
    validate: (v) =>
      isPlausibleCivValue(v, { maxLen: 80 }) &&
      !looksLikeLabelNotValue(v) &&
      !/cilindree|motorina|benzina/i.test(v),
  },
  {
    key: 'commercialName',
    kind: 'profile',
    fieldKind: 'text',
    labels: ['Denumire comercială', 'Denumire comerciala', 'Denumirea comercială'],
    validate: (v) => isPlausibleCivValue(v, { maxLen: 60 }) && !looksLikeLabelNotValue(v),
  },
  {
    key: 'manufactureYear',
    kind: 'profile',
    fieldKind: 'year',
    labels: ['An fabricație', 'An fabricatie', 'Anul fabricației', 'Anul fabricatiei'],
    validate: isYear,
  },
  {
    key: 'homologationCategory',
    kind: 'profile',
    fieldKind: 'text',
    // Pe CIV: „J. Categorie:” → după curățare rămâne „Categorie” (nu „de folosință”).
    labels: ['Categorie omologare', 'Categorie'],
    validate: (v) =>
      /^(M|N|O|L|T|C|R|S)\d{0,2}[A-Z0-9]*$/i.test(v.trim()) && !/folosint|autoturism|an fabric/i.test(v),
  },
  {
    key: 'usageCategory',
    kind: 'profile',
    fieldKind: 'text',
    labels: ['Categorie de folosință', 'Categorie de folosinta', 'Categoria de folosință'],
    validate: (v) => {
      const t = v.trim();
      if (/^\d+\.?$/.test(t) || isYear(t) || /^an\s*fabric/i.test(t)) return false;
      if (looksLikeLabelNotValue(t)) return false;
      return /autoturism|autobuz|autocamion|motociclet|remorc|tractor|special/i.test(t) || t.length >= 6;
    },
  },
  {
    key: 'bodyType',
    kind: 'profile',
    fieldKind: 'text',
    labels: ['Caroserie', 'Caroseria'],
    validate: (v) =>
      isPlausibleCivValue(v, { maxLen: 60 }) &&
      !looksLikeLabelNotValue(v) &&
      !/clas[aă]|numai pentru|autoturism\s*m\d/i.test(v),
  },
  {
    key: 'typeApprovalNumber',
    kind: 'profile',
    fieldKind: 'text',
    labels: ['Număr omologare de tip', 'Numar omologare de tip', 'Numărul de omologare'],
    validate: (v) => isPlausibleCivValue(v, { maxLen: 80 }) && /[0-9]/.test(v),
  },
  {
    key: 'nationalRegisterNumber',
    kind: 'profile',
    fieldKind: 'text',
    labels: ['Număr național de registru', 'Numar national de registru', 'Numărul național de registru'],
    validate: (v) => isPlausibleCivValue(v, { maxLen: 40 }) && /[A-Z0-9]/i.test(v),
  },

  // --- mase (MTMA = masă maximă tehnic admisibilă) ---
  {
    key: 'axleCount',
    kind: 'profile',
    fieldKind: 'number',
    labels: ['Număr axe', 'Numar axe', 'Numărul axelor', 'Numarul axelor'],
    validate: (v) => isPositiveNumber(v, 1, 8),
  },
  {
    key: 'maxTechnicalMassKg',
    kind: 'profile',
    fieldKind: 'number',
    // App: „Masă maximă tehnic admisă” ↔ CIV: formularea completă (excepție motociclete).
    labels: [
      'Masă maximă tehnic admisibilă, cu excepția motocicletelor',
      'Masa maximă tehnic admisibilă, cu excepția motocicletelor',
      'Masă maximă tehnic admisă',
      'Masa maximă tehnic admisă',
    ],
    validate: (v) => isPositiveNumber(v, 200, 80000),
  },
  {
    key: 'maxTrainMassKg',
    kind: 'profile',
    fieldKind: 'number',
    labels: [
      'MTMA ansamblu vehicule',
      'Masă maximă tehnic admisibilă a ansamblului de vehicule',
      'Masa maximă tehnic admisibilă a ansamblului de vehicule',
    ],
    validate: (v) => isPositiveNumber(v, 200, 100000),
  },
  {
    key: 'axle1MaxMassKg',
    kind: 'profile',
    fieldKind: 'number',
    labels: ['MTMA axa 1', 'Masă maximă tehnic admisibilă a axei 1'],
    validate: (v) => isPositiveNumber(v, 100, 30000),
  },
  {
    key: 'axle2MaxMassKg',
    kind: 'profile',
    fieldKind: 'number',
    labels: ['MTMA axa 2', 'Masă maximă tehnic admisibilă a axei 2'],
    validate: (v) => isPositiveNumber(v, 100, 30000),
  },
  {
    key: 'axle3MaxMassKg',
    kind: 'profile',
    fieldKind: 'number',
    labels: ['MTMA axa 3', 'Masă maximă tehnic admisibilă a axei 3'],
    validate: (v) => isPositiveNumber(v, 100, 30000),
  },
  {
    key: 'curbMassKg',
    kind: 'profile',
    fieldKind: 'number',
    labels: ['Masă în ordine de mers', 'Masa in ordine de mers', 'Masă proprie', 'Proprie'],
    validate: (v) => isPositiveNumber(v, 200, 50000),
  },
  {
    key: 'actualMassKg',
    kind: 'profile',
    fieldKind: 'number',
    labels: ['Masă reală', 'Masa reala'],
    validate: (v) => isPositiveNumber(v, 200, 50000),
  },
  {
    key: 'maxBrakedTrailerMassKg',
    kind: 'profile',
    fieldKind: 'number',
    labels: [
      'Masă remorcabilă cu frână',
      'Masă maximă remorcabilă cu dispozitiv de frânare',
      'Remorcabilă cu disp. de frânare',
    ],
    validate: (v) => isPositiveNumber(v, 0, 50000),
  },
  {
    key: 'maxUnbrakedTrailerMassKg',
    kind: 'profile',
    fieldKind: 'number',
    labels: [
      'Masă remorcabilă fără frână',
      'Masă maximă remorcabilă fără dispozitiv de frânare',
      'Remorcabilă fără disp. de frânare',
    ],
    validate: (v) => isPositiveNumber(v, 0, 50000),
  },
  {
    key: 'maxCouplingMassKg',
    kind: 'profile',
    fieldKind: 'number',
    labels: [
      'Masă max. punct cuplare',
      'Masă maximă tehnic admisibilă în punctul de cuplare',
      'Sarcina pe cârligul de remorcare',
    ],
    validate: (v) => isPositiveNumber(v, 0, 5000),
  },

  // --- dimensiuni ---
  {
    key: 'lengthMm',
    kind: 'profile',
    fieldKind: 'number',
    labels: ['Lungime'],
    validate: (v) => isPositiveNumber(v, 1500, 25000),
  },
  {
    key: 'widthMm',
    kind: 'profile',
    fieldKind: 'number',
    labels: ['Lățime', 'Latime', 'Lăţime'],
    validate: (v) => isPositiveNumber(v, 800, 4000),
  },
  {
    key: 'heightMm',
    kind: 'profile',
    fieldKind: 'number',
    labels: ['Înălțime', 'Inaltime', 'Înălţime'],
    validate: (v) => isPositiveNumber(v, 800, 5000),
  },
  {
    key: 'wheelbaseMm',
    kind: 'profile',
    fieldKind: 'number',
    labels: ['Distanță între axe', 'Distanta intre axe', 'Ampatament'],
    validate: (v) => isPositiveNumber(v, 1000, 12000),
  },

  // --- motor ---
  {
    key: 'engineCode',
    kind: 'profile',
    fieldKind: 'text',
    labels: ['Cod motor', 'Codul motorului', 'Tipul motor'],
    validate: (v) => {
      const compact = v.replace(/\s+/g, '');
      return (
        /^[A-Z0-9][A-Z0-9\-]{2,14}$/i.test(compact) && !/cilindree|putere|codul/i.test(v)
      );
    },
  },
  {
    key: 'engineCapacityCm3',
    kind: 'profile',
    fieldKind: 'number',
    labels: ['Capacitate cilindrică', 'Capacitate cilindrica', 'Cilindree'],
    validate: (v) => isPositiveNumber(v, 50, 20000),
  },
  {
    key: 'enginePowerKw',
    kind: 'profile',
    fieldKind: 'number',
    labels: ['Putere', 'Putere max', 'Putere maximă'],
    validate: (v) => isPositiveNumber(v, 5, 800),
  },
  {
    key: 'fuelType',
    kind: 'profile',
    fieldKind: 'text',
    labels: [
      'Combustibil / sursă energie',
      'Tip combustibil sau sursă de energie',
      'Tip combustibil sau sursa de energie',
      'Sursa de energie',
      'Combustibil',
    ],
    validate: (v) => isFuel(v) || (/^[A-ZĂÂÎȘȚa-zăâîșț \-]{3,40}$/.test(v) && !looksLikeLabelNotValue(v)),
  },
  {
    key: 'engineRpm',
    kind: 'profile',
    fieldKind: 'number',
    labels: ['Turație nominală', 'Turatie nominala', 'Turaţie nominală'],
    validate: (v) => isPositiveNumber(v, 500, 12000),
  },
  {
    key: 'engineSerial',
    kind: 'profile',
    fieldKind: 'text',
    labels: ['Serie motor', 'Seria motor'],
    validate: (v) => {
      const s = v.replace(/\s+/g, '').toUpperCase();
      if (isPlausibleVin(s)) return false;
      if (/serie\s*civ/i.test(v)) return false;
      return /^[A-Z0-9]{4,20}$/i.test(s) && isPlausibleCivValue(v, { maxLen: 24 });
    },
  },
  {
    key: 'propulsionSystem',
    kind: 'profile',
    fieldKind: 'text',
    labels: ['Sistem propulsie', 'Sistem de propulsie'],
    validate: (v) => isPlausibleCivValue(v, { maxLen: 60 }) && !looksLikeLabelNotValue(v),
  },
  {
    key: 'electricMotorPowerKw',
    kind: 'profile',
    fieldKind: 'number',
    labels: ['Putere motor electric'],
    validate: (v) => isPositiveNumber(v, 0, 800),
  },
  {
    key: 'driveType',
    kind: 'profile',
    fieldKind: 'text',
    labels: ['Tracțiune', 'Tractiune', 'Tracţiune', 'Tracțiunea', 'Tractiunea'],
    validate: (v) => isDrive(v),
  },

  // --- mediu / capacitate / roți ---
  {
    key: 'emissionStandard',
    kind: 'profile',
    fieldKind: 'text',
    labels: ['Normă poluare', 'Norma de poluare', 'Normă de poluare CE', 'Norma de poluare CE'],
    validate: (v) => {
      const t = v.trim();
      if (isEmptyCivValue(t)) return false;
      // Respinge OCR „)” pentru „-”; cere literă/cifră (Euro 5, E5, …).
      if (!/[A-Za-z0-9]/.test(t)) return false;
      return isPlausibleCivValue(t, { maxLen: 40 });
    },
  },
  {
    key: 'nationalEmissionCode',
    kind: 'profile',
    fieldKind: 'text',
    labels: ['Cod național emisii', 'Cod national de emisii', 'Cod naţional de emisii'],
    validate: (v) => /^[A-Z0-9]{1,8}$/i.test(v.trim()),
  },
  {
    key: 'co2Gkm',
    kind: 'profile',
    fieldKind: 'number',
    labels: ['CO₂', 'CO2', 'Emisii CO2'],
    validate: (v) => isPositiveNumber(v.replace(/[^\d.,]/g, ''), 1, 800),
  },
  {
    key: 'color',
    kind: 'profile',
    fieldKind: 'text',
    labels: ['Culoare', 'Culoarea'],
    validate: (v) =>
      /^[A-ZĂÂÎȘȚa-zăâîșț]{3,24}$/.test(v.trim()) && !looksLikeLabelNotValue(v),
  },
  {
    key: 'seatsIncludingDriver',
    kind: 'profile',
    fieldKind: 'number',
    labels: [
      'Număr locuri (cu șofer)',
      'Număr locuri, inclusiv locul conducătorului auto',
      'Numar locuri',
      'Locuri',
    ],
    validate: (v) => isPositiveNumber(v, 1, 80),
  },
  {
    key: 'standingPlaces',
    kind: 'profile',
    fieldKind: 'number',
    labels: ['Locuri în picioare', 'Număr locuri în picioare'],
    validate: (v) => isPositiveNumber(v, 0, 200),
  },
  {
    key: 'maxSpeedKmh',
    kind: 'profile',
    fieldKind: 'number',
    labels: ['Viteză maximă', 'Viteza maximă', 'Vit. max constructiva', 'Viteză maximă constructivă'],
    validate: (v) => isPositiveNumber(v, 40, 400),
  },
  {
    key: 'stationaryNoiseDb',
    kind: 'profile',
    fieldKind: 'number',
    labels: ['Nivel sonor staționare', 'Nivel sonor in stationare'],
    validate: (v) => isPositiveNumber(v, 40, 120),
  },
  {
    key: 'movingNoiseDb',
    kind: 'profile',
    fieldKind: 'number',
    labels: ['Nivel sonor în mers', 'Nivel sonor in mers'],
    validate: (v) => isPositiveNumber(v, 40, 120),
  },
  {
    key: 'tyresFront',
    kind: 'profile',
    fieldKind: 'text',
    labels: ['Anvelope/jante față', 'Anvelope/jante axe față', 'Anvelope/jante axe fata'],
    validate: (v) => /\d{3}\/\d{2}/.test(v) || /R\d{2}/i.test(v),
  },
  {
    key: 'tyresRear',
    kind: 'profile',
    fieldKind: 'text',
    labels: ['Anvelope/jante spate', 'Anvelope/jante axe spate'],
    validate: (v) => /\d{3}\/\d{2}/.test(v) || /R\d{2}/i.test(v),
  },
  {
    key: 'suspensionFront',
    kind: 'profile',
    fieldKind: 'text',
    labels: ['Suspensie față', 'Suspensie axe față', 'Suspensie axe fata'],
    validate: (v) => isPlausibleCivValue(v, { maxLen: 80 }) && !looksLikeLabelNotValue(v),
  },
  {
    key: 'suspensionRear',
    kind: 'profile',
    fieldKind: 'text',
    labels: ['Suspensie spate', 'Suspensie axe spate'],
    validate: (v) => isPlausibleCivValue(v, { maxLen: 80 }) && !looksLikeLabelNotValue(v),
  },
  {
    key: 'fuelTankCapacityL',
    kind: 'profile',
    fieldKind: 'number',
    labels: ['Capacitate rezervor', 'Capacitatea rezervorului', 'Capacitate rezervor (l)'],
    validate: (v) => isPositiveNumber(v, 10, 500),
  },
];

// Asigură că fiecare cheie profile din UI are cel puțin label-ul din CIV_PROFILE_FIELDS.
for (const f of CIV_PROFILE_FIELDS) {
  const existing = CIV_LABEL_FIELDS.find((x) => x.kind === 'profile' && x.key === f.key);
  if (!existing) {
    CIV_LABEL_FIELDS.push({
      key: f.key,
      kind: 'profile',
      fieldKind: f.kind,
      labels: [f.label],
      validate: (v) => isPlausibleCivValue(v, { maxLen: 120 }) && !isEmptyCivValue(v),
    });
  } else if (!existing.labels.some((l) => normalizeCivLabel(l) === normalizeCivLabel(f.label))) {
    existing.labels = [f.label, ...existing.labels];
  }
}

export type CivLabelPair = {
  label: string;
  labelNorm: string;
  value: string;
  source: 'same-line';
};

/** Serie CIV pe față: 1 literă + 6 cifre (sub barcode / QR). */
export function isCivSeriesCode(raw: string): boolean {
  const s = raw.replace(/\s+/g, '').toUpperCase();
  if (isPlausibleVin(s)) return false;
  return /^[A-HJ-NP-Z]\d{6}$/.test(s);
}

/**
 * Extrage perechi etichetă: / valoare din text OCR.
 * Doar pe aceeași linie (etichetă stânga cu ":" → valoare dreapta). Fără fallback pe linia următoare.
 */
export function extractCivLabelValuePairs(text: string): CivLabelPair[] {
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0);

  const pairs: CivLabelPair[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    // Scoate prefix rubrică opțional „D.1.” / „18.” / „P.3.” — nu e folosit la match, doar curăță eticheta.
    const cleaned = line.replace(
      /^(?:[A-Z]\.?\s*)?\d{1,2}(?:\.\d+)?\.?\s+/i,
      '',
    );
    const m =
      /^(.{2,90}?)\s*:\s*(.*)$/.exec(cleaned) ||
      /^(.{2,90}?)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;

    let label = m[1]!.trim();
    // Dacă a rămas un cod scurt la începutul etichetei (D.1 Marca), păstrăm textul denumirii.
    label = label.replace(/^[A-Z]\.?\d{0,2}\.?\s+/i, '').trim();
    label = label.replace(/^\d{1,2}(?:\.\d+)?\.?\s+/i, '').trim();

    const value = (m[2] ?? '').trim();
    if (isEmptyCivValue(value)) continue;
    if (looksLikeLabelNotValue(value) && value.length > 20) continue;

    pairs.push({
      label,
      labelNorm: normalizeCivLabel(label),
      value,
      source: 'same-line',
    });
  }

  return pairs;
}

function labelMatchScore(fieldLabelNorm: string, pairLabelNorm: string): number {
  if (!fieldLabelNorm || !pairLabelNorm) return 0;
  if (fieldLabelNorm === pairLabelNorm) return 100;
  if (pairLabelNorm.startsWith(fieldLabelNorm) || fieldLabelNorm.startsWith(pairLabelNorm)) {
    return 85;
  }
  if (pairLabelNorm.includes(fieldLabelNorm) && fieldLabelNorm.length >= 6) return 70;
  if (fieldLabelNorm.includes(pairLabelNorm) && pairLabelNorm.length >= 6) return 65;
  // Token overlap
  const a = new Set(fieldLabelNorm.split(' ').filter((t) => t.length > 2));
  const b = new Set(pairLabelNorm.split(' ').filter((t) => t.length > 2));
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const ratio = inter / Math.max(a.size, b.size);
  if (ratio >= 0.75) return 55;
  if (ratio >= 0.5 && inter >= 2) return 40;
  return 0;
}

export type CivLabelMapHit = {
  key: string;
  kind: CivLabelTargetKind;
  label: string;
  value: string;
  score: number;
};

const MIN_SCORE = 55;

/**
 * Mapează perechi etichetă/valoare → câmpuri formular (doar pe denumiri).
 */
export function mapCivPairsToFields(pairs: CivLabelPair[]): CivLabelMapHit[] {
  const hits: CivLabelMapHit[] = [];
  const usedPairIdx = new Set<number>();

  // Câmpuri cu etichete mai lungi / mai specifice primul (Serie CIV înaintea Serie).
  const fields = [...CIV_LABEL_FIELDS].sort((a, b) => {
    const la = Math.max(...a.labels.map((x) => x.length));
    const lb = Math.max(...b.labels.map((x) => x.length));
    return lb - la;
  });

  for (const field of fields) {
    let best: { idx: number; score: number; label: string; value: string } | null = null;

    for (let i = 0; i < pairs.length; i++) {
      if (usedPairIdx.has(i)) continue;
      const pair = pairs[i]!;
      let score = 0;
      let matchedLabel = field.labels[0] ?? '';
      for (const lab of field.labels) {
        const s = labelMatchScore(normalizeCivLabel(lab), pair.labelNorm);
        if (s > score) {
          score = s;
          matchedLabel = lab;
        }
      }
      // Penalizare: „Serie motor” nu trebuie să bată „Serie CIV”
      if (field.key === 'civSeries' && /motor/i.test(pair.label)) score = 0;
      if (field.key === 'engineSerial' && /\bciv\b/i.test(pair.labelNorm)) score = 0;
      // „Categorie” scurt = omologare (J); „Categorie de folosință” = usage.
      if (field.key === 'homologationCategory' && /folosint/i.test(pair.labelNorm)) score = 0;
      if (field.key === 'homologationCategory' && pair.labelNorm === 'categorie') score = Math.max(score, 90);
      if (field.key === 'usageCategory' && pair.labelNorm === 'categorie') score = 0;
      if (field.key === 'usageCategory' && /omolog/i.test(pair.labelNorm) && !/folosint/i.test(pair.labelNorm)) {
        score = Math.min(score, 40);
      }
      if (field.key === 'manufactureYear' && /folosint|categorie de/i.test(pair.labelNorm)) score = 0;

      if (score < MIN_SCORE) continue;

      let value = pair.value.trim();
      // Numere: „2634 ;” / „1670 kg” → extrage partea numerică înainte de validare.
      if (field.fieldKind === 'number' || field.fieldKind === 'year') {
        const num = value.match(/-?\d+(?:[.,]\d+)?/);
        if (num) value = num[0]!.replace(',', '.');
      }
      // CO2: extrage numărul
      if (field.key === 'co2Gkm') {
        const num = value.match(/(\d{1,3}(?:[.,]\d+)?)/);
        if (num) value = num[1]!.replace(',', '.');
      }
      if (field.kind === 'vin') value = value.replace(/\s+/g, '').toUpperCase();
      if (field.key === 'engineCode') value = value.replace(/\s+/g, '');
      if (field.key === 'commercialName') {
        value = value.replace(/^VEHICUL\s+/i, '').trim();
      }
      if (isEmptyCivValue(value)) continue;
      if (field.validate && !field.validate(value)) continue;
      if (!isPlausibleCivValue(value, { maxLen: field.key === 'civMentions' ? 2000 : 180 })) continue;

      if (!best || score > best.score) {
        best = { idx: i, score, label: matchedLabel, value };
      }
    }

    if (best) {
      usedPairIdx.add(best.idx);
      hits.push({
        key: field.key,
        kind: field.kind,
        label: best.label,
        value: best.value,
        score: best.score,
      });
    }
  }

  return hits;
}

/** Fallback VIN dacă eticheta lipsește din OCR. */
export function findVinInText(text: string): string | null {
  const m =
    /\b(UU1[A-HJ-NPR-Z0-9]{14}|WF0[A-HJ-NPR-Z0-9]{14}|WVW[A-HJ-NPR-Z0-9]{14}|[A-HJ-NPR-Z0-9]{17})\b/i.exec(
      text,
    );
  if (m && isPlausibleVin(m[1]!)) return m[1]!.toUpperCase();
  return null;
}

/**
 * Serie CIV pe față: literă + 6 cifre, preferat lângă „Serie CIV” / barcode.
 * Nu caută pe verso (caller transmite doar textul feței).
 */
export function findCivSeriesInFrontText(text: string): string | null {
  // Nu confunda cu serie motor (ex. R196021 pe pag. 3).
  const withoutEngine = text.replace(
    /serie\s*motor[\s\S]{0,40}?[A-Z0-9]{4,20}/gi,
    ' ',
  );

  const nearLabel =
    /(?:serie|seria)\s*c\.?\s*i\.?\s*v\.?\s*[:\s]*([A-HJ-NP-Z]\d{6})\b/i.exec(withoutEngine) ||
    /\b([A-HJ-NP-Z]\d{6})\b[\s\S]{0,40}?(?:serie|seria)\s*c\.?\s*i\.?\s*v/i.exec(withoutEngine);
  if (nearLabel && isCivSeriesCode(nearLabel[1]!)) return nearLabel[1]!.toUpperCase();

  // „J 4 5 9 5 1 3” SAU „J 4 5 9 5 13” (Vision lipește ultimele două cifre).
  const compactSpaced = [
    ...withoutEngine.matchAll(/\b([A-HJ-NP-Z])\s+(\d)\s+(\d)\s+(\d)\s+(\d)\s+(\d)\s+(\d)\b/gi),
  ].map((m) => `${m[1]}${m[2]}${m[3]}${m[4]}${m[5]}${m[6]}${m[7]}`.toUpperCase());
  for (const c of compactSpaced) {
    if (isCivSeriesCode(c)) return c;
  }
  const gluedSpaced = [
    ...withoutEngine.matchAll(/\b([A-HJ-NP-Z])((?:\s+\d{1,2}){4,6})\b/gi),
  ].map((m) => `${m[1]}${m[2]!.replace(/\s+/g, '')}`.toUpperCase());
  for (const c of gluedSpaced) {
    if (isCivSeriesCode(c)) return c;
  }

  // „P 541981” / „P541981” — literă + 6 cifre (posibil spațiu).
  const letterDigits = [
    ...withoutEngine.matchAll(/\b([A-HJ-NP-Z])\s*(\d{6})\b/gi),
  ].map((m) => `${m[1]}${m[2]}`.toUpperCase());
  for (const c of letterDigits) {
    if (isCivSeriesCode(c)) return c;
  }

  // Literă pe o linie, 6 cifre pe următoarea (OCR barcode fragmentat).
  const lineBroken = [
    ...withoutEngine.matchAll(/\b([A-HJ-NP-Z])\s*\n\s*(\d{6})\b/gi),
  ].map((m) => `${m[1]}${m[2]}`.toUpperCase());
  for (const c of lineBroken) {
    if (isCivSeriesCode(c)) return c;
  }

  const candidates = [...withoutEngine.matchAll(/\b([A-HJ-NP-Z]\d{6})\b/gi)].map((m) =>
    m[1]!.toUpperCase(),
  );
  const unique = [
    ...new Set([...candidates, ...compactSpaced, ...gluedSpaced, ...letterDigits, ...lineBroken]),
  ].filter(isCivSeriesCode);
  // Pe CIV moderne seria tipărită e frecvent P###### — preferă față de R###### (serie motor).
  const pSeries = unique.filter((s) => s.startsWith('P'));
  if (pSeries.length === 1) return pSeries[0]!;
  if (unique.length === 1 && !unique[0]!.startsWith('R')) return unique[0]!;

  // Vision rupe barcode-ul spațiat „S 8 6 9 7 4 0” în: „S eliberare” / „86: e2” / „9740 AF183…”.
  const splitBarcode =
    /\b([A-HJ-NP-Z])\s+eliberare[\s\S]{0,120}?(\d{2})\s*:[\s\S]{0,280}?\b(\d{4})\s+[A-Z]{2}\d/i.exec(
      withoutEngine,
    );
  if (splitBarcode) {
    const glued = `${splitBarcode[1]}${splitBarcode[2]}${splitBarcode[3]}`.toUpperCase();
    if (isCivSeriesCode(glued)) return glued;
  }
  return null;
}

export function parseCivIssuedOnIso(raw: string): string | null {
  const m =
    /(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/.exec(raw) ||
    /(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/.exec(raw);
  if (!m) return null;
  let y: string;
  let mo: string;
  let d: string;
  if (m[1]!.length === 4) {
    y = m[1]!;
    mo = m[2]!.padStart(2, '0');
    d = m[3]!.padStart(2, '0');
  } else {
    d = m[1]!.padStart(2, '0');
    mo = m[2]!.padStart(2, '0');
    y = m[3]!;
  }
  const iso = `${y}-${mo}-${d}`;
  const dt = new Date(`${iso}T12:00:00.000Z`);
  return Number.isNaN(dt.getTime()) ? null : iso;
}
