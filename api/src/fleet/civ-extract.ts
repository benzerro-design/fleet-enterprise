import {
  CIV_PROFILE_FIELDS,
  type CivDocumentFormat,
  type VehicleCivProfile,
} from './vehicle-civ-fields';
import {
  extractCivLabelValuePairs,
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
};

/**
 * Detectare format doar informativă (UI / debug). Maparea NU depinde de indici.
 */
export function detectCivDocumentFormat(text: string): CivDocumentFormat {
  const t = text.toLowerCase();
  if (/\bd\.1\b/.test(t) || /\bp\.3\b/.test(t) || /\bd\.3\b/.test(t)) return '2024';
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

/**
 * Mapează text OCR CIV pe câmpurile formularului: denumire (stânga, cu ":") → valoare (dreapta).
 * Indicii de rubrică (17 vs 18, D.1…) sunt ignorate la mapare.
 */
export function mapCivExtractTextToPreview(
  text: string,
  formatHint: CivDocumentFormat = 'unknown',
  source: 'text' | 'file' = 'text',
): CivExtractPreview {
  const formatUsed =
    formatHint !== 'unknown' ? formatHint : detectCivDocumentFormat(text);

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
      civSeries = hit.value.trim();
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

  // Fallback-uri pe denumiri/semantice — doar dacă eticheta:valoare a lăsat gol (OCR 2 coloane).
  applyEmptyFieldFallbacks(text, {
    civProfile,
    matched,
    setMeta: (key, value, rubric) => {
      if (key === 'brand' || key === 'homologationCategory' || key === 'usageCategory' || key === 'bodyType' || key === 'driveType' || key === 'manufactureYear') {
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

  // Tip/variantă/versiune pe linii separate (fără ":" pe același rând) — doar dacă lipsesc.
  if (!civProfile.typeVariantVersion) {
    const composed = composeTypeVariantFromLooseLines(text);
    if (composed) {
      civProfile.typeVariantVersion = composed;
      matched.push({
        rubric: 'Tip / variantă / versiune',
        target: 'typeVariantVersion',
        value: composed,
      });
    }
  }

  const unmatchedLines = pairs
    .filter((p) => !hits.some((h) => normalizeLoose(h.label) === normalizeLoose(p.label) && h.value === p.value))
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
    formatUsed,
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
    const brand = /\b(DACIA|FORD|VOLKSWAGEN|RENAULT|SKODA|OPEL|TOYOTA|HYUNDAI|BMW|AUDI|PEUGEOT|CITROEN|FIAT|SEAT|MERCEDES[-\s]?BENZ)\b/i.exec(
      t,
    );
    if (brand) ctx.setMeta('brand', brand[1]!.replace(/\s+/g, ' ').toUpperCase(), 'Marcă');
  }

  if (empty('homologationCategory')) {
    // Evită „M2/M3” din eticheta Clasă; preferă M1 pe CIV autoturism.
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
      /fabrica\w*[\s\S]{0,40}?((?:19|20)\d{2})/i.exec(t);
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

/** Uneori Tip / Variantă / Versiune apar pe rânduri fără valoare pe aceeași linie. */
function composeTypeVariantFromLooseLines(text: string): string | null {
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const codes: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^tip\s*:?\s*$/i.test(line) || /^d\.?\s*2\.?\s*tip\s*:?\s*$/i.test(line)) {
      const n = lines[i + 1];
      if (n && /^[A-Z0-9]{1,8}$/i.test(n) && !/variant|versiune/i.test(n)) codes.push(n.toUpperCase());
    }
    if (/^variant[aă]\s*:?\s*$/i.test(line)) {
      const n = lines[i + 1];
      if (n && /^[A-Z0-9]{2,14}$/i.test(n) && /\d/.test(n)) codes.push(n.toUpperCase());
    }
    if (/^versiune\s*:?\s*$/i.test(line)) {
      const n = lines[i + 1];
      if (n && /^[A-Z0-9]{2,14}$/i.test(n) && /\d/.test(n)) codes.push(n.toUpperCase());
    }
  }
  // Fallback tipic Dacia: SD + 7SDCL + 7SDCL5 în text
  if (!codes.length) {
    if (/\bSD\b/.test(text) && /\b7SDCL\b/i.test(text)) {
      const v = /\b(7SDCL\d?)\b/i.exec(text)?.[1];
      return ['SD', '7SDCL', v?.toUpperCase()].filter(Boolean).join(' / ');
    }
    return null;
  }
  return [...new Set(codes)].join(' / ');
}
