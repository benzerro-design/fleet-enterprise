import { readFileSync } from 'fs';
import { rebuildCivOcrTextFromVision } from '../src/fleet/civ-ocr-layout';
import { mapCivExtractTextToPreview } from '../src/fleet/civ-extract';

const raw = JSON.parse(readFileSync('./scripts/_civ_preview/fiesta-civ.p1-2.ann.json', 'utf8'));
const page = (Array.isArray(raw) ? raw[0] : raw).pages[0];
const W = page.width as number;
const H = page.height as number;
const words: { text: string; cx: number; cy: number }[] = [];
for (const b of page.blocks || []) {
  for (const p of b.paragraphs || []) {
    for (const w of p.words || []) {
      const text = (w.symbols || []).map((s: { text?: string }) => s.text || '').join('');
      const verts = w.boundingBox?.vertices?.length
        ? w.boundingBox.vertices
        : (w.boundingBox?.normalizedVertices || []).map((v: { x?: number; y?: number }) => ({
            x: (v.x || 0) * W,
            y: (v.y || 0) * H,
          }));
      const xs = verts.map((v: { x?: number }) => v.x || 0);
      const ys = verts.map((v: { y?: number }) => v.y || 0);
      words.push({
        text,
        cx: (Math.min(...xs) + Math.max(...xs)) / 2,
        cy: (Math.min(...ys) + Math.max(...ys)) / 2,
      });
    }
  }
}

for (const mid of [0.45, 0.48, 0.5, 0.55, 0.58]) {
  const left = words.filter((w) => w.cx < W * mid);
  const t = left.map((w) => w.text).join(' ');
  console.log({
    mid,
    hasOmo: /omologare\s+de\s+tip/i.test(t),
    hasRem: /Remorcabil/i.test(t),
    has750: /\b750\b/.test(t),
    has1722: /\b1722\b/.test(t),
    has1399: /1399/.test(t),
    hasFala: /Fala/i.test(t),
  });
}

const rebuilt = rebuildCivOcrTextFromVision({ text: (Array.isArray(raw) ? raw[0] : raw).text, pages: [page] }) || '';
const p = mapCivExtractTextToPreview(rebuilt, 'unknown', 'file');
console.log('current rebuild extract', {
  mtma: p.civProfile.maxTechnicalMassKg,
  braked: p.civProfile.maxBrakedTrailerMassKg,
  unbraked: p.civProfile.maxUnbrakedTrailerMassKg,
  L: p.civProfile.lengthMm,
  l: p.civProfile.widthMm,
  cm3: p.civProfile.engineCapacityCm3,
  tyresF: p.civProfile.tyresFront,
  tyresR: p.civProfile.tyresRear,
});
const omo = rebuilt.search(/omologare\s+de\s+tip/i);
const rem = rebuilt.search(/Remorcabil/i);
console.log({ omoIdx: omo, remIdx: rem, omoBeforeRem: omo >= 0 && rem >= 0 && omo < rem });
if (omo >= 0) console.log('omo context', JSON.stringify(rebuilt.slice(Math.max(0, omo - 40), omo + 40)));
