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
console.log('OK');
