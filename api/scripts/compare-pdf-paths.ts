/**
 * Aceleași PDF-uri, pe ambele căi: files:annotate (Google rasterizează) vs
 * imaginea scoasă din PDF la rezoluția scanului. npx ts-node scripts/compare-pdf-paths.ts
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { GoogleAuth } from 'google-auth-library';
import { rebuildCivOcrTextFromVision } from '../src/fleet/civ-ocr-layout';
import { mapCivExtractTextToPreview } from '../src/fleet/civ-extract';
import { extractCivPdfImages } from '../src/fleet/civ-pdf-image';

async function token() {
  try {
    return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
  } catch {
    const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-vision'] });
    const t = await auth.getClient().then((c) => c.getAccessToken());
    const v = typeof t === 'string' ? t : t?.token;
    if (!v) throw new Error('No Vision token');
    return v;
  }
}

async function vision(url: string, request: unknown): Promise<string> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [request] }),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  const json: any = await res.json();
  const out: string[] = [];
  for (const r of json.responses ?? []) {
    for (const p of r.responses ?? [r]) {
      const ann = p.fullTextAnnotation;
      if (ann) out.push(rebuildCivOcrTextFromVision(ann)?.trim() || ann.text?.trim() || '');
    }
  }
  return out.filter(Boolean).join('\n\n');
}

const asPdf = (buf: Buffer) =>
  vision('https://vision.googleapis.com/v1/files:annotate', {
    inputConfig: { mimeType: 'application/pdf', content: buf.toString('base64') },
    features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
    pages: [1],
  });

const asImage = (buf: Buffer) =>
  vision('https://vision.googleapis.com/v1/images:annotate', {
    image: { content: buf.toString('base64') },
    features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
  });

async function run(label: string, fata: string, verso: string) {
  const [fBuf, vBuf] = [readFileSync(fata), readFileSync(verso)];

  const viaPdf = `=== CIV FAȚĂ ===\n${await asPdf(fBuf)}\n\n=== CIV VERSO ===\n${await asPdf(vBuf)}`;
  const fImg = extractCivPdfImages(fBuf)[0]!;
  const vImg = extractCivPdfImages(vBuf)[0]!;
  const viaImg = `=== CIV FAȚĂ ===\n${await asImage(fImg.data)}\n\n=== CIV VERSO ===\n${await asImage(vImg.data)}`;

  for (const [how, text] of [
    ['files:annotate (Google rasterizează)', viaPdf],
    [`imagine ${fImg.width}x${fImg.height} din PDF`, viaImg],
  ] as const) {
    const g = mapCivExtractTextToPreview(text, 'unknown', 'file');
    const filled = Object.values(g.civProfile).filter((v) => v != null && v !== '').length;
    console.log(
      `${label} | ${how.padEnd(38)} format=${g.formatUsed} câmpuri=${filled} ` +
        `S.1=${g.civProfile.seatsIncludingDriver ?? '-'} serie=${g.civSeries ?? '-'}`,
    );
  }
}

void (async () => {
  await run(
    'Proace 2024',
    'scripts/_civ_preview/proace/fata.pdf',
    'scripts/_civ_preview/proace/verso.pdf',
  );
  await run(
    'Logan  2016',
    'scripts/_civ_preview/logan-fata.pdf',
    'scripts/_civ_preview/logan-verso.pdf',
  );
})();
