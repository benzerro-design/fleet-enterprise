/**
 * Diagnostic: poziții X pentru valorile CIV 1993 Fiesta.
 */
import { readFileSync } from 'fs';

type V = { x?: number; y?: number };
type W = { text: string; cx: number; cy: number };

function wordsFromPage(page: {
  width?: number;
  height?: number;
  blocks?: Array<{
    paragraphs?: Array<{
      words?: Array<{
        boundingBox?: { vertices?: V[]; normalizedVertices?: V[] };
        symbols?: Array<{ text?: string }>;
      }>;
    }>;
  }>;
}): { width: number; height: number; words: W[] } {
  const width = page.width ?? 0;
  const height = page.height ?? 0;
  const words: W[] = [];
  for (const b of page.blocks ?? []) {
    for (const p of b.paragraphs ?? []) {
      for (const w of p.words ?? []) {
        const text = (w.symbols ?? []).map((s) => s.text ?? '').join('');
        if (!text.trim()) continue;
        const verts = w.boundingBox?.vertices?.length
          ? w.boundingBox.vertices
          : (w.boundingBox?.normalizedVertices ?? []).map((v) => ({
              x: (v.x ?? 0) * width,
              y: (v.y ?? 0) * height,
            }));
        const xs = verts.map((v) => v.x ?? 0);
        const ys = verts.map((v) => v.y ?? 0);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        words.push({ text, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 });
      }
    }
  }
  return { width, height, words };
}

const raw = JSON.parse(readFileSync('./scripts/_civ_preview/fiesta-civ.p1-2.ann.json', 'utf8'));
const doc = Array.isArray(raw) ? raw[0] : raw;
const { width, height, words } = wordsFromPage(doc.pages[0]);
console.log({ width, height, mid50: width * 0.5, mid58: width * 0.58, mid70: width * 0.7 });

const interesting = [
  '1195',
  '1540',
  '750',
  '550',
  '3958',
  '1722',
  '1481',
  '1399',
  '51.5',
  'Totala',
  'max',
  'Remorcabil',
  'Remorcabila',
  'Cilindree',
  'Cilindree1399',
  'Dimensiunile',
  'Fala',
  '195/50',
  '175/65',
  'spate',
  'Myloc',
  'Proprie',
];

for (const w of words) {
  if (interesting.some((t) => w.text.includes(t) || t.includes(w.text))) {
    const pct = ((w.cx / width) * 100).toFixed(1);
    console.log(`${w.text.padEnd(20)} cx=${w.cx.toFixed(0).padStart(4)} (${pct}%) cy=${w.cy.toFixed(0)}`);
  }
}
