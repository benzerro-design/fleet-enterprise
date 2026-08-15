/**
 * Smoke CIV 1993 — diacritice + valori pe linia A|B (COL B imediat după etichetă).
 * npx tsx scripts/smoke-civ-1993.ts
 */
import { mapCivExtractTextToPreview, detectCivDocumentFormat } from '../src/fleet/civ-extract';
import { mapCiv1993SectionAToProfile } from '../src/fleet/civ-1993-extract';
import { findCivSeriesInFrontText } from '../src/fleet/civ-label-map';
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

// Also exercise Fiesta OCR quirks: Vit . max con- / Carosena … 2
const vitQuirk = `
2 Carosena AB berlina cu hayon 2
3 Marca FORD 3
Remorcabil cu 750 Remorcabila fara 550
disp . de franare disp , de franare
9 gabarit Dimensiunile ( mm ) de L 3958 1722 h 1481 9
10 Motorul ( cm Cilindree1399 Putere Turatie ( max min - 1 ) 51.5 / 4000 10
16 Vit . max con- 162 17 Capacitatea 42.8 16 17
structiva ( km / h ) rezervorului
`;
const q = mapCiv1993SectionAToProfile(vitQuirk);
if (q.profile.maxSpeedKmh !== 162) throw new Error(`quirk speed=${q.profile.maxSpeedKmh}`);
if (String(q.profile.bodyType ?? '') !== 'AB berlina cu hayon') {
  throw new Error(`quirk body=${q.profile.bodyType}`);
}
if (q.profile.widthMm !== 1722) throw new Error(`quirk width=${q.profile.widthMm}`);
if (q.profile.maxBrakedTrailerMassKg !== 750) throw new Error(`quirk braked=${q.profile.maxBrakedTrailerMassKg}`);
if (q.profile.engineCapacityCm3 !== 1399) throw new Error(`quirk cm3=${q.profile.engineCapacityCm3}`);

// OCR: M1 citit ca MT; remorcabile cu cifre DUPĂ „disp”
const remQuirk = `
1 Categoda AUTOTURISM MT 1
2 Carosena AB berlina cu hayon 2
Remorcabil cu Remorcabila fara
disp . de franare disp , de franare
750 550
de Numarul locuri total 5
9 gabarit Dimensiunile ( mm ) de L 3958 1722 h 1481 9
`;
const rq = mapCiv1993SectionAToProfile(remQuirk);
if (rq.profile.usageCategory !== 'AUTOTURISM M1') {
  throw new Error(`usage MT→M1 got ${rq.profile.usageCategory}`);
}
if (rq.profile.maxBrakedTrailerMassKg !== 750) {
  throw new Error(`rem after disp braked=${rq.profile.maxBrakedTrailerMassKg}`);
}
if (rq.profile.maxUnbrakedTrailerMassKg !== 550) {
  throw new Error(`rem after disp unbraked=${rq.profile.maxUnbrakedTrailerMassKg}`);
}
if (rq.profile.standingPlaces != null) {
  throw new Error(`standingPlaces should be empty for AUTOTURISM, got ${rq.profile.standingPlaces}`);
}

const standNoise = mapCiv1993SectionAToProfile(`
1 Categoda AUTOTURISM M1 1
de Numarul locuri total 5 in fata 2 pe Scaune 5 in picioare 80
`);
if (standNoise.profile.standingPlaces != null) {
  throw new Error(`standing noise 80 leaked: ${standNoise.profile.standingPlaces}`);
}
const standNoise8 = mapCiv1993SectionAToProfile(`
AUTOTURISM M1
in picioare 8
`);
if (standNoise8.profile.standingPlaces != null) {
  throw new Error(`standing noise 8 leaked: ${standNoise8.profile.standingPlaces}`);
}

// OCR: tip pe o linie cu Fiesta; rezervor pe 2 linii; serie lipită „J 4 5 9 5 13”
const tipTankSeries = `
4 Tipul JA8 / KVJA1J / 5AEABH / Fiesta 4
16 Vit . max con- 162 17 Capacitatea 42.8 16 17
structiva ( km / h ) rezervorului
J 4 5 9 5 13
`;
const tts = mapCiv1993SectionAToProfile(tipTankSeries);
if (!String(tts.profile.typeVariantVersion ?? '').includes('Fiesta')) {
  throw new Error(`tip+Fiesta got ${tts.profile.typeVariantVersion}`);
}
if (tts.profile.fuelTankCapacityL !== 42.8) {
  throw new Error(`tank split=${tts.profile.fuelTankCapacityL}`);
}
{
  const ser = findCivSeriesInFrontText('J 4 5 9 5 13');
  if (ser !== 'J459513') throw new Error(`series glued=${ser}`);
}

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
  speed: p.civProfile.maxSpeedKmh,
  body: p.civProfile.bodyType,
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
if (p.civProfile.maxSpeedKmh !== 162) throw new Error(`speed=${p.civProfile.maxSpeedKmh}`);
if (String(p.civProfile.bodyType ?? '').includes(' 2')) {
  throw new Error(`body has row num: ${p.civProfile.bodyType}`);
}
if (!String(p.civProfile.bodyType ?? '').toLowerCase().includes('berlina')) {
  throw new Error(`body=${p.civProfile.bodyType}`);
}
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
  maxSpeedKmh: 162,
})) {
  if (f.civProfile[k] !== want) throw new Error(`fiesta ${k}=${f.civProfile[k]} want ${want}`);
}
if (String(f.civProfile.bodyType ?? '').trim() !== 'AB berlina cu hayon') {
  throw new Error(`fiesta body=${f.civProfile.bodyType}`);
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
if (f.civProfile.fuelTankCapacityL !== 42.8 && f.civProfile.fuelTankCapacityL !== 42) {
  // allow int if OCR drops decimal in some paths; Vision Fiesta = 42.8
  const tank = Number(f.civProfile.fuelTankCapacityL);
  if (!(tank >= 42 && tank <= 43)) {
    throw new Error(`fiesta tank=${f.civProfile.fuelTankCapacityL}`);
  }
}
if (!String(f.civProfile.typeVariantVersion ?? '').includes('Fiesta')) {
  throw new Error(`fiesta tip=${f.civProfile.typeVariantVersion}`);
}
if (f.civSeries !== 'J459513') {
  throw new Error(`fiesta series=${f.civSeries}`);
}
console.log('OK fiesta+split');
