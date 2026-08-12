import { readFileSync } from 'fs';
import { mapCivExtractTextToPreview } from '../src/fleet/civ-extract';
import { splitCivBookPages } from '../src/fleet/civ-pages';
import { mergeOrphanValueAboveEmptyLabel } from '../src/fleet/civ-ocr-layout';

const rebuilt = readFileSync('./scripts/_civ_preview/logan-ocr-rebuilt.txt', 'utf8');

const frontOnly = `=== CIV FAȚĂ ===
Mențiuni:
H
REGISTRUL AUTO ROMÂN
A. Număr de înmatriculare: B-157-EFI
C.2. Proprietar: CAPALAC MARIUS
Data nașterii:
`;

const withVerso = `${frontOnly}

=== CIV VERSO ===
${mergeOrphanValueAboveEmptyLabel(rebuilt)}
`;

const pages = splitCivBookPages(withVerso);
console.log('page1 starts', pages.page1.slice(0, 60).replace(/\n/g, ' | '));
console.log('page4 starts', pages.page4.slice(0, 40).replace(/\n/g, ' | '));

const faceOnly = mapCivExtractTextToPreview(frontOnly, 'unknown', 'text');
console.log('face-only', {
  matched: faceOnly.matched.length,
  hasVerso: faceOnly.hasVerso,
  techPairCount: faceOnly.techPairCount,
  brand: faceOnly.civProfile.brand,
});

const full = mapCivExtractTextToPreview(withVerso, 'unknown', 'file');
console.log('with-verso', {
  matched: full.matched.length,
  hasVerso: full.hasVerso,
  techPairCount: full.techPairCount,
  brand: full.civProfile.brand,
  tip: full.civProfile.typeVariantVersion,
  commercial: full.civProfile.commercialName,
  series: full.civSeries,
  rar: full.civRarOffice,
});

if (!full.hasVerso) throw new Error('expected hasVerso');
if ((full.techPairCount ?? 0) < 15) throw new Error(`tech pairs ${full.techPairCount}`);
if (full.civProfile.commercialName !== 'LOGAN') {
  throw new Error(`commercial=${full.civProfile.commercialName}`);
}
if (!pages.page1.includes('înmatriculare') && !pages.page1.includes('inmatriculare')) {
  throw new Error('page1 should include registration');
}
console.log('OK');
