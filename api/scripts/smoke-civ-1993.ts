/**
 * Smoke CIV 1993 (Fiesta-like Secțiunea A).
 * npx tsx scripts/smoke-civ-1993.ts
 */
import { mapCivExtractTextToPreview, detectCivDocumentFormat } from '../src/fleet/civ-extract';

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
7. Mase (kg): Proprie: 1195 Total max. autorizata: 1540
Sarcina pe carligul de remorcare: 50
Fata: 850 Spate: 765
Remorcabila cu dispozitiv de franare: 750
Remorcabila fara dispozitiv de franare: 550
8. Nr. locuri Total: 5 in fata: 2 pe scaune: 5
9. Dimensiuni L: 3958 l: 1722 h: 1481
10. Motorul Tipul: KVJA Serie: CD17215
Cilindree (cmc): 1399
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

=== COL B ===
1. Categoria:
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
  commercial: p.civProfile.commercialName,
  year: p.civProfile.manufactureYear,
  vin: p.vin,
  series: p.civSeries,
  curb: p.civProfile.curbMassKg,
  length: p.civProfile.lengthMm,
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
console.log('OK');
