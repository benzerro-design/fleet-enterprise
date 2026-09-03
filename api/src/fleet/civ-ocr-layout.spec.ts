import { detectCivScanRotation, rebuildCivOcrTextFromVision } from './civ-ocr-layout';

type Vertex = { x: number; y: number };
type Word = { boundingBox: { vertices: Vertex[] }; symbols: { text: string }[] };
type Annotation = {
  text: string;
  pages: { width: number; height: number; blocks: { paragraphs: { words: Word[] }[] }[] }[];
};

const PAGE_W = 700;
const PAGE_H = 1000;
const CHAR_W = 6;

/** Rândurile de pe p3, în ordinea tipărită pe CIV. */
const ROWS = [
  '16. Cod national de emisii: E6',
  'R. Culoare vehicul: Gri',
  'S.1. Numar locuri, inclusiv locul conducatorului auto: 9',
  'S.2. Numar locuri in picioare: 0',
  'T. Viteza maxima (km/h): 160',
  'U.2. Turatie motor: 2625',
  'W. Capacitate rezervor (l): 70',
];

function word(text: string, x0: number, y0: number, x1: number, y1: number): Word {
  return {
    boundingBox: {
      vertices: [
        { x: x0, y: y0 },
        { x: x1, y: y0 },
        { x: x1, y: y1 },
        { x: x0, y: y1 },
      ],
    },
    symbols: [...text].map((ch) => ({ text: ch })),
  };
}

/**
 * Eticheta tipărită vertical pe marginea CIV („Date constructive vehicul”) — are direcția
 * ei proprie, deci nu trebuie să decidă ea orientarea paginii.
 */
function sidebarWords(): Word[] {
  const out: Word[] = [];
  let y = 700;
  for (const token of ['Date', 'constructive', 'vehicul']) {
    const len = token.length * CHAR_W;
    const yTop = y - len;
    // v0→v1 în sus = text rotit 270° față de rând.
    out.push({
      boundingBox: {
        vertices: [
          { x: 8, y },
          { x: 8, y: yTop },
          { x: 30, y: yTop },
          { x: 30, y },
        ],
      },
      symbols: [...token].map((ch) => ({ text: ch })),
    });
    y = yTop - 10;
  }
  return out;
}

function buildUpright(rows: string[], withSidebar: boolean): Annotation {
  const words: Word[] = withSidebar ? sidebarWords() : [];
  rows.forEach((row, ri) => {
    const y0 = 80 + ri * 60;
    const y1 = y0 + 28;
    let x = 60;
    for (const token of row.split(' ')) {
      const w = Math.max(18, token.length * CHAR_W);
      words.push(word(token, x, y0, x + w, y1));
      x += w + 10;
    }
  });
  return {
    text: rows.join('\n'),
    pages: [{ width: PAGE_W, height: PAGE_H, blocks: [{ paragraphs: [{ words }] }] }],
  };
}

/** Simulează scanul rotit: mută vârfurile exact cum le-ar muta rotirea imaginii. */
function rotate(ann: Annotation, deg: 90 | 180 | 270): Annotation {
  const { width: W, height: H } = ann.pages[0]!;
  const map = (p: Vertex): Vertex => {
    if (deg === 90) return { x: H - p.y, y: p.x };
    if (deg === 180) return { x: W - p.x, y: H - p.y };
    return { x: p.y, y: W - p.x };
  };
  const swap = deg !== 180;
  return {
    text: ann.text,
    pages: [
      {
        width: swap ? H : W,
        height: swap ? W : H,
        blocks: [
          {
            paragraphs: [
              {
                words: ann.pages[0]!.blocks[0]!.paragraphs[0]!.words.map((w) => ({
                  ...w,
                  boundingBox: { vertices: w.boundingBox.vertices.map(map) },
                })),
              },
            ],
          },
        ],
      },
    ],
  };
}

describe('rebuildCivOcrTextFromVision — scan rotit', () => {
  it('pagina dreaptă păstrează eticheta și valoarea pe același rând', () => {
    const text = rebuildCivOcrTextFromVision(buildUpright(ROWS, false));
    expect(text).toContain('S.1. Numar locuri, inclusiv locul conducatorului auto: 9');
    expect(text).toContain('S.2. Numar locuri in picioare: 0');
  });

  it.each([90, 180, 270] as const)('rotit %i° dă exact același text ca pagina dreaptă', (deg) => {
    const upright = rebuildCivOcrTextFromVision(buildUpright(ROWS, false));
    const turned = rebuildCivOcrTextFromVision(rotate(buildUpright(ROWS, false), deg));
    expect(turned).toBe(upright);
  });

  it.each([0, 90, 180, 270] as const)(
    'eticheta verticală de pe margine nu strică orientarea (%i°)',
    (deg) => {
      const base = buildUpright(ROWS, true);
      const ann = deg === 0 ? base : rotate(base, deg);
      const text = rebuildCivOcrTextFromVision(ann);
      expect(text).toContain('S.1. Numar locuri, inclusiv locul conducatorului auto: 9');
      expect(text).toContain('W. Capacitate rezervor (l): 70');
    },
  );

  it('fără derotare, rândurile ar fi ieșit ca o coloană lipită', () => {
    // Simptomul de pe scanul Proace: codurile de rubrică ajung toate pe o linie.
    const turned = rebuildCivOcrTextFromVision(rotate(buildUpright(ROWS, false), 90));
    expect(turned).not.toMatch(/16\.\s+R\.\s+S\.1\s+S\.2/);
  });

  it.each([
    [90, 90],
    [180, 180],
    [270, 270],
  ])('detectCivScanRotation raportează %i°', (deg, expected) => {
    const ann = rotate(buildUpright(ROWS, false), deg as 90 | 180 | 270);
    expect(detectCivScanRotation(ann)).toBe(expected);
  });

  it('detectCivScanRotation raportează 0 pe scan drept', () => {
    expect(detectCivScanRotation(buildUpright(ROWS, true))).toBe(0);
  });
});
