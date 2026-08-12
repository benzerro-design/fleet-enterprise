/**
 * CIV modern = carte cu 4 pagini (îndoită pe verticală la mijloc).
 *
 * Scan față: Pagina 4 (stânga tipic) + Pagina 1 (dreapta) — proprietari, barcode/Serie CIV, Mențiuni + glossar EN.
 * Scan verso: Pagina 2 (stânga) + Pagina 3 (dreapta) — date identificare + constructive.
 *
 * Mapare: Serie CIV ← p1; tehnice ← p2+p3; Mențiuni ← p4 (fără glossar englez).
 */

export type CivBookPages = {
  page1: string;
  page2: string;
  page3: string;
  page4: string;
  /** Text față (pag. 1+4 brute). */
  frontRaw: string;
  /** Text verso (pag. 2+3 brute). */
  versoRaw: string;
  /** Doar p2+p3 — sursă unică pentru rubrici tehnice. */
  techText: string;
  /** Pag. 1 pentru Serie CIV / barcode. */
  seriesText: string;
  /** Mențiuni fără glossar englez. */
  mentionsText: string;
};

function splitFrontVerso(combined: string): { front: string; verso: string } {
  const versoMark = /===\s*CIV\s+VERSO\s*===/i.exec(combined);
  const fataMark = /===\s*CIV\s+FA[TȚ][AĂ]\s*===/i.exec(combined);

  if (fataMark && versoMark && fataMark.index != null && versoMark.index != null) {
    if (fataMark.index < versoMark.index) {
      const front = combined.slice(fataMark.index + fataMark[0].length, versoMark.index).trim();
      const verso = combined.slice(versoMark.index + versoMark[0].length).trim();
      return { front, verso };
    }
    const verso = combined.slice(versoMark.index + versoMark[0].length, fataMark.index).trim();
    const front = combined.slice(fataMark.index + fataMark[0].length).trim();
    return { front, verso };
  }
  if (versoMark && versoMark.index != null) {
    return {
      front: combined.slice(0, versoMark.index).replace(/===\s*CIV\s+FA[TȚ][AĂ]\s*===/gi, '').trim(),
      verso: combined.slice(versoMark.index + versoMark[0].length).trim(),
    };
  }
  if (fataMark && fataMark.index != null) {
    return {
      front: combined.slice(fataMark.index + fataMark[0].length).trim(),
      verso: '',
    };
  }
  // Fără markere: dacă avem D.1 / P.1 e probabil tot verso (sau PDF unic).
  return { front: combined, verso: '' };
}

/** Taie glossarul englez de pe pagina 4 (definiții tip „A. Registration number; …”). */
export function stripEnglishCivGlossary(text: string): string {
  if (!text.trim()) return '';
  const markers = [
    /A\.\s*Registration\s+number/i,
    /C\.2\.\s*Owner\s+of\s+the\s+vehicle/i,
    /Vehicle\s+Identity\s+Card/i,
    /Number\s+of\s+seats\s+including\s+driver'?s?\s+seat/i,
    /Make\s*;\s*D\.?2/i,
    /D\.1\.\s*Make/i,
  ];
  let cut = text.length;
  for (const re of markers) {
    const m = re.exec(text);
    if (m && m.index != null && m.index < cut && m.index > 20) cut = m.index;
  }
  // Linii tip glossar: „D.1. Make; D.2. Type…”
  const lines = text.slice(0, cut).split(/\r?\n/);
  const kept: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (/^[A-Z]\.?\d{0,2}\.?\s+[A-Z][a-z].{8,};/.test(t)) continue;
    if (/\bdriver'?s?\s+seat\b/i.test(t) && !/\bNum[aă]r\s+locuri\b/i.test(t)) continue;
    if (/^(Make|Type|Variant|Version|Colour|Mass|Power|Engine)\b/i.test(t) && t.includes(';')) {
      continue;
    }
    kept.push(line);
  }
  return kept.join('\n').trim();
}

function extractMentionsBody(page4: string): string {
  const cleaned = stripEnglishCivGlossary(page4);
  const m = /Men[tț]iuni\s*:?\s*([\s\S]*)/i.exec(cleaned);
  if (!m) return cleaned.trim();
  const body = (m[1] ?? '').trim();
  if (!body || body === '-' || /^-+$/.test(body)) return '';
  // Taie QR / residual englez scurt.
  return body
    .split(/\r?\n/)
    .filter((l) => !/Registration\s+number|Owner\s+of\s+the/i.test(l))
    .join('\n')
    .trim();
}

/**
 * Pe scan față: p4 (Mențiuni + glossar) vs p1 (proprietari + barcode).
 */
function splitFrontIntoPage1And4(front: string): { page1: string; page4: string } {
  if (!front.trim()) return { page1: '', page4: '' };

  const mentiuni = /Men[tț]iuni\s*:/i.exec(front);
  const proprietar = /\b(?:C\.?2\.?\s*)?Proprietar\b/i.exec(front);
  const inmatriculare = /\bNum[aă]r\s+de\s+[iî]nmatriculare\b/i.exec(front);
  const glossary = /A\.\s*Registration\s+number/i.exec(front);

  // Dacă Mențiuni e înaintea blocului proprietar → OCR a citit p4 apoi p1.
  if (mentiuni && proprietar && mentiuni.index! < proprietar.index!) {
    const page4 = front.slice(0, proprietar.index!).trim();
    const page1 = front.slice(proprietar.index!).trim();
    return { page1, page4 };
  }

  // Proprietar / înmatriculare înainte → p1 apoi p4.
  if (mentiuni && (proprietar || inmatriculare)) {
    const p1End = mentiuni.index!;
    const page1 = front.slice(0, p1End).trim();
    const page4 = front.slice(p1End).trim();
    return { page1, page4 };
  }

  if (mentiuni && glossary) {
    return {
      page1: front.slice(0, mentiuni.index!).trim(),
      page4: front.slice(mentiuni.index!).trim(),
    };
  }

  if (mentiuni) {
    return {
      page1: front.slice(0, mentiuni.index!).trim() || front,
      page4: front.slice(mentiuni.index!).trim(),
    };
  }

  // Doar glossar EN fără Mențiuni explicit.
  if (glossary && glossary.index! > 40) {
    return {
      page1: front.slice(0, glossary.index!).trim(),
      page4: front.slice(glossary.index!).trim(),
    };
  }

  // Heuristică: barcode / serie pe p1 — tot frontul e p1 dacă nu avem indicii p4.
  return { page1: front, page4: '' };
}

/**
 * Pe scan verso: p2 (D.1…dimensiuni) vs p3 (cod motor…dată eliberare).
 */
function splitVersoIntoPage2And3(verso: string): { page2: string; page3: string } {
  if (!verso.trim()) return { page2: '', page3: '' };

  const page3Starts = [
    /\b14\.\s*Cod\s+motor\b/i,
    /\bCod\s+motor\s*:/i,
    /\bP\.?\s*1\.?\s*Capacitate\s+cilindric/i,
    /\bDATE\s+CONSTRUCTIVE\s+VEHICUL\s*\(continuare\)/i,
    /\bDATE\s+CONSTRUCTIVE\s+VEHICUL\s+continuare/i,
  ];

  let splitAt: number | null = null;
  for (const re of page3Starts) {
    const m = re.exec(verso);
    if (m && m.index != null) {
      // Preferă split după ce am văzut deja D.1 / Marcă (altfel e fals pozitiv).
      const before = verso.slice(0, m.index);
      if (/\bD\.?\s*1\b/i.test(before) || /\bMarca\s*:/i.test(before) || /\bF\.?\s*1\b/i.test(before)) {
        splitAt = m.index;
        break;
      }
      if (splitAt == null) splitAt = m.index;
    }
  }

  if (splitAt != null && splitAt > 80) {
    return {
      page2: verso.slice(0, splitAt).trim(),
      page3: verso.slice(splitAt).trim(),
    };
  }

  // Fără split clar: tot verso = tehnic (p2+p3 amestecate OK pentru label:).
  return { page2: verso, page3: '' };
}

/**
 * Descompune textul OCR (față+verso concatenate) în paginile cărții CIV.
 */
export function splitCivBookPages(combined: string): CivBookPages {
  const { front, verso } = splitFrontVerso(combined);

  let page1 = '';
  let page2 = '';
  let page3 = '';
  let page4 = '';
  let frontRaw = front;
  let versoRaw = verso;

  if (verso && (/\bD\.?\s*1\b/i.test(verso) || /\bMarca\s*:/i.test(verso))) {
    const f = splitFrontIntoPage1And4(front);
    page1 = f.page1;
    page4 = f.page4;
    const v = splitVersoIntoPage2And3(verso);
    page2 = v.page2;
    page3 = v.page3;
  } else if (/\bD\.?\s*1\b/i.test(front) || /\bMarca\s*:/i.test(front)) {
    // Un singur blob (PDF) cu tot — încearcă să separe pe landmark-uri globale.
    frontRaw = front;
    versoRaw = '';
    const f = splitFrontIntoPage1And4(front);
    // Dacă frontul are și D.1, partea tehnică e amestecată.
    if (/\bD\.?\s*1\b/i.test(f.page1) || /\bMarca\s*:/i.test(f.page1)) {
      const techBlob = f.page1;
      const ownerCut = /\b(?:C\.?2\.?\s*)?Proprietar\b/i.exec(techBlob);
      const d1 = /\bD\.?\s*1\.?\s*Marca\s*:/i.exec(techBlob) || /\bMarca\s*:/i.exec(techBlob);
      if (ownerCut && d1 && ownerCut.index! < d1.index!) {
        page1 = techBlob.slice(0, d1.index!).trim();
        const rest = techBlob.slice(d1.index!).trim();
        const v = splitVersoIntoPage2And3(rest);
        page2 = v.page2;
        page3 = v.page3;
      } else {
        const v = splitVersoIntoPage2And3(techBlob);
        page2 = v.page2;
        page3 = v.page3;
        page1 = '';
      }
      page4 = f.page4;
    } else {
      page1 = f.page1;
      page4 = f.page4;
      // Tehnic lipsă din acest blob.
    }
  } else {
    const f = splitFrontIntoPage1And4(front || combined);
    page1 = f.page1;
    page4 = f.page4;
    if (verso) {
      const v = splitVersoIntoPage2And3(verso);
      page2 = v.page2;
      page3 = v.page3;
    }
  }

  const techText = [page2, page3].filter(Boolean).join('\n\n').trim();
  const seriesText = page1.trim() || frontRaw;
  const mentionsText = extractMentionsBody(page4);

  return {
    page1,
    page2,
    page3,
    page4,
    frontRaw,
    versoRaw,
    techText: techText || stripEnglishCivGlossary(
      // Ultim fallback: tot fără glossar, dar preferabil fără p1 proprietari.
      [versoRaw, frontRaw].filter(Boolean).join('\n\n'),
    ),
    seriesText,
    mentionsText,
  };
}
