import { readFileSync } from 'fs';
import {
  looksLikeCiv1993,
  mapCiv1993TextToPreview,
  extractCiv1993SectionA,
} from '../src/fleet/civ-1993-extract';
import { detectCivDocumentFormat, mapCivExtractTextToPreview } from '../src/fleet/civ-extract';

const t = readFileSync('./scripts/_civ_preview/fiesta-combined.ocr.txt', 'utf8');
console.log('looks', looksLikeCiv1993(t), 'detect', detectCivDocumentFormat(t));
console.log('--- sectionA ---');
console.log(extractCiv1993SectionA(t).slice(0, 800));
const r = mapCiv1993TextToPreview(t, 'file');
console.log('direct1993', {
  matched: r.matched.length,
  brand: r.civProfile.brand,
  vin: r.vin,
  series: r.civSeries,
  tip: r.civProfile.typeVariantVersion,
  curb: r.civProfile.curbMassKg,
  keys: Object.keys(r.civProfile).filter((k) => r.civProfile[k] != null && r.civProfile[k] !== ''),
});
const p = mapCivExtractTextToPreview(t, 'unknown', 'file');
console.log('viaExtract', {
  format: p.formatUsed,
  matched: p.matched.length,
  skipped: p.mappingSkipped,
  brand: p.civProfile.brand,
  vin: p.vin,
});
