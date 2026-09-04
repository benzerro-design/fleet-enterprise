import { readFileSync } from 'fs';
import { rebuildCivOcrTextFromVision } from '../src/fleet/civ-ocr-layout';
import { extractCiv1993SectionA, mapCiv1993SectionAToProfile } from '../src/fleet/civ-1993-extract';
import { mapCivExtractTextToPreview } from '../src/fleet/civ-extract';

const raw = JSON.parse(readFileSync('./scripts/_civ_preview/fiesta-civ.p1-2.ann.json', 'utf8'));
const pagesDoc = Array.isArray(raw) ? raw[0] : raw;
const rebuilt = rebuildCivOcrTextFromVision({ text: pagesDoc.text, pages: pagesDoc.pages }) || '';
const idx = rebuilt.toLowerCase().indexOf('proprie');
console.log('--- around proprie ---');
console.log(rebuilt.slice(Math.max(0, idx - 20), idx + 250));
const dim = rebuilt.toLowerCase().indexOf('dimensi');
console.log('--- around dimensi ---');
console.log(rebuilt.slice(Math.max(0, dim - 10), dim + 120));
const cil = rebuilt.toLowerCase().indexOf('cilindree');
console.log('--- around cilindree ---');
console.log(rebuilt.slice(Math.max(0, cil - 10), cil + 80));

const sec = extractCiv1993SectionA(rebuilt);
const m = mapCiv1993SectionAToProfile(sec);
console.log(
  'section keys',
  Object.fromEntries(
    [
      'curbMassKg',
      'maxTechnicalMassKg',
      'maxBrakedTrailerMassKg',
      'lengthMm',
      'widthMm',
      'engineCapacityCm3',
      'enginePowerKw',
    ].map((k) => [k, m.profile[k]]),
  ),
);

const p = mapCivExtractTextToPreview(rebuilt, 'unknown', 'file');
console.log('extract keys', {
  mtma: p.civProfile.maxTechnicalMassKg,
  L: p.civProfile.lengthMm,
  l: p.civProfile.widthMm,
  cm3: p.civProfile.engineCapacityCm3,
  power: p.civProfile.enginePowerKw,
});

// Test patterns manually
const text = sec.normalize('NFD').replace(/\p{M}/gu, '');
for (const [name, re] of [
  ['p1', /\bTotala?\s*max\.?\s*autoriz\w*\s*[:\s]*(\d{3,5})\b/i],
  ['p2', /\bTotala?\s*max\.?\s*autoriz\w*[\s\S]{0,40}?(\d{3,5})\b/i],
  ['p3', /\bTotala?\s*max\s*[:\s]*(\d{3,5})\b/i],
  ['p4', /\bTotala?\s*max\s+(\d{3,5})\b/i],
  ['p5', /\bProprie\s+\d{3,5}\s+Totala?\s*max\s+(\d{3,5})\b/i],
  ['p6', /\bTotala?\s*max\b[\s\S]{0,60}?(\d{3,5})\b/i],
] as const) {
  const hit = re.exec(text);
  console.log(name, hit?.[1] ?? null, hit ? JSON.stringify(hit[0].slice(0, 80)) : null);
}
