/**
 * Diag pe PDF-urile CIV Logan din staging (față/verso).
 * npx tsx scripts/diag-logan-pdf-ocr.ts
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { extractCivLabelValuePairs } from '../src/fleet/civ-label-map';
import { mapCivExtractTextToPreview } from '../src/fleet/civ-extract';
import { rebuildCivOcrTextFromVision } from '../src/fleet/civ-ocr-layout';

const DIR = path.join(__dirname, '_civ_preview');

function token() {
  return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
}

function countWords(ann: any): {
  pages: number;
  wordsWithVertices: number;
  wordsWithNormOnly: number;
  width: number;
  height: number;
} {
  let wordsWithVertices = 0;
  let wordsWithNormOnly = 0;
  let width = 0;
  let height = 0;
  for (const page of ann?.pages ?? []) {
    width = page.width ?? width;
    height = page.height ?? height;
    for (const block of page.blocks ?? []) {
      for (const para of block.paragraphs ?? []) {
        for (const word of para.words ?? []) {
          const v = word.boundingBox?.vertices;
          const n = word.boundingBox?.normalizedVertices;
          const hasV = Array.isArray(v) && v.some((p: any) => (p.x ?? 0) > 1 || (p.y ?? 0) > 1);
          const hasN = Array.isArray(n) && n.length > 0;
          if (hasV) wordsWithVertices++;
          else if (hasN) wordsWithNormOnly++;
        }
      }
    }
  }
  return {
    pages: ann?.pages?.length ?? 0,
    wordsWithVertices,
    wordsWithNormOnly,
    width,
    height,
  };
}

async function visionPdf(buf: Buffer, cacheName: string) {
  const cachePath = path.join(DIR, `${cacheName}.ann.json`);
  if (fs.existsSync(cachePath)) {
    return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  }
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
          pages: [1],
        },
      ],
    }),
  });
  const json = (await res.json()) as any;
  if (!res.ok) throw new Error(JSON.stringify(json).slice(0, 800));
  const ann = json.responses?.[0]?.responses?.[0]?.fullTextAnnotation;
  fs.writeFileSync(cachePath, JSON.stringify(ann), 'utf8');
  return ann;
}

async function main() {
  for (const name of ['logan-verso.pdf', 'logan-fata.pdf'] as const) {
    const p = path.join(DIR, name);
    if (!fs.existsSync(p)) {
      console.log('missing', name);
      continue;
    }
    const ann = await visionPdf(fs.readFileSync(p), name);
    const stats = countWords(ann);
    const raw = (ann?.text ?? '').trim();
    const rebuilt = rebuildCivOcrTextFromVision(ann) ?? '';
    fs.writeFileSync(path.join(DIR, `${name}.raw.txt`), raw, 'utf8');
    fs.writeFileSync(path.join(DIR, `${name}.rebuilt.txt`), rebuilt, 'utf8');
    console.log('\n==', name, '==');
    console.log(stats);
    console.log({
      rawChars: raw.length,
      rebuiltChars: rebuilt.length,
      rawPairs: extractCivLabelValuePairs(raw).length,
      rebuiltPairs: extractCivLabelValuePairs(rebuilt).length,
      sample: rebuilt.split('\n').slice(0, 12).join(' | '),
    });
  }

  const front = fs.readFileSync(path.join(DIR, 'logan-fata.pdf.rebuilt.txt'), 'utf8');
  const verso = fs.readFileSync(path.join(DIR, 'logan-verso.pdf.rebuilt.txt'), 'utf8');
  const combined = `=== CIV FAȚĂ ===\n${front}\n\n=== CIV VERSO ===\n${verso}`;
  const preview = mapCivExtractTextToPreview(combined, 'unknown', 'file');
  console.log('\n== preview ==', {
    matched: preview.matched.length,
    hasVerso: preview.hasVerso,
    techPairCount: preview.techPairCount,
    brand: preview.civProfile.brand,
    tip: preview.civProfile.typeVariantVersion,
    commercial: preview.civProfile.commercialName,
    series: preview.civSeries,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
