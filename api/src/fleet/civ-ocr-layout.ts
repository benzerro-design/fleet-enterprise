/**
 * Reconstruiește text OCR CIV pe linii reale (etichetă : valoare pe aceeași linie),
 * din cuvintele Vision cu bounding box — nu din fullTextAnnotation.text (ordin de citire
 * greșit pe spread pag.2|pag.3).
 *
 * Pentru scan față/verso tip carte: împarte pe mijloc (stânga | dreapta) = două pagini.
 */

type Vertex = { x?: number; y?: number };

type VisionWord = {
  text: string;
  cx: number;
  cy: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

type VisionFullText = {
  text?: string;
  pages?: Array<{
    width?: number;
    height?: number;
    blocks?: Array<{
      paragraphs?: Array<{
        words?: Array<{
          boundingBox?: {
            vertices?: Vertex[];
            /** PDF / files:annotate — coordonate 0–1; lipsesc adesea vertices pixel. */
            normalizedVertices?: Vertex[];
          };
          symbols?: Array<{ text?: string; property?: { detectedBreak?: { type?: string } } }>;
        }>;
      }>;
    }>;
  }>;
};

function wordText(word: {
  symbols?: Array<{ text?: string; property?: { detectedBreak?: { type?: string } } }>;
}): string {
  let s = '';
  for (const sym of word.symbols ?? []) {
    s += sym.text ?? '';
    const br = sym.property?.detectedBreak?.type;
    if (br === 'SPACE' || br === 'SURE_SPACE') s += ' ';
    if (br === 'EOL_SURE_SPACE' || br === 'LINE_BREAK') s += ' ';
  }
  return s.replace(/\s+/g, ' ').trim();
}

function boxOf(vertices: Vertex[] | undefined): {
  cx: number;
  cy: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} | null {
  if (!vertices?.length) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const v of vertices) {
    const x = v.x ?? 0;
    const y = v.y ?? 0;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  if (!Number.isFinite(minX)) return null;
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    minX,
    maxX,
    minY,
    maxY,
  };
}

/** Preferă vertices pixel; pe PDF Vision trimite doar normalizedVertices (0–1). */
function boxFromBounding(
  boundingBox:
    | {
        vertices?: Vertex[];
        normalizedVertices?: Vertex[];
      }
    | undefined,
  pageWidth: number,
  pageHeight: number,
): ReturnType<typeof boxOf> {
  const pixel = boxOf(boundingBox?.vertices);
  // vertices uneori există dar sunt tot normalizate (0–1) pe PDF.
  if (pixel && (pixel.maxX > 1.5 || pixel.maxY > 1.5 || pageWidth <= 1)) {
    return pixel;
  }
  const norm = boundingBox?.normalizedVertices;
  if (norm?.length && pageWidth > 1 && pageHeight > 1) {
    const scaled = norm.map((v) => ({
      x: (v.x ?? 0) * pageWidth,
      y: (v.y ?? 0) * pageHeight,
    }));
    return boxOf(scaled);
  }
  // vertices deja 0–1 fără normalizedVertices explicit
  if (pixel && pageWidth > 1 && pageHeight > 1 && pixel.maxX <= 1.5 && pixel.maxY <= 1.5) {
    return {
      cx: pixel.cx * pageWidth,
      cy: pixel.cy * pageHeight,
      minX: pixel.minX * pageWidth,
      maxX: pixel.maxX * pageWidth,
      minY: pixel.minY * pageHeight,
      maxY: pixel.maxY * pageHeight,
    };
  }
  return pixel;
}

function collectWords(page: NonNullable<VisionFullText['pages']>[number]): VisionWord[] {
  const out: VisionWord[] = [];
  const width = page.width ?? 0;
  const height = page.height ?? 0;
  for (const block of page.blocks ?? []) {
    for (const para of block.paragraphs ?? []) {
      for (const word of para.words ?? []) {
        const text = wordText(word);
        if (!text) continue;
        const box = boxFromBounding(word.boundingBox, width, height);
        if (!box) continue;
        out.push({ text, ...box });
      }
    }
  }
  return out;
}

function clusterLines(words: VisionWord[]): VisionWord[][] {
  if (!words.length) return [];
  const sorted = [...words].sort((a, b) => a.cy - b.cy || a.cx - b.cx);
  const heights = sorted.map((w) => Math.max(4, w.maxY - w.minY)).sort((a, b) => a - b);
  const medianH = heights[Math.floor(heights.length / 2)] ?? 12;
  const tol = Math.max(6, medianH * 0.55);

  const lines: VisionWord[][] = [];
  let current: VisionWord[] = [];
  let currentY = sorted[0]!.cy;

  for (const w of sorted) {
    if (!current.length || Math.abs(w.cy - currentY) <= tol) {
      current.push(w);
      currentY = current.reduce((s, x) => s + x.cy, 0) / current.length;
    } else {
      lines.push(current);
      current = [w];
      currentY = w.cy;
    }
  }
  if (current.length) lines.push(current);

  return lines.map((line) => [...line].sort((a, b) => a.cx - b.cx));
}

function linesToText(lines: VisionWord[][]): string {
  return lines
    .map((line) =>
      line
        .map((w) => w.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .replace(/\s*:\s*/g, ': ')
        .trim(),
    )
    .filter(Boolean)
    .join('\n');
}

/**
 * Pe CIV, uneori Vision pune valoarea pe linia de deasupra etichetei goale
 * („DACIA” apoi „D.1. Marca:”) din cauza jitter pe Y — reatașăm.
 */
export function mergeOrphanValueAboveEmptyLabel(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i]!.trim();
    const next = (lines[i + 1] ?? '').trim();
    const emptyLabel = /^(.{2,90}?):\s*$/.exec(next);
    const vehiculName = /^VEHICUL\s+([A-Z][A-Z0-9][A-Z0-9\- ]{0,28})$/i.exec(cur);
    const curIsOrphanValue =
      !!cur &&
      !cur.includes(':') &&
      cur.length <= 48 &&
      !/^(DATE|IDENTIFICARE|CONSTRUCTIVE|CONTINUARE|MEN[TȚ]IUNI)\b/i.test(cur);
    if (emptyLabel && (curIsOrphanValue || vehiculName)) {
      const label = emptyLabel[1]!.trim();
      const value = vehiculName ? vehiculName[1]!.trim() : cur;
      out.push(`${label}: ${value}`);
      i += 1;
      continue;
    }
    out.push(lines[i]!);
  }
  return out.join('\n');
}

/**
 * Reconstruiește text pe linii; pe spread lat împarte stânga/dreapta (două pagini CIV).
 * Pe CIV 1993 (Secțiunea A|B|C|omologare) împarte în 4 coloane și marchează COL A…D.
 */
export function rebuildCivOcrTextFromVision(fullText: VisionFullText | null | undefined): string | null {
  if (!fullText?.pages?.length) {
    return fullText?.text?.trim() || null;
  }

  const rawHint = (fullText.text ?? '').toLowerCase();
  const looks1993 =
    !/\bd\.?\s*1\b/.test(rawHint) &&
    ((/\bcategoria\b/.test(rawHint) && /\bcaroserie\b/.test(rawHint)) ||
      (/\bmarca\b/.test(rawHint) && /\bcilindree\b/.test(rawHint)) ||
      /\bsectiunea\s*a\b/.test(rawHint) ||
      /\btipul\s*\/?\s*varianta\b/.test(rawHint));

  const pageTexts: string[] = [];
  for (const page of fullText.pages) {
    const width = page.width ?? 0;
    const height = page.height ?? 0;
    const words = collectWords(page);
    if (!words.length) continue;

    const isSpread = width > 0 && height > 0 && width / height >= 1.25;
    if (isSpread && looks1993 && width / height >= 1.35) {
      // Verso 1993: A | B | C | omologare (sau față: p4 | p1 pe 2 coloane — tot OK, A≈p4).
      const colW = width / 4;
      const cols = [0, 1, 2, 3].map((i) =>
        words.filter((w) => w.cx >= i * colW && w.cx < (i + 1) * colW),
      );
      const labels = ['A', 'B', 'C', 'D'];
      const parts: string[] = [];
      for (let i = 0; i < 4; i++) {
        const t = mergeOrphanValueAboveEmptyLabel(linesToText(clusterLines(cols[i]!)));
        if (t.trim()) parts.push(`=== COL ${labels[i]} ===\n${t.trim()}`);
      }
      if (parts.length) pageTexts.push(parts.join('\n\n'));
    } else if (isSpread) {
      const mid = width / 2;
      const left = words.filter((w) => w.cx < mid);
      const right = words.filter((w) => w.cx >= mid);
      // Pe pagina 2 singură (scan doar p2): A|B — jumătatea stângă e Secțiunea A.
      if (looks1993) {
        const leftMid = mid / 2;
        const sectionA = left.filter((w) => w.cx < leftMid);
        const sectionB = left.filter((w) => w.cx >= leftMid);
        const aText = mergeOrphanValueAboveEmptyLabel(linesToText(clusterLines(sectionA)));
        const bText = mergeOrphanValueAboveEmptyLabel(linesToText(clusterLines(sectionB)));
        const rightText = mergeOrphanValueAboveEmptyLabel(linesToText(clusterLines(right)));
        const parts = [
          aText.trim() ? `=== COL A ===\n${aText.trim()}` : '',
          bText.trim() ? `=== COL B ===\n${bText.trim()}` : '',
          rightText.trim() ? `=== COL C ===\n${rightText.trim()}` : '',
        ].filter(Boolean);
        if (parts.length) {
          pageTexts.push(parts.join('\n\n'));
          continue;
        }
      }
      const leftText = mergeOrphanValueAboveEmptyLabel(linesToText(clusterLines(left)));
      const rightText = mergeOrphanValueAboveEmptyLabel(linesToText(clusterLines(right)));
      const parts = [leftText, rightText].filter(Boolean);
      if (parts.length) pageTexts.push(parts.join('\n\n'));
    } else if (looks1993 && width > 0) {
      // O singură pagină lată (doar p2): împarte A|B.
      const mid = width / 2;
      const a = words.filter((w) => w.cx < mid);
      const b = words.filter((w) => w.cx >= mid);
      const aText = mergeOrphanValueAboveEmptyLabel(linesToText(clusterLines(a)));
      const bText = mergeOrphanValueAboveEmptyLabel(linesToText(clusterLines(b)));
      const parts = [
        aText.trim() ? `=== COL A ===\n${aText.trim()}` : '',
        bText.trim() ? `=== COL B ===\n${bText.trim()}` : '',
      ].filter(Boolean);
      if (parts.length) pageTexts.push(parts.join('\n\n'));
      else {
        const t = mergeOrphanValueAboveEmptyLabel(linesToText(clusterLines(words)));
        if (t) pageTexts.push(t);
      }
    } else {
      const t = mergeOrphanValueAboveEmptyLabel(linesToText(clusterLines(words)));
      if (t) pageTexts.push(t);
    }
  }

  const rebuilt = pageTexts.join('\n\n').trim();
  if (rebuilt.length >= 40) return rebuilt;
  return fullText.text?.trim() || rebuilt || null;
}
