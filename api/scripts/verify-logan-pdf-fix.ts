import { readFileSync } from 'fs';
import { rebuildCivOcrTextFromVision } from '../src/fleet/civ-ocr-layout';
import { mapCivExtractTextToPreview } from '../src/fleet/civ-extract';

const front = rebuildCivOcrTextFromVision(
  JSON.parse(readFileSync('./scripts/_civ_preview/logan-fata.pdf.ann.json', 'utf8')),
)!;
const verso = rebuildCivOcrTextFromVision(
  JSON.parse(readFileSync('./scripts/_civ_preview/logan-verso.pdf.ann.json', 'utf8')),
)!;
const p = mapCivExtractTextToPreview(
  `=== CIV FAȚĂ ===\n${front}\n\n=== CIV VERSO ===\n${verso}`,
  'unknown',
  'file',
);
console.log({
  matched: p.matched.length,
  tech: p.techPairCount,
  brand: p.civProfile.brand,
  tip: p.civProfile.typeVariantVersion,
  commercial: p.civProfile.commercialName,
  series: p.civSeries,
  rar: p.civRarOffice,
  vin: p.vin,
});
if (p.civSeries !== 'P541981') throw new Error(`series=${p.civSeries}`);
if ((p.techPairCount ?? 0) < 40) throw new Error(`tech=${p.techPairCount}`);
if (p.civProfile.commercialName !== 'LOGAN') throw new Error(`commercial=${p.civProfile.commercialName}`);
console.log('OK');
