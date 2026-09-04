import { mapCiv1993SectionAToProfile } from '../src/fleet/civ-1993-extract';

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
console.log(rq.profile);
const t = remQuirk.normalize('NFD').replace(/\p{M}/gu, '');
const p1 = /(?:^|\n)\s*1\.?\s*Categor\w*\s*[:\s]+([^\n]+?)(?=\s+\d+\s*$|\s*$|\s+2\.?\s*Carose)/i.exec(t);
const p1m = /(?:^|\n)\s*1\.?\s*Categor\w*\s*[:\s]+([^\n]+?)(?=\s+\d+\s*$|\s*$|\s+2\.?\s*Carose)/im.exec(t);
const p2 = /\bCategor\w*\s*[:\s]+([A-Z][^\n]{2,40}?)(?=\s+\d+\s|$)/i.exec(t);
const p3 = /\bCategor\w*\s+([A-Z]+(?:\s+M[I1TL])?)/i.exec(t);
console.log({ p1, p1m, p2, p3 });
