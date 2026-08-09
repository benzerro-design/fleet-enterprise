import {
  CIV_PROFILE_FIELDS,
  CIV_RUBRIC_ALIASES_1993,
  normalizeCivRubricToken,
  resolveCivRubric,
  type CivDocumentFormat,
  type VehicleCivProfile,
} from './vehicle-civ-fields';
import { isPlausibleCivValue, isPlausibleVin } from './civ-text-quality';

export type CivExtractMatch = {
  rubric: string;
  target: string;
  value: string;
};

export type CivExtractPreview = {
  civProfile: VehicleCivProfile;
  civSeries: string | null;
  civIssuedOn: string | null;
  civRarOffice: string | null;
  civMentions: string | null;
  vin: string | null;
  matched: CivExtractMatch[];
  unmatchedLines: string[];
  formatUsed: CivDocumentFormat;
  source: 'text' | 'file';
};

const LABEL_STRIP =
  /^(marca|tip|varianta|versiune|denumire\s+comerciala|an\s+fabricatie|categorie|clasa|caroserie|numar|masa|lungime|latime|inaltime|cod\s+motor|capacitate|putere|combustibil|serie\s+motor|norma|culoare|locuri|viteza|anvelope|suspensie|rezervor|tractiune|co2|mentiuni)\s*[:.\-–]?\s*/i;

/** Heuristic format detection from OCR text. */
export function detectCivDocumentFormat(text: string): CivDocumentFormat {
  const t = text.toLowerCase();
  if (/\b2\.\s*an\s+fabrica/.test(t) || /\b14\.\s*cod\s+motor/.test(t) || /\b20\.1\s*suspensie/.test(t)) {
    return '2016';
  }
  // CIV vechi (grilă 1–19): Marca / Caroseria / Numărul de identificare, fără D.1
  if (
    !/\bd\.1\b/.test(t) &&
    (/num[aă]r(?:ul)?\s+de\s+identificare/.test(t) ||
      (/\bmarca\b/.test(t) && (/\bcaroseria\b/.test(t) || /\bcategoria\b/.test(t) || /\bcilindree\b/.test(t))))
  ) {
    return '1993';
  }
  if (/\bmarca\b/.test(t) && /\bcilindree\b/.test(t) && !/\bd\.1\b/.test(t)) {
    return '1993';
  }
  if (/\bd\.1\b/.test(t) || /\b1\.\s*an\s+fabrica/.test(t) || /\bp\.3\b/.test(t)) {
    return '2024';
  }
  return 'unknown';
}

function cleanValue(raw: string): string {
  let v = raw.replace(/\s+/g, ' ').trim();
  v = v.replace(LABEL_STRIP, '').trim();
  v = v.replace(/^[:.\-–]+\s*/, '').trim();
  return v;
}

function parseIsoDateHint(raw: string): string | null {
  const m =
    /(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/.exec(raw) ||
    /(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/.exec(raw);
  if (!m) return null;
  let y: string;
  let mo: string;
  let d: string;
  if (m[1].length === 4) {
    y = m[1];
    mo = m[2].padStart(2, '0');
    d = m[3].padStart(2, '0');
  } else {
    d = m[1].padStart(2, '0');
    mo = m[2].padStart(2, '0');
    y = m[3];
  }
  const iso = `${y}-${mo}-${d}`;
  const dt = new Date(`${iso}T12:00:00.000Z`);
  return Number.isNaN(dt.getTime()) ? null : iso;
}

type MutableExtract = {
  civProfile: VehicleCivProfile;
  matched: CivExtractMatch[];
  civSeries: string | null;
  civIssuedOn: string | null;
  civRarOffice: string | null;
  civMentions: string | null;
  vin: string | null;
};

function setProfile(
  state: MutableExtract,
  key: string,
  value: string | number,
  rubric: string,
  formatUsed: CivDocumentFormat,
) {
  const resolved = resolveCivRubric(rubric, formatUsed);
  if (resolved?.kind === 'profile' && resolved.field.key !== key) {
    // prefer explicit key
  }
  const field = CIV_PROFILE_FIELDS.find((f) => f.key === key);
  if (!field) return;
  if (state.civProfile[key] != null && state.civProfile[key] !== '') return;
  if (field.kind === 'number' || field.kind === 'year') {
    const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.').replace(/[^\d.-]/g, ''));
    if (!Number.isFinite(n) || !isSaneNumericCivField(key, n)) return;
    state.civProfile[key] = n;
    state.matched.push({ rubric, target: key, value: String(n) });
    return;
  }
  const s = String(value).trim();
  if (!s || !isPlausibleCivValue(s)) return;
  state.civProfile[key] = s;
  state.matched.push({ rubric, target: key, value: s });
}

/**
 * Al doilea pas: regex pe tot textul — salvează CIV-urile vechi unde OCR rupe liniile.
 */
function applyFullTextHeuristics(fullText: string, state: MutableExtract, formatUsed: CivDocumentFormat) {
  const t = fullText.replace(/\r\n/g, '\n');

  if (!state.vin) {
    const vinNear =
      /num[aă]r(?:ul)?\s+de\s+identificare[^A-HJ-NPR-Z0-9]{0,40}([A-HJ-NPR-Z0-9]{17})/i.exec(t) ||
      /\b([A-HJ-NPR-Z0-9]{17})\b/i.exec(t);
    if (vinNear && isPlausibleVin(vinNear[1])) {
      state.vin = vinNear[1].toUpperCase();
      state.matched.push({ rubric: 'E', target: 'vin', value: state.vin });
    }
  }

  const brand = /\bmarca\b\s*[:.\-–]?\s*([A-ZĂÂÎȘȚ][A-Za-zăâîșțĂÂÎȘȚ0-9 \-]{1,30})/i.exec(t);
  if (brand) setProfile(state, 'brand', brand[1].trim().split(/\s{2,}/)[0]!, 'Marca', formatUsed);

  const tip = /\btipul(?:\s*\/\s*varianta(?:\s*\/\s*versiunea)?)?\b\s*[:.\-–]?\s*([^\n]{3,80})/i.exec(t);
  if (tip) setProfile(state, 'typeVariantVersion', tip[1].trim(), 'Tipul', formatUsed);

  const caroserie = /\bcaroseria\b\s*[:.\-–]?\s*([^\n]{2,60})/i.exec(t);
  if (caroserie) setProfile(state, 'bodyType', caroserie[1].trim(), 'Caroseria', formatUsed);

  const year =
    /anul\s+fabrica[tț]iei[^0-9]{0,20}((?:19|20)\d{2})/i.exec(t) ||
    /\b((?:19|20)\d{2})\b/.exec(t);
  // year alone too loose — only with label
  const yearLabeled = /anul\s+fabrica[tț]iei[^0-9]{0,20}((?:19|20)\d{2})/i.exec(t);
  if (yearLabeled) {
    setProfile(state, 'manufactureYear', yearLabeled[1], 'Anul fabricatiei', formatUsed);
  }
  void year;

  const cilindree = /cilindree(?:\s*\(cm3\))?[^0-9]{0,15}(\d{3,5})/i.exec(t);
  if (cilindree) setProfile(state, 'engineCapacityCm3', cilindree[1], 'Cilindree', formatUsed);

  const putere = /putere\s*max[^0-9]{0,20}(\d+[.,]?\d*)/i.exec(t);
  if (putere) setProfile(state, 'enginePowerKw', putere[1].replace(',', '.'), 'Putere max', formatUsed);

  const fuel =
    /sursa\s+de\s+energie\s*[:.\-–]?\s*(MOTORINA|MOTORINĂ|BENZINA|BENZINĂ|GPL|ELECTRIC|HIBRID[ĂA]?)/i.exec(
      t,
    ) || /\b(MOTORINA|MOTORINĂ|BENZINA|BENZINĂ)\b/i.exec(t);
  if (fuel) setProfile(state, 'fuelType', fuel[1].replace(/Ă/g, 'A').replace(/ă/g, 'a'), 'Sursa de energie', formatUsed);

  const color = /\bculoarea?\b\s*[:.\-–]?\s*([A-ZĂÂÎȘȚa-zăâîșț]{3,20})/i.exec(t);
  if (color) setProfile(state, 'color', color[1], 'Culoarea', formatUsed);

  const drive = /\btractiunea\b\s*[:.\-–]?\s*(FATA|FAȚA|SPATE|INTEGRALA|INTEGRALĂ|4X4)/i.exec(t);
  if (drive) setProfile(state, 'driveType', drive[1], 'Tractiunea', formatUsed);

  const axles = /num[aă]rul?\s+axelor[^0-9]{0,10}(\d)/i.exec(t);
  if (axles) setProfile(state, 'axleCount', axles[1], 'Numarul axelor', formatUsed);

  const vmax = /vit\.?\s*max(?:ima)?\s*constructiva[^0-9]{0,15}(\d{2,3})/i.exec(t);
  if (vmax) setProfile(state, 'maxSpeedKmh', vmax[1], 'Vit. max constructiva', formatUsed);

  const tank = /capacitatea\s+rezervorului[^0-9]{0,15}(\d+[.,]?\d*)/i.exec(t);
  if (tank) setProfile(state, 'fuelTankCapacityL', tank[1].replace(',', '.'), 'Capacitatea rezervorului', formatUsed);

  const engineCode = /\btipul\b\s*[:.\-–]?\s*([A-Z0-9]{3,10})\b/i.exec(
    t.split(/motorul/i)[1] ?? '',
  );
  // Cod motor pe CIV vechi: "Tipul: KVJA" în secțiunea Motorul
  const motorBlock = /motorul[\s\S]{0,400}/i.exec(t)?.[0] ?? '';
  const tipMotor = /tipul\s*[:.\-–]?\s*([A-Z0-9]{3,12})/i.exec(motorBlock);
  if (tipMotor) setProfile(state, 'engineCode', tipMotor[1], 'Tipul motor', formatUsed);
  void engineCode;

  const serieMotor =
    /(?:serie\s*motor|serie)\s*[:.\-–]?\s*([A-Z0-9]{5,20})\b/i.exec(motorBlock) ||
    /\bserie\s*[:.\-–]?\s*(CD\d{4,8}|[A-Z0-9]{6,16})\b/i.exec(t);
  if (serieMotor && serieMotor[1].toUpperCase() !== state.vin) {
    setProfile(state, 'engineSerial', serieMotor[1], 'Serie motor', formatUsed);
  }

  // Mase tipice CIV vechi
  const proprie = /proprie[^0-9]{0,15}(\d{3,5})/i.exec(t);
  if (proprie) setProfile(state, 'curbMassKg', proprie[1], 'proprie', formatUsed);
  const totala = /total[aă]\s*max\.?\s*autorizata[^0-9]{0,15}(\d{3,5})/i.exec(t);
  if (totala) setProfile(state, 'maxTechnicalMassKg', totala[1], 'total max autorizata', formatUsed);

  const lungime = /\bL\s*[:.\-–]?\s*(\d{3,5})\b/.exec(t) || /lungime[^0-9]{0,10}(\d{3,5})/i.exec(t);
  if (lungime) setProfile(state, 'lengthMm', lungime[1], '9', formatUsed);
  const latime = /\bl\s*[:.\-–]?\s*(\d{3,4})\b/.exec(t) || /l[aă]țime[^0-9]{0,10}(\d{3,4})/i.exec(t);
  if (latime) setProfile(state, 'widthMm', latime[1], '10', formatUsed);
  const inaltime = /\bh\s*[:.\-–]?\s*(\d{3,4})\b/.exec(t) || /în[aă]lțime[^0-9]{0,10}(\d{3,4})/i.exec(t);
  if (inaltime) setProfile(state, 'heightMm', inaltime[1], '11', formatUsed);

  // Serie CIV tip J 459513
  if (!state.civSeries) {
    const serieCiv = /\b([A-Z]\s?\d{5,7})\b/.exec(t);
    if (serieCiv && !isPlausibleVin(serieCiv[1].replace(/\s/g, ''))) {
      state.civSeries = serieCiv[1].replace(/\s+/g, ' ').trim();
      state.matched.push({ rubric: 'Serie CIV', target: 'civSeries', value: state.civSeries });
    }
  }

  // Denumire comercială din tip (ex. …/Fiesta)
  const commercial = /\/\s*(Fiesta|Focus|Golf|Octavia|Logan|Sandero|Clio|Megane|Passat)\b/i.exec(t);
  if (commercial) {
    setProfile(state, 'commercialName', commercial[1], 'D.3', formatUsed);
  }
}

/**
 * Mapează text OCR / copy-paste din CIV pe câmpurile Fleet (preview, fără persistare).
 */
export function mapCivExtractTextToPreview(
  text: string,
  formatHint: CivDocumentFormat = 'unknown',
  source: 'text' | 'file' = 'text',
): CivExtractPreview {
  let formatUsed =
    formatHint !== 'unknown' ? formatHint : detectCivDocumentFormat(text);
  // Heuristicile pe text complet funcționează cel mai bine pe format 1993
  if (formatUsed === 'unknown' && /marca|identificare|cilindree|caroseria/i.test(text)) {
    formatUsed = '1993';
  }

  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const state: MutableExtract = {
    civProfile: {},
    matched: [],
    civSeries: null,
    civIssuedOn: null,
    civRarOffice: null,
    civMentions: null,
    vin: null,
  };
  const unmatchedLines: string[] = [];

  const label1993 = [
    'Numarul de identificare',
    'Numărul de identificare',
    'Marca',
    'Tipul',
    'Varianta',
    'Caroseria',
    'Anul fabricatiei',
    'Anul fabricației',
    'Cilindree',
    'Culoarea',
    'Tractiunea',
    'Tracțiunea',
    'Sursa de energie',
    'Capacitatea rezervorului',
    'Vit. max constructiva',
    'Numarul axelor',
    'Serie motor',
    ...Object.keys(CIV_RUBRIC_ALIASES_1993).map((k) => k.replace(/_/g, ' ')),
  ];

  const rubricAlts = [
    ...CIV_PROFILE_FIELDS.map((f) => f.rubric),
    'E',
    'X',
    'Y',
    'Serie CIV',
    'Seria CIV',
    'Dată eliberare',
    'Data eliberare',
    'Reprezentanță RAR',
    'Reprezentanta RAR',
    'Mențiuni',
    'Mentiuni',
    ...label1993,
  ];

  const sortedRubrics = [...new Set(rubricAlts)].sort((a, b) => b.length - a.length);
  const rubricUnion = sortedRubrics
    .map((r) => r.replace(/\./g, '\\.').replace(/\s+/g, '\\s+'))
    .join('|');
  const lineRe = new RegExp(
    `^(?:\\d{1,2}\\.\\s*)?(${rubricUnion})\\b\\s*[:.\\-–]?\\s*(.*)$`,
    'i',
  );

  const consumed = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    if (consumed.has(i)) continue;
    const line = lines[i]!;
    if (!isPlausibleCivValue(line, { maxLen: 400 })) {
      unmatchedLines.push(line);
      continue;
    }

    const m = lineRe.exec(line);
    if (!m) {
      const vinOnly = /\b([A-HJ-NPR-Z0-9]{17})\b/i.exec(line);
      if (vinOnly && !state.vin && isPlausibleVin(vinOnly[1])) {
        state.vin = vinOnly[1].toUpperCase();
        state.matched.push({ rubric: 'E', target: 'vin', value: state.vin });
        continue;
      }
      if (line.length > 2) unmatchedLines.push(line);
      continue;
    }

    const rubricRaw = m[1].trim();
    let value = cleanValue(m[2] ?? '');
    // Etichetă pe o linie, valoare pe următoarea (frecvent la OCR CIV vechi)
    if (!value && i + 1 < lines.length) {
      const next = lines[i + 1]!;
      if (!lineRe.test(next) && isPlausibleCivValue(next) && !/^\d{1,2}\.\s*$/.test(next)) {
        value = cleanValue(next);
        consumed.add(i + 1);
      }
    }
    if (!value || !isPlausibleCivValue(value)) {
      unmatchedLines.push(line);
      continue;
    }

    // „Serie” scurt fără context → serie motor doar dacă arată a cod motor
    if (/^serie$/i.test(rubricRaw) && !/^serie\s*motor/i.test(line)) {
      if (isPlausibleVin(value.replace(/\s/g, ''))) {
        // skip — e mai degrabă VIN pe linie greșită
      } else if (/^[A-Z0-9]{5,20}$/i.test(value) && !state.civProfile.engineSerial) {
        setProfile(state, 'engineSerial', value, 'Serie motor', formatUsed);
        continue;
      }
    }

    const resolved = resolveCivRubric(rubricRaw, formatUsed);
    if (!resolved) {
      unmatchedLines.push(line);
      continue;
    }

    if (resolved.kind === 'vin') {
      const v = value.replace(/\s+/g, '').toUpperCase();
      if (!isPlausibleVin(v)) {
        unmatchedLines.push(line);
        continue;
      }
      state.vin = v;
      state.matched.push({ rubric: rubricRaw, target: 'vin', value: v });
      continue;
    }
    if (resolved.kind === 'civSeries') {
      state.civSeries = value;
      state.matched.push({ rubric: rubricRaw, target: 'civSeries', value });
      continue;
    }
    if (resolved.kind === 'civIssuedOn') {
      state.civIssuedOn = parseIsoDateHint(value) ?? value.slice(0, 10);
      state.matched.push({ rubric: rubricRaw, target: 'civIssuedOn', value: state.civIssuedOn });
      continue;
    }
    if (resolved.kind === 'civRarOffice') {
      state.civRarOffice = value;
      state.matched.push({ rubric: rubricRaw, target: 'civRarOffice', value });
      continue;
    }
    if (resolved.kind === 'civMentions') {
      state.civMentions = value;
      state.matched.push({ rubric: rubricRaw, target: 'civMentions', value });
      continue;
    }
    if (resolved.kind === 'profile') {
      const field = resolved.field;
      let stored: string | number = value;
      if (field.kind === 'number' || field.kind === 'year') {
        const n = Number(value.replace(',', '.').replace(/[^\d.-]/g, ''));
        if (!Number.isFinite(n) || !isSaneNumericCivField(field.key, n)) {
          unmatchedLines.push(line);
          continue;
        }
        stored = n;
      }
      if (state.civProfile[field.key] == null || state.civProfile[field.key] === '') {
        state.civProfile[field.key] = stored;
        state.matched.push({ rubric: rubricRaw, target: field.key, value: String(stored) });
      }
    }
  }

  applyFullTextHeuristics(text, state, formatUsed);
  void normalizeCivRubricToken;

  return {
    civProfile: state.civProfile,
    civSeries: state.civSeries,
    civIssuedOn: state.civIssuedOn,
    civRarOffice: state.civRarOffice,
    civMentions: state.civMentions,
    vin: state.vin,
    matched: state.matched,
    unmatchedLines: unmatchedLines.slice(0, 40),
    formatUsed,
    source,
  };
}

function isSaneNumericCivField(key: string, n: number): boolean {
  if (key === 'manufactureYear') return n >= 1950 && n <= 2100;
  if (key.endsWith('Kg') || key.includes('Mass') || key.includes('mass')) {
    return n >= 10 && n <= 200_000;
  }
  if (
    key.endsWith('Mm') ||
    key.includes('length') ||
    key.includes('width') ||
    key.includes('height') ||
    key.includes('wheelbase')
  ) {
    return n >= 100 && n <= 50_000;
  }
  if (key.includes('Cm3') || key === 'engineCapacityCm3') return n >= 50 && n <= 20_000;
  if (key === 'enginePowerKw') return n >= 1 && n <= 2000;
  if (key.includes('Kmh') || key === 'maxSpeedKmh') return n >= 20 && n <= 450;
  if (key.includes('Noise') || key.includes('noise')) return n >= 20 && n <= 120;
  if (key === 'axleCount') return n >= 1 && n <= 10;
  if (key.includes('Seats') || key.includes('seats')) return n >= 1 && n <= 100;
  if (key === 'fuelTankCapacityL') return n >= 5 && n <= 2000;
  if (key === 'co2Gkm') return n >= 0 && n <= 1000;
  if (key === 'powerToMassRatio') return n > 0 && n <= 5;
  if (key === 'engineRpm' || key.includes('Rpm') || key.includes('rpm')) {
    return n >= 500 && n <= 20_000;
  }
  return Number.isFinite(n) && n >= 0;
}
