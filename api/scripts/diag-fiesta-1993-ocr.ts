/**
 * OCR Vision pe PDF CIV Fiesta + mapare 1993.
 * npx tsx scripts/diag-fiesta-1993-ocr.ts
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { rebuildCivOcrTextFromVision } from '../src/fleet/civ-ocr-layout';
import { mapCivExtractTextToPreview, detectCivDocumentFormat } from '../src/fleet/civ-extract';

const DIR = path.join(__dirname, '_civ_preview');
const PDF = path.join(DIR, 'fiesta-civ.pdf');

function token() {
  return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
}

async function visionPdfPages(buf: Buffer, pages: number[]) {
  const cache = path.join(DIR, `fiesta-civ.p${pages.join('-')}.ann.json`);
  if (fs.existsSync(cache)) return JSON.parse(fs.readFileSync(cache, 'utf8'));
  const accessToken = token();
  const res = await fetch('https://vision.googleapis.com/v1/files:annotate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'x-goog-user-project': 'hybrid-entropy-494218-u2',
    },
    body: JSON.stringify({
      requests: [
        {
          inputConfig: {
            mimeType: 'application/pdf',
            content: buf.toString('base64'),
          },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          pages,
        },
      ],
    }),
  });
  const json = (await res.json()) as any;
  if (!res.ok) throw new Error(JSON.stringify(json).slice(0, 800));
  const anns = (json.responses?.[0]?.responses ?? []).map(
    (r: any) => r.fullTextAnnotation,
  );
  fs.writeFileSync(cache, JSON.stringify(anns), 'utf8');
  return anns;
}

async function main() {
  if (!fs.existsSync(PDF)) throw new Error('missing fiesta-civ.pdf');
  const buf = fs.readFileSync(PDF);
  const anns = await visionPdfPages(buf, [1, 2]);
  const parts: string[] = [];
  for (let i = 0; i < anns.length; i++) {
    const rebuilt = rebuildCivOcrTextFromVision(anns[i]) ?? anns[i]?.text ?? '';
    const label = i === 0 ? 'CIV FAȚĂ' : 'CIV VERSO';
    parts.push(`=== ${label} ===\n${rebuilt}`);
    fs.writeFileSync(path.join(DIR, `fiesta-p${i + 1}.rebuilt.txt`), rebuilt, 'utf8');
  }
  const combined = parts.join('\n\n');
  fs.writeFileSync(path.join(DIR, 'fiesta-combined.ocr.txt'), combined, 'utf8');
  const fmt = detectCivDocumentFormat(combined);
  const p = mapCivExtractTextToPreview(combined, 'unknown', 'file');
  console.log({
    format: fmt,
    formatUsed: p.formatUsed,
    matched: p.matched.length,
    tech: p.techPairCount,
    brand: p.civProfile.brand,
    tip: p.civProfile.typeVariantVersion,
    commercial: p.civProfile.commercialName,
    vin: p.vin,
    series: p.civSeries,
    year: p.civProfile.manufactureYear,
    keys: Object.keys(p.civProfile).filter((k) => p.civProfile[k] != null && p.civProfile[k] !== ''),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
