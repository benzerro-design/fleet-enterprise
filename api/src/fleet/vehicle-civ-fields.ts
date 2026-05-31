/** Chei pentru câmpurile din civProfile (JSON pe Vehicle). */
export type VehicleCivProfile = Record<string, string | number | null>;

export type CivFieldKind = 'text' | 'number' | 'year';

export type CivFieldDef = {
  key: string;
  rubric: string;
  label: string;
  kind: CivFieldKind;
  group: 'identificare' | 'mase' | 'dimensiuni' | 'motor' | 'mediu' | 'capacitate' | 'roți' | 'altele';
  unit?: string;
};

export const CIV_FIELD_GROUPS: { id: CivFieldDef['group']; label: string }[] = [
  { id: 'identificare', label: 'Identificare (pag. 1)' },
  { id: 'mase', label: 'Mase și remorcare' },
  { id: 'dimensiuni', label: 'Dimensiuni' },
  { id: 'motor', label: 'Motor / propulsie' },
  { id: 'mediu', label: 'Mediu și omologare' },
  { id: 'capacitate', label: 'Capacitate și performanță' },
  { id: 'roți', label: 'Roți, suspensie, rezervor' },
  { id: 'altele', label: 'Altele' },
];

/** Rubrici CIV standard (format 2024+) — valorile se stochează în Vehicle.civProfile. */
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
