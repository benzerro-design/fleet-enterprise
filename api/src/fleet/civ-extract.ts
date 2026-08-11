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
} from './civ-label-map';

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
  /** Textul OCR brut (pentru verificare în UI). */
  ocrText?: string;
  /** True dacă formatul e CIV vechi — maparea modernă nu se aplică. */
  mappingSkipped?: boolean;
  mappingSkipReason?: string;
  /** VIN scris automat în Basic Info (dacă era gol). */
  vinAutoSaved?: boolean;
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
    // 2024: fără câmpuri proprietar tipice pe stocul vechi 2016.
    const hasOwnerBlock =
      /\bproprietar\b/.test(t) ||
      /\btitular\b/.test(t) ||
      /\bnume\s+si\s+prenume\b/.test(t) ||
      /\bcnp\b/.test(t);
    if (!hasOwnerBlock && (/\bvehicle identity card\b/.test(t) || /\bmentiuni\b/.test(t))) {
      // Heuristică slabă: preferăm 2016 dacă e ambiguu (majoritatea scanurilor actuale).
      // Marcăm 2024 doar când lipsește clar blocul proprietar ȘI există indicii post-2024.
      if (/\bfara\s+date\s+proprietar\b/.test(t) || /\bno\s+owner\b/.test(t)) return '2024';
    }
    return '2016';
  }
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
    ocrText: text.slice(0, 8000),
    mappingSkipped: true,
    mappingSkipReason: reason,
  };
}

/**
 * Separă textul feței când OCR-ul e concatenat față+verso.
 */
export function splitCivFrontText(combined: string): string {
  const m = /===\s*CIV\s+VERSO\s*===/i.exec(combined);
  if (!m || m.index == null) {
    const alt = /===\s*CIV\s+FA[TȚ][AĂ]\s*===/i.exec(combined);
    if (alt && alt.index != null) {
      const after = combined.slice(alt.index + alt[0].length);
      const verso = /===\s*CIV\s+VERSO\s*===/i.exec(after);
      return verso && verso.index != null ? after.slice(0, verso.index) : after;
    }
    return combined;
  }
  return combined.slice(0, m.index);
}

/**
 * Mapează text OCR CIV pe câmpurile formularului: denumire (stânga, cu ":") → valoare (dreapta).
 * Doar pentru CIV modern (2016/2024). CIV vechi → mappingSkipped.
 */
export function mapCivExtractTextToPreview(
  text: string,
  formatHint: CivDocumentFormat = 'unknown',
  source: 'text' | 'file' = 'text',
): CivExtractPreview {
  const formatUsed =
    formatHint !== 'unknown' ? formatHint : detectCivDocumentFormat(text);

  if (formatUsed === '1993') {
    return emptyModernPreview(
      formatUsed,
      source,
      text,
      'CIV vechi (format pre-2016): algoritmul pe etichete nu se aplică. Mapare separată — în lucru.',
    );
  }
  if (!isModernCivFormat(formatUsed) && formatUsed === 'unknown') {
    // Dacă totuși avem perechi etichetă:, încercăm ca modern; altfel skip.
    const probe = extractCivLabelValuePairs(text);
    if (probe.length < 3) {
      return emptyModernPreview(
        formatUsed,
        source,
        text,
        'Format CIV nerecunoscut. Încarcă CIV modern (2016+) față+verso sau lipește text OCR cu etichete „Marcă: …”.',
      );
    }
  }

  const pairs = extractCivLabelValuePairs(text);
  const hits = mapCivPairsToFields(pairs);

  const civProfile: VehicleCivProfile = {};
  const matched: CivExtractMatch[] = [];
  let civSeries: string | null = null;
  let civIssuedOn: string | null = null;
  let civRarOffice: string | null = null;
  let civMentions: string | null = null;
  let vin: string | null = null;

  for (const hit of hits) {
    matched.push({
      rubric: hit.label,
      target: hit.key,
      value: hit.value,
    });

    if (hit.kind === 'vin') {
      vin = hit.value.replace(/\s+/g, '').toUpperCase();
      continue;
    }
    if (hit.kind === 'civSeries') {
      civSeries = hit.value.trim().toUpperCase().replace(/\s+/g, '');
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
    if (hit.kind === 'civMentions') {
      civMentions = hit.value.trim();
      continue;
    }
    if (hit.kind === 'profile') {
      civProfile[hit.key] = coerceProfileValue(hit.key, hit.value);
    }
  }

  if (!vin) {
    vin = findVinInText(text);
    if (vin) {
      matched.push({ rubric: 'Număr de identificare', target: 'vin', value: vin });
    }
  }

  if (!civSeries) {
    const front = splitCivFrontText(text);
    const series = findCivSeriesInFrontText(front);
    if (series) {
      civSeries = series;
      matched.push({ rubric: 'Serie CIV', target: 'civSeries', value: series });
    }
  }

  // Fallback-uri pe denumiri/semantice — doar dacă eticheta:valoare a lăsat gol.
  applyEmptyFieldFallbacks(text, {
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
    ocrText: text.slice(0, 8000),
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
    const brand =
      /\b(DACIA|FORD|VOLKSWAGEN|RENAULT|SKODA|OPEL|TOYOTA|HYUNDAI|BMW|AUDI|PEUGEOT|CITROEN|FIAT|SEAT|MERCEDES[-\s]?BENZ)\b/i.exec(
        t,
      );
    if (brand) ctx.setMeta('brand', brand[1]!.replace(/\s+/g, ' ').toUpperCase(), 'Marcă');
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
