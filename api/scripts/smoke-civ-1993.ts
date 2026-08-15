/**
 * Smoke CIV 1993 — diacritice + valori pe linia A|B (COL B imediat după etichetă).
 * npx tsx scripts/smoke-civ-1993.ts
 */
import { mapCivExtractTextToPreview, detectCivDocumentFormat } from '../src/fleet/civ-extract';
import { readFileSync } from 'fs';

const sample = `
=== CIV FAȚĂ ===
CARTEA DE IDENTITATE A VEHICULULUI
Numărul de înmatriculare: B-112-AYM
Deținător: CARAIAC MARIUS
J 459513

=== CIV VERSO ===
=== COL A ===
1. Categoria: AUTOTURISM M1
2. Caroserie: AB berlina cu hayon
3. Marca: FORD
4. Tipul / Varianta: JA8 / KVJA1J / 5AEABH / Fiesta
5. Nr. omologare / Anul fabricatiei: AB193F3Y11WB0E5 / 2012
6. Nr. identificare: WF0JXXGAJJCD17215
7. Mase (kg): Proprie: 1195 Totală max. autorizată:
=== COL B ===
1540
=== COL A ===
Sarcina pe carligul de remorcare: 50
Fata: 850 Spate: 765
Remorcabilă cu dispozitiv de franare:
=== COL B ===
750
=== COL A ===
Remorcabilă fără dispozitiv de franare:
=== COL B ===
550
=== COL A ===
8. Nr. locuri Total: 5 in fata: 2 pe scaune: 5
9. Dimensiuni L: 3958
=== COL B ===
1722 h 1481
=== COL A ===
10. Motorul Tipul: KVJA Serie: CD17215
Cilindree (cmc):
=== COL B ===
1399
=== COL A ===
Putere max (kW) / Turatie: 51.5 / 4000
Sursa de energie: MOTORINA
11. Nr. axe: 2
12. Tractiune: FATA
13. Dimensiunea anvelopelor Fata: 195/50 R15 82 H
Spate: 195/50 R15 82 H
14. Zgomot in mers: 69 in stationare: 74
16. Vit. max constructiva (km/h): 162
17. Capacitatea rezervorului (l): 42.8
18. Culoarea: GRI
Modificari: CO2: 107 g/km; Filtru de particule.
`;

const fmt = detectCivDocumentFormat(sample);
const p = mapCivExtractTextToPreview(sample, 'unknown', 'text');
console.log({
  format: fmt,
  formatUsed: p.formatUsed,
  matched: p.matched.length,
  tech: p.techPairCount,
  brand: p.civProfile.brand,
  tip: p.civProfile.typeVariantVersion,
  year: p.civProfile.manufactureYear,
  vin: p.vin,
  series: p.civSeries,
  curb: p.civProfile.curbMassKg,
  mtma: p.civProfile.maxTechnicalMassKg,
  braked: p.civProfile.maxBrakedTrailerMassKg,
  unbraked: p.civProfile.maxUnbrakedTrailerMassKg,
  length: p.civProfile.lengthMm,
  width: p.civProfile.widthMm,
  height: p.civProfile.heightMm,
  cm3: p.civProfile.engineCapacityCm3,
  engine: p.civProfile.engineCode,
  co2: p.civProfile.co2Gkm,
  color: p.civProfile.color,
});

if (fmt !== '1993' && p.formatUsed !== '1993') throw new Error(`format=${fmt}/${p.formatUsed}`);
if (p.civProfile.brand !== 'FORD') throw new Error(`brand=${p.civProfile.brand}`);
if (p.vin !== 'WF0JXXGAJJCD17215') throw new Error(`vin=${p.vin}`);
if (p.civSeries !== 'J459513') throw new Error(`series=${p.civSeries}`);
if (p.civProfile.curbMassKg !== 1195) throw new Error(`curb=${p.civProfile.curbMassKg}`);
if (p.civProfile.maxTechnicalMassKg !== 1540) throw new Error(`mtma=${p.civProfile.maxTechnicalMassKg}`);
if (p.civProfile.maxBrakedTrailerMassKg !== 750) throw new Error(`braked=${p.civProfile.maxBrakedTrailerMassKg}`);
if (p.civProfile.maxUnbrakedTrailerMassKg !== 550) throw new Error(`unbraked=${p.civProfile.maxUnbrakedTrailerMassKg}`);
if (p.civProfile.lengthMm !== 3958) throw new Error(`L=${p.civProfile.lengthMm}`);
if (p.civProfile.widthMm !== 1722) throw new Error(`l=${p.civProfile.widthMm}`);
if (p.civProfile.engineCapacityCm3 !== 1399) throw new Error(`cm3=${p.civProfile.engineCapacityCm3}`);
if (!String(p.civProfile.tyresFront ?? '').includes('195/50')) {
  throw new Error(`tyresF=${p.civProfile.tyresFront}`);
}
if (!String(p.civProfile.tyresRear ?? '').includes('195/50')) {
  throw new Error(`tyresR=${p.civProfile.tyresRear}`);
}
if (String(p.civProfile.tyresFront ?? '').includes('175/65')) {
  throw new Error(`tyresF took optional sau: ${p.civProfile.tyresFront}`);
}
if (!String(p.civProfile.typeVariantVersion ?? '').includes('JA8')) {
  throw new Error(`tip=${p.civProfile.typeVariantVersion}`);
}
if (p.civProfile.usageCategory !== 'AUTOTURISM M1') {
  throw new Error(`usage=${p.civProfile.usageCategory}`);
}
if (!p.civMentions || !/CO2|Filtru/i.test(p.civMentions)) {
  throw new Error(`mentions=${p.civMentions}`);
}
if ((p.matched.length ?? 0) < 15) throw new Error(`matched=${p.matched.length}`);

const fiesta = readFileSync('./scripts/_civ_preview/fiesta-combined.ocr.txt', 'utf8');
const f = mapCivExtractTextToPreview(fiesta, 'unknown', 'file');
for (const [k, want] of Object.entries({
  maxTechnicalMassKg: 1540,
  maxBrakedTrailerMassKg: 750,
  maxUnbrakedTrailerMassKg: 550,
  lengthMm: 3958,
  widthMm: 1722,
  engineCapacityCm3: 1399,
})) {
  if (f.civProfile[k] !== want) throw new Error(`fiesta ${k}=${f.civProfile[k]} want ${want}`);
}
if (!String(f.civProfile.tyresFront ?? '').includes('195/50')) {
  throw new Error(`fiesta tyresF=${f.civProfile.tyresFront}`);
}
if (!String(f.civProfile.tyresRear ?? '').includes('195/50')) {
  throw new Error(`fiesta tyresR=${f.civProfile.tyresRear}`);
}
if (String(f.civProfile.tyresFront ?? '').includes('175/65')) {
  throw new Error(`fiesta tyresF optional: ${f.civProfile.tyresFront}`);
}
console.log('OK fiesta+split');
