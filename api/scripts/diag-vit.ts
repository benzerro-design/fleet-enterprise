import { mapCiv1993SectionAToProfile } from '../src/fleet/civ-1993-extract';

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
console.log({
  speed: q.profile.maxSpeedKmh,
  body: q.profile.bodyType,
  width: q.profile.widthMm,
  braked: q.profile.maxBrakedTrailerMassKg,
  cm3: q.profile.engineCapacityCm3,
  matched: q.matched.filter((m) =>
    ['maxSpeedKmh', 'bodyType', 'widthMm', 'maxBrakedTrailerMassKg', 'engineCapacityCm3'].includes(
      m.target,
    ),
  ),
});

const t = vitQuirk.normalize('NFD').replace(/\p{M}/gu, '');
const re = /\bVit\s*\.?\s*max[\s\S]{0,40}?(\d{2,3})\b/i;
console.log('re', re.exec(t));
const re2 = /\bVit\s*\.?\s*max\s*con[\s\-]*\w*\s*[:\s]*(\d{2,3})\b/i;
console.log('re2', re2.exec(t));
const idx = t.search(/\bVit\s*\.?\s*max/i);
console.log('after', JSON.stringify(t.slice(idx, idx + 60)));
