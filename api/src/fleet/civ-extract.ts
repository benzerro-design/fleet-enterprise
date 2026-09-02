import {
  CIV_PROFILE_FIELDS,
  type CivDocumentFormat,
  type VehicleCivProfile,
} from './vehicle-civ-fields';
import {
  extractCivLabelValuePairs,
  findCivSeriesInFrontText,
  findVinInText,
  mapCivPairsToFields,
  parseCivIssuedOnIso,
  type CivLabelPair,
} from './civ-label-map';
import { splitCivBookPages, stripEnglishCivGlossary } from './civ-pages';
import { looksLikeCiv1993, mapCiv1993TextToPreview } from './civ-1993-extract';

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
  /** Textul OCR (pentru verificare în UI). */
  ocrText?: string;
  /** True dacă formatul e CIV vechi — maparea modernă nu se aplică. */
  mappingSkipped?: boolean;
  mappingSkipReason?: string;
  /** VIN scris automat în Basic Info (dacă era gol). */
  vinAutoSaved?: boolean;
  /** Diagnostic: există marker / text verso. */
  hasVerso?: boolean;
  /** Perechi etichetă:valoare din pag. 2–3. */
  techPairCount?: number;
};

/** Format modern UE (Ordin 2016 / 2024) — același algoritm pe etichete. */
export function isModernCivFormat(format: CivDocumentFormat): boolean {
  return format === '2016' || format === '2024';
}

/**
 * Detectare variantă CIV.
 * - 2016: layout UE cu D.1 / P.x (ex. Logan emis 2022)
 * - 2024: același layout tehnic, fără rubrici proprietar (Ordin 211/2024)
 * - 1993: grilă veche, fără D.1
 */
export function detectCivDocumentFormat(text: string): CivDocumentFormat {
  const t = text.toLowerCase();
  const hasUeCodes = /\bd\.1\b/.test(t) || /\bp\.3\b/.test(t) || /\bd\.3\b/.test(t);
  if (hasUeCodes) {
    const hasOwnerBlock =
      /\bproprietar\b/.test(t) ||
      /\btitular\b/.test(t) ||
      /\bnume\s+si\s+prenume\b/.test(t) ||
      /\bcnp\b/.test(t);
    if (hasOwnerBlock) return '2016';
    // 2024 = aceleași D.1/P.x, fără C.2/CNP. Nu cere fraza „fără date proprietar”
    // (OCR rar o vede). Verso-only 2016 (fără față) rămâne 2016 — n-are indicii p1.
    const hasFront2024Hints =
      /\bmentiuni\b/.test(t) ||
      /\bvehicle identity card\b/.test(t) ||
      /\bnum[aă]r\s+de\s+[iî]nmatriculare\b/.test(t);
    if (hasFront2024Hints) return '2024';
    return '2016';
  }
  if (looksLikeCiv1993(text)) return '1993';
  if (/\bmarca\b/.test(t) && /\bcilindree\b/.test(t) && !/\bd\.1\b/.test(t)) return '1993';
  if (/\b14\.\s*cod\s+motor/.test(t) || /\b20\.1\s*suspensie/.test(t)) return '2016';
  return 'unknown';
}

function coerceProfileValue(key: string, raw: string): string | number {
  const def = CIV_PROFILE_FIELDS.find((f) => f.key === key);
  if (!def) return raw.trim();
  if (def.kind === 'number' || def.kind === 'year') {
    const n = Number(String(raw).replace(',', '.').replace(/[^\d.-]/g, ''));
    if (Number.isFinite(n)) return n;
  }
  return raw.trim();
}

function emptyModernPreview(
  formatUsed: CivDocumentFormat,
  source: 'text' | 'file',
  text: string,
  reason: string,
): CivExtractPreview {
  const pages = splitCivBookPages(text);
  return {
    civProfile: {},
    civSeries: null,
    civIssuedOn: null,
    civRarOffice: null,
    civMentions: null,
    vin: null,
    matched: [],
    unmatchedLines: [],
    formatUsed,
    source,
    ocrText: text.slice(0, 100_000),
    mappingSkipped: true,
    mappingSkipReason: reason,
    hasVerso: Boolean(pages.versoRaw.trim()) || /===\s*CIV\s+VERSO\s*===/i.test(text),
    techPairCount: 0,
  };
}

/** @deprecated folosește splitCivBookPages().seriesText */
export function splitCivFrontText(combined: string): string {
  return splitCivBookPages(combined).seriesText;
}

/**
 * Compune Tip / Variantă / Versiune din perechi separate de pe pagina 2.
 */
function composeTypeVariantVersion(pairs: CivLabelPair[]): string | null {
  let tip: string | null = null;
  let varianta: string | null = null;
  let versiune: string | null = null;
  for (const p of pairs) {
    const n = p.labelNorm;
    if (n === 'tip' || n === 'd 2 tip' || /^d\.?\s*2\.?\s*tip$/.test(n)) {
      if (/^[A-Z0-9]{1,8}$/i.test(p.value.trim())) tip = p.value.trim().toUpperCase();
    } else if (n === 'varianta' || n === 'variantă' || n.startsWith('varianta')) {
      if (/^[A-Z0-9]{2,14}$/i.test(p.value.trim())) varianta = p.value.trim().toUpperCase();
    } else if (n === 'versiune') {
      if (/^[A-Z0-9]{2,14}$/i.test(p.value.trim())) versiune = p.value.trim().toUpperCase();
    }
  }
  const parts = [tip, varianta, versiune].filter(Boolean);
  return parts.length ? parts.join(' / ') : null;
}

/**
 * Mapează text OCR CIV pe câmpuri:
 * - Serie CIV ← pagina 1 (față)
 * - Tehnice ← paginile 2–3 (verso), etichetă: valoare
 * - Mențiuni ← pagina 4 (fără glossar englez)
 */
export function mapCivExtractTextToPreview(
  text: string,
  formatHint: CivDocumentFormat = 'unknown',
  source: 'text' | 'file' = 'text',
): CivExtractPreview {
  const formatUsed =
    formatHint !== 'unknown' ? formatHint : detectCivDocumentFormat(text);

  if (formatUsed === '1993' || (formatUsed === 'unknown' && looksLikeCiv1993(text))) {
    const r = mapCiv1993TextToPreview(text, source);
    if (r.matched.length === 0) {
      return emptyModernPreview(
        '1993',
        source,
        text,
        'CIV 1993 detectat, dar nu am putut mapa Secțiunea A. Verifică scanul verso (pag. 2, coloana stângă).',
      );
    }
    return {
      civProfile: r.civProfile,
      civSeries: r.civSeries,
      civIssuedOn: r.civIssuedOn,
      civRarOffice: r.civRarOffice,
      civMentions: r.civMentions,
      vin: r.vin,
      matched: r.matched,
      unmatchedLines: r.unmatchedLines,
      formatUsed: '1993',
      source,
      ocrText: text.slice(0, 100_000),
      hasVerso: Boolean(splitCivBookPages(text).versoRaw.trim()) || /===\s*CIV\s+VERSO\s*===/i.test(text),
      techPairCount: r.techPairCount,
    };
  }

  const pages = splitCivBookPages(text);
  const techText = pages.techText.trim();
  const seriesText = pages.seriesText.trim();

  if (!isModernCivFormat(formatUsed) && formatUsed === 'unknown') {
    const probe = extractCivLabelValuePairs(techText || stripEnglishCivGlossary(text));
    if (probe.length < 3) {
      return emptyModernPreview(
        formatUsed,
        source,
        text,
        'Format CIV nerecunoscut. Încarcă CIV modern (2016+) față+verso (pag. 1–4) sau CIV 1993 cu Secțiunea A.',
      );
    }
  }

  // Doar paginile 2–3 pentru etichete tehnice. NU cădea pe față/proprietari când verso lipsește
  // (altfel „Mapate 13” din fallback-uri + perechi greșite de pe p1).
  const pairSource =
    techText ||
    pages.versoRaw.trim() ||
    (!pages.frontRaw.trim() ? stripEnglishCivGlossary(text) : '');
  const pairs = extractCivLabelValuePairs(pairSource);
  const hits = mapCivPairsToFields(pairs);

  const civProfile: VehicleCivProfile = {};
  const matched: CivExtractMatch[] = [];
  let civSeries: string | null = null;
  let civIssuedOn: string | null = null;
  let civRarOffice: string | null = null;
  let civMentions: string | null = pages.mentionsText || null;
  let vin: string | null = null;

  if (civMentions) {
    matched.push({ rubric: 'Mențiuni', target: 'civMentions', value: civMentions });
  }

  for (const hit of hits) {
    // Serie CIV nu se ia din p2–3 (risc serie motor).
    if (hit.kind === 'civSeries') continue;
    // Mențiuni deja din p4.
    if (hit.kind === 'civMentions') continue;

    matched.push({
      rubric: hit.label,
      target: hit.key,
      value: hit.value,
    });

    if (hit.kind === 'vin') {
      vin = hit.value.replace(/\s+/g, '').toUpperCase();
      continue;
    }
    if (hit.kind === 'civIssuedOn') {
      civIssuedOn = parseCivIssuedOnIso(hit.value) ?? hit.value.trim();
      continue;
    }
    if (hit.kind === 'civRarOffice') {
      civRarOffice = hit.value.trim();
      continue;
    }
    if (hit.kind === 'profile') {
      civProfile[hit.key] = coerceProfileValue(hit.key, hit.value);
    }
  }

  // Tip / Variantă / Versiune pe linii separate pe pagina 2 (nu un singur câmp pe CIV).
  {
    const composed = composeTypeVariantVersion(pairs);
    if (composed) {
      civProfile.typeVariantVersion = composed;
      if (!matched.some((m) => m.target === 'typeVariantVersion')) {
        matched.push({
          rubric: 'Tip / variantă / versiune',
          target: 'typeVariantVersion',
          value: composed,
        });
      } else {
        const row = matched.find((m) => m.target === 'typeVariantVersion');
        if (row) row.value = composed;
      }
    }
  }

  if (!vin) {
    vin = findVinInText(techText) ?? findVinInText(text);
    if (vin) {
      matched.push({ rubric: 'Număr de identificare', target: 'vin', value: vin });
    }
  }

  // Serie CIV exclusiv din pagina 1 (sub barcode).
  const series = findCivSeriesInFrontText(seriesText);
  if (series) {
    civSeries = series;
    matched.push({ rubric: 'Serie CIV', target: 'civSeries', value: series });
  }

  // Tip / Denumire comercială: pe verso uneori „VEHICUL LOGAN” e deasupra etichetei goale D.3.
  if (!civProfile.commercialName) {
    const commercial =
      /\bVEHICUL\s+([A-Z][A-Z0-9\-]{1,24})\b/i.exec(pairSource) ||
      /\bD\.?\s*3\.?\s*Denumire\s+comercial\w*\s*:?\s*([A-Z][A-Z0-9\-]{1,24})\b/i.exec(
        pairSource,
      );
    if (commercial) {
      const name = commercial[1]!.replace(/\s+/g, ' ').trim().toUpperCase();
      const blocked =
        !name ||
        /^(CONTINUARE|IDENTIFICARE|CONSTRUCTIVE|DATE|VEHICUL)$/i.test(name) ||
        /\b(DATE|IDENTIFICARE|CONSTRUCTIVE)\b/i.test(name);
      if (!blocked) {
        civProfile.commercialName = name;
        matched.push({
          rubric: 'Denumire comercială',
          target: 'commercialName',
          value: name,
        });
      }
    }
  }

  const fallbackText = pairSource || techText;
  applyEmptyFieldFallbacks(fallbackText, {
    civProfile,
    matched,
    setMeta: (key, value, rubric) => {
      if (
        key === 'brand' ||
        key === 'homologationCategory' ||
        key === 'usageCategory' ||
        key === 'bodyType' ||
        key === 'driveType' ||
        key === 'manufactureYear'
      ) {
        if (civProfile[key] == null || civProfile[key] === '') {
          civProfile[key] = coerceProfileValue(key, value);
          matched.push({ rubric, target: key, value });
        }
        return;
      }
      if (key === 'civRarOffice' && !civRarOffice) {
        civRarOffice = value;
        matched.push({ rubric, target: key, value });
      }
      if (key === 'civIssuedOn' && !civIssuedOn) {
        civIssuedOn = parseCivIssuedOnIso(value) ?? value;
        matched.push({ rubric, target: key, value: civIssuedOn });
      }
    },
  });

  const vinForBrand = vin ?? findVinInText(techText);
  if (
    vinForBrand?.startsWith('UU1') &&
    String(civProfile.brand ?? '')
      .toUpperCase()
      .replace(/\s+/g, '') === 'SEAT'
  ) {
    civProfile.brand = 'DACIA';
    matched.push({ rubric: 'Marcă (din VIN)', target: 'brand', value: 'DACIA' });
  }

  const unmatchedLines = pairs
    .filter(
      (p) =>
        !hits.some((h) => normalizeLoose(h.label) === normalizeLoose(p.label) && h.value === p.value),
    )
    .map((p) => `${p.label}: ${p.value}`)
    .slice(0, 40);

  return {
    civProfile,
    civSeries,
    civIssuedOn,
    civRarOffice,
    civMentions,
    vin,
    matched,
    unmatchedLines,
    formatUsed: isModernCivFormat(formatUsed) ? formatUsed : '2016',
    source,
    // Limita mare: „Extrage din text” pe text trunchiat pierde VERSO → mapare slabă.
    ocrText: text.slice(0, 100_000),
    hasVerso: Boolean(pages.versoRaw.trim()) || /===\s*CIV\s+VERSO\s*===/i.test(text),
    techPairCount: pairs.length,
  };
}

function applyEmptyFieldFallbacks(
  text: string,
  ctx: {
    civProfile: VehicleCivProfile;
    matched: CivExtractMatch[];
    setMeta: (key: string, value: string, rubric: string) => void;
  },
) {
  const t = text;
  const empty = (key: string) => ctx.civProfile[key] == null || ctx.civProfile[key] === '';

  if (empty('brand')) {
    const brand = resolveCivBrandFallback(t);
    if (brand) ctx.setMeta('brand', brand, 'Marcă');
  }

  if (empty('homologationCategory')) {
    const cat =
      /\bCategorie\s*:?\s*[\s\S]{0,40}?\b((?:M|N|O|L)\d{0,2})\b/i.exec(t) ||
      /\bAUTOTURISM\s*((?:M|N)\d)\b/i.exec(t) ||
      /\b(M1)\b/.exec(t);
    if (cat && !/^M[23]$/i.test(cat[1]!)) {
      ctx.setMeta('homologationCategory', cat[1]!.toUpperCase(), 'Categorie');
    } else if (/\b(M1)\b/.test(t)) {
      ctx.setMeta('homologationCategory', 'M1', 'Categorie');
    }
  }

  if (empty('usageCategory')) {
    const u = /\b(AUTOTURISM\s*M\d|AUTOTURISM|AUTOCAMION|AUTOBUZ|MOTOCICLETA|REMORCA)\b/i.exec(t);
    if (u) ctx.setMeta('usageCategory', u[1]!.replace(/\s+/g, ' ').toUpperCase(), 'Categorie de folosință');
  }

  if (empty('bodyType')) {
    const b = /\b(AC\s*BREAK|HATCHBACK|SEDAN|BREAK|SUV|COUPE|CABRIO|PICK[\s-]?UP)\b/i.exec(t);
    if (b) ctx.setMeta('bodyType', b[1]!.replace(/\s+/g, ' ').toUpperCase(), 'Caroserie');
  }

  if (empty('driveType')) {
    const d =
      /\bTrac[tţț]iune\s*:?[\s\S]{0,40}?\b(FATA|FAȚA|SPATE|INTEGRALA|4X4)\b/i.exec(t) ||
      /\b(FATA)\b/.exec(t);
    if (d) ctx.setMeta('driveType', d[1]!.replace(/Ț|ţ|ț/g, 'T').toUpperCase(), 'Tracțiune');
  }

  if (empty('manufactureYear')) {
    const y =
      /An\s+fabrica\w*\s*:?[\s\S]{0,80}?((?:19|20)\d{2})/i.exec(t) ||
      /fabrica\w*[\s\S]{0,40}?((?:19|20)\d{2})/i.exec(t) ||
      /\b[A-HJ-NPR-Z0-9]{17}\b[\s\S]{0,120}?\b((?:19|20)\d{2})\b/i.exec(t);
    if (y && Number(y[1]) >= 1980 && Number(y[1]) <= 2035) {
      ctx.setMeta('manufactureYear', y[1]!, 'An fabricație');
    }
  }

  const rar =
    /Reprezentan[tțţ][aă]\s+R\.?A\.?R\.?\s*:?[\s\S]{0,100}?\b([A-Z]{1,3}\/[A-Z0-9]{4,12})\b/i.exec(t) ||
    /\b(OB\/[A-Z0-9]{5,12})\b/i.exec(t);
  if (rar) ctx.setMeta('civRarOffice', rar[1]!.toUpperCase(), 'Reprezentanță RAR');

  const issued = /Data\s+eliber[aă]rii\s*:?[\s\S]{0,80}?(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{4})/i.exec(t);
  if (issued) ctx.setMeta('civIssuedOn', issued[1]!, 'Data eliberării');
}

function normalizeLoose(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const CIV_BRAND_PATTERN =
  '(DACIA|FORD|VOLKSWAGEN|VW|RENAULT|SKODA|OPEL|TOYOTA|HYUNDAI|BMW|AUDI|PEUGEOT|CITROEN|FIAT|SEAT|MERCEDES[\\s-]?BENZ)';

/** Marca doar lângă eticheta Marcă / D.1 sau din WMI VIN — pe text tehnic (p2–3). */
function resolveCivBrandFallback(text: string): string | null {
  const nearLabel = new RegExp(
    `(?:D\\.?\\s*1\\.?\\s*)?(?:Marca)\\s*:?\\s*${CIV_BRAND_PATTERN}\\b`,
    'i',
  ).exec(text);
  if (nearLabel) {
    const b = nearLabel[1]!.replace(/\s+/g, ' ').toUpperCase();
    return b === 'VW' ? 'VOLKSWAGEN' : b;
  }

  const vin = findVinInText(text);
  if (vin?.startsWith('UU1')) return 'DACIA';
  if (vin?.startsWith('WF0') || vin?.startsWith('WFO')) return 'FORD';
  if (vin?.startsWith('WVW') || vin?.startsWith('WV1')) return 'VOLKSWAGEN';
  if (vin?.startsWith('VF1')) return 'RENAULT';
  if (vin?.startsWith('TMB')) return 'SKODA';
  if (vin?.startsWith('VSS')) return 'SEAT';

  return null;
}
