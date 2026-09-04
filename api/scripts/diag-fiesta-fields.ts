import { readFileSync } from 'fs';
import { extractCiv1993SectionA, mapCiv1993SectionAToProfile } from '../src/fleet/civ-1993-extract';
import { rebuildCivOcrTextFromVision } from '../src/fleet/civ-ocr-layout';
import { mapCivExtractTextToPreview } from '../src/fleet/civ-extract';

const raw = JSON.parse(readFileSync('./scripts/_civ_preview/fiesta-civ.p1-2.ann.json', 'utf8'));
const pagesDoc = Array.isArray(raw) ? raw[0] : raw;
const full = { text: pagesDoc.text, pages: pagesDoc.pages };

console.log('page', pagesDoc.pages?.[0]?.width, 'x', pagesDoc.pages?.[0]?.height);
console.log('aspect', (pagesDoc.pages?.[0]?.width ?? 0) / (pagesDoc.pages?.[0]?.height ?? 1));

const rebuilt = rebuildCivOcrTextFromVision(full);
console.log('rebuilt len', rebuilt?.length ?? 0);
console.log('has COL', /===\s*COL/.test(rebuilt || ''));
console.log(rebuilt?.slice(0, 2000));
console.log('\n===== SECTION A =====\n');
const sec = extractCiv1993SectionA(rebuilt || '');
console.log(sec.slice(0, 1500));
const m = mapCiv1993SectionAToProfile(sec);
console.log('\nKEYS', {
  curb: m.profile.curbMassKg,
  mtma: m.profile.maxTechnicalMassKg,
  braked: m.profile.maxBrakedTrailerMassKg,
  unbraked: m.profile.maxUnbrakedTrailerMassKg,
  L: m.profile.lengthMm,
  l: m.profile.widthMm,
  h: m.profile.heightMm,
  cm3: m.profile.engineCapacityCm3,
  power: m.profile.enginePowerKw,
});
const p = mapCivExtractTextToPreview(rebuilt || '', 'unknown', 'file');
console.log('EXTRACT', {
  format: p.formatUsed,
  tech: p.techPairCount,
  mtma: p.civProfile.maxTechnicalMassKg,
  braked: p.civProfile.maxBrakedTrailerMassKg,
  unbraked: p.civProfile.maxUnbrakedTrailerMassKg,
  L: p.civProfile.lengthMm,
  l: p.civProfile.widthMm,
  cm3: p.civProfile.engineCapacityCm3,
});
