/**
 * OCR Vision pe PDF CIV Proace (B 15 NPY) față+verso, apoi mapare.
 * npx tsx scripts/ocr-civ-proace.ts
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { GoogleAuth } from 'google-auth-library';
import { rebuildCivOcrTextFromVision } from '../src/fleet/civ-ocr-layout';
import { detectCivDocumentFormat, mapCivExtractTextToPreview } from '../src/fleet/civ-extract';

const DIR = join(__dirname, '_civ_preview/proace');
const PROJECT = process.env.GCP_PROJECT_ID || 'hybrid-entropy-494218-u2';

async function token() {
  try {
    return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
  } catch {
    const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-vision'] });
    const client = await auth.getClient();
    const t = await client.getAccessToken();
    const value = typeof t === 'string' ? t : t?.token;
    if (!value) throw new Error('No Vision token');
    return value;
  }
}

async function visionPdf(buf: Buffer, name: string) {
  // Anotarea brută se păstrează pe disc: rebuild-ul se poate reface fără un nou apel Vision.
  const cache = join(DIR, `${name}.ann.json`);
  if (existsSync(cache)) {
    const ann = JSON.parse(readFileSync(cache, 'utf8'));
    return (rebuildCivOcrTextFromVision(ann)?.trim() || ann?.text?.trim() || '') as string;
  }
  const accessToken = await token();
  const res = await fetch('https://vision.googleapis.com/v1/files:annotate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'x-goog-user-project': PROJECT,
    },
    body: JSON.stringify({
      requests: [
        {
          inputConfig: { mimeType: 'application/pdf', content: buf.toString('base64') },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          pages: [1],
        },
      ],
    }),
  });
  const json = (await res.json()) as {
    error?: { message?: string };
    responses?: Array<{
      error?: { message?: string };
      responses?: Array<{
        error?: { message?: string };
        fullTextAnnotation?: { text?: string; pages?: unknown[] };
      }>;
    }>;
  };
  if (!res.ok) throw new Error(`Vision HTTP ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
  if (json.error?.message) throw new Error(json.error.message);
  const page = json.responses?.[0]?.responses?.[0];
  if (page?.error?.message) throw new Error(page.error.message);
  const ann = page?.fullTextAnnotation;
  if (ann) writeFileSync(cache, JSON.stringify(ann), 'utf8');
  const rebuilt = rebuildCivOcrTextFromVision(ann as Parameters<typeof rebuildCivOcrTextFromVision>[0]);
  return (rebuilt?.trim() || ann?.text?.trim() || '') as string;
}

async function main() {
  const fata = join(DIR, 'fata.pdf');
  const verso = join(DIR, 'verso.pdf');
  if (!existsSync(fata) || !existsSync(verso)) {
    console.error('Missing', fata, 'or', verso);
    process.exit(1);
  }
  console.log('OCR față', readFileSync(fata).length, 'bytes');
  const front = await visionPdf(readFileSync(fata), 'fata');
  writeFileSync(join(DIR, 'fata.ocr.txt'), front);
  console.log('OCR verso', readFileSync(verso).length, 'bytes');
  const back = await visionPdf(readFileSync(verso), 'verso');
  writeFileSync(join(DIR, 'verso.ocr.txt'), back);

  const combined = `=== CIV FAȚĂ ===\n${front}\n\n=== CIV VERSO ===\n${back}`;
  writeFileSync(join(DIR, 'combined.ocr.txt'), combined);
  const fmt = detectCivDocumentFormat(combined);
  const p = mapCivExtractTextToPreview(combined, 'unknown', 'file');
  const keys = Object.entries(p.civProfile).filter(([, v]) => v != null && v !== '');
  console.log({
    detect: fmt,
    formatUsed: p.formatUsed,
    mappingSkipped: p.mappingSkipped,
    mappingSkipReason: p.mappingSkipReason,
    matched: p.matched.length,
    techPairCount: p.techPairCount,
    hasVerso: p.hasVerso,
    vin: p.vin,
    civSeries: p.civSeries,
    brand: p.civProfile.brand,
    commercial: p.civProfile.commercialName,
    keys: keys.map(([k, v]) => `${k}=${v}`),
    ocrHeadFront: front.slice(0, 600),
    ocrHeadVerso: back.slice(0, 600),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
