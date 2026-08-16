import {
  isLikelyAudatex,
  parseAudatexQuoteText,
} from './quote-import-audatex';

export type QuoteImportLineType = 'labor' | 'parts' | 'other';

export type QuoteImportPreviewLine = {
  lineType: QuoteImportLineType;
  description: string;
  quantity: number;
  unitNetCents: number;
  vatRatePercent: number;
  partNumber: string | null;
  confidence: number;
  raw?: string;
};

export type QuoteImportPreview = {
  formatDetected: 'audatex' | 'generic' | 'unknown';
  parser: 'audatex-v1' | 'generic-v1' | 'none';
  sourceTextLength: number;
  warnings: string[];
  summary: {
    parts: number;
    labor: number;
    other: number;
    lowConfidence: number;
  };
  lines: QuoteImportPreviewLine[];
};

function detectFormat(text: string): QuoteImportPreview['formatDetected'] {
  if (isLikelyAudatex(text)) return 'audatex';
  if (text.trim().length < 40) return 'unknown';
  return 'generic';
}

function parseMoneyToCents(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, '').replace(/RON|EUR|LEI/gi, '');
  let normalized = cleaned;
  if (/,/.test(cleaned) && /\./.test(cleaned)) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (/,/.test(cleaned)) {
    normalized = cleaned.replace(',', '.');
  }
  const n = Number.parseFloat(normalized);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function guessLineType(desc: string, partNumber: string | null): QuoteImportLineType {
  const d = desc.toLowerCase();
  if (partNumber) return 'parts';
  if (
    /manoper|labor|lucrare|tinich|vopsit|demont|montaj|ore\b|uhl|arbeitszeit/i.test(d)
  ) {
    return 'labor';
  }
  if (/pies|part|oe\b|ref\.|consumabil|material/i.test(d)) return 'parts';
  return 'other';
}

function buildSummary(lines: QuoteImportPreviewLine[]): QuoteImportPreview['summary'] {
  const summary = { parts: 0, labor: 0, other: 0, lowConfidence: 0 };
  for (const line of lines) {
    if (line.lineType === 'parts') summary.parts += 1;
    else if (line.lineType === 'labor') summary.labor += 1;
    else summary.other += 1;
    if (line.confidence < 0.6) summary.lowConfidence += 1;
  }
  return summary;
}

function parseGeneric(text: string, formatDetected: QuoteImportPreview['formatDetected']): QuoteImportPreview {
  const warnings: string[] = [];
  const normalized = text.replace(/\r\n/g, '\n').replace(/\t/g, ' ');
  if (formatDetected === 'unknown') {
    warnings.push('Text prea scurt sau format nerecunoscut — verifică liniile manual.');
  }

  const lines: QuoteImportPreviewLine[] = [];
  const seen = new Set<string>();

  const rowRe =
    /^(.{8,120}?)\s+(\d+(?:[.,]\d+)?)\s+(?:x\s*)?(\d+(?:[.,]\d+)?)\s*(?:RON|EUR|LEI)?\s*$/gim;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(normalized)) !== null) {
    const description = m[1].replace(/\s+/g, ' ').trim();
    const qty = Number.parseFloat(m[2].replace(',', '.'));
    const unitCents = parseMoneyToCents(m[3]);
    if (!description || !Number.isFinite(qty) || qty <= 0 || unitCents == null) continue;
    if (/^total|subtotal|tva|sumă|suma/i.test(description)) continue;
    const key = `${description}|${qty}|${unitCents}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const partMatch = description.match(/\b([A-Z0-9][A-Z0-9./-]{4,})\b/);
    const partNumber =
      partMatch && !/^(RON|EUR|LEI|TVA|AUDATEX)$/i.test(partMatch[1])
        ? partMatch[1]
        : null;
    lines.push({
      lineType: guessLineType(description, partNumber),
      description: description.slice(0, 240),
      quantity: Math.round(qty * 1000) / 1000,
      unitNetCents: unitCents,
      vatRatePercent: 19,
      partNumber,
      confidence: 0.5,
      raw: m[0].slice(0, 200),
    });
    if (lines.length >= 80) break;
  }

  if (lines.length === 0) {
    const moneyLineRe =
      /^(.{10,160}?)\s+(\d{1,6}(?:[.,]\d{2})|\d{1,6}[.,]\d{3}[.,]\d{2})\s*(?:RON|EUR)?\s*$/gim;
    while ((m = moneyLineRe.exec(normalized)) !== null) {
      const description = m[1].replace(/\s+/g, ' ').trim();
      const unitCents = parseMoneyToCents(m[2]);
      if (!description || unitCents == null || unitCents < 50) continue;
      if (/^total|subtotal|tva|sumă|suma|pagina/i.test(description)) continue;
      const key = `${description}|1|${unitCents}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push({
        lineType: guessLineType(description, null),
        description: description.slice(0, 240),
        quantity: 1,
        unitNetCents: unitCents,
        vatRatePercent: 19,
        partNumber: null,
        confidence: 0.35,
        raw: m[0].slice(0, 200),
      });
      if (lines.length >= 40) break;
    }
    if (lines.length) {
      warnings.push('Am folosit o mapare simplificată (o sumă pe rând) — verifică cantitățile.');
    }
  }

  if (!lines.length) {
    warnings.push(
      'Nu am putut extrage linii automat. Poți lipi textul tabelului sau completa manual pe ciornă.',
    );
  }

  return {
    formatDetected,
    parser: 'generic-v1',
    sourceTextLength: normalized.length,
    warnings,
    summary: buildSummary(lines),
    lines,
  };
}

/**
 * Heuristică pe text OCR / PDF — preview editabil.
 * Audatex → parser dedicat v1; altfel generic.
 */
export function parseQuoteTextToPreview(text: string): QuoteImportPreview {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\t/g, ' ');
  const formatDetected = detectFormat(normalized);

  if (formatDetected === 'audatex') {
    const audatex = parseAudatexQuoteText(normalized);
    if (audatex.lines.length > 0) {
      return {
        ...audatex,
        parser: 'audatex-v1',
        summary: buildSummary(audatex.lines),
      };
    }
    const fallback = parseGeneric(normalized, 'audatex');
    return {
      ...fallback,
      formatDetected: 'audatex',
      warnings: [
        ...audatex.warnings,
        'Fallback la parser generic după Audatex fără linii.',
        ...fallback.warnings,
      ],
    };
  }

  return parseGeneric(normalized, formatDetected);
}
