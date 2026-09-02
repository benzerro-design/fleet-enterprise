/**
 * CIV 2024 (Ordin 211) — scan tip grilă, nu „Etichetă: valoare” pe linie ca Logan 2016.
 * Exemplu: Proace B 15 NPY — verso = rând de coduri F.1/N.1/P.1 + rând de numere;
 * glosarul EN e amestecat de OCR și nu trebuie folosit ca perechi.
 */
import type { VehicleCivProfile } from './vehicle-civ-fields';
import { findVinInText, parseCivIssuedOnIso } from './civ-label-map';
import { splitCivBookPages } from './civ-pages';
import type { CivExtractMatch, CivExtractPreview } from './civ-extract';

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '');
}

const BRANDS =
  /\b(TOYOTA|DACIA|FORD|VOLKSWAGEN|VW|RENAULT|SKODA|OPEL|PEUGEOT|CITROEN|FIAT|SEAT|MERCEDES(?:-BENZ)?|BMW|AUDI|HYUNDAI|KIA|NISSAN|IVECO|MAN)\b/i;

const COMMERCIAL =
  /\b(PROACE|LOGAN|DUSTER|SANDERO|TRANSIT|CRAFTER|SPRINTER|MASTER|BOXER|JUMPER|VITO|TRANSPORTER|CADDY|KANGOO|PARTNER)\b/i;

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

  const cat = /\b(M1G?|N1G?|M2|M3|N2|N3|L3e)\b/.exec(front)?.[1];
  if (cat) setProfile(profile, matched, 'homologationCategory', cat.toUpperCase(), 'Categorie omologare');

  const issuedNear =
    /eliberare[\s\S]{0,80}?(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{4})/i.exec(front) ||
    /(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{4})/.exec(front);
  if (issuedNear) {
    meta.civIssuedOn = parseCivIssuedOnIso(issuedNear[1]!) ?? issuedNear[1]!;
    matched.push({ rubric: 'Data eliberării', target: 'civIssuedOn', value: meta.civIssuedOn });
  }

  const issueYear = meta.civIssuedOn ? Number(meta.civIssuedOn.slice(0, 4)) : null;
  const years = [...front.matchAll(/\b((?:19|20)\d{2})\b/g)].map((m) => Number(m[1]));
  const mfr = years.find((y) => y >= 1990 && y <= new Date().getFullYear() && y !== issueYear);
  if (mfr) setProfile(profile, matched, 'manufactureYear', mfr, 'An fabricație');

  const approval = /e\d\s*\*\s*[0-9\s/*]+[A-Z0-9]{3,}/i.exec(front)?.[0];
  if (approval) {
    setProfile(
      profile,
      matched,
      'typeApprovalNumber',
      approval.replace(/\s+/g, ' ').trim(),
      'Număr omologare de tip',
    );
  }

  const nat = /\b([A-Z]{2}\d{2,4}[A-Z0-9]{6,14})\b/.exec(front)?.[1];
  if (nat && nat.length >= 10) {
    setProfile(profile, matched, 'nationalRegisterNumber', nat, 'Număr național de registru');
  }

  const rarCity =
    /\b(Calarasi|Călărași|Bucuresti|București|Cluj|Iasi|Iași|Timisoara|Timișoara|Constanta|Constanța|Brasov|Brașov)\b/i.exec(
      front,
    )?.[1];
  if (rarCity) {
    meta.civRarOffice = rarCity;
    matched.push({ rubric: 'Reprezentanță RAR', target: 'civRarOffice', value: rarCity });
  }

  const body = /\b([A-Z]{1,2}\d{0,2})\s*\)/.exec(front)?.[1];
  if (body && !/^(M1|N1|AF|RO)$/i.test(body)) {
    setProfile(profile, matched, 'bodyType', body.toUpperCase(), 'Caroserie');
  }
}

function parseVersoGrid(verso: string, profile: VehicleCivProfile, matched: CivExtractMatch[]) {
  const fuelRo = /\b(MOTORINA|BENZINA|GPL|HIBRID[AĂ]?)\b/i.exec(verso)?.[1];
  const fuel = fuelRo ?? (/\bELECTRIC\b/i.exec(verso)?.[1]);
  if (fuel) {
    setProfile(profile, matched, 'fuelType', stripDiacritics(fuel).toUpperCase(), 'Combustibil / sursă energie');
  }

  const drive = /\b(FATA|SPATE|INTEGRALA|4X4)\b/i.exec(verso)?.[1];
  if (drive) {
    setProfile(profile, matched, 'driveType', stripDiacritics(drive).toUpperCase(), 'Tracțiune');
  }

  const color = /\b(Gri|Alb|Negru|Albastru|Rosu|Roșu|Maro|Verde|Argintiu|Bej|Galben|Portocaliu)\b/i.exec(
    verso,
  )?.[1];
  if (color) setProfile(profile, matched, 'color', color.toUpperCase(), 'Culoare');

  const tyre = /(\d{3})\s*\/\s*(\d{2})[\s\S]{0,40}?R\s*(\d{2}C?)/i.exec(verso);
  if (tyre) {
    const spec = `${tyre[1]}/${tyre[2]} R${tyre[3]}`.replace(/\s+/g, '');
    setProfile(profile, matched, 'tyresFront', spec, 'Anvelope/jante față');
    setProfile(profile, matched, 'tyresRear', spec, 'Anvelope/jante spate');
  }

  const rim = /(\d(?:[.,]\d)?)\s*J\s*x\s*(\d{2})/i.exec(verso);
  if (rim && profile.tyresFront) {
    const extra = `${profile.tyresFront} / ${rim[1].replace(',', '.')}Jx${rim[2]}`;
    profile.tyresFront = extra;
    profile.tyresRear = extra;
  }

  const susp = /\bMecanica\b|\bMecanică\b/i.test(verso);
  if (susp) {
    setProfile(profile, matched, 'suspensionFront', 'MECANICĂ', 'Suspensie față');
    setProfile(profile, matched, 'suspensionRear', 'MECANICĂ', 'Suspensie spate');
  }

  const euro = /\bEuro\s*([0-9]+)\b/i.exec(verso)?.[1];
  if (euro) setProfile(profile, matched, 'emissionStandard', `Euro ${euro}`, 'Normă poluare');

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
  const rpm = after.find((n) => n >= 2500 && n <= 7000);
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
  const braked = before.find((n) => n >= 1000 && n <= 3500 && n !== masses[0] && n !== masses[1] && n !== axles[0] && n !== axles[1]);
  if (braked) setProfile(profile, matched, 'maxBrakedTrailerMassKg', braked, 'Masă remorcabilă cu frână');
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

  return {
    civProfile: profile,
    civSeries: meta.civSeries,
    civIssuedOn: meta.civIssuedOn,
    civRarOffice: meta.civRarOffice,
    civMentions: null,
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
