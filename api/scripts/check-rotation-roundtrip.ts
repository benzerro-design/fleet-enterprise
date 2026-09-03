/**
 * Verifică pe răspunsuri Vision REALE că derotarea reface același text la 0/90/180/270.
 * Fișierele .ann.json sunt scanuri locale (netrackate) — scriptul le sare dacă lipsesc.
 *
 * npx tsx scripts/check-rotation-roundtrip.ts
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { detectCivScanRotation, rebuildCivOcrTextFromVision } from '../src/fleet/civ-ocr-layout';
import { mapCivExtractTextToPreview } from '../src/fleet/civ-extract';

/** Ce contează de fapt: aceleași rubrici mapate, nu text identic la nivel de octet. */
function fieldsOf(text: string): string {
  const p = mapCivExtractTextToPreview(text, 'unknown', 'file');
  const profile = Object.entries(p.civProfile)
    .filter(([, v]) => v != null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`);
  return JSON.stringify({
    vin: p.vin,
    serie: p.civSeries,
    emis: p.civIssuedOn,
    rar: p.civRarOffice,
    format: p.formatUsed,
    profile,
  });
}

type Vertex = { x?: number; y?: number };

const SAMPLES = [
  '_civ_preview/logan-verso.pdf.ann.json',
  '_civ_preview/logan-fata.pdf.ann.json',
  '_civ_preview/fiesta-civ.p1-2.ann.json',
];

function rotateVertex(p: Vertex, deg: number, w: number, h: number): Vertex {
  const x = p.x ?? 0;
  const y = p.y ?? 0;
  if (deg === 90) return { x: h - y, y: x };
  if (deg === 180) return { x: w - x, y: h - y };
  return { x: y, y: w - x };
}

function rotateAnnotation(ann: any, deg: number): any {
  return {
    ...ann,
    pages: (ann.pages ?? []).map((page: any) => {
      // Sursa poate fi normalizată (0–1) sau pixeli; rotim în propriul cadru.
      const usesNorm = (page.blocks ?? []).some((b: any) =>
        (b.paragraphs ?? []).some((p: any) =>
          (p.words ?? []).some((wd: any) => wd.boundingBox?.normalizedVertices?.length),
        ),
      );
      const w = usesNorm ? 1 : (page.width ?? 0);
      const h = usesNorm ? 1 : (page.height ?? 0);
      const swap = deg !== 180;
      return {
        ...page,
        width: swap ? page.height : page.width,
        height: swap ? page.width : page.height,
        blocks: (page.blocks ?? []).map((block: any) => ({
          ...block,
          paragraphs: (block.paragraphs ?? []).map((para: any) => ({
            ...para,
            words: (para.words ?? []).map((wd: any) => {
              const bb = wd.boundingBox ?? {};
              const out: any = {};
              if (bb.vertices?.length) {
                out.vertices = bb.vertices.map((v: Vertex) =>
                  rotateVertex(v, deg, page.width ?? 0, page.height ?? 0),
                );
              }
              if (bb.normalizedVertices?.length) {
                out.normalizedVertices = bb.normalizedVertices.map((v: Vertex) =>
                  rotateVertex(v, deg, w, h),
                );
              }
              return { ...wd, boundingBox: out };
            }),
          })),
        })),
      };
    }),
  };
}

let checked = 0;
let failed = 0;

for (const rel of SAMPLES) {
  const path = join(__dirname, rel);
  if (!existsSync(path)) {
    console.log(`skip (lipsește local): ${rel}`);
    continue;
  }
  const ann = JSON.parse(readFileSync(path, 'utf8'));
  const upright = rebuildCivOcrTextFromVision(ann) ?? '';
  const uprightRotation = detectCivScanRotation(ann);
  console.log(`\n=== ${rel}`);
  console.log(`   orientare detectată: ${uprightRotation}°, linii: ${upright.split('\n').length}`);

  const uprightFields = fieldsOf(upright);

  for (const deg of [90, 180, 270]) {
    checked++;
    const turned = rebuildCivOcrTextFromVision(rotateAnnotation(ann, deg)) ?? '';
    const sameText = turned === upright;
    const sameFields = fieldsOf(turned) === uprightFields;
    if (sameFields) {
      console.log(`   ${deg}° OK — câmpuri identice${sameText ? ', text identic' : ', text ușor regrupat'}`);
      continue;
    }
    failed++;
    const a = upright.split('\n');
    const b = turned.split('\n');
    const diffLines = a.filter((line, i) => line !== b[i]).length;
    console.log(`   ${deg}° CÂMPURI DIFERITE (${diffLines}/${a.length} linii diferă)`);
    console.log(`      drept: ${uprightFields.slice(0, 400)}`);
    console.log(`      rotit: ${fieldsOf(turned).slice(0, 400)}`);
  }
}

console.log(`\n${checked - failed}/${checked} rotații refac textul paginii drepte.`);
