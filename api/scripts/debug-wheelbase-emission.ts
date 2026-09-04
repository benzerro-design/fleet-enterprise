import { readFileSync } from 'fs';
import { rebuildCivOcrTextFromVision } from '../src/fleet/civ-ocr-layout';
import { extractCivLabelValuePairs, mapCivPairsToFields } from '../src/fleet/civ-label-map';

const verso = rebuildCivOcrTextFromVision(
  JSON.parse(readFileSync('./scripts/_civ_preview/logan-verso.pdf.ann.json', 'utf8')),
)!;
const pairs = extractCivLabelValuePairs(verso);
console.log(
  'dist/emis pairs',
  pairs.filter((p) => /distan|poluar|norm/i.test(p.label + p.value)),
);
const hits = mapCivPairsToFields(pairs);
console.log('wheelbase', hits.find((h) => h.key === 'wheelbaseMm'));
console.log('emission', hits.find((h) => h.key === 'emissionStandard'));
