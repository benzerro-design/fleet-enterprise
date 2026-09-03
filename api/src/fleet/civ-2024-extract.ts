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

  const tvv = pickTypeVariantVersion(front);
  if (tvv) {
    setProfile(profile, matched, 'typeVariantVersion', tvv, 'Tip – variantă – versiune');
  }

  pickClassAndBody(front, profile, matched);

  const series = findCivSeriesInFrontText(front);
  if (series) {
    meta.civSeries = series;
    matched.push({ rubric: 'Serie CIV', target: 'civSeries', value: series });
  }
}

const D2_STOPWORDS = new Set(
  [
    'TOYOTA',
    'DACIA',
    'FORD',
    'VOLKSWAGEN',
    'VW',
    'RENAULT',
    'SKODA',
    'OPEL',
    'PEUGEOT',
    'CITROEN',
    'FIAT',
    'SEAT',
    'MERCEDES',
    'BMW',
    'AUDI',
    'HYUNDAI',
    'KIA',
    'NISSAN',
    'IVECO',
    'MAN',
    'PROACE',
    'LOGAN',
    'DUSTER',
    'SANDERO',
    'TRANSIT',
    'CRAFTER',
    'SPRINTER',
    'MASTER',
    'BOXER',
    'JUMPER',
    'VITO',
    'TRANSPORTER',
    'CADDY',
    'KANGOO',
    'PARTNER',
    'AUTO',
    'CARD',
    'DATE',
    'SERIE',
    'MARCA',
    'TIP',
    'RAR',
    'CIV',
    'VIN',
    'STANDARD',
    'IDENTITY',
    'VEHICLE',
    'ROMAN',
    'REGISTRUL',
    'IDENTITATE',
    'VEHICULULUI',
    'AUTOTURISM',
    'AUTOUTILITARA',
    'CAROSERIE',
    'CLASA',
    'CATEGORIE',
    'VERSIUNE',
    'VARIANTA',
    'DENUMIRE',
    'NUMAR',
    'UTILIZARE',
    'MULTIPLA',
    'ELIBERARE',
    'REPREZENTANTA',
  ].map((s) => s.toUpperCase()),
);

/** Zona de valori D.2: după data eliberării (nu stickerul din Mențiuni). */
function d2ValueZone(front: string): string {
  for (const m of front.matchAll(/(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{4})/g)) {
    const raw = m[1]!;
    if (isStickerDate(front, raw)) continue;
    return front.slice(m.index ?? 0);
  }
  return front;
}

/**
 * D.2 pe grila 2024: celule Tip | Variantă | Versiune, OCR-ul le dumped lângă VIN.
 * Versiunea e familia + codul (LITERE + LITERE/CIFRE), opțional (nT); tip/variantă
 * stau după „nT )” — ordine de tipar RTL (D.3 D.2 D.1), nu tokeni de marcă.
 */
function isD2HeaderLeak(tok: string | undefined): boolean {
  if (!tok) return true;
  return /^(MARC|MARCA|DENUMIRE|VERSIUNE|VARIANTA|NUMAR|CATEGORIE|IDENTIFICARE|COMERCIALA)$/i.test(
    tok,
  );
}

function pickTypeVariantVersion(front: string): string | null {
  const labeledTipRaw =
    /\bTip\s*:\s*([A-Z0-9]{1,8})\b/i.exec(front)?.[1] ||
    /\bD\.?\s*2\.?\s*Tip\s*:\s*([A-Z0-9]{1,8})\b/i.exec(front)?.[1];
  const labeledVariantRaw = /\bVariant[aă]\s*:\s*([A-Z0-9]{1,14})\b/i.exec(front)?.[1];
  const labeledVersionRaw = /\bVersiune\s*:\s*([A-Z0-9()\-]{3,40})\b/i.exec(front)?.[1];
  const labeledTip = isD2HeaderLeak(labeledTipRaw) ? undefined : labeledTipRaw;
  const labeledVariant = isD2HeaderLeak(labeledVariantRaw) ? undefined : labeledVariantRaw;
  const labeledVersion = isD2HeaderLeak(labeledVersionRaw) ? undefined : labeledVersionRaw;
  if (labeledTip || labeledVariant || labeledVersion) {
    const parts = [labeledTip, labeledVariant, labeledVersion]
      .filter(Boolean)
      .map((s) => String(s).toUpperCase());
    if (parts.length >= 2) return parts.join(' / ');
    if (parts.length === 1) return parts[0]!;
  }

  const zone = d2ValueZone(front);
  const axle = /\b(\dT)\s*\)/.exec(zone)?.[1]?.toUpperCase();
  const tail = /\dT\s*\)\s*([A-Z0-9]{1,4})\s+([A-Z0-9]{1,4})\b/.exec(zone);
  const variant = tail?.[1]?.toUpperCase() ?? null;
  const tip = tail?.[2]?.toUpperCase() ?? null;

  const joined = /\b(?=[A-Z0-9-]*[A-Z])([A-Z0-9]{2,8})-([A-Z0-9]{3,14})(?:\((\dT)\))?\b/i.exec(
    zone,
  );
  let version: string | null = null;
  if (joined && !/^\d{2,4}-\d{2,4}/.test(joined[0]!)) {
    version = `${joined[1]!.toUpperCase()}-${joined[2]!.toUpperCase()}`;
    const joinedAxle = joined[3]?.toUpperCase();
    if (joinedAxle) version += `(${joinedAxle})`;
  }

  if (!version) {
    const family = [...zone.matchAll(/\b([A-Z]{3,8})(?!\p{L})/gu)]
      .map((m) => m[1]!.toUpperCase())
      .find((tok) => !D2_STOPWORDS.has(tok) && tok !== 'THE' && tok !== 'ROM');
    const code = [...zone.matchAll(/\b([A-Z]{1,4}\d[A-Z0-9]{2,8})\b/g)]
      .map((m) => m[1]!.toUpperCase())
      .find((tok) => tok.length <= 10 && !/^AF\d{3}/.test(tok));
    if (family && code) version = `${family}-${code}`;
  }

  if (version && axle && !/\(\dT\)$/.test(version)) version += `(${axle})`;

  if (tip && variant && version) return `${tip} / ${variant} / ${version}`;
  if (tip && variant) return `${tip} / ${variant}`;
  if (version) return version;
  return null;
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

/** S.1 etichetat — unica sursă sigură când OCR amestecă cifra cu Euro n. */
function pickSeatsFromLabel(
  verso: string,
  profile: VehicleCivProfile,
  matched: CivExtractMatch[],
) {
  const labeled =
    /S\.?\s*1\.?\s*Num[aă]r\s+locuri[\s\S]{0,80}?:\s*(\d{1,2})/i.exec(verso) ||
    /S\.?\s*1\.?\s*Num[aă]r\s+locuri[\s\S]{0,80}?(\d{1,2})/i.exec(verso) ||
    /Num[aă]r\s+locuri[,\s]+inclusiv[\s\S]{0,60}?:\s*(\d{1,2})/i.exec(verso) ||
    /Num[aă]r\s+locuri[,\s]+inclusiv[\s\S]{0,60}?(\d{1,2})/i.exec(verso) ||
    /conduc[aă]torului\s+auto\s*:\s*(\d{1,2})/i.exec(verso);
  if (!labeled) return;
  const n = Number(labeled[1]);
  if (n >= 1 && n <= 70 && n !== 16 && n !== 17 && n !== 18) {
    setProfile(profile, matched, 'seatsIncludingDriver', n, 'Număr locuri (cu șofer)');
  }
}

const EMISSION_BASES = ['715/2007', '595/2009', '168/2013'] as const;
const EMISSION_AMENDS = ['692/2008', '2017/1151', '2018/1832', '582/2011'] as const;

function hasRegCitation(text: string, id: string): boolean {
  const [a, b] = id.split('/');
  if (!a || !b) return false;
  if (new RegExp(`\\b${a}\\s*/\\s*${b}\\b`).test(text)) return true;
  const ia = text.search(new RegExp(`\\b${a}\\b`));
  const ib = text.search(new RegExp(`\\b${b}\\b`));
  if (ia < 0 || ib < 0) return false;
  return Math.abs(ia - ib) < 400;
}

function pickEuroLevel(verso: string): string | null {
  const full = /\bEuro\s*(\d[a-zA-Z-]{0,10})/i.exec(verso);
  if (full) return `Euro ${full[1]!.replace(/-+$/g, '')}`.replace(/\s+/g, ' ').trim();
  const code = /\bE(\d)\b/.exec(verso);
  if (code) return `Euro ${code[1]}`;
  return null;
}

function pickEmissionStage(verso: string): string | null {
  const around =
    /(?:V\.?\s*9|Euro|poluare|715|595|168)[\s\S]{0,220}?\b(AP|AM|AT|AX)\b/i.exec(verso) ||
    /\b(AP|AM|AT|AX)\b[\s\S]{0,220}?(?:V\.?\s*9|Euro|poluare|715)/i.exec(verso);
  return around?.[1]?.toUpperCase() ?? null;
}

/**
 * V.9 — etichetă, șir deja lipit, sau reconstituire din regulamente UE (nu un singur act).
 */
function pickEmissionStandard(verso: string): string | null {
  const labeled = /V\.?\s*9\.?\s*Norm[aă][\s\S]{0,40}?:\s*([^\n]{8,80})/i.exec(verso)?.[1]?.trim();
  if (labeled && /Euro/i.test(labeled)) {
    return labeled.replace(/\s+/g, ' ').replace(/\s*;\s*/g, '; ');
  }

  const joined =
    /\bEuro\s*(\d[a-zA-Z-]{0,10})\s*;\s*(\d{3,4}\/\d{4}(?:\s*\*\s*\d{3,4}\/\d{4})*)(?:\s+(AP|AM|AT|AX)\b)?/i.exec(
      verso,
    );
  if (joined) {
    const regs = joined[2]!.replace(/\s+/g, '');
    const stage = joined[3] ? ` ${joined[3]!.toUpperCase()}` : '';
    return `Euro ${joined[1]!.replace(/-+$/g, '')}; ${regs}${stage}`.replace(/\s+/g, ' ').trim();
  }

  const euro = pickEuroLevel(verso);
  const bases = EMISSION_BASES.filter((id) => hasRegCitation(verso, id));
  const amends = EMISSION_AMENDS.filter((id) => hasRegCitation(verso, id));
  const regs = [...bases, ...amends];
  const stage = pickEmissionStage(verso);
  if (euro && regs.length) {
    return `${euro}; ${regs.join('*')}${stage ? ` ${stage}` : ''}`;
  }
  if (euro) return euro;
  return null;
}

/** M1 + caroserie AF / utilizare multiplă — plafon legal 9 locuri, fără S.2. */
function isM1PeopleCarrier(profile: VehicleCivProfile): boolean {
  if (!/^M1/i.test(String(profile.homologationCategory ?? ''))) return false;
  const body = String(profile.bodyType ?? '');
  return /\bAF\b/i.test(body) || /utilizare multipl/i.test(stripDiacritics(body));
}

function parseVersoCapacity(verso: string, profile: VehicleCivProfile, matched: CivExtractMatch[]) {
  pickSeatsFromLabel(verso, profile, matched);

  /**
   * Rând 16→W: E{n} culoare S.1 S.2 T. U.1…
   * Dacă S.1 = cifra Euro (E6+6), nu lua 6. Pe M1+AF (plafon 9) e OCR 9↔6.
   */
  const coded = /\b(E\d)\s+(Gri|Alb|Negru|Albastru|Rosu|Roșu|Maro|Verde|Argintiu|Bej|Galben|Portocaliu)\s+(\d{1,2})\s+(\d{1,2})\s+(\d{2,3})\s+(\d{2,3})\s+(\d{4})\s+(\d{2,3})/i.exec(
    verso,
  );
  const colorOnly = /\b(Gri|Alb|Negru|Albastru|Rosu|Roșu|Maro|Verde|Argintiu|Bej|Galben|Portocaliu)\b/i.exec(
    verso,
  )?.[1];

  if (coded) {
    setProfile(profile, matched, 'nationalEmissionCode', coded[1]!.toUpperCase(), 'Cod național emisii');
    setProfile(profile, matched, 'color', coded[2]!.toUpperCase(), 'Culoare');
    const afterColor = Number(coded[3]);
    const euroDigit = Number(coded[1]!.replace(/\D/g, ''));
    const standing = Number(coded[4]);
    const speed = Number(coded[5]);
    const noise = Number(coded[6]);
    const noiseRpm = Number(coded[7]);
    const moving = Number(coded[8]);
    if (afterColor >= 2 && afterColor <= 9 && afterColor !== euroDigit) {
      setProfile(profile, matched, 'seatsIncludingDriver', afterColor, 'Număr locuri (cu șofer)');
    } else if (
      afterColor === euroDigit &&
      euroDigit === 6 &&
      standing === 0 &&
      isM1PeopleCarrier(profile)
    ) {
      // OCR 9↔6 lângă E6. M1 + AF (plafon 9, fără locuri în picioare) → 9, nu gol.
      setProfile(profile, matched, 'seatsIncludingDriver', 9, 'Număr locuri (cu șofer)');
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
  } else if (colorOnly) {
    setProfile(profile, matched, 'color', colorOnly.toUpperCase(), 'Culoare');
  }

  if (!profile.nationalEmissionCode) {
    const labeled16 = /16\.?\s*Cod\s+na[tț]ional[\s\S]{0,40}?:\s*([A-Z0-9]+)/i.exec(verso)?.[1];
    if (labeled16) {
      setProfile(profile, matched, 'nationalEmissionCode', labeled16.toUpperCase(), 'Cod național emisii');
    }
  }

  if (!profile.nationalEmissionCode) {
    const emCode = /\b((?:AE|EE|AA|EA)\s*\d{2,3})\b/i.exec(verso)?.[1];
    if (emCode) {
      setProfile(
        profile,
        matched,
        'nationalEmissionCode',
        emCode.replace(/\s+/g, '').toUpperCase(),
        'Cod național emisii',
      );
    }
  }

  const euro = pickEmissionStandard(verso);
  if (euro) setProfile(profile, matched, 'emissionStandard', euro, 'Normă poluare');

  const co2Labeled =
    /NEDC:\s*(\d+)\s*\(g\/km\)\s*\|\s*WLTP:\s*(\d+)\s*\(g\/km\)/i.exec(verso) ||
    /WLTP:\s*(\d+)\s*\(g\/km\)[\s\S]{0,40}?NEDC:\s*(\d+)/i.exec(verso);
  if (co2Labeled) {
    const a = co2Labeled[1]!;
    const b = co2Labeled[2]!;
    const nedcVal = /NEDC:\s*(\d+)/i.exec(verso)?.[1] ?? a;
    const wltpVal = /WLTP:\s*(\d+)/i.exec(verso)?.[1] ?? b;
    setProfile(
      profile,
      matched,
      'co2Gkm',
      `NEDC: ${nedcVal} (g/km) | WLTP: ${wltpVal} (g/km)`,
      'CO₂',
    );
  } else {
  const wltp =
    /\b(1\d{2})\b[^0-9]{0,40}7\s*[.,]0\s*J/i.exec(verso)?.[1] ||
    /\b(1\d{2})\b[\s\S]{0,40}?WLTP/i.exec(verso)?.[1];
  const nedc =
    /\b(1\d{2})\b[^0-9]{0,20}215\s*\/\s*65/i.exec(verso)?.[1] ||
    /\b(1\d{2})\b[\s\S]{0,40}?NEDC/i.exec(verso)?.[1];
  if (wltp && nedc && wltp !== nedc) {
    setProfile(
      profile,
      matched,
      'co2Gkm',
      `NEDC: ${nedc} (g/km) | WLTP: ${wltp} (g/km)`,
      'CO₂',
    );
  } else {
    const co2 = wltp ?? nedc;
    if (co2 && Number(co2) >= 80 && Number(co2) <= 280) {
      setProfile(profile, matched, 'co2Gkm', co2, 'CO₂');
    }
  }
  }

  const tank = /\b(?:ET\d{2,3}\s+){1,2}(\d{2})\b/.exec(verso)?.[1];
  if (tank) {
    const n = Number(tank);
    if (n >= 40 && n <= 120) setProfile(profile, matched, 'fuelTankCapacityL', n, 'Capacitate rezervor');
  }

  const drive = /\b(FATA|SPATE|INTEGRALA|4X4)\b/i.exec(verso)?.[1];
  if (drive) {
    setProfile(profile, matched, 'driveType', stripDiacritics(drive).toUpperCase(), 'Tracțiune');
  }

  const prop = stripDiacritics(verso);
  if (/\bmotor\s+cu\s+ardere\s+interna\b/i.test(prop) || (/\bmotor\b/i.test(prop) && /\bardere\b/i.test(prop))) {
    setProfile(profile, matched, 'propulsionSystem', 'Motor cu ardere internă', 'Sistem propulsie');
  }

  // P.5 — inclusiv „Fără serie” tipărit pe CIV (nu lăsa gol = fals OCR fail).
  if (/\bFARA\b/i.test(prop) && /\bSERIE\b/i.test(prop)) {
    setProfile(profile, matched, 'engineSerial', 'FĂRĂ SERIE', 'Serie motor');
  } else if (/\bFARA\s*\/\s*/i.test(verso) && /\bSERIE\b/i.test(verso)) {
    setProfile(profile, matched, 'engineSerial', 'FĂRĂ SERIE', 'Serie motor');
  }
}

function parseTyresAndSuspension(
  verso: string,
  profile: VehicleCivProfile,
  matched: CivExtractMatch[],
) {
  const size = /(\d{3})\s*\/\s*(\d{2})(?!\d)/.exec(verso);
  const radius = /\bR\s*(\d{2}C?)\b/i.exec(verso);
  const rim = /(\d(?:[.,]\d)?)\s*J\s*x\s*(\d{2})/i.exec(verso);
  const load = /\b(10[0-9][A-Z]|9[0-9][A-Z])\b/.exec(verso);
  const offset = /\b(ET\d{2,3})\b/i.exec(verso)?.[1]?.toUpperCase();
  const width = size ? Number(size[1]) : 0;
  const aspect = size ? Number(size[2]) : 0;
  const tyreOk = width >= 155 && width <= 325 && aspect >= 35 && aspect <= 85;
  if (size && radius && tyreOk) {
    // Format CIV: „215/65 R16C 106T/7.0Jx16 ET46”
    const loadRim = [load?.[1], rim ? `${rim[1]!.replace(',', '.')}Jx${rim[2]}` : null]
      .filter(Boolean)
      .join('/');
    const spec = [`${size[1]}/${size[2]} R${radius[1]}`, loadRim || null, offset]
      .filter(Boolean)
      .join(' ')
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

  /**
   * Ordine rubrici înainte de lungime (9):
   * L, F.1, 6, N.1, N.2, [N.3–N.5 goale pe 2 axe], G, 7, O.1, O.2, 8
   * Exemplu Proace: 2 2790 4190 1500 1500 1734 1910 1400 750 84 5309…
   * → G=1734, O.1=1400 (nu curb din „MOTORINA 1832”, nu O.1=1734).
   */
  const axleCount = before[0];
  if (axleCount != null && axleCount >= 1 && axleCount <= 5) {
    setProfile(profile, matched, 'axleCount', axleCount, 'Număr axe');
  }
  if (before[1] != null && before[1] >= 900) {
    setProfile(profile, matched, 'maxTechnicalMassKg', before[1], 'Masă maximă tehnic admisă');
  }
  if (before[2] != null && before[2] > (before[1] ?? 0)) {
    setProfile(profile, matched, 'maxTrainMassKg', before[2], 'MTMA ansamblu vehicule');
  }
  if (before[3] != null && before[3] >= 800 && before[3] <= 2500) {
    setProfile(profile, matched, 'axle1MaxMassKg', before[3], 'MTMA axa 1');
  }
  if (before[4] != null && before[4] >= 800 && before[4] <= 2500) {
    setProfile(profile, matched, 'axle2MaxMassKg', before[4], 'MTMA axa 2');
  }

  const rest = before.slice(5);
  const twoAxlePacked =
    (axleCount === 2 || axleCount == null) &&
    rest.length >= 5 &&
    rest[0]! >= 900 &&
    rest[0]! <= 3500 &&
    rest[3]! >= 400 &&
    rest[3]! <= 900 &&
    rest[4]! >= 50 &&
    rest[4]! <= 150;

  if (twoAxlePacked) {
    setProfile(profile, matched, 'curbMassKg', rest[0], 'Masă în ordine de mers');
    if (rest[1]! >= 900 && rest[1]! <= 3500) {
      setProfile(profile, matched, 'actualMassKg', rest[1], 'Masă reală');
    }
    if (rest[2]! >= 800 && rest[2]! <= 3500) {
      setProfile(profile, matched, 'maxBrakedTrailerMassKg', rest[2], 'Masă remorcabilă cu frână');
    }
    setProfile(profile, matched, 'maxUnbrakedTrailerMassKg', rest[3], 'Masă remorcabilă fără frână');
    setProfile(profile, matched, 'maxCouplingMassKg', rest[4], 'Masă max. punct cuplare');
  } else {
    const coupling = before.find((n) => n >= 50 && n <= 150);
    if (coupling) setProfile(profile, matched, 'maxCouplingMassKg', coupling, 'Masă max. punct cuplare');
    const unbraked = before.find((n) => n >= 400 && n <= 900);
    if (unbraked) {
      setProfile(profile, matched, 'maxUnbrakedTrailerMassKg', unbraked, 'Masă remorcabilă fără frână');
    }
  }
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
