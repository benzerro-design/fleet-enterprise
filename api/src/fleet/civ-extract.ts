import {
  CIV_PROFILE_FIELDS,
  normalizeCivRubricToken,
  resolveCivRubric,
  type CivDocumentFormat,
  type VehicleCivProfile,
} from './vehicle-civ-fields';

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

/** Heuristic: CIV 2016 if we see "2. An fabrica" / "14. Cod motor" style markers. */
export function detectCivDocumentFormat(text: string): CivDocumentFormat {
  const t = text.toLowerCase();
  if (/\b2\.\s*an\s+fabrica/.test(t) || /\b14\.\s*cod\s+motor/.test(t) || /\b20\.1\s*suspensie/.test(t)) {
    return '2016';
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

/**
 * Mapează text OCR / copy-paste din CIV pe câmpurile Fleet (preview, fără persistare).
 */
export function mapCivExtractTextToPreview(
  text: string,
  formatHint: CivDocumentFormat = 'unknown',
  source: 'text' | 'file' = 'text',
): CivExtractPreview {
  const formatUsed =
    formatHint !== 'unknown' ? formatHint : detectCivDocumentFormat(text);
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const civProfile: VehicleCivProfile = {};
  const matched: CivExtractMatch[] = [];
  const unmatchedLines: string[] = [];
  let civSeries: string | null = null;
  let civIssuedOn: string | null = null;
  let civRarOffice: string | null = null;
  let civMentions: string | null = null;
  let vin: string | null = null;

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
  ];

  // Longer rubrics first (18.1 before 18, D.1 before D)
  const sortedRubrics = [...new Set(rubricAlts)].sort((a, b) => b.length - a.length);
  const rubricUnion = sortedRubrics
    .map((r) => r.replace(/\./g, '\\.').replace(/\s+/g, '\\s+'))
    .join('|');
  const lineRe = new RegExp(
    `^(${rubricUnion})\\b\\s*[:.\\-–]?\\s*(.*)$`,
    'i',
  );

  for (const line of lines) {
    const m = lineRe.exec(line);
    if (!m) {
      // VIN standalone 17 chars
      const vinOnly = /\b([A-HJ-NPR-Z0-9]{17})\b/i.exec(line);
      if (vinOnly && !vin) {
        vin = vinOnly[1].toUpperCase();
        matched.push({ rubric: 'E', target: 'vin', value: vin });
        continue;
      }
      if (line.length > 2) unmatchedLines.push(line);
      continue;
    }

    const rubricRaw = m[1].trim();
    const value = cleanValue(m[2] ?? '');
    if (!value) {
      unmatchedLines.push(line);
      continue;
    }

    const resolved = resolveCivRubric(rubricRaw, formatUsed);
    if (!resolved) {
      unmatchedLines.push(line);
      continue;
    }

    if (resolved.kind === 'vin') {
      const v = value.replace(/\s+/g, '').toUpperCase();
      vin = v;
      matched.push({ rubric: rubricRaw, target: 'vin', value: v });
      continue;
    }
    if (resolved.kind === 'civSeries') {
      civSeries = value;
      matched.push({ rubric: rubricRaw, target: 'civSeries', value });
      continue;
    }
    if (resolved.kind === 'civIssuedOn') {
      civIssuedOn = parseIsoDateHint(value) ?? value.slice(0, 10);
      matched.push({ rubric: rubricRaw, target: 'civIssuedOn', value: civIssuedOn });
      continue;
    }
    if (resolved.kind === 'civRarOffice') {
      civRarOffice = value;
      matched.push({ rubric: rubricRaw, target: 'civRarOffice', value });
      continue;
    }
    if (resolved.kind === 'civMentions') {
      civMentions = value;
      matched.push({ rubric: rubricRaw, target: 'civMentions', value });
      continue;
    }
    if (resolved.kind === 'profile') {
      const field = resolved.field;
      let stored: string | number = value;
      if (field.kind === 'number' || field.kind === 'year') {
        const n = Number(value.replace(',', '.').replace(/[^\d.-]/g, ''));
        if (!Number.isFinite(n)) {
          unmatchedLines.push(line);
          continue;
        }
        stored = n;
      }
      // Don't overwrite richer earlier match
      if (civProfile[field.key] == null || civProfile[field.key] === '') {
        civProfile[field.key] = stored;
        matched.push({ rubric: rubricRaw, target: field.key, value: String(stored) });
      }
    }
  }

  // Mentions: if a block after "Mențiuni" without rubric — already handled by line match.
  void normalizeCivRubricToken;

  return {
    civProfile,
    civSeries,
    civIssuedOn,
    civRarOffice,
    civMentions,
    vin,
    matched,
    unmatchedLines: unmatchedLines.slice(0, 40),
    formatUsed,
    source,
  };
}
