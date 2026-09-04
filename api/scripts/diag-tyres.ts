import { mapCiv1993SectionAToProfile, extractCiv1993SectionA } from '../src/fleet/civ-1993-extract';
import { mapCivExtractTextToPreview } from '../src/fleet/civ-extract';
import { readFileSync } from 'fs';

const mini = `
13. Dimensiunea anvelopelor Fata: 195/50 R15 82 H
Spate: 195/50 R15 82 H
Fala 195/50 R15 82 H
anvelopelor sau 175/65 R14 82 T
, Myloc- 195/50 R15 82 H
spate
sau 175/65 R14 82 T
`;
console.log('mini', mapCiv1993SectionAToProfile(mini).profile.tyresFront, mapCiv1993SectionAToProfile(mini).profile.tyresRear);

// Replicate smoke sample tyre section after COL extract
const smokeSrc = readFileSync('./scripts/smoke-civ-1993.ts', 'utf8');
const m = /const sample = `([\s\S]*?)`;/.exec(smokeSrc);
if (!m) throw new Error('no sample');
const sample = m[1]!;
const sec = extractCiv1993SectionA(sample);
console.log('--- section has Fata?', /Fata/i.test(sec), 'Myloc?', /Myloc|Spate/i.test(sec));
console.log(sec.slice(sec.toLowerCase().indexOf('anvelop') >= 0 ? sec.toLowerCase().indexOf('anvelop') : 0).slice(0, 400));
const p = mapCivExtractTextToPreview(sample, 'unknown', 'text');
console.log('smoke tyres', p.civProfile.tyresFront, p.civProfile.tyresRear);
