/**
 * Smoke CIV 2024 (șablon Proace) — Ordin 211/2024, fără bloc proprietar.
 * npx tsx scripts/smoke-civ-2024.ts
 *
 * Mapperul tehnic e cel 2016 (D.1/P.x). Aici înghețăm detectarea 2024 + câmpuri pe corpus.
 */
import { detectCivDocumentFormat, mapCivExtractTextToPreview } from '../src/fleet/civ-extract';

/** Față 2024: Mențiuni + înmatriculare + Serie CIV, fără C.2/CNP. Verso = aceleași rubrici UE. */
export const SAMPLE_CIV_2024_PROACE = `
=== CIV FAȚĂ ===
Mențiuni:
-
Vehicle Identity Card
REGISTRUL AUTO ROMÂN
A. Număr de înmatriculare: B-15-NPY
Serie CIV: P778899
A. Registration number; D.1. Make

=== CIV VERSO ===
D.1. Marcă: TOYOTA
D.2. Tip: VAYH
Variantă: VMGZ
Versiune: VMGZ008
D.3. Denumire comercială: PROACE
E. Număr de identificare: YARVAYHVMGZ008341
2. An fabricație: 2018
J. Categorie: N1
3. Categorie de folosință: AUTOVEHICUL RUTIER
5. Caroserie: BB
L. Număr axe: 2
F.1. Masă maximă tehnic admisibilă, cu excepția motocicletelor (kg): 3100
G. Masă în ordine de mers (kg): 1845
O.1. Masă maximă remorcabilă cu dispozitiv de frânare (kg): 2500
O.2. Masă maximă remorcabilă fără dispozitiv de frânare (kg): 750
10. Lungime (mm): 5309
11. Lățime (mm): 1920
12. Înălțime (mm): 1899
14. Cod motor: 4WZ
P.1. Capacitate cilindrică (cm3): 1997
P.2. Putere (kW): 90
P.3. Tip combustibil sau sursă de energie: MOTORINA
P.5. Serie motor: 4WZ123456
R. Culoare: ALB
S.1. Număr locuri, inclusiv locul conducătorului auto: 3
18. Tracțiune: FAȚĂ
W. Capacitate rezervor (l): 80
21. Reprezentanță RAR: B/B1000001
Data eliberării: 03.06.2024
`;

const fmt = detectCivDocumentFormat(SAMPLE_CIV_2024_PROACE);
if (fmt !== '2024') throw new Error(`detect=${fmt} expected 2024`);

const p = mapCivExtractTextToPreview(SAMPLE_CIV_2024_PROACE, 'unknown', 'file');
if (p.formatUsed !== '2024') throw new Error(`formatUsed=${p.formatUsed}`);
if (p.mappingSkipped) throw new Error(`skipped: ${p.mappingSkipReason}`);
if (p.civProfile.brand !== 'TOYOTA') throw new Error(`brand=${p.civProfile.brand}`);
if (String(p.civProfile.commercialName ?? '').toUpperCase() !== 'PROACE') {
  throw new Error(`commercial=${p.civProfile.commercialName}`);
}
if (p.vin !== 'YARVAYHVMGZ008341') throw new Error(`vin=${p.vin}`);
if (p.civSeries !== 'P778899') throw new Error(`serie=${p.civSeries}`);
if (p.civProfile.homologationCategory !== 'N1') throw new Error(`J=${p.civProfile.homologationCategory}`);
if (p.civProfile.fuelType && !/MOTORIN/i.test(String(p.civProfile.fuelType))) {
  throw new Error(`fuel=${p.civProfile.fuelType}`);
}
const keys = Object.keys(p.civProfile).filter((k) => p.civProfile[k] != null && p.civProfile[k] !== '');
if (keys.length < 12) throw new Error(`fields=${keys.length}`);
if ((p.techPairCount ?? 0) < 10) throw new Error(`pairs=${p.techPairCount}`);

console.log({
  formatUsed: p.formatUsed,
  matched: p.matched.length,
  fields: keys.length,
  brand: p.civProfile.brand,
  commercial: p.civProfile.commercialName,
  vin: p.vin,
  series: p.civSeries,
});
console.log('OK colon-2024');

{
  const { readFileSync } = require('fs') as typeof import('fs');
  const { join } = require('path') as typeof import('path');
  const ocr = readFileSync(join(__dirname, 'fixtures/civ-2024-proace.ocr.txt'), 'utf8');
  if (detectCivDocumentFormat(ocr) !== '2024') {
    throw new Error(`grid detect=${detectCivDocumentFormat(ocr)}`);
  }
  const g = mapCivExtractTextToPreview(ocr, 'unknown', 'file');
  if (g.formatUsed !== '2024') throw new Error(`grid formatUsed=${g.formatUsed}`);
  if (g.civProfile.standingPlaces === 3) {
    throw new Error('standingPlaces=3 e fals din glosar EN');
  }
  if (g.civProfile.brand !== 'TOYOTA') throw new Error(`grid brand=${g.civProfile.brand}`);
  if (String(g.civProfile.commercialName ?? '').toUpperCase() !== 'PROACE') {
    throw new Error(`grid commercial=${g.civProfile.commercialName}`);
  }
  if (g.vin !== 'YARVAYHVMGZ008341') throw new Error(`grid vin=${g.vin}`);
  if (g.civProfile.lengthMm !== 5309) throw new Error(`grid L=${g.civProfile.lengthMm}`);
  if (g.civProfile.widthMm !== 1920) throw new Error(`grid l=${g.civProfile.widthMm}`);
  if (g.civProfile.heightMm !== 1899) throw new Error(`grid h=${g.civProfile.heightMm}`);
  if (!/MOTORIN/i.test(String(g.civProfile.fuelType ?? ''))) {
    throw new Error(`grid fuel=${g.civProfile.fuelType}`);
  }
  if (g.civProfile.manufactureYear !== 2021) throw new Error(`grid year=${g.civProfile.manufactureYear}`);
  if (g.civProfile.homologationCategory !== 'M1') throw new Error(`grid J=${g.civProfile.homologationCategory}`);
  if (g.civProfile.engineRpm !== 3500) throw new Error(`grid rpm=${g.civProfile.engineRpm}`);
  if (g.civIssuedOn !== '2025-06-23') throw new Error(`grid issued=${g.civIssuedOn}`);
  if (!/Călărași/i.test(String(g.civRarOffice ?? ''))) throw new Error(`grid rar=${g.civRarOffice}`);
  if (!/215\/65/.test(String(g.civProfile.tyresFront ?? ''))) {
    throw new Error(`grid tyres=${g.civProfile.tyresFront}`);
  }
  if (g.civProfile.seatsIncludingDriver !== 6) throw new Error(`grid seats=${g.civProfile.seatsIncludingDriver}`);
  if (g.civProfile.co2Gkm !== 169) throw new Error(`grid co2=${g.civProfile.co2Gkm}`);
  if (g.civSeries !== 'S869740') throw new Error(`grid serie=${g.civSeries}`);
  if (!/AF.*multipl/i.test(String(g.civProfile.bodyType ?? ''))) {
    throw new Error(`grid body=${g.civProfile.bodyType}`);
  }
  if (g.civProfile.vehicleClass !== '-') throw new Error(`grid class=${g.civProfile.vehicleClass}`);
  if (!/FILTRU DE PARTICULE/i.test(String(g.civMentions ?? ''))) {
    throw new Error(`grid mentions=${g.civMentions}`);
  }
  const gk = Object.keys(g.civProfile).filter((k) => g.civProfile[k] != null && g.civProfile[k] !== '');
  if (gk.length < 30) throw new Error(`grid fields=${gk.length} ${gk.join(',')}`);
  console.log({
    gridFormat: g.formatUsed,
    gridFields: gk.length,
    gridKeys: gk,
  });
  console.log('OK grid-2024 Proace OCR');
}
