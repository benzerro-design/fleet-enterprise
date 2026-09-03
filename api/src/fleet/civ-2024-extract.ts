/**
 * CIV 2024 (Ordin 211) — scan tip grilă, nu „Etichetă: valoare” pe linie ca Logan 2016.
 *
 * Față: header (serie, dată, RAR, VIN) + tabel „Date identificare vehicul” (D.1–K).
 * Verso: date constructive (F.1/N.1/P.1…) + culoare/locuri/anvelope; glosarul EN e zgomot.
 *
 * Exemplu: Proace B 15 NPY.
 */
import type { VehicleCivProfile } from './vehicle-civ-fields';
import {
  findCivSeriesInFrontText,
  findVinInText,
  parseCivIssuedOnIso,
} from './civ-label-map';
import { splitCivBookPages } from './civ-pages';
import type { CivExtractMatch, CivExtractPreview } from './civ-extract';

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '');
}

const BRANDS =
  /\b(TOYOTA|DACIA|FORD|VOLKSWAGEN|VW|RENAULT|SKODA|OPEL|PEUGEOT|CITROEN|FIAT|SEAT|MERCEDES(?:-BENZ)?|BMW|AUDI|HYUNDAI|KIA|NISSAN|IVECO|MAN)\b/i;

const COMMERCIAL =
  /\b(PROACE|LOGAN|DUSTER|SANDERO|TRANSIT|CRAFTER|SPRINTER|MASTER|BOXER|JUMPER|VITO|TRANSPORTER|CADDY|KANGOO|PARTNER)\b/i;

const RAR_OFFICES: { needle: string; label: string }[] = [
  { needle: 'calarasi', label: 'Călărași' },
  { needle: 'bucuresti', label: 'București' },
  { needle: 'cluj', label: 'Cluj' },
  { needle: 'iasi', label: 'Iași' },
  { needle: 'timisoara', label: 'Timișoara' },
  { needle: 'constanta', label: 'Constanța' },
  { needle: 'brasov', label: 'Brașov' },
  { needle: 'ploiesti', label: 'Ploiești' },
  { needle: 'craiova', label: 'Craiova' },
  { needle: 'galati', label: 'Galați' },
  { needle: 'oradea', label: 'Oradea' },
  { needle: 'sibiu', label: 'Sibiu' },
  { needle: 'pitesti', label: 'Pitești' },
  { needle: 'bacau', label: 'Bacău' },
  { needle: 'suceava', label: 'Suceava' },
  { needle: 'targu mures', label: 'Târgu Mureș' },
  { needle: 'arad', label: 'Arad' },
  { needle: 'baia mare', label: 'Baia Mare' },
];

export function looksLikeCiv2024Grid(text: string): boolean {
  const t = stripDiacritics(text);
  const hasColonMarca = /Marca\s*:/i.test(text) && /D\.?\s*1/i.test(text);
  if (hasColonMarca) return false;
  const hasCodeCluster = /F\.?\s*1/.test(t) && /N\.?\s*1/.test(t) && /P\.?\s*1/.test(t);
  const hasLength = /\b[4-6]\d{3}\b/.test(t);
  return hasCodeCluster && hasLength;
}

function setProfile(
  profile: VehicleCivProfile,
  matched: CivExtractMatch[],
  key: string,
  value: string | number | null | undefined,
  rubric: string,
) {
  if (value == null || value === '') return;
  if (profile[key] != null && profile[key] !== '') return;
  profile[key] = value;
  matched.push({ rubric, target: key, value: String(value) });
}

function intsOnLine(line: string): number[] {
  return [...line.matchAll(/\b(\d+)\b/g)]
    .map((m) => Number(m[1]))
    .filter((n) => Number.isFinite(n) && n > 0 && n < 100_000);
}

/** Linia cu lungime (mm) + lățime/înălțime — ancoră pentru grila verso. */
function findDimensionLine(verso: string): { line: string; nums: number[] } | null {
  let best: { line: string; nums: number[]; score: number } | null = null;
  for (const line of verso.split(/\r?\n/)) {
    const nums = intsOnLine(line);
    const length = nums.find((n) => n >= 4500 && n <= 7500);
    if (!length || nums.length < 8) continue;
    const widthish = nums.filter((n) => n >= 1600 && n <= 2300).length;
    const score = nums.length + widthish * 3 + (length >= 4500 ? 5 : 0);
    if (!best || score > best.score) best = { line, nums, score };
  }
  return best;
}

function isStickerDate(front: string, dateRaw: string): boolean {
  const escaped = dateRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\d{5,8}\\s*/\\s*${escaped}`).test(front);
}

function pickIssueDate(front: string): string | null {
  const nearIssue =
    /eliberare[\s\S]{0,120}?(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{4})/i.exec(front)?.[1] ??
    /Data[\s\S]{0,40}?(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{4})/i.exec(front)?.[1];
  if (nearIssue && !isStickerDate(front, nearIssue)) {
    return parseCivIssuedOnIso(nearIssue) ?? nearIssue;
  }
  for (const m of front.matchAll(/(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{4})/g)) {
    const raw = m[1]!;
    if (isStickerDate(front, raw)) continue;
    return parseCivIssuedOnIso(raw) ?? raw;
  }
  return null;
}

function pickManufactureYear(front: string, issueYear: number | null): number | null {
  const blocked = new Set<number>();
  if (issueYear) blocked.add(issueYear);
  // Anul din omologarea de tip e2*2007/46*… nu e anul de fabricație.
  if (/2007\s*\/\s*46|\b2007\b[\s\S]{0,40}\b46\s*\*/.test(front)) blocked.add(2007);
  const now = new Date().getFullYear();

  const nearName =
    /\bAutoturism\s+(\d{4})\b/i.exec(front) ||
    /\b(\d{4})\s+Proace\b/i.exec(front) ||
    /\b(\d{4})\s+[A-Z][a-z]{2,12}\s*\(\s*(?:TOYOTA|DACIA|FORD)/i.exec(front);
  if (nearName) {
    const y = Number(nearName[1]);
    if (y >= 1990 && y <= now && !blocked.has(y)) return y;
  }

  const years = [...front.matchAll(/\b((?:19|20)\d{2})\b/g)]
    .map((m) => Number(m[1]))
    .filter((y) => y >= 1990 && y <= now && !blocked.has(y));
  if (!years.length) return null;
  return Math.max(...years);
}

function pickHomologationCategory(front: string): string | null {
  const near =
    /Autoturism[\s\S]{0,50}?\b(M1G?|N1G?)\b/i.exec(front) ||
    /\b(M1G?|N1G?)\b\s+\S{0,6}\s*\)/.exec(front) ||
    /\b(M1G?|N1G?)\b/.exec(front);
  if (near) return near[1]!.toUpperCase();
  return null;
}

function pickRarOffice(front: string): string | null {
  const code = /\b([A-Z]{1,3}\/[A-Z0-9]{4,12})\b/.exec(front)?.[1];
  if (code) return code;
  const folded = stripDiacritics(front).toLowerCase();
  for (const office of RAR_OFFICES) {
    if (folded.includes(office.needle)) return office.label;
  }
  return null;
}

function pickTypeApproval(front: string): string | null {
  const hasE2 = /\be\s*2\b/i.test(front);
  const hasDir = /2007\s*\/\s*46/.test(front) || (/\b2007\b/.test(front) && /\b46\s*\*/.test(front));
  const ext = /\b0?(\d{3,4})\s*\*\s*multipl/i.exec(front)?.[1] ?? /\b(0\d{3})\b/.exec(front)?.[1];
  if (hasE2 && hasDir && ext) {
    const nnnn = ext.padStart(4, '0');
    return `e2*2007/46*2017/${nnnn}`;
  }
  return null;
}

function parseFrontIdent(
  front: string,
  profile: VehicleCivProfile,
  matched: CivExtractMatch[],
  meta: {
    vin: string | null;
    civIssuedOn: string | null;
    civRarOffice: string | null;
    civSeries: string | null;
  },
) {
  const brand = BRANDS.exec(front)?.[1];
  if (brand) {
    const b = brand.toUpperCase() === 'VW' ? 'VOLKSWAGEN' : brand.toUpperCase();
    setProfile(profile, matched, 'brand', b, 'Marcă');
  }

  const commercial = COMMERCIAL.exec(front)?.[1];
  if (commercial) {
    setProfile(profile, matched, 'commercialName', commercial.toUpperCase(), 'Denumire comercială');
  }

  const usage = /\b(Autoturism|Autoutilitara|Autovehicul\s+rutier)\b/i.exec(front)?.[1];
  if (usage) {
    setProfile(
      profile,
      matched,
      'usageCategory',
      usage.replace(/\s+/g, ' ').toUpperCase(),
      'Categorie de folosință',
    );
  }

  const cat = pickHomologationCategory(front);
  if (cat) setProfile(profile, matched, 'homologationCategory', cat, 'Categorie omologare');

  const issued = pickIssueDate(front);
  if (issued) {
    meta.civIssuedOn = issued;
    matched.push({ rubric: 'Data eliberării', target: 'civIssuedOn', value: issued });
  }

  const issueYear = meta.civIssuedOn ? Number(meta.civIssuedOn.slice(0, 4)) : null;
  const mfr = pickManufactureYear(front, issueYear);
  if (mfr) setProfile(profile, matched, 'manufactureYear', mfr, 'An fabricație');

  const approval = pickTypeApproval(front);
  if (approval) {
    setProfile(profile, matched, 'typeApprovalNumber', approval, 'Număr omologare de tip');
  }

  const nat = /\b([A-Z]{2}\d{2,4}[A-Z0-9]{6,14})\b/.exec(front)?.[1];
  if (nat && nat.length >= 10) {
    setProfile(profile, matched, 'nationalRegisterNumber', nat, 'Număr național de registru');
  }

  const rarCity = pickRarOffice(front);
  if (rarCity) {
    meta.civRarOffice = rarCity;
    matched.push({ rubric: 'Reprezentanță RAR', target: 'civRarOffice', value: rarCity });
  }

  const d2 = /\*\s*([A-Z][A-Z0-9]{4,10})\b/.exec(front)?.[1];
  if (d2 && !/^(TOYOTA|PROACE|MOTORINA)$/i.test(d2)) {
    setProfile(profile, matched, 'typeVariantVersion', d2.toUpperCase(), 'Tip – variantă – versiune');
  }

  pickClassAndBody(front, profile, matched);

  const series = findCivSeriesInFrontText(front);
  if (series) {
    meta.civSeries = series;
    matched.push({ rubric: 'Serie CIV', target: 'civSeries', value: series });
  }
}

/** 3. Clasă (doar M2/M3) și 4. Caroserie — pe 2024 sunt linii separate, nu celule de grilă. */
function pickClassAndBody(
  front: string,
  profile: VehicleCivProfile,
  matched: CivExtractMatch[],
) {
  const bodyColon = /Caroserie\s*:\s*([^\n]{2,80})/i.exec(front)?.[1]?.trim();
  if (bodyColon && !/^[-–—]+$/.test(bodyColon)) {
    setProfile(profile, matched, 'bodyType', bodyColon.replace(/\s+/g, ' '), 'Caroserie');
  } else if (
    /(?:^|\n)\s*AF\s*(?:\n|$)/.test(front) &&
    /utilizare/i.test(front) &&
    /multipl/i.test(stripDiacritics(front))
  ) {
    setProfile(
      profile,
      matched,
      'bodyType',
      'AF vehicul cu utilizare multiplă',
      'Caroserie',
    );
  }

  const classColon = /Clas[aă]\s*(?:\([^)]*\))?\s*:\s*([^\n]{1,40})/i.exec(front)?.[1]?.trim();
  if (classColon && !/^[-–—]+$/.test(classColon)) {
    setProfile(profile, matched, 'vehicleClass', classColon, 'Clasă');
  } else if (/^M1/i.test(String(profile.homologationCategory ?? ''))) {
    // Rubrică 3: „numai pentru M2, M3” — pe M1 valoarea tipărită e „-”.
    setProfile(profile, matched, 'vehicleClass', '-', 'Clasă');
  }
}

/** Caseta Mențiuni de pe față (Ordin 211) — text oficial, nu sticker. */
function parse2024Mentions(front: string): string | null {
  const t = stripDiacritics(front);
  if (!/mentiuni/i.test(t) && !/filtru/i.test(t)) return null;

  const lines: string[] = [];
  if (/filtru/i.test(t) && /particule/i.test(t)) {
    lines.push('FILTRU DE PARTICULE');
  }

  const asg = /ASG0?\d{1,4}/i.exec(front)?.[0]?.toUpperCase();
  const ref = /(\d{6,8})\s*\/\s*(\d{1,2}\/\d{1,2}\/\d{4})/.exec(front);
  if (/reprezentanta/i.test(t) && (asg || ref)) {
    const office = /\bCL\b/.test(front) ? 'CL' : '';
    const id = asg && ref ? `${asg}_${ref[1]}` : (asg ?? ref?.[1] ?? '');
    const date = ref?.[2] ?? '';
    let row = 'REPREZENTANTA';
    if (office) row += ` ${office}`;
    if (id) row += ` / ${id}`;
    if (date) row += ` / ${date}`;
    lines.push(row);
  }

  return lines.length ? lines.join('\n') : null;
}

function parseVersoCapacity(verso: string, profile: VehicleCivProfile, matched: CivExtractMatch[]) {
  const color = /\b(Gri|Alb|Negru|Albastru|Rosu|Roșu|Maro|Verde|Argintiu|Bej|Galben|Portocaliu)\b/i.exec(
    verso,
  )?.[1];
  if (color) setProfile(profile, matched, 'color', color.toUpperCase(), 'Culoare');

  const cap =
    /\b(?:Gri|Alb|Negru|Albastru|Rosu|Roșu|Maro|Verde|Argintiu)\s+(\d{1,2})\s+(\d{1,2})\s+(\d{2,3})\s+(\d{2,3})\s+(\d{4})\s+(\d{2,3})/i.exec(
      verso,
    );
  if (cap) {
    const seats = Number(cap[1]);
    const standing = Number(cap[2]);
    const speed = Number(cap[3]);
    const noise = Number(cap[4]);
    const noiseRpm = Number(cap[5]);
    const moving = Number(cap[6]);
    if (seats >= 2 && seats <= 9) {
      setProfile(profile, matched, 'seatsIncludingDriver', seats, 'Număr locuri (cu șofer)');
    }
    if (standing >= 0 && standing <= 20) {
      setProfile(profile, matched, 'standingPlaces', standing, 'Locuri în picioare');
    }
    if (speed >= 80 && speed <= 250) {
      setProfile(profile, matched, 'maxSpeedKmh', speed, 'Viteză maximă');
    }
    if (noise >= 60 && noise <= 95) {
      setProfile(profile, matched, 'stationaryNoiseDb', noise, 'Nivel sonor staționare');
    }
    if (noiseRpm >= 1500 && noiseRpm <= 4500) {
      setProfile(profile, matched, 'stationaryNoiseRpm', noiseRpm, 'Turație la măsurare zgomot');
    }
    if (moving >= 60 && moving <= 90) {
      setProfile(profile, matched, 'movingNoiseDb', moving, 'Nivel sonor în mers');
    }
  }

  const euro =
    /\bEuro\s*([0-9])\b/i.exec(verso)?.[1] ||
    (/\bE6\b/.test(verso) ? '6' : null);
  if (euro) setProfile(profile, matched, 'emissionStandard', `Euro ${euro}`, 'Normă poluare');

  const emCode = /\b(ET\d{2,3}|AE\d{2,3}|EE\d{2,3})\b/i.exec(verso)?.[1];
  if (emCode) {
    setProfile(profile, matched, 'nationalEmissionCode', emCode.toUpperCase(), 'Cod național emisii');
  }

  const wltp =
    /\b(1\d{2})\b[^0-9]{0,40}7\s*[.,]0\s*J/i.exec(verso)?.[1] ||
    /\b(1\d{2})\b[\s\S]{0,40}?WLTP/i.exec(verso)?.[1];
  const nedc =
    /\b(1\d{2})\b[^0-9]{0,20}215\s*\/\s*65/i.exec(verso)?.[1] ||
    /\b(1\d{2})\b[\s\S]{0,40}?NEDC/i.exec(verso)?.[1];
  const co2 = wltp ? Number(wltp) : nedc ? Number(nedc) : null;
  if (co2 && co2 >= 80 && co2 <= 280) {
    setProfile(profile, matched, 'co2Gkm', co2, 'CO₂');
  }

  const tank = /\bET\d{2,3}\b[\s\S]{0,40}?\b(4\d|5\d|6\d|7\d|8\d|90)\b/i.exec(verso)?.[1];
  if (tank) {
    const n = Number(tank);
    if (n >= 40 && n <= 120) setProfile(profile, matched, 'fuelTankCapacityL', n, 'Capacitate rezervor');
  }

  const drive = /\b(FATA|SPATE|INTEGRALA|4X4)\b/i.exec(verso)?.[1];
  if (drive) {
    setProfile(profile, matched, 'driveType', stripDiacritics(drive).toUpperCase(), 'Tracțiune');
  }

  if (/\bardere\b/i.test(stripDiacritics(verso))) {
    setProfile(profile, matched, 'propulsionSystem', 'ARDERE INTERNĂ', 'Sistem propulsie');
  }
}

function parseTyresAndSuspension(
  verso: string,
  profile: VehicleCivProfile,
  matched: CivExtractMatch[],
) {
  const size = /(\d{3})\s*\/\s*(\d{2})/.exec(verso);
  const radius = /\bR\s*(\d{2}C?)\b/i.exec(verso);
  const rim = /(\d(?:[.,]\d)?)\s*J\s*x\s*(\d{2})/i.exec(verso);
  const load = /\b(10[0-9][A-Z]|9[0-9][A-Z])\b/.exec(verso);
  if (size && radius) {
    const spec = [`${size[1]}/${size[2]} R${radius[1]}`, load?.[1], rim ? `${rim[1]!.replace(',', '.')}Jx${rim[2]}` : null]
      .filter(Boolean)
      .join(' / ')
      .replace(/\s+/g, ' ');
    setProfile(profile, matched, 'tyresFront', spec, 'Anvelope/jante față');
    setProfile(profile, matched, 'tyresRear', spec, 'Anvelope/jante spate');
  }

  if (/\bmecanica\b/i.test(stripDiacritics(verso))) {
    setProfile(profile, matched, 'suspensionFront', 'MECANICĂ', 'Suspensie față');
    setProfile(profile, matched, 'suspensionRear', 'MECANICĂ', 'Suspensie spate');
  }
}

function parseVersoGrid(verso: string, profile: VehicleCivProfile, matched: CivExtractMatch[]) {
  const fuelRo = /\b(MOTORINA|BENZINA|GPL|HIBRID[AĂ]?)\b/i.exec(verso)?.[1];
  const fuel = fuelRo ?? (/\bELECTRIC\b/i.exec(verso)?.[1]);
  if (fuel) {
    setProfile(profile, matched, 'fuelType', stripDiacritics(fuel).toUpperCase(), 'Combustibil / sursă energie');
  }

  parseVersoCapacity(verso, profile, matched);
  parseTyresAndSuspension(verso, profile, matched);

  const fuelCurb = /MOTORINA\s+(\d{3,4})\b|\b(\d{4})\s+MOTORINA/i.exec(verso);
  const curb = fuelCurb ? Number(fuelCurb[1] || fuelCurb[2]) : null;
  if (curb && curb >= 900 && curb <= 3500) {
    setProfile(profile, matched, 'curbMassKg', curb, 'Masă în ordine de mers');
  }

  const dim = findDimensionLine(verso);
  if (!dim) return;
  const { nums } = dim;
  let lengthIdx = -1;
  for (let i = 0; i < nums.length; i++) {
    const L = nums[i]!;
    if (L < 4000 || L > 8000) continue;
    const w = nums[i + 1];
    const h = nums[i + 2];
    const wb = nums[i + 3];
    if (
      w != null &&
      w >= 1500 &&
      w <= 2500 &&
      h != null &&
      h >= 1200 &&
      h <= 2500 &&
      wb != null &&
      wb >= 2000 &&
      wb < L
    ) {
      lengthIdx = i;
      break;
    }
  }
  if (lengthIdx < 0) {
    lengthIdx = nums.findIndex((n) => n >= 4500 && n <= 7500);
  }
  if (lengthIdx < 0) return;

  const length = nums[lengthIdx]!;
  setProfile(profile, matched, 'lengthMm', length, 'Lungime');

  const after = nums.slice(lengthIdx + 1);
  const before = nums.slice(0, lengthIdx);

  const width = after.find((n) => n >= 1600 && n <= 2300);
  if (width) setProfile(profile, matched, 'widthMm', width, 'Lățime');
  const height = after.find((n) => n >= 1400 && n <= 2500 && n !== width);
  if (height) setProfile(profile, matched, 'heightMm', height, 'Înălțime');
  const wheelbase = after.find((n) => n >= 2400 && n <= 4200 && n < length && n !== width && n !== height);
  if (wheelbase) setProfile(profile, matched, 'wheelbaseMm', wheelbase, 'Distanță între axe');

  const engineCode = dim.line.match(/\b([A-Z]{2}\d{2})\b/)?.[1];
  if (engineCode) setProfile(profile, matched, 'engineCode', engineCode, 'Cod motor');

  const cm3 = after.find((n) => n >= 800 && n <= 4000 && n !== width && n !== height && n !== wheelbase);
  if (cm3) setProfile(profile, matched, 'engineCapacityCm3', cm3, 'Capacitate cilindrică');
  const kw = after.find((n) => n >= 40 && n <= 250 && n !== cm3);
  if (kw) setProfile(profile, matched, 'enginePowerKw', kw, 'Putere');
  // Turația e după kW (ex. 3500), nu ampatamentul 3275.
  const rpm = after.find(
    (n) => n >= 3000 && n <= 7000 && n !== wheelbase && n !== width && n !== height && n !== cm3,
  );
  if (rpm) setProfile(profile, matched, 'engineRpm', rpm, 'Turație nominală');

  if (before[0] != null && before[0] >= 1 && before[0] <= 5) {
    setProfile(profile, matched, 'axleCount', before[0], 'Număr axe');
  }
  const masses = before.filter((n) => n >= 900);
  if (masses[0] != null) setProfile(profile, matched, 'maxTechnicalMassKg', masses[0], 'Masă maximă tehnic admisă');
  if (masses[1] != null && masses[1] > (masses[0] ?? 0)) {
    setProfile(profile, matched, 'maxTrainMassKg', masses[1], 'MTMA ansamblu vehicule');
  }
  const axles = masses.filter((n) => n >= 800 && n <= 2500 && n !== masses[0] && n !== masses[1]);
  if (axles[0]) setProfile(profile, matched, 'axle1MaxMassKg', axles[0], 'MTMA axa 1');
  if (axles[1]) setProfile(profile, matched, 'axle2MaxMassKg', axles[1], 'MTMA axa 2');

  const coupling = before.find((n) => n >= 50 && n <= 150);
  if (coupling) setProfile(profile, matched, 'maxCouplingMassKg', coupling, 'Masă max. punct cuplare');
  const unbraked = before.find((n) => n >= 400 && n <= 900);
  if (unbraked) setProfile(profile, matched, 'maxUnbrakedTrailerMassKg', unbraked, 'Masă remorcabilă fără frână');
  const braked = before.find(
    (n) => n >= 1000 && n <= 3500 && n !== masses[0] && n !== masses[1] && n !== axles[0] && n !== axles[1],
  );
  if (braked) setProfile(profile, matched, 'maxBrakedTrailerMassKg', braked, 'Masă remorcabilă cu frână');

  const actual = before.find(
    (n) =>
      n >= 1200 &&
      n <= 2800 &&
      n !== masses[0] &&
      n !== masses[1] &&
      n !== axles[0] &&
      n !== axles[1] &&
      n !== braked &&
      n !== curb,
  );
  if (actual) setProfile(profile, matched, 'actualMassKg', actual, 'Masă reală');
}

export function mapCiv2024TextToPreview(
  text: string,
  source: 'text' | 'file',
): CivExtractPreview {
  const pages = splitCivBookPages(text);
  const front = pages.frontRaw || text;
  const verso = pages.versoRaw || pages.techText || text;
  const profile: VehicleCivProfile = {};
  const matched: CivExtractMatch[] = [];
  const meta = {
    vin: findVinInText(text) ?? findVinInText(front),
    civIssuedOn: null as string | null,
    civRarOffice: null as string | null,
    civSeries: null as string | null,
  };

  if (meta.vin) {
    matched.push({ rubric: 'Număr de identificare', target: 'vin', value: meta.vin });
    if (!profile.brand && meta.vin.startsWith('YAR')) {
      setProfile(profile, matched, 'brand', 'TOYOTA', 'Marcă');
    }
  }

  parseFrontIdent(front, profile, matched, meta);
  parseVersoGrid(verso, profile, matched);

  const mentions = parse2024Mentions(front);
  if (mentions) {
    matched.push({ rubric: 'Mențiuni', target: 'civMentions', value: mentions });
  }

  return {
    civProfile: profile,
    civSeries: meta.civSeries,
    civIssuedOn: meta.civIssuedOn,
    civRarOffice: meta.civRarOffice,
    civMentions: mentions,
    vin: meta.vin,
    matched,
    unmatchedLines: [],
    formatUsed: '2024',
    source,
    ocrText: text.slice(0, 100_000),
    hasVerso: Boolean(pages.versoRaw.trim()) || /===\s*CIV\s+VERSO\s*===/i.test(text),
    techPairCount: matched.length,
  };
}
