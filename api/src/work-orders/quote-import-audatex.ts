import type {
  QuoteImportPreview,
  QuoteImportPreviewLine,
  QuoteImportLineType,
} from './quote-import-parse';

function parseMoneyToCents(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, '').replace(/RON|EUR|LEI|PLN|CHF/gi, '');
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

function isNoiseDescription(desc: string): boolean {
  return /^(total|subtotal|tva|sumă|suma|mwst|netto|brutto|pagina|seite|zwischensumme|gesamtkosten|gesamt)/i.test(
    desc.trim(),
  );
}

/** OE / SKU típice Audatex (ex. 7711478056, 6R0821021A). */
function extractOe(raw: string): string | null {
  const patterns = [
    /(?:OE[-\s]?Nr\.?|OE\s*[:#]?|Nr\.?\s*OE)\s*[:\s]*([A-Z0-9][A-Z0-9./-]{3,})/i,
    /\b([0-9]{5,}[A-Z0-9./-]*)\b/,
    /\b([A-Z]{1,3}[0-9]{4,}[A-Z0-9]*)\b/,
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (!m?.[1]) continue;
    const code = m[1].replace(/[.,;]+$/, '');
    if (/^(RON|EUR|LEI|TVA|AUDATEX|MWST|UHR|AE)$/i.test(code)) continue;
    if (code.length < 5) continue;
    return code;
  }
  return null;
}

type Section = 'parts' | 'labor' | 'paint' | 'other' | null;

function detectSection(line: string): Section {
  const u = line.toUpperCase();
  if (
    /ERSATZTEIL|PIESE\b|PARTS\b|MATERIALE?\b|CONSUMABIL|LACKMATERIAL|MATERIAL LAC/.test(u)
  ) {
    if (/LACKMATERIAL|MATERIAL LAC|VOPSEA|LACKIERMATERIAL/.test(u)) return 'paint';
    return 'parts';
  }
  if (/ARBEITSKOST|MANOPER|LABOR\b|ARBEITSZEIT|LUCR[AĂ]RI/.test(u)) return 'labor';
  if (/LACKIERUNG|VOPSIT|REFINISH|PAINT/.test(u)) return 'paint';
  return null;
}

/**
 * Linie piesă Audatex (variante OCR / PDF text):
 *  7711478056  BARA FATA  1  245,00
 *  OE-Nr. 6R0821021A  Aripa  1x  312.50 RON
 */
const PARTS_ROW =
  /^(?:(?:OE[-\s]?Nr\.?|OE)\s*[:.]?\s*)?([A-Z0-9][A-Z0-9./-]{4,})\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s*(?:x|X|buc|pcs)?\s+(\d{1,7}(?:[.,]\d{2})?(?:[.,]\d{3})?)\s*(?:RON|EUR|LEI)?\s*$/i;

/** Manoperă: descriere + ore (AE/U) + tarif sau total */
const LABOR_ROW =
  /^(.{6,140}?)\s+(\d+(?:[.,]\d+)?)\s*(?:AE|UHR|U|h|ore|H)\s+(?:[x×]\s*)?(\d{1,6}(?:[.,]\d{2})?)\s*(?:RON|EUR|LEI)?\s*$/i;

/** Manoperă cu total la final (fără tarif separat) */
const LABOR_TOTAL_ROW =
  /^(.{6,140}?)\s+(\d+(?:[.,]\d+)?)\s*(?:AE|UHR|U|h|ore)\s+(\d{1,7}(?:[.,]\d{2})?)\s*(?:RON|EUR|LEI)?\s*$/i;

function pushUnique(
  lines: QuoteImportPreviewLine[],
  seen: Set<string>,
  line: QuoteImportPreviewLine,
) {
  const key = `${line.lineType}|${line.partNumber ?? ''}|${line.description}|${line.quantity}|${line.unitNetCents}`;
  if (seen.has(key)) return;
  seen.add(key);
  lines.push(line);
}

/**
 * Parser dedicat Audatex / Qapter (text OCR sau PDF text layer).
 * Acoperă secțiuni Ersatzteile / Arbeitskosten / Lackierung (+ etichete RO).
 */
export function parseAudatexQuoteText(text: string): QuoteImportPreview {
  const warnings: string[] = [];
  const normalized = text.replace(/\r\n/g, '\n').replace(/\t/g, ' ');
  const lines: QuoteImportPreviewLine[] = [];
  const seen = new Set<string>();

  let section: Section = null;
  let partsHits = 0;
  let laborHits = 0;
  let paintHits = 0;

  for (const rawLine of normalized.split('\n')) {
    const line = rawLine.replace(/\s+/g, ' ').trim();
    if (!line || line.length < 4) continue;

    const sectionHit = detectSection(line);
    if (sectionHit) {
      section = sectionHit;
      continue;
    }

    if (isNoiseDescription(line)) continue;

    // --- Parts ---
    if (section === 'parts' || section === null || section === 'paint') {
      let m = PARTS_ROW.exec(line);
      if (!m) {
        // Varianta: descriere ... OE ... cant preț
        const alt =
          /^(.{8,100}?)\s+(?:OE[-\s]?Nr\.?\s*)?([A-Z0-9][A-Z0-9./-]{4,})\s+(\d+(?:[.,]\d+)?)\s+(\d{1,7}(?:[.,]\d{2})?)\s*(?:RON|EUR|LEI)?\s*$/i.exec(
            line,
          );
        if (alt) {
          m = alt as unknown as RegExpExecArray;
          // remap: desc, oe, qty, price
          const description = alt[1].trim();
          const partNumber = alt[2];
          const qty = Number.parseFloat(alt[3].replace(',', '.'));
          const unitCents = parseMoneyToCents(alt[4]);
          if (
            description &&
            Number.isFinite(qty) &&
            qty > 0 &&
            unitCents != null &&
            !isNoiseDescription(description)
          ) {
            const lineType: QuoteImportLineType =
              section === 'paint' || /lac|vopsea|paint|lack/i.test(description)
                ? 'other'
                : 'parts';
            pushUnique(lines, seen, {
              lineType,
              description: description.slice(0, 240),
              quantity: Math.round(qty * 1000) / 1000,
              unitNetCents: unitCents,
              vatRatePercent: 19,
              partNumber,
              confidence: 0.88,
              raw: line.slice(0, 200),
            });
            if (lineType === 'parts') partsHits += 1;
            else paintHits += 1;
            continue;
          }
        }
      } else {
        const partNumber = m[1];
        const description = m[2].replace(/\s+/g, ' ').trim();
        const qty = Number.parseFloat(m[3].replace(',', '.'));
        const unitCents = parseMoneyToCents(m[4]);
        if (
          description &&
          Number.isFinite(qty) &&
          qty > 0 &&
          unitCents != null &&
          !isNoiseDescription(description)
        ) {
          const lineType: QuoteImportLineType =
            section === 'paint' || /lac|vopsea|paint|lack/i.test(description)
              ? 'other'
              : 'parts';
          pushUnique(lines, seen, {
            lineType,
            description: description.slice(0, 240),
            quantity: Math.round(qty * 1000) / 1000,
            unitNetCents: unitCents,
            vatRatePercent: 19,
            partNumber,
            confidence: section === 'parts' ? 0.9 : 0.78,
            raw: line.slice(0, 200),
          });
          if (lineType === 'parts') partsHits += 1;
          else paintHits += 1;
          continue;
        }
      }
    }

    // --- Labor ---
    if (section === 'labor' || section === 'paint' || section === null) {
      const lm = LABOR_ROW.exec(line) || LABOR_TOTAL_ROW.exec(line);
      if (lm) {
        const description = lm[1].replace(/\s+/g, ' ').trim();
        const hours = Number.parseFloat(lm[2].replace(',', '.'));
        const money = parseMoneyToCents(lm[3]);
        if (
          description &&
          Number.isFinite(hours) &&
          hours > 0 &&
          money != null &&
          !isNoiseDescription(description)
        ) {
          // Dacă al 3-lea număr e mic (< 500 lei) și ore > 1, e probabil tarif/oră → unit = tarif, qty = ore
          // Dacă e mare, e total linie → unit = total/ore
          let quantity = hours;
          let unitNetCents = money;
          if (money > 50000 && hours > 0) {
            // likely total in cents > 500 RON
            unitNetCents = Math.round(money / hours);
          } else if (hours >= 1 && money < 20000) {
            // tarif pe oră
            quantity = hours;
            unitNetCents = money;
          }
          pushUnique(lines, seen, {
            lineType: 'labor',
            description: description.slice(0, 240),
            quantity: Math.round(quantity * 1000) / 1000,
            unitNetCents,
            vatRatePercent: 19,
            partNumber: null,
            confidence: section === 'labor' ? 0.86 : 0.72,
            raw: line.slice(0, 200),
          });
          laborHits += 1;
          continue;
        }
      }
    }

    // OE pe linie liberă + sumă la final
    const oe = extractOe(line);
    const trailing = line.match(
      /(\d+(?:[.,]\d+)?)\s+(\d{1,7}(?:[.,]\d{2})?)\s*(?:RON|EUR|LEI)?\s*$/i,
    );
    if (oe && trailing && (section === 'parts' || section === null)) {
      const qty = Number.parseFloat(trailing[1].replace(',', '.'));
      const unitCents = parseMoneyToCents(trailing[2]);
      let description = line
        .replace(trailing[0], '')
        .replace(oe, '')
        .replace(/OE[-\s]?Nr\.?/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!description) description = oe;
      if (Number.isFinite(qty) && qty > 0 && unitCents != null && unitCents >= 50) {
        pushUnique(lines, seen, {
          lineType: 'parts',
          description: description.slice(0, 240),
          quantity: Math.round(qty * 1000) / 1000,
          unitNetCents: unitCents,
          vatRatePercent: 19,
          partNumber: oe,
          confidence: 0.7,
          raw: line.slice(0, 200),
        });
        partsHits += 1;
      }
    }

    if (lines.length >= 100) break;
  }

  warnings.push(
    `Parser Audatex v1: ${partsHits} piese, ${laborHits} manoperă, ${paintHits} lac/altele.`,
  );
  if (!lines.length) {
    warnings.push('Parser Audatex: nicio linie mapată — se încearcă fallback generic.');
  } else if (partsHits === 0 && laborHits === 0) {
    warnings.push('Audatex: linii extrase cu încredere mixtă — verifică tipurile.');
  }

  return {
    formatDetected: 'audatex',
    parser: 'audatex-v1',
    sourceTextLength: normalized.length,
    warnings,
    summary: {
      parts: partsHits,
      labor: laborHits,
      other: paintHits,
      lowConfidence: lines.filter((l) => l.confidence < 0.6).length,
    },
    lines,
  };
}

export function isLikelyAudatex(text: string): boolean {
  const u = text.toUpperCase();
  return (
    u.includes('AUDATEX') ||
    u.includes('QAPTER') ||
    u.includes('AXALTA') ||
    /KALKULATION|REPARATURKALKULATION|OE[-\s]?NR|ERSATZTEIL|ARBEITSKOST/i.test(text)
  );
}
