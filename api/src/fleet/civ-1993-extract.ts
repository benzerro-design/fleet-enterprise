/**
 * Extracție CIV format 1993 (grilă / Secțiunea A pe pagina 2).
 * Formularul app rămâne același (civProfile 2016/2024); doar parserul diferă.
 */

import type { VehicleCivProfile } from './vehicle-civ-fields';
import { findCivSeriesInFrontText, findVinInText } from './civ-label-map';
import { splitCivBookPages } from './civ-pages';

export type Civ1993ExtractResult = {
  civProfile: VehicleCivProfile;
  civSeries: string | null;
  civIssuedOn: string | null;
  civRarOffice: string | null;
  civMentions: string | null;
  vin: string | null;
  matched: { rubric: string; target: string; value: string }[];
  unmatchedLines: string[];
  techPairCount: number;
  sectionAText: string;
};

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '');
}

function norm(s: string): string {
  return stripDiacritics(s).toLowerCase().replace(/\s+/g, ' ').trim();
}

function isEmpty(v: string | null | undefined): boolean {
  const t = (v ?? '').trim();
  return !t || t === '-' || t === '—' || /^-+$/.test(t) || /^[)(\]\[.;,:\/\\|_*]+$/.test(t);
}

function num(raw: string | null | undefined): number | null {
  if (!raw || isEmpty(raw)) return null;
  const m = String(raw).replace(/\s/g, '').replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/** Taie textul Secțiunii A din verso (ignoră B/C/omologare). */
export function extractCiv1993SectionA(versoOrCombined: string): string {
  let t = versoOrCombined.replace(/\r\n/g, '\n');

  const colA = /===\s*COL\s*A\s*===([\s\S]*?)(?===\s*COL\s*[BCD]\s*===|$)/i.exec(t);
  if (colA?.[1]?.trim()) return colA[1].trim();

  const secA = /sec[tț]iunea\s*a\b([\s\S]*?)(?=sec[tț]iunea\s*[bc]\b|omologare\s+de\s+tip|$)/i.exec(t);
  if (secA?.[1]?.trim() && secA[1].length > 80) return secA[1].trim();

  // Taie la Secțiunea B / C / Omologare dacă apar după începutul grilei.
  const cutMarkers = [
    /\bsec[tț]iunea\s*b\b/i,
    /\bsec[tț]iunea\s*c\b/i,
    /\bomologare\s+de\s+tip\b/i,
    /\bomologare\s+individual/i,
  ];
  let cut = t.length;
  for (const re of cutMarkers) {
    const m = re.exec(t);
    if (m?.index != null && m.index > 60 && m.index < cut) cut = m.index;
  }
  t = t.slice(0, cut);

  // Dacă e față+verso concatenat, preferă partea cu Marca / Categoria.
  const marca = /\b3\.?\s*Marca\b|\bMarca\b/i.exec(t);
  const cat = /\b1\.?\s*Categoria\b|\bCategoria\b/i.exec(t);
  if (marca || cat) {
    const start = Math.min(marca?.index ?? Infinity, cat?.index ?? Infinity);
    if (Number.isFinite(start) && start > 0 && start < t.length) {
      // păstrează puțin înainte (barcode / antet)
      const from = Math.max(0, start - 120);
      t = t.slice(from);
    }
  }
  return t.trim();
}

function pick(
  text: string,
  patterns: RegExp[],
): string | null {
  for (const re of patterns) {
    const m = re.exec(text);
    if (m?.[1] && !isEmpty(m[1])) return m[1].replace(/\s+/g, ' ').trim();
  }
  return null;
}

function pushMatch(
  matched: Civ1993ExtractResult['matched'],
  profile: VehicleCivProfile,
  target: string,
  rubric: string,
  value: string | number,
) {
  const s = String(value).trim();
  if (isEmpty(s)) return;
  if (profile[target] != null && profile[target] !== '') return;
  profile[target] = value;
  matched.push({ rubric, target, value: s });
}

/**
 * Parsează Secțiunea A → civProfile (echivalențe CIV 1993 → formular app).
 *
 * Regulă: etichetă (text albastru pe CIV) → următoarea valoare (text negru).
 * Fără culoare Vision: aproximăm pe etichete cunoscute + tokenul numeric/alfanumeric următor.
 * Doar Secțiunea A — nimic după separatorul vertical A|B.
 *
 * Fără corespondent (ignorate): sarcină utilă, mijloc/senilă pe axe, locuri față/scaune,
 * „sau” anvelope, presiune cuplă, data/nr. primei înmatriculări.
 */
export function mapCiv1993SectionAToProfile(sectionA: string): {
  profile: VehicleCivProfile;
  matched: Civ1993ExtractResult['matched'];
  vin: string | null;
  techPairCount: number;
  /** Bloc „Modificări…” → Mențiuni în app. */
  modificationsMentions: string | null;
} {
  const text = sectionA;
  const profile: VehicleCivProfile = {};
  const matched: Civ1993ExtractResult['matched'] = [];
  let techPairCount = 0;

  const set = (key: string, rubric: string, raw: string | null, asNum = false) => {
    if (!raw || isEmpty(raw)) return;
    techPairCount++;
    if (asNum) {
      const n = num(raw);
      if (n == null) return;
      pushMatch(matched, profile, key, rubric, n);
      return;
    }
    pushMatch(matched, profile, key, rubric, raw.replace(/\s+/g, ' ').trim());
  };

  /** Valoare neagră imediat după etichetă albastră (pe același rând / imediat după). */
  const valueAfter = (labelRe: RegExp, valueRe: RegExp): string | null => {
    const m = labelRe.exec(text);
    if (!m || m.index == null) return null;
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 80);
    const v = valueRe.exec(after);
    return v?.[1] ? v[1].replace(/\s+/g, ' ').trim() : null;
  };

  // 1. Categoria → Categorie de folosință (nu omologare separată)
  const categoria = pick(text, [
    /(?:^|\n)\s*1\.?\s*Categor\w*\s*[:\s]+([^\n]+?)(?=\s+\d+\s*$|\s*$|\s+2\.?\s*Carose)/i,
    /\bCategor\w*\s*[:\s]+([A-ZĂÂÎȘȚ][^\n]{2,40}?)(?=\s+\d+\s|$)/i,
  ]);
  if (categoria) {
    const usage = categoria
      .replace(/\bMI\b/i, 'M1')
      .replace(/\s+/g, ' ')
      .replace(/\s+\d+\s*$/, '')
      .trim()
      .toUpperCase();
    set('usageCategory', 'Categorie de folosință', usage);
  }

  // 2. Caroserie
  set(
    'bodyType',
    'Caroserie',
    pick(text, [
      /(?:^|\n)\s*2\.?\s*Carose\w*\s*[:\s]+([^\n]+?)(?=\s+\d+\s*$|\s*$|\s+3\.?\s*Marca)/i,
      /\bCarose\w*\s*[:\s]+([A-Z0-9][^\n]{2,50}?)(?=\s+\d+\s|$)/i,
    ]),
  );

  // 3. Marca
  set(
    'brand',
    'Marcă',
    pick(text, [
      /(?:^|\n)\s*3\.?\s*Marca\s*[:\s]+([A-ZĂÂÎȘȚ][A-ZĂÂÎȘȚa-zăâîșț\- ]{1,30}?)(?=\s+\d+\s*$|\s*$|\s+4\.?\s*Tipul)/i,
      /\bMarca\s*[:\s]+([A-Z]{2,20})\b/i,
      /\bMarca\s+([A-Z]{2,20})\b/i,
    ]),
  );

  // 4. Tipul / Varianta → Tip – variantă – versiune (tot șirul, inclusiv Fiesta)
  const tipVar = pick(text, [
    /(?:^|\n)\s*4\.?\s*Tipul\s*\/?\s*Var\w*\s*[:\s]+([^\n]+)/i,
    /(?:^|\n)\s*4\.?\s*Tipul\s*[:\s]+([A-Z0-9][^\n]*?(?:Fiesta|[A-Z0-9]{4,}))/i,
    /\bTipul\s*\/?\s*Var\w*\s*[:\s]+([^\n]+)/i,
    /\bTipul\s+([A-Z0-9][A-Z0-9.\-\/\s]{4,80}?Fiesta)\b/i,
    /\bTipul\s+([A-Z0-9][A-Z0-9.\-\/\s]{4,60})/i,
  ]);
  if (tipVar) {
    set(
      'typeVariantVersion',
      'Tip – variantă – versiune',
      tipVar
        .replace(/\s+Vananla\s*/i, ' ')
        .replace(/\s+\d+\s*$/, '')
        .replace(/\s+/g, ' ')
        .replace(/\s*\/\s*$/, '')
        .trim(),
    );
  }

  // 5. Nr. omologare / Anul — anul e după „/”, înainte de separatorul A|B (deja tăiat în COL A)
  {
    const dual =
      /\bomologa([A-Z0-9]{10,24})\s*\/\s*((?:19|20)\d{2})\b/i.exec(text) ||
      /\b([A-Z0-9]{12,24})\s*\/\s*((?:19|20)\d{2})\b/.exec(text);
    if (dual) {
      set('nationalRegisterNumber', 'Număr național de registru', dual[1]);
      set('manufactureYear', 'An fabricație', dual[2], true);
    } else {
      set(
        'nationalRegisterNumber',
        'Număr național de registru',
        pick(text, [
          /\bNr\.?\s*(?:de\s+)?omologare\s*[:\s]+([A-Z0-9]{6,24})\b/i,
          /\bomologa([A-Z0-9]{10,24})\b/i,
        ]),
      );
      set(
        'manufactureYear',
        'An fabricație',
        pick(text, [
          /\bAnul\s+(?:de\s+)?fabrica\w*\s*[:\s\/]*((?:19|20)\d{2})\b/i,
          /\/\s*((?:19|20)\d{2})\b/,
        ]),
        true,
      );
    }
  }

  // 6. Nr. identificare → VIN
  let vin =
    pick(text, [
      /(?:^|\n)\s*6\.?\s*(?:Nr\.?\s*|Numarul\s+de\s+)?identificare\s*[:\s]+([A-HJ-NPR-Z0-9O]{17})\b/i,
      /\bNumarul\s+de\s+([A-HJ-NPR-Z0-9O]{17})\b/i,
      /\b([A-HJ-NPR-Z0-9O]{17})\b/,
    ])
      ?.replace(/\s+/g, '')
      .toUpperCase()
      .replace(/^WFO/, 'WF0')
      .replace(/^UUO/, 'UU0') ?? null;
  if (vin && !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
    vin = vin.replace(/O/g, '0').replace(/I/g, '1').replace(/Q/g, '0');
  }
  if (vin && !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) vin = null;
  if (vin) {
    techPairCount++;
    matched.push({ rubric: 'VIN', target: 'vin', value: vin });
  }

  // 7. Mase — doar corespondentele din tabel (fără sarcină utilă / mijloc / senilă)
  set('curbMassKg', 'Masă în ordine de mers', valueAfter(/\bProprie\b/i, /^\s*[:\s]*(\d{3,5})\b/) ?? pick(text, [/\bProprie\s*[:\s]*(\d{3,5})\b/i]), true);
  set(
    'maxTechnicalMassKg',
    'Masă maximă tehnic admisă',
    pick(text, [
      /\bTotal[ae]?\s*max\.?\s*autoriz\w*\s*[:\s]*(\d{3,5})\b/i,
      /\bTotal[ae]?\s*max\s*[:\s]*(\d{3,5})\b/i,
    ]),
    true,
  );
  set(
    'maxCouplingMassKg',
    'Masă max. punct cuplare',
    pick(text, [
      /\bSarcina\s+pe\s+c[aâ]rlig\w*\s*[:\s]*(\d{1,4})\b/i,
      /\bc[aâ]rlig\w*\s*(?:de\s+remorcare)?\s*[:\s]*(\d{1,4})\b/i,
    ]),
    true,
  );
  set(
    'axle1MaxMassKg',
    'MTMA axa 1',
    pick(text, [/\bFat[ah]\s*[:\s]*(\d{3,4})\b/i, /\bFa[tț][aă]\s*[:\s]*(\d{3,4})\b/i]),
    true,
  );
  set(
    'axle2MaxMassKg',
    'MTMA axa 2',
    pick(text, [/\bSpate\s*[:\s]*(\d{3,4})\b/i]),
    true,
  );
  set(
    'maxBrakedTrailerMassKg',
    'Masă remorcabilă cu frână',
    pick(text, [
      /Remorcabila?\s+cu\s+(?:disp\.?\s*(?:de\s+)?fr[aâ]nare|dispozitiv\s+de\s+fr[aâ]nare)\s*[:\s]*(\d{2,5})/i,
      /Remorcabil\s+cu\s*[:\s]*(\d{2,5})/i,
    ]),
    true,
  );
  set(
    'maxUnbrakedTrailerMassKg',
    'Masă remorcabilă fără frână',
    pick(text, [
      /Remorcabila?\s+f[aă]r[aă]\s+(?:disp\.?\s*(?:de\s+)?fr[aâ]nare|dispozitiv\s+de\s+fr[aâ]nare)\s*[:\s]*(\d{2,5})/i,
      /Remorcabila?\s+fara\s*[:\s]*(\d{2,5})/i,
    ]),
    true,
  );

  // 8. Locuri — total + în picioare (ignoră în față / pe scaune)
  set(
    'seatsIncludingDriver',
    'Număr locuri (cu șofer)',
    pick(text, [
      /\blocuri[^\n]{0,30}?\b[Tt]otal\s*[:\s]*(\d{1,2})\b/,
      /\b[Tt]otal\s*[:\s]*(\d{1,2})\b[^\n]{0,20}?(?:in\s+fata|pe\s+scaune)/i,
    ]),
    true,
  );
  set(
    'standingPlaces',
    'Locuri în picioare',
    pick(text, [/\b(?:[Ii]n\s+)?picioare\s*[:\s]*(\d{1,2})\b/i]),
    true,
  );
  if (typeof profile.standingPlaces === 'number' && (profile.standingPlaces > 40 || profile.standingPlaces < 0)) {
    delete profile.standingPlaces;
    const idx = matched.findIndex((m) => m.target === 'standingPlaces');
    if (idx >= 0) matched.splice(idx, 1);
  }

  // 9. Dimensiuni pe același rând: L (albastru) valoare (negru) l valoare h valoare
  const dims =
    /\bL\s*[:\s]*(\d{3,5})\s+l\s*[:\s]*(\d{3,5})\s+h\s*[:\s]*(\d{3,5})\b/i.exec(text) ||
    /\bL\s*[:\s]*(\d{3,5})\s+(\d{3,5})\s+h\s*[:\s]*(\d{3,5})\b/i.exec(text);
  if (dims) {
    set('lengthMm', 'Lungime', dims[1], true);
    set('widthMm', 'Lățime', dims[2], true);
    set('heightMm', 'Înălțime', dims[3], true);
  } else {
    set('lengthMm', 'Lungime', pick(text, [/\bL\s*[:\s]*(\d{3,5})\b/]), true);
    set('widthMm', 'Lățime', pick(text, [/\bl\s*[:\s]*(\d{3,5})\b/]), true);
    set('heightMm', 'Înălțime', pick(text, [/\bh\s*[:\s]*(\d{3,5})\b/]), true);
  }

  // 10. Motor — Tipul după „Motorul”; Putere / Turație: turația după „/” (înainte de A|B)
  const motorBlock =
    /(?:^|\n)\s*10\.?\s*Motorul[\s\S]{0,280}?(?=(?:^|\n)\s*11\.?\s*|\bNumarul\s+axelor\b|\baxelor\b)/i.exec(
      text,
    )?.[0] ?? text;
  set(
    'engineCode',
    'Cod motor',
    pick(motorBlock, [
      /\bTipul\s*[:\s]*([A-Z0-9\-]{3,12})\b/i,
      /\bTipul\s+(KVJA|[A-Z]{3,5}\d?[A-Z0-9]{0,4})\b/i,
    ]),
  );
  set('engineSerial', 'Serie motor', pick(motorBlock, [/\bSerie\s*[:\s]*([A-Z0-9]{5,20})\b/i]));
  set(
    'engineCapacityCm3',
    'Capacitate cilindrică',
    pick(motorBlock, [/\bCilindree\s*(?:\([^)]*\))?\s*[:\s]*(\d{3,5})\b/i, /\bCilindree\s*(\d{3,5})\b/i]),
    true,
  );
  // Putere / Turație: turația e după „/”, înainte de separatorul A|B
  {
    const pt =
      /Putere[^\n]{0,50}?([\d.,]+)\s*\/\s*(\d{3,5})/i.exec(motorBlock) ||
      /([\d.,]+)\s*\/\s*(4000|3500|3750|3000|4500)\b/.exec(motorBlock);
    if (pt) {
      set('enginePowerKw', 'Putere', pt[1], true);
      set('engineRpm', 'Turație nominală', pt[2], true);
    } else {
      set('enginePowerKw', 'Putere', pick(motorBlock, [/\bPutere\s*max\w*\s*(?:\([^)]*\))?\s*[:\s]*([\d.,]+)\b/i]), true);
      set('engineRpm', 'Turație nominală', pick(motorBlock, [/\bTura[tț]ie\s*(?:\([^)]*\))?\s*[:\s]*(\d{3,5})\b/i]), true);
    }
  }
  set(
    'fuelType',
    'Combustibil / sursă energie',
    pick(text, [
      /\bSursa\s+de\s+energie\s*[:\s]*([A-ZĂÂÎȘȚa-zăâîșț]{4,20})\b/i,
      /\bSursa\s+de\s+(MOTORINA|BENZINA|GPL|ELECTRIC|HIBRID\w*)\b/i,
    ]),
  );

  // 11–12. Axe apoi Tracțiune (pe același rând după valoarea axelor)
  set(
    'axleCount',
    'Număr axe',
    pick(text, [
      /\b(?:11\.?\s*)?(?:Nr\.?\s*|Numarul\s+)axelor?\s*[:\s]*(\d)\b/i,
      /\baxelor\s+Numarul\s*(\d)/i,
    ]),
    true,
  );
  set(
    'driveType',
    'Tracțiune',
    pick(text, [
      /\b(?:12\.?\s*)?Trac[tț]iune[a]?\s*[:\s]*(FATA|FAȚA|SPATE|INTEGRALA|4X4)\b/i,
      /\bTractiunea\s+(FATA|SPATE|INTEGRALA)\b/i,
      /\baxelor?\s*[:\s]*\d\s+\d*\s*Trac[tț]iune[a]?\s*[:\s]*(FATA|SPATE|INTEGRALA)\b/i,
    ]),
  );

  // 13. Anvelope — față / spate; ignoră alternativele după „sau”
  const tyresFront = pick(text, [
    /(?:13\.?\s*)?Dimens\w*\s+anvelopelor[^\n]{0,40}?Fa[tțah]+\s*[:\s]*([^\n]+?)(?=\s+sau\s+|\s+Mijloc|\s+[Ss]pate|$)/i,
    /\bFa[tțah]+\s*[:\s]*(\d{3}\s*\/\s*\d{2}\s*R?\s*\d{2}[^\n]{0,24}?)(?=\s+sau\s+|\s+[Ss]pate|$)/i,
  ]);
  if (tyresFront) {
    set('tyresFront', 'Anvelope/jante față', tyresFront.replace(/\s+sau\s+[\s\S]*$/i, '').trim());
  }
  const tyresRear = pick(text, [
    /\b[Ss]pate\s*[:\s]*(\d{3}\s*\/\s*\d{2}\s*R?\s*\d{2}[^\n]{0,40}?)(?=\s+sau\s+|$)/i,
  ]);
  if (tyresRear) {
    set('tyresRear', 'Anvelope/jante spate', tyresRear.replace(/\s+sau\s+[\s\S]*$/i, '').trim());
  }

  // 14. Zgomot
  set('movingNoiseDb', 'Nivel sonor în mers', pick(text, [/\b(?:[Ii]n\s+)?mers\s*[:\s]*(\d{2,3})\b/i]), true);
  set(
    'stationaryNoiseDb',
    'Nivel sonor staționare',
    pick(text, [/\b(?:[Ii]n\s+)?sta[tț]ionare\s*[:\s]*(\d{2,3})\b/i]),
    true,
  );

  // 15. Presiune cuplă — fără corespondent (ignorat)
  // 16. Vit. max
  set(
    'maxSpeedKmh',
    'Viteză maximă',
    pick(text, [/\bVit\.?\s*max\w*\s*(?:\([^)]*\))?\s*[:\s]*(\d{2,3})\b/i]),
    true,
  );
  // 17. Rezervor — între vit. max și separatorul A|B (deja în COL A)
  set(
    'fuelTankCapacityL',
    'Capacitate rezervor',
    pick(text, [
      /\bCapacitatea\s+rezervorului\s*(?:\([^)]*\))?\s*[:\s]*([\d.,]+)\b/i,
      /\bCapacitatea\s+rezervorului\s*(?:\([^)]*\))?\s*([\d.,]+)\b/i,
    ]),
    true,
  );
  // 18. Culoare
  set(
    'color',
    'Culoare',
    pick(text, [/\b(?:18\.?\s*)?Culoarea?\s*[:\s]*([A-ZĂÂÎȘȚa-zăâîșț]{3,20})\b/i]),
  );
  // 19. Data / nr. primei înm. — fără corespondent

  // Modificări… → Mențiuni
  let modificationsMentions: string | null = null;
  const mod =
    /Modific[aă]ri[^:\n]*:\s*([\s\S]*?)(?=\n\s*===|\n\s*\d+\.\s*[A-Z]|$)/i.exec(text) ||
    /Modific[aă]ri[^\n]*\n([\s\S]*?)(?=\n\s*===|\n\s*1\.?\s*Categor|$)/i.exec(text);
  if (mod?.[1]) {
    const body = mod[1]
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !/^-+$/.test(l) && !/^===\s*COL/i.test(l))
      .join('\n')
      .trim();
    if (body.length >= 3) modificationsMentions = body.slice(0, 2000);
  }
  const co2 = pick(text, [/\bCO\s*2\s*[:\s]*(\d{2,3})\s*(?:g\s*\/\s*km)?/i, /\bCO₂\s*[:\s]*(\d{2,3})/i]);
  set('co2Gkm', 'CO₂', co2, true);

  if (!vin) vin = findVinInText(text);

  return { profile, matched, vin, techPairCount, modificationsMentions };
}

/**
 * Pipeline complet 1993 pe text OCR față+verso.
 */
export function mapCiv1993TextToPreview(
  text: string,
  source: 'text' | 'file' = 'text',
): Civ1993ExtractResult & { source: 'text' | 'file' } {
  const pages = splitCivBookPages(text);
  const verso = pages.versoRaw || pages.techText || text;
  const sectionA = extractCiv1993SectionA(verso);
  const first = mapCiv1993SectionAToProfile(sectionA);

  let civProfile = first.profile;
  let allMatched = [...first.matched];
  let techCount = first.techPairCount;
  let usedVin = first.vin;
  let modificationsMentions = first.modificationsMentions;

  if (techCount < 5) {
    const again = mapCiv1993SectionAToProfile(extractCiv1993SectionA(text));
    if (again.techPairCount > techCount) {
      civProfile = again.profile;
      allMatched = [...again.matched];
      techCount = again.techPairCount;
      usedVin = again.vin ?? usedVin;
      modificationsMentions = again.modificationsMentions ?? modificationsMentions;
    }
  }

  const seriesText = pages.seriesText || pages.frontRaw || text;
  const civSeries = findCivSeriesInFrontText(seriesText);
  if (civSeries) {
    allMatched.push({ rubric: 'Serie CIV', target: 'civSeries', value: civSeries });
  }

  if (!usedVin) {
    usedVin = findVinInText(sectionA) ?? findVinInText(text);
    if (usedVin) {
      allMatched.push({ rubric: 'VIN', target: 'vin', value: usedVin });
    }
  }

  // Mențiuni = bloc Modificări din Secțiunea A (nu p4 pe 1993 tipic).
  let civMentions = modificationsMentions;
  if (!civMentions && pages.mentionsText) {
    const m = pages.mentionsText.trim();
    if (m && !/radieri|sec[tț]iunea/i.test(m)) civMentions = m;
  }
  if (civMentions) {
    allMatched.push({ rubric: 'Mențiuni (Modificări)', target: 'civMentions', value: civMentions });
  }

  return {
    civProfile,
    civSeries,
    civIssuedOn: null,
    civRarOffice: null,
    civMentions,
    vin: usedVin,
    matched: allMatched,
    unmatchedLines: [],
    techPairCount: techCount,
    sectionAText: sectionA.slice(0, 4000),
    source,
  };
}

/** Heuristică: textul arată a CIV 1993 (nu UE D.1). Tolerant la OCR. */
export function looksLikeCiv1993(text: string): boolean {
  const t = norm(text);
  if (/\bd\.?\s*1\b/.test(t) && /\bmarca\b/.test(t) && /\bdenumire comercial/.test(t)) {
    return false;
  }
  if (/\bp\.?\s*3\b/.test(t) && /\bcombustibil sau sursa/.test(t)) return false;

  const signals = [
    /\bcategor/.test(t) && /\bcarose/.test(t),
    /\bmarca\b/.test(t) && /\b(cilindree|tipul)\b/.test(t),
    /\btipul\b/.test(t) && /\b(varianta|fiesta|ja\d|kvja)/.test(t),
    /\bsectiunea\s*a\b/.test(t),
    /\bdetinator\b/.test(t),
    /\bproprie\b/.test(t) && /\btotal[ae]?\s*max/.test(t),
    /\bnumarul\s+de\s+identificare\b/.test(t) && /\bmasele\b/.test(t),
    /\bmarca\b/.test(t) && /\bproprie\b/.test(t) && /\b\d{3,4}\b/.test(t),
  ];
  return signals.filter(Boolean).length >= 2;
}
