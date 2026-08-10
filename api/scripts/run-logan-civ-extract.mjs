/**
 * OCR + map CIV Logan sample against ground truth.
 * Usage: node scripts/run-logan-civ-extract.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleAuth } from 'google-auth-library';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Use compiled JS if present, else fail with hint
let mapCivExtractTextToPreview;
let detectCivDocumentFormat;
try {
  ({ mapCivExtractTextToPreview, detectCivDocumentFormat } = require('../dist/fleet/civ-extract.js'));
} catch {
  console.error('Build API first: npm run build');
  process.exit(1);
}

const API_URL = (process.env.API_URL ?? 'https://fleet-api-cxsqhb2qmq-ew.a.run.app').replace(/\/$/, '');
const TENANT = process.env.TENANT ?? 'demo';
const ADMIN = { email: 'admin@demo.local', password: 'demo12345' };

const GROUND = {
  brand: 'DACIA',
  typeVariantVersion: 'SD / 7SDCL / 7SDCL5',
  commercialName: 'LOGAN',
  vin: 'UU17SDCL551325663',
  manufactureYear: '2014',
  homologationCategory: 'M1',
  usageCategory: 'AUTOTURISM',
  bodyType: 'AC BREAK',
  engineCode: 'K9K-C6',
  engineCapacityCm3: '1461',
  enginePowerKw: '66',
  fuelType: 'MOTORINA',
  engineSerial: 'R196021',
  color: 'MARO',
  driveType: 'FATA',
  lengthMm: '4494',
  widthMm: '1733',
  heightMm: '1518',
  civIssuedOn: '2022-02-14',
  civRarOffice: 'OB/B2320088',
  civSeries: null, // pe acest scan lipsește / greșită — nu forțăm
};

const IMG =
  process.env.CIV_IMG ??
  path.join(__dirname, '_civ_preview/civ.jpg');
const PDF = process.env.CIV_PDF ?? 'c:/Users/mariu/Downloads/CIV Logan B157EFI.pdf';

async function getAccessToken() {
  // Prefer gcloud user token (local), then ADC.
  try {
    const { execSync } = await import('child_process');
    const t = execSync('gcloud auth print-access-token', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    if (t) return t;
  } catch {
    /* fall through */
  }
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  const value = typeof token === 'string' ? token : token?.token;
  if (!value) throw new Error('No access token — run: gcloud auth login');
  return value;
}

async function visionOcr(buf, isPdf) {
  const accessToken = await getAccessToken();
  const b64 = buf.toString('base64');
  let url;
  let body;
  if (isPdf) {
    url = 'https://vision.googleapis.com/v1/files:annotate';
    body = {
      requests: [
        {
          inputConfig: { content: b64, mimeType: 'application/pdf' },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        },
      ],
    };
  } else {
    url = 'https://vision.googleapis.com/v1/images:annotate';
    body = {
      requests: [
        {
          image: { content: b64 },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        },
      ],
    };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'x-goog-user-project': process.env.GCP_PROJECT_ID || 'hybrid-entropy-494218-u2',
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Vision HTTP ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
  }
  if (isPdf) {
    const pages = json.responses?.[0]?.responses ?? [];
    const text = pages.map((p) => p.fullTextAnnotation?.text ?? '').join('\n').trim();
    const err = json.responses?.[0]?.error || pages.find((p) => p.error)?.error;
    if (err) throw new Error(err.message || JSON.stringify(err));
    return text;
  }
  const r0 = json.responses?.[0];
  if (r0?.error) throw new Error(r0.error.message || JSON.stringify(r0.error));
  return (r0?.fullTextAnnotation?.text ?? '').trim();
}

function norm(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function compare(preview) {
  const p = preview.civProfile || {};
  const rows = [];
  const checks = [
    ['brand', GROUND.brand, p.brand],
    ['vin', GROUND.vin, preview.vin],
    ['manufactureYear', GROUND.manufactureYear, p.manufactureYear],
    ['homologationCategory', GROUND.homologationCategory, p.homologationCategory],
    ['usageCategory', GROUND.usageCategory, p.usageCategory],
    ['engineCode', GROUND.engineCode, p.engineCode],
    ['engineCapacityCm3', GROUND.engineCapacityCm3, p.engineCapacityCm3],
    ['enginePowerKw', GROUND.enginePowerKw, p.enginePowerKw],
    ['fuelType', GROUND.fuelType, p.fuelType],
    ['engineSerial', GROUND.engineSerial, p.engineSerial],
    ['color', GROUND.color, p.color],
    ['bodyType', GROUND.bodyType, p.bodyType],
    ['lengthMm', GROUND.lengthMm, p.lengthMm],
    ['widthMm', GROUND.widthMm, p.widthMm],
    ['heightMm', GROUND.heightMm, p.heightMm],
    ['driveType', GROUND.driveType, p.driveType],
    ['civIssuedOn', GROUND.civIssuedOn, preview.civIssuedOn],
    ['civRarOffice', GROUND.civRarOffice, preview.civRarOffice],
  ];
  let ok = 0;
  for (const [key, expected, got] of checks) {
    const match =
      got != null &&
      got !== '' &&
      (norm(got).includes(norm(expected)) || norm(expected).includes(norm(got)));
    if (match) ok++;
    rows.push({ key, expected, got: got ?? null, match });
  }
  // civSeries: OK dacă e null (nu am pus greșit serie motor)
  const seriesWrong =
    preview.civSeries &&
    norm(preview.civSeries) === norm(String(p.engineSerial ?? GROUND.engineSerial));
  rows.push({
    key: 'civSeries_not_engine',
    expected: '≠ serie motor',
    got: preview.civSeries,
    match: !seriesWrong,
  });
  if (!seriesWrong) ok++;
  rows.push({
    key: 'typeVariantVersion',
    expected: GROUND.typeVariantVersion,
    got: p.typeVariantVersion ?? null,
    match: p.typeVariantVersion ? /SD|7SDCL/i.test(String(p.typeVariantVersion)) : false,
  });
  if (rows[rows.length - 1].match) ok++;
  return { ok, total: rows.length, rows };
}

async function alsoTryStaging(text) {
  try {
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': TENANT },
      body: JSON.stringify({ ...ADMIN, tenantSlug: TENANT }),
    });
    const login = await loginRes.json();
    if (!loginRes.ok || !login.accessToken) {
      console.log('staging login skip', loginRes.status);
      return;
    }
    const vehRes = await fetch(`${API_URL}/fleet/vehicles?page=1&pageSize=1`, {
      headers: {
        Authorization: `Bearer ${login.accessToken}`,
        'X-Tenant-Id': TENANT,
        Accept: 'application/json',
      },
    });
    const veh = await vehRes.json();
    const id = veh.items?.[0]?.id;
    if (!id) {
      console.log('staging: no vehicle');
      return;
    }
    const ex = await fetch(`${API_URL}/fleet/vehicles/${id}/civ/extract-preview`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${login.accessToken}`,
        'X-Tenant-Id': TENANT,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, format: 'unknown' }),
    });
    const body = await ex.json();
    console.log('\n=== STAGING extract-preview ===');
    console.log('HTTP', ex.status, 'format', body.formatUsed, 'matched', body.matched?.length);
    if (!ex.ok) console.log(JSON.stringify(body).slice(0, 500));
  } catch (e) {
    console.log('staging error', e.message);
  }
}

async function main() {
  const usePdf = process.argv.includes('--pdf');
  const file = usePdf ? PDF : IMG;
  if (!fs.existsSync(file)) {
    console.error('Missing file', file);
    process.exit(1);
  }
  const buf = fs.readFileSync(file);
  console.log('OCR file', file, 'bytes', buf.length);
  const text = await visionOcr(buf, usePdf || file.toLowerCase().endsWith('.pdf'));
  console.log('\n=== OCR text (first 1200 chars) ===\n');
  console.log(text.slice(0, 1200));
  console.log('\n... total chars', text.length);

  const detected = detectCivDocumentFormat(text);
  console.log('\nDetected format:', detected);

  for (const fmt of ['unknown', detected, '2024', '2016']) {
    const preview = mapCivExtractTextToPreview(text, fmt, 'file');
    const cmp = compare(preview);
    console.log(`\n=== Map format=${fmt} → used=${preview.formatUsed} matched=${preview.matched.length} score=${cmp.ok}/${cmp.total} ===`);
    for (const r of cmp.rows) {
      console.log(`${r.match ? 'OK' : 'MISS'}\t${r.key}\texpected=${r.expected}\tgot=${r.got}`);
    }
    if (fmt === 'unknown' || fmt === detected) {
      console.log('profile keys:', Object.keys(preview.civProfile || {}).filter((k) => preview.civProfile[k] != null));
    }
  }

  await alsoTryStaging(text);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
