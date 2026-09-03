/**
 * Reconstruiește text OCR CIV pe linii reale (etichetă : valoare pe aceeași linie),
 * din cuvintele Vision cu bounding box — nu din fullTextAnnotation.text (ordin de citire
 * greșit pe spread pag.2|pag.3).
 *
 * Pentru scan față/verso tip carte: împarte pe mijloc (stânga | dreapta) = două pagini.
 */

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '');
}

type Vertex = { x?: number; y?: number };

type VisionWord = {
  text: string;
  cx: number;
  cy: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  /** Direcția de citire a cuvântului, din ordinea vârfurilor Vision. */
  dir: RotationClass | null;
  /** Cât cântărește cuvântul la votul de orientare (nr. de simboluri). */
  weight: number;
};

/** Rotația scanului față de pagina dreaptă, în grade. */
export type RotationClass = 0 | 90 | 180 | 270;

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

/**
 * Vision returnează vârfurile în ordinea de citire a textului, deci v0→v1 e chiar
 * direcția rândului. Pe scan rotit, direcția dominantă nu mai e stânga→dreapta.
 */
function wordDirection(
  boundingBox: { vertices?: Vertex[]; normalizedVertices?: Vertex[] } | undefined,
): RotationClass | null {
  const v = boundingBox?.vertices?.length ? boundingBox.vertices : boundingBox?.normalizedVertices;
  if (!v || v.length < 2) return null;
  const dx = (v[1]!.x ?? 0) - (v[0]!.x ?? 0);
  const dy = (v[1]!.y ?? 0) - (v[0]!.y ?? 0);
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 0 : 180;
  return dy >= 0 ? 90 : 270;
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
        out.push({
          text,
          ...box,
          dir: wordDirection(word.boundingBox),
          weight: Math.max(1, word.symbols?.length ?? text.length),
        });
      }
    }
  }
  return out;
}

/**
 * Orientarea paginii = votul cuvintelor. Etichetele tipărite vertical pe marginea CIV
 * au direcția lor proprie, deci contează majoritatea, nu primul cuvânt.
 */
function dominantRotation(words: VisionWord[]): RotationClass {
  const tally: Record<RotationClass, number> = { 0: 0, 90: 0, 180: 0, 270: 0 };
  for (const w of words) {
    if (w.dir == null) continue;
    tally[w.dir] += w.weight;
  }
  let best: RotationClass = 0;
  for (const cls of [90, 180, 270] as RotationClass[]) {
    if (tally[cls] > tally[best]) best = cls;
  }
  return best;
}

/** Aduce cuvintele în cadrul paginii drepte, ca gruparea pe rânduri să vadă rânduri. */
function derotateWords(
  words: VisionWord[],
  rotation: RotationClass,
  width: number,
  height: number,
): { words: VisionWord[]; width: number; height: number } {
  if (rotation === 0 || !words.length) return { words, width, height };

  const map = (x: number, y: number): [number, number] => {
    if (rotation === 90) return [y, -x];
    if (rotation === 180) return [-x, -y];
    return [-y, x];
  };

  const turned = words.map((w) => {
    const [ax, ay] = map(w.minX, w.minY);
    const [bx, by] = map(w.maxX, w.maxY);
    return {
      ...w,
      minX: Math.min(ax, bx),
      maxX: Math.max(ax, bx),
      minY: Math.min(ay, by),
      maxY: Math.max(ay, by),
    };
  });

  const offX = Math.min(...turned.map((w) => w.minX));
  const offY = Math.min(...turned.map((w) => w.minY));
  const shifted = turned.map((w) => {
    const minX = w.minX - offX;
    const maxX = w.maxX - offX;
    const minY = w.minY - offY;
    const maxY = w.maxY - offY;
    return { ...w, minX, maxX, minY, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
  });

  const swap = rotation === 90 || rotation === 270;
  return { words: shifted, width: swap ? height : width, height: swap ? width : height };
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
 * Cât de rotit e scanul față de pagina dreaptă (0 = drept). Pentru avertisment la upload.
 */
export function detectCivScanRotation(
  fullText: VisionFullText | null | undefined,
): RotationClass {
  for (const page of fullText?.pages ?? []) {
    const words = collectWords(page);
    if (words.length) return dominantRotation(words);
  }
  return 0;
}

/**
 * Reconstruiește text pe linii; pe spread lat împarte stânga/dreapta (două pagini CIV).
 * Pe CIV 1993 (Secțiunea A|B|C|omologare) împarte în 4 coloane și marchează COL A…D.
 */
export function rebuildCivOcrTextFromVision(fullText: VisionFullText | null | undefined): string | null {
  if (!fullText?.pages?.length) {
    return fullText?.text?.trim() || null;
  }

  const rawHint = stripDiacritics(fullText.text ?? '').toLowerCase();
  const looks1993 =
    !/\bd\.?\s*1\b/.test(rawHint) &&
    ((/categor/.test(rawHint) && /carose/.test(rawHint)) ||
      (/marca/.test(rawHint) && /cilindree/.test(rawHint)) ||
      /sectiunea\s*a/.test(rawHint) ||
      /tipul/.test(rawHint) && /fiesta|kvja|proprie/.test(rawHint) ||
      /tipul\s*\/?\s*varianta/.test(rawHint));

  const pageTexts: string[] = [];
  for (const page of fullText.pages) {
    const collected = collectWords(page);
    if (!collected.length) continue;

    // Scan rotit: rândurile CIV ajung coloane și textul iese amestecat. Îndreptăm întâi.
    const rotation = dominantRotation(collected);
    const derotated = derotateWords(collected, rotation, page.width ?? 0, page.height ?? 0);
    const words = derotated.words;
    const width = derotated.width;
    const height = derotated.height;

    const isSpread = width > 0 && height > 0 && width / height >= 1.25;
    if (looks1993) {
      // CIV 1993: stânga = grilă tehnică (~0–50%), dreapta = omologare (~52%+).
      // mid 0.48 exclude coloana C; 0.58 o includea și amesteca liniile (strică Remorcabil/L/cm³).
      if (isSpread || width > 0) {
        const mid = width * 0.48;
        const left = words.filter((w) => w.cx < mid);
        const right = words.filter((w) => w.cx >= mid);
        const leftText = mergeOrphanValueAboveEmptyLabel(linesToText(clusterLines(left)));
        const rightText = mergeOrphanValueAboveEmptyLabel(linesToText(clusterLines(right)));
        const parts = [leftText, rightText].filter((t) => t.trim());
        if (parts.length) {
          pageTexts.push(parts.join('\n\n'));
          continue;
        }
      }
      const t = mergeOrphanValueAboveEmptyLabel(linesToText(clusterLines(words)));
      if (t.trim()) pageTexts.push(t.trim());
      continue;
    }
    if (isSpread) {
      const mid = width / 2;
      const left = words.filter((w) => w.cx < mid);
      const right = words.filter((w) => w.cx >= mid);
      const leftText = mergeOrphanValueAboveEmptyLabel(linesToText(clusterLines(left)));
      const rightText = mergeOrphanValueAboveEmptyLabel(linesToText(clusterLines(right)));
      const parts = [leftText, rightText].filter(Boolean);
      if (parts.length) pageTexts.push(parts.join('\n\n'));
    } else {
      const t = mergeOrphanValueAboveEmptyLabel(linesToText(clusterLines(words)));
      if (t) pageTexts.push(t);
    }
  }

  const rebuilt = pageTexts.join('\n\n').trim();
  if (rebuilt.length >= 40) return rebuilt;
  return fullText.text?.trim() || rebuilt || null;
}
