/**
 * Calitate text CIV (OCR / scrape PDF) — respinge mojibake din stream-uri PDF.
 */

export function isPlausibleVin(raw: string): boolean {
  const v = raw.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(v)) return false;
  // VIN-urile RO uzuale au litere + cifre; respinge șiruri „aleatoare” fără literă.
  if (!/[A-Z]/.test(v) || !/[0-9]/.test(v)) return false;
  return true;
}

/** Text fără caractere de control / binare (mojibake PDF). */
export function isPlausibleCivValue(raw: string, opts?: { maxLen?: number }): boolean {
  const v = raw.trim();
  if (!v) return false;
  const maxLen = opts?.maxLen ?? 180;
  if (v.length > maxLen) return false;
  let ok = 0;
  let bad = 0;
  for (const ch of v) {
    const c = ch.charCodeAt(0);
    if (c === 9 || c === 10 || c === 13) continue;
    if (c >= 32 && c < 127) {
      ok++;
      continue;
    }
    if (/[ăâîșțĂÂÎȘȚ°€–—]/.test(ch)) {
      ok++;
      continue;
    }
    bad++;
  }
  const total = ok + bad;
  if (total === 0) return false;
  return bad / total <= 0.08;
}

/**
 * Textul arată a CIV citibil (nu stream PDF). Folosit înainte de mapare / accept scrape.
 */
export function isReadableCivOcrText(text: string): boolean {
  const sample = (text || '').slice(0, 12_000).trim();
  if (sample.length < 30) return false;
  if (!isPlausibleCivValue(sample.slice(0, 400), { maxLen: 500 })) {
    // eșantion scurt poate e ok; verifică rata pe tot sample-ul
  }
  let ok = 0;
  let bad = 0;
  for (const ch of sample) {
    const c = ch.charCodeAt(0);
    if (c === 9 || c === 10 || c === 13 || c === 32) continue;
    if ((c >= 33 && c < 127) || /[ăâîșțĂÂÎȘȚ°€]/.test(ch)) ok++;
    else bad++;
  }
  const total = ok + bad;
  if (total < 20) return false;
  if (bad / total > 0.12) return false;

  const lower = sample.toLowerCase();
  const markers = [
    /\bd\.1\b/,
    /\bp\.3\b/,
    /\bmarca\b/,
    /\bcilindree\b/,
    /num[aă]r(?:ul)?\s+de\s+identificare/,
    /carte\s+de\s+identitate/,
    /\bautoturism\b/,
    /\bford\b|\bdacia\b|\bvolkswagen\b|\brenaul/,
    /\bwf0[a-z0-9]{14}\b/i,
    /\bvin\b/,
  ];
  return markers.some((re) => re.test(lower) || re.test(sample));
}
