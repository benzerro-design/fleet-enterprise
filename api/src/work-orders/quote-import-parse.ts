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
  sourceTextLength: number;
  warnings: string[];
  lines: QuoteImportPreviewLine[];
};

function detectFormat(text: string): QuoteImportPreview['formatDetected'] {
  const u = text.toUpperCase();
  if (
    u.includes('AUDATEX') ||
    u.includes('AXALTA') ||
    /KALKULATION|REPARATURKALKULATION|OE[-\s]?NR/i.test(text)
  ) {
    return 'audatex';
  }
  if (text.trim().length < 40) return 'unknown';
  return 'generic';
}

function parseMoneyToCents(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, '').replace(/RON|EUR|LEI/gi, '');
  // 1.234,56 or 1234.56 or 1234,56
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

/**
 * Heuristică pe text OCR / PDF — preview editabil, nu import mut.
 * Audatex + tabele generice (cant × preț).
 */
export function parseQuoteTextToPreview(text: string): QuoteImportPreview {
  const warnings: string[] = [];
  const normalized = text.replace(/\r\n/g, '\n').replace(/\t/g, ' ');
  const formatDetected = detectFormat(normalized);
  if (formatDetected === 'unknown') {
    warnings.push('Text prea scurt sau format nerecunoscut — verifică liniile manual.');
  }
  if (formatDetected === 'audatex') {
    warnings.push('Format detectat: Audatex (mapare euristică — verifică cantități și prețuri).');
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
    const partMatch = description.match(
      /\b([A-Z0-9][A-Z0-9./-]{4,})\b/,
    );
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
      confidence: formatDetected === 'audatex' ? 0.65 : 0.5,
      raw: m[0].slice(0, 200),
    });
    if (lines.length >= 80) break;
  }

  // Fallback: lines with a trailing money amount
  if (lines.length === 0) {
    const moneyLineRe = /^(.{10,160}?)\s+(\d{1,6}(?:[.,]\d{2})|\d{1,6}[.,]\d{3}[.,]\d{2})\s*(?:RON|EUR)?\s*$/gim;
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
    sourceTextLength: normalized.length,
    warnings,
    lines,
  };
}
