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
 * Parsează Secțiunea A (și blocul Modificări) → civProfile.
 */
export function mapCiv1993SectionAToProfile(sectionA: string): {
  profile: VehicleCivProfile;
  matched: Civ1993ExtractResult['matched'];
  vin: string | null;
  techPairCount: number;
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

  // 1. Categoria — „AUTOTURISM M1” (OCR: Categoda, MI)
  const categoria = pick(text, [
    /(?:^|\n)\s*1\.?\s*Categor\w*\s*[:\s]+([^\n]+)/i,
    /\bCategor\w*\s*[:\s]+([A-ZĂÂÎȘȚ][^\n]{2,40})/i,
  ]);
  if (categoria) {
    techPairCount++;
    const m1 = /\b((?:M|N|O|L)\d{0,2}|MI)\b/i.exec(categoria);
    if (m1) {
      const cat = m1[1]!.toUpperCase() === 'MI' ? 'M1' : m1[1]!.toUpperCase();
      pushMatch(matched, profile, 'homologationCategory', 'Categoria (omologare)', cat);
    }
    const usage = categoria
      .replace(/\bMI\b/i, 'M1')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
    pushMatch(matched, profile, 'usageCategory', 'Categoria', usage);
  }

  set(
    'bodyType',
    'Caroserie',
    pick(text, [
      /(?:^|\n)\s*2\.?\s*Carose\w*\s*[:\s]+([^\n]+)/i,
      /\bCarose\w*\s*[:\s]+([A-Z0-9][^\n]{2,50})/i,
    ]),
  );

  set(
    'brand',
    'Marcă',
    pick(text, [
      /(?:^|\n)\s*3\.?\s*Marca\s*[:\s]+([A-ZĂÂÎȘȚ][A-ZĂÂÎȘȚa-zăâîșț\- ]{1,30})/i,
      /\bMarca\s+([A-Z]{2,20})\b/i,
      /\bMarca\s*[:\s]+([A-Z]{2,20})\b/i,
    ]),
  );

  const tipVar = pick(text, [
    /(?:^|\n)\s*4\.?\s*Tipul\s*\/?\s*Var\w*\s*[:\s]+([^\n]+)/i,
    /\bTipul\s*\/?\s*Var\w*\s*[:\s]+([^\n]+)/i,
    /(?:^|\n)\s*4\.?\s*Tipul\s*[:\s]+([^\n]+)/i,
    /\bTipul\s+([A-Z0-9][^\n]{3,60})/i,
  ]);
  if (tipVar) {
    techPairCount++;
    const parts = tipVar.split(/\s*\/\s*/).map((p) => p.trim()).filter(Boolean);
    const commercial = parts.length >= 2 ? parts[parts.length - 1]! : null;
    const typeParts =
      commercial && parts.length > 1 ? parts.slice(0, -1) : parts;
    if (typeParts.length) {
      pushMatch(
        matched,
        profile,
        'typeVariantVersion',
        'Tipul / Varianta',
        typeParts.join(' / '),
      );
    }
    if (commercial && /^[A-Za-z][A-Za-z0-9\- ]{1,24}$/.test(commercial) && !/^\d+$/.test(commercial)) {
      pushMatch(matched, profile, 'commercialName', 'Denumire comercială', commercial.toUpperCase());
    }
  }

  const omologAn = pick(text, [
    /(?:^|\n)\s*5\.?\s*Nr\.?\s*omologare[^\n]{0,40}?Anul[^\n]{0,20}?[:\s]+([^\n]+)/i,
    /\bNr\.?\s*omologare[^\n]{0,30}?\/?[^\n]{0,20}Anul[^\n]{0,15}[:\s]+([^\n]+)/i,
    /\bomologa([A-Z0-9]{10,24})\s*\/\s*((?:19|20)\d{2})\b/i,
    /([A-Z0-9]{10,24})\s*\/\s*((?:19|20)\d{2})\b/,
  ]);
  if (omologAn) {
    // pick returns only group 1 — handle dual capture via dedicated regex
  }
  {
    const dual =
      /\bomologa([A-Z0-9]{10,24})\s*\/\s*((?:19|20)\d{2})\b/i.exec(text) ||
      /\b([A-Z0-9]{12,24})\s*\/\s*((?:19|20)\d{2})\b/.exec(text);
    if (dual) {
      set('nationalRegisterNumber', 'Nr. omologare', dual[1]);
      set('manufactureYear', 'Anul fabricației', dual[2], true);
    } else if (omologAn) {
      const bits = omologAn.split(/\s*\/\s*/).map((x) => x.trim());
      if (bits[0] && /[A-Z0-9]/i.test(bits[0])) {
        set('nationalRegisterNumber', 'Nr. omologare', bits[0].replace(/^omologa/i, ''));
      }
      const yearBit = bits.find((b) => /^(19|20)\d{2}$/.test(b)) ?? bits[1];
      if (yearBit) set('manufactureYear', 'Anul fabricației', yearBit, true);
    } else {
      set(
        'manufactureYear',
        'Anul fabricației',
        pick(text, [/\bAnul\s+(?:de\s+)?fabrica\w*\s*[:\s\/]*((?:19|20)\d{2})\b/i, /\/\s*((?:19|20)\d{2})\b/]),
        true,
      );
      set(
        'nationalRegisterNumber',
        'Nr. omologare',
        pick(text, [/\bNr\.?\s*omologare\s*[:\s]+([A-Z0-9]{6,24})\b/i, /\bomologa([A-Z0-9]{10,24})\b/i]),
      );
    }
  }

  let vin =
    pick(text, [
      /(?:^|\n)\s*6\.?\s*Nr\.?\s*identificare\s*[:\s]+([A-HJ-NPR-Z0-9O]{17})\b/i,
      /\bNr\.?\s*identificare\s*[:\s]+([A-HJ-NPR-Z0-9O]{17})\b/i,
      /\bNumarul\s+de\s+([A-HJ-NPR-Z0-9O]{17})\b/i,
      /\b([A-HJ-NPR-Z0-9O]{17})\b/,
    ])
      ?.replace(/\s+/g, '')
      .toUpperCase()
      .replace(/^WFO/, 'WF0') // OCR O↔0 pe WMI Ford
      .replace(/^UUO/, 'UU0') ?? null;
  // VIN valid fără O/I/Q
  if (vin && !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
    vin = vin.replace(/O/g, '0').replace(/I/g, '1').replace(/Q/g, '0');
  }
  if (vin && !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) vin = null;
  if (vin) {
    techPairCount++;
    matched.push({ rubric: 'Nr. identificare', target: 'vin', value: vin });
  }

  // 7. Mase
  set('curbMassKg', 'Masă proprie', pick(text, [/\bProprie\s*[:\s]*(\d{3,5})\b/i]), true);
  set(
    'maxTechnicalMassKg',
    'Total max. autorizată',
    pick(text, [
      /\bTotal[ae]?\s*max\.?\s*autoriz\w*\s*[:\s]*(\d{3,5})\b/i,
      /\bTotal[ae]?\s*max\s*[:\s]*(\d{3,5})\b/i,
    ]),
    true,
  );
  set(
    'maxCouplingMassKg',
    'Sarcina pe cârlig',
    pick(text, [/\bSarcina\s+pe\s+c[aâ]rlig\w*\s*[:\s]*(\d{1,4})\b/i, /\bc[aâ]rlig\w*\s*[:\s]*(\d{1,4})\b/i]),
    true,
  );
  set(
    'axle1MaxMassKg',
    'MTMA axa față',
    pick(text, [/\bFat[ah]\s*[:\s]*(\d{3,4})\b/i, /\bFa[tț][aă]\s*[:\s]*(\d{3,4})\b/i]),
    true,
  );
  set(
    'axle2MaxMassKg',
    'MTMA axa spate',
    pick(text, [/\bSpate\s*[:\s]*(\d{3,4})\b/i]),
    true,
  );
  set(
    'maxBrakedTrailerMassKg',
    'Remorcabilă cu frână',
    pick(text, [
      /Remorcabila?\s+cu\s+(?:dispozitiv\s+de\s+)?fr[aâ]nare\s*[:\s]*(\d{2,5})/i,
      /Remorcabil\s+cu\s*[:\s]*(\d{2,5})/i,
      /cu\s+dispozitiv\s+de\s+fr[aâ]nare\s*[:\s]*(\d{2,5})/i,
    ]),
    true,
  );
  set(
    'maxUnbrakedTrailerMassKg',
    'Remorcabilă fără frână',
    pick(text, [
      /Remorcabila?\s+f[aă]r[aă]\s+(?:dispozitiv\s+de\s+)?fr[aâ]nare\s*[:\s]*(\d{2,5})/i,
      /Remorcabila?\s+fara\s*[:\s]*(\d{2,5})/i,
      /f[aă]r[aă]\s+dispozitiv\s+(?:de\s+)?fr[aâ]nare\s*[:\s]*(\d{2,5})/i,
    ]),
    true,
  );

  // 8. Locuri
  set(
    'seatsIncludingDriver',
    'Nr. locuri total',
    pick(text, [/\b(?:Nr\.?\s*locuri[^\n]{0,40}?)?\bTotal\s*[:\s]*(\d{1,2})\b/i, /\blocuri[^\n]{0,20}Total\s*[:\s]*(\d{1,2})\b/i]),
    true,
  );
  set(
    'standingPlaces',
    'Locuri în picioare',
    pick(text, [/\b(?:[Ii]n\s+)?picioare\s*[:\s]*(\d{1,2})\b/i]),
    true,
  );
  if (typeof profile.standingPlaces === 'number' && profile.standingPlaces > 40) {
    delete profile.standingPlaces;
    const idx = matched.findIndex((m) => m.target === 'standingPlaces');
    if (idx >= 0) matched.splice(idx, 1);
  }

  // 9. Dimensiuni L l h — OCR: „L 3958 1722 h 1481”
  const dims = /\bL\s*[:\s]*(\d{3,5})\s+(\d{3,5})\s+h\s*[:\s]*(\d{3,5})\b/i.exec(text);
  if (dims) {
    set('lengthMm', 'Lungime', dims[1], true);
    set('widthMm', 'Lățime', dims[2], true);
    set('heightMm', 'Înălțime', dims[3], true);
  } else {
    set('lengthMm', 'Lungime', pick(text, [/\bL\s*[:\s]*(\d{3,5})\b/, /\bLungime\s*[:\s]*(\d{3,5})\b/i]), true);
    set('widthMm', 'Lățime', pick(text, [/\bl\s*[:\s]*(\d{3,5})\b/, /\bL[aă][tț]ime\s*[:\s]*(\d{3,5})\b/i]), true);
    set('heightMm', 'Înălțime', pick(text, [/\bh\s*[:\s]*(\d{3,5})\b/, /\b[IiÎî]n[aă]l[tț]ime\s*[:\s]*(\d{3,5})\b/i]), true);
  }

  // 10. Motor
  set(
    'engineCode',
    'Tip motor',
    pick(text, [
      /(?:^|\n)\s*10\.?\s*Motorul[^\n]{0,40}?Tipul\s*[:\s]*([A-Z0-9\-]{3,12})\b/i,
      /\bMotorul[^\n]{0,30}?Tipul\s*[:\s]*([A-Z0-9\-]{3,12})\b/i,
      /\bTipul\s*[:\s]*(KVJA|[A-Z]{3,5}\d{0,2}[A-Z0-9]{0,4})\b/,
      /\bTipul\s+(KVJA)\b/i,
    ]),
  );
  set(
    'engineSerial',
    'Serie motor',
    pick(text, [/\bSerie\s*[:\s]*([A-Z0-9]{5,20})\b/i]),
  );
  set(
    'engineCapacityCm3',
    'Cilindree',
    pick(text, [
      /\bCilindree\s*(?:\([^)]*\))?\s*[:\s]*(\d{3,5})\b/i,
      /\bCilindree\s*(\d{3,5})\b/i,
    ]),
    true,
  );
  const putereTuratie = pick(text, [
    /Putere\s*max\w*\s*(?:\([^)]*\))?\s*\/?\s*Tura[tț]ie[^\n]{0,20}[:\s]*([^\n]+)/i,
    /Putere\s*max\w*[^\n]{0,15}[:\s]*([\d.,]+\s*\/\s*\d+)/i,
    /Putere\s+Turatie[^\n]{0,40}?([\d.,]+\s*\/\s*\d{3,5})/i,
    /([\d.,]+)\s*\/\s*(4000|3500|3750|3000|4500)\b/,
  ]);
  if (putereTuratie) {
    const parts = putereTuratie.split(/\s*\/\s*/);
    set('enginePowerKw', 'Putere max', parts[0] ?? null, true);
    set('engineRpm', 'Turație', parts[1] ?? null, true);
  } else {
    set('enginePowerKw', 'Putere max', pick(text, [/\bPutere\s*max\w*\s*(?:\([^)]*\))?\s*[:\s]*([\d.,]+)\b/i]), true);
    set('engineRpm', 'Turație', pick(text, [/\bTura[tț]ie\s*(?:\([^)]*\))?\s*[:\s]*(\d{3,5})\b/i]), true);
  }
  set(
    'fuelType',
    'Sursă energie',
    pick(text, [
      /\bSursa\s+de\s+energie\s*[:\s]*([A-ZĂÂÎȘȚa-zăâîșț]{4,20})\b/i,
      /\bSursa\s+de\s+(MOTORINA|BENZINA|GPL|ELECTRIC|HIBRID\w*)\b/i,
    ]),
  );

  set(
    'driveType',
    'Tracțiune',
    pick(text, [
      /\b(?:12\.?\s*)?Trac[tț]iune[a]?\s*[:\s]*(FATA|FAȚA|SPATE|INTEGRALA|4X4)\b/i,
      /\bTractiunea\s+(FATA|SPATE|INTEGRALA)\b/i,
    ]),
  );

  set(
    'axleCount',
    'Nr. axe',
    pick(text, [
      /\b(?:11\.?\s*)?Nr\.?\s*axe(?:lor)?\s*[:\s]*(\d)\b/i,
      /\bNumarul\s+axelor\s*[:\s]*(\d)\b/i,
      /\baxelor\s+Numarul\s+(\d)\b/i,
      /\baxelor\s+Numarul\s*(\d)/i,
    ]),
    true,
  );

  const tyresFront = pick(text, [
    /(?:13\.?\s*)?Dimensiunea\s+anvelopelor[^\n]{0,40}?Fa[tț][aă]\s*[:\s]*([^\n]+?)(?=\s+sau\s+|\s+Mijloc|\s+Spate|$)/i,
    /\bFa[tț][aă]\s*[:\s]*(\d{3}\s*\/\s*\d{2}\s*R\s*\d{2}[^\n]{0,30}?)(?=\s+sau\s+|\s+Spate|$)/i,
  ]);
  if (tyresFront) set('tyresFront', 'Anvelope față', tyresFront.replace(/\s+sau\s+.*$/i, '').trim());

  const tyresRear = pick(text, [
    /\bSpate\s*[:\s]*(\d{3}\s*\/\s*\d{2}\s*R\s*\d{2}[^\n]{0,40}?)(?=\s+sau\s+|$)/i,
  ]);
  if (tyresRear) set('tyresRear', 'Anvelope spate', tyresRear.replace(/\s+sau\s+.*$/i, '').trim());

  set('movingNoiseDb', 'Zgomot în mers', pick(text, [/\b(?:[Ii]n\s+)?mers\s*[:\s]*(\d{2,3})\b/i]), true);
  set(
    'stationaryNoiseDb',
    'Zgomot în staționare',
    pick(text, [/\b(?:[Ii]n\s+)?sta[tț]ionare\s*[:\s]*(\d{2,3})\b/i]),
    true,
  );
  set(
    'maxSpeedKmh',
    'Viteză max',
    pick(text, [/\bVit\.?\s*max\w*\s*(?:\([^)]*\))?\s*[:\s]*(\d{2,3})\b/i]),
    true,
  );
  set(
    'fuelTankCapacityL',
    'Capacitate rezervor',
    pick(text, [/\bCapacitatea\s+rezervorului\s*(?:\([^)]*\))?\s*[:\s]*([\d.,]+)\b/i]),
    true,
  );
  set(
    'color',
    'Culoare',
    pick(text, [/\b(?:18\.?\s*)?Culoarea?\s*[:\s]*([A-ZĂÂÎȘȚa-zăâîșț]{3,20})\b/i]),
  );

  // Modificări: CO2
  const co2 = pick(text, [/\bCO\s*2\s*[:\s]*(\d{2,3})\s*(?:g\s*\/\s*km)?/i, /\bCO₂\s*[:\s]*(\d{2,3})/i]);
  set('co2Gkm', 'CO₂', co2, true);

  if (!vin) vin = findVinInText(text);

  return { profile, matched, vin, techPairCount };
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
  const { profile, matched, vin, techPairCount } = mapCiv1993SectionAToProfile(sectionA);

  // Fallback: dacă Secțiunea A e săracă, încearcă tot verso/combined.
  let civProfile = profile;
  let allMatched = matched;
  let techCount = techPairCount;
  let usedVin = vin;
  if (techPairCount < 5) {
    const again = mapCiv1993SectionAToProfile(extractCiv1993SectionA(text));
    if (again.techPairCount > techPairCount) {
      civProfile = again.profile;
      allMatched = again.matched;
      techCount = again.techPairCount;
      usedVin = again.vin ?? vin;
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
      allMatched.push({ rubric: 'Nr. identificare', target: 'vin', value: usedVin });
    }
  }

  // Mențiuni pe p4 — pe 1993 rareori populate
  let civMentions = pages.mentionsText || null;
  if (civMentions && /radieri|sec[tț]iunea/i.test(civMentions) && civMentions.length < 20) {
    civMentions = null;
  }
  if (civMentions) {
    allMatched.push({ rubric: 'Mențiuni', target: 'civMentions', value: civMentions });
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
