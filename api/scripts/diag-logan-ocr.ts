/**
 * Diagnostic: Vision OCR + rebuild pe bounding box vs text brut.
 * npx tsx scripts/diag-logan-ocr.ts
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { extractCivLabelValuePairs } from '../src/fleet/civ-label-map';
import { splitCivBookPages } from '../src/fleet/civ-pages';
import { mapCivExtractTextToPreview } from '../src/fleet/civ-extract';
import { rebuildCivOcrTextFromVision } from '../src/fleet/civ-ocr-layout';

const JPG = path.join(__dirname, '_civ_preview/civ.jpg');

function token() {
  return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
}

async function visionRaw(buf: Buffer) {
  const accessToken = token();
  const res = await fetch('https://vision.googleapis.com/v1/images:annotate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'x-goog-user-project': 'hybrid-entropy-494218-u2',
    },
    body: JSON.stringify({
      requests: [
        {
          image: { content: buf.toString('base64') },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        },
      ],
    }),
  });
  const json = (await res.json()) as any;
  if (!res.ok) throw new Error(JSON.stringify(json).slice(0, 500));
  return json.responses?.[0]?.fullTextAnnotation;
}

async function main() {
  const ann = await visionRaw(fs.readFileSync(JPG));
  const raw = (ann?.text ?? '').trim();
  const rebuilt = rebuildCivOcrTextFromVision(ann) ?? '';
  fs.writeFileSync(path.join(__dirname, '_civ_preview/logan-ocr-raw.txt'), raw, 'utf8');
  fs.writeFileSync(path.join(__dirname, '_civ_preview/logan-ocr-rebuilt.txt'), rebuilt, 'utf8');

  console.log('raw chars', raw.length, 'rebuilt chars', rebuilt.length);
  console.log('raw pairs', extractCivLabelValuePairs(raw).length);
  console.log('rebuilt pairs', extractCivLabelValuePairs(rebuilt).length);
  console.log('rebuilt sample:\n', rebuilt.split('\n').slice(0, 25).join('\n'));

  const combined = `=== CIV FAȚĂ ===\n${rebuilt}\n\n=== CIV VERSO ===\n${rebuilt}`;
  const pages = splitCivBookPages(combined);
  const preview = mapCivExtractTextToPreview(combined, 'unknown', 'file');
  const keys = Object.keys(preview.civProfile).filter(
    (k) => preview.civProfile[k] != null && preview.civProfile[k] !== '',
  );
  console.log({
    techPairs: extractCivLabelValuePairs(pages.techText).length,
    brand: preview.civProfile.brand,
    vin: preview.vin,
    civSeries: preview.civSeries,
    matched: preview.matched.length,
    profileFields: keys.length,
    keys: keys.sort(),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
