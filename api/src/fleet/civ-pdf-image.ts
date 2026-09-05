import { decode as decodeJpeg } from 'jpeg-js';
import { deflateSync, inflateSync } from 'node:zlib';

/**
 * CIV-urile scanate sunt, în practică, o singură imagine împachetată în PDF.
 * Trimis la Vision ca PDF, Google îl rasterizează singur, la o rezoluție pe care nu
 * o controlăm — de acolo venea confuzia 6/9 la S.1 pe un scan de 300 DPI.
 *
 * Scoatem imaginea exact cum stă în fișier, fără reeșantionare. JPEG-ul trece octet
 * cu octet când e deja drept; pixelii bruți se reîmpachetează în PNG. Nu mărim și
 * nu „curățăm” nimic — plafonul de informație e scanul, nu DPI-ul la care am desena.
 *
 * Rotația 90/180/270 o îndreaptă civ-ocr-layout pe coordonate. Oglindirea nu: Vision
 * citește glife inversate (ATOYOT). Matricea `cm` din pagină spune cum e afișat
 * scanul; o aplicăm pe pixeli înainte de OCR.
 */
export interface CivPdfImage {
  mime: 'image/jpeg' | 'image/png';
  data: Buffer;
  width: number;
  height: number;
}

/** Transformări pe axe, fără interpolare. */
export type AxisImageTransform =
  | 'identity'
  | 'flipH'
  | 'flipV'
  | 'rot180'
  | 'rot90'
  | 'rot270'
  | 'transpose'
  | 'transverse';

type PdfMatrix = [number, number, number, number, number, number];

/** Sub atât sunt sigle și ștampile, nu pagini de CIV. */
const MIN_IMAGE_PIXELS = 400_000;
/** Mai multe imagini mari înseamnă pagină compusă din benzi — nu le putem ordona sigur. */
const MAX_IMAGES = 4;
/** Peste atât, cererea către Vision devine mai scumpă decât câștigul. */
const MAX_ENCODED_BYTES = 15 * 1024 * 1024;

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function pngChunk(type: string, payload: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), payload]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(payload.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

/** Pixeli bruți → PNG. Fără pierdere: PNG stochează exact ce primește. */
function encodePng(pixels: Buffer, width: number, height: number, channels: 1 | 3): Buffer {
  const stride = width * channels;
  // PNG cere un octet de filtru la începutul fiecărei linii; 0 = fără filtru.
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = channels === 1 ? 0 : 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 6 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function dictNumber(dict: string, key: string): number | null {
  const m = new RegExp(`/${key}\\s+(\\d+)`).exec(dict);
  return m ? Number(m[1]) : null;
}

/** `/Length 1234` sau `/Length 12 0 R` — a doua formă trimite la alt obiect. */
function resolveLength(dict: string, text: string, offsets: Map<number, number>): number | null {
  const indirect = /\/Length\s+(\d+)\s+\d+\s+R\b/.exec(dict);
  if (indirect) {
    const at = offsets.get(Number(indirect[1]));
    if (at == null) return null;
    const m = /^\s*(\d+)/.exec(text.slice(at, at + 40));
    return m ? Number(m[1]) : null;
  }
  return dictNumber(dict, 'Length');
}

type DecodedImage =
  | { kind: 'jpeg'; data: Buffer; width: number; height: number }
  | { kind: 'raw'; pixels: Buffer; width: number; height: number; channels: 1 | 3 };

function mulPdfMatrix(A: PdfMatrix, B: PdfMatrix): PdfMatrix {
  const [a, b, c, d, e, f] = A;
  const [a2, b2, c2, d2, e2, f2] = B;
  return [
    a * a2 + c * b2,
    b * a2 + d * b2,
    a * c2 + c * d2,
    b * c2 + d * d2,
    a * e2 + c * f2 + e,
    b * e2 + d * f2 + f,
  ];
}

/** Clasifică o matrice PDF de plasare a imaginii (pătrat unitar, Y în sus). */
export function classifyPdfImageMatrix(a: number, b: number, c: number, d: number): AxisImageTransform | null {
  const eps = 1e-3;
  const axis = Math.abs(b) < eps && Math.abs(c) < eps && Math.abs(a) > eps && Math.abs(d) > eps;
  const swapped = Math.abs(a) < eps && Math.abs(d) < eps && Math.abs(b) > eps && Math.abs(c) > eps;
  if (axis) {
    if (a > 0 && d > 0) return 'identity';
    if (a < 0 && d > 0) return 'flipH';
    if (a > 0 && d < 0) return 'flipV';
    if (a < 0 && d < 0) return 'rot180';
  }
  if (swapped) {
    if (c > 0 && b < 0) return 'rot90';
    if (c < 0 && b > 0) return 'rot270';
    if (c > 0 && b > 0) return 'transpose';
    if (c < 0 && b < 0) return 'transverse';
  }
  return null;
}

function parsePlacementMatrix(content: string): PdfMatrix | null {
  let current: PdfMatrix = [1, 0, 0, 1, 0, 0];
  const stack: PdfMatrix[] = [];
  const nums: number[] = [];
  let lastDo: PdfMatrix | null = null;
  const re = /(-?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?)|\/[A-Za-z0-9._-]+|[qQ]|cm|Do/g;
  for (const m of content.matchAll(re)) {
    if (m[1] != null) {
      nums.push(Number(m[1]));
      continue;
    }
    const op = m[0];
    if (op === 'q') {
      stack.push(current);
    } else if (op === 'Q') {
      current = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    } else if (op === 'cm' && nums.length >= 6) {
      current = mulPdfMatrix(current, nums.slice(-6) as PdfMatrix);
    } else if (op === 'Do') {
      lastDo = current;
    }
    nums.length = 0;
  }
  return lastDo;
}

function pageRotateDegrees(text: string): 0 | 90 | 180 | 270 {
  const found = [...text.matchAll(/\/Rotate\s+(-?\d+)/g)].map((m) => ((Number(m[1]) % 360) + 360) % 360);
  const unique = [...new Set(found)].filter((n) => n === 0 || n === 90 || n === 180 || n === 270);
  if (unique.length === 1) return unique[0] as 0 | 90 | 180 | 270;
  return 0;
}

function rotateToTransform(deg: 0 | 90 | 180 | 270): AxisImageTransform {
  if (deg === 90) return 'rot90';
  if (deg === 180) return 'rot180';
  if (deg === 270) return 'rot270';
  return 'identity';
}

export function transformPixels(
  src: Buffer,
  width: number,
  height: number,
  channels: 1 | 3,
  kind: AxisImageTransform,
): { pixels: Buffer; width: number; height: number } {
  if (kind === 'identity') return { pixels: src, width, height };
  const swap = kind === 'rot90' || kind === 'rot270' || kind === 'transpose' || kind === 'transverse';
  const dw = swap ? height : width;
  const dh = swap ? width : height;
  const dest = Buffer.alloc(dw * dh * channels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let nx = x;
      let ny = y;
      switch (kind) {
        case 'flipH':
          nx = width - 1 - x;
          break;
        case 'flipV':
          ny = height - 1 - y;
          break;
        case 'rot180':
          nx = width - 1 - x;
          ny = height - 1 - y;
          break;
        case 'rot90':
          nx = height - 1 - y;
          ny = x;
          break;
        case 'rot270':
          nx = y;
          ny = width - 1 - x;
          break;
        case 'transpose':
          nx = y;
          ny = x;
          break;
        case 'transverse':
          nx = height - 1 - y;
          ny = width - 1 - x;
          break;
        default:
          break;
      }
      const si = (y * width + x) * channels;
      const di = (ny * dw + nx) * channels;
      src.copy(dest, di, si, si + channels);
    }
  }
  return { pixels: dest, width: dw, height: dh };
}

function jpegToRgb(data: Buffer): { pixels: Buffer; width: number; height: number } | null {
  try {
    const decoded = decodeJpeg(data, { useTArray: true, maxMemoryUsageInMB: 128 });
    const { width, height, data: rgba } = decoded;
    if (!width || !height || !rgba) return null;
    const pixels = Buffer.alloc(width * height * 3);
    for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
      pixels[j] = rgba[i]!;
      pixels[j + 1] = rgba[i + 1]!;
      pixels[j + 2] = rgba[i + 2]!;
    }
    return { pixels, width, height };
  } catch {
    return null;
  }
}

function applyAxisTransforms(image: DecodedImage, steps: AxisImageTransform[]): CivPdfImage | null {
  const needed = steps.filter((s) => s !== 'identity');
  if (!needed.length && image.kind === 'jpeg') {
    return { mime: 'image/jpeg', data: image.data, width: image.width, height: image.height };
  }
  let pixels: Buffer;
  let width = image.width;
  let height = image.height;
  let channels: 1 | 3 = 3;
  if (image.kind === 'jpeg') {
    const rgb = jpegToRgb(image.data);
    if (!rgb) return null;
    pixels = rgb.pixels;
    width = rgb.width;
    height = rgb.height;
  } else {
    pixels = image.pixels;
    channels = image.channels;
  }
  for (const step of needed) {
    const out = transformPixels(pixels, width, height, channels, step);
    pixels = out.pixels;
    width = out.width;
    height = out.height;
  }
  return {
    mime: 'image/png',
    data: encodePng(pixels, width, height, channels),
    width,
    height,
  };
}

function decodeImage(dict: string, stream: Buffer): DecodedImage | null {
  const width = dictNumber(dict, 'Width');
  const height = dictNumber(dict, 'Height');
  if (!width || !height || width * height < MIN_IMAGE_PIXELS) return null;
  if (/\/ImageMask\s+true/.test(dict)) return null;
  // Predictoarele cer reconstrucție linie cu linie; scanerele reale nu le folosesc aici.
  if (/\/Predictor\s+([2-9]|\d\d)/.test(dict)) return null;
  if ((dictNumber(dict, 'BitsPerComponent') ?? 8) !== 8) return null;

  const filters = [...dict.matchAll(/\/(DCTDecode|FlateDecode|JPXDecode|CCITTFaxDecode|JBIG2Decode|LZWDecode|RunLengthDecode|ASCII85Decode|ASCIIHexDecode)\b/g)].map(
    (m) => m[1]!,
  );
  // Un singur filtru, altfel sunt lanțuri pe care nu le desfacem aici.
  if (filters.length !== 1) return null;

  if (filters[0] === 'DCTDecode') {
    if (stream[0] !== 0xff || stream[1] !== 0xd8) return null;
    return { kind: 'jpeg', data: stream, width, height };
  }
  if (filters[0] !== 'FlateDecode') return null;

  let pixels: Buffer;
  try {
    pixels = inflateSync(stream);
  } catch {
    return null;
  }
  // Numărul de canale iese din aritmetică; e mai sigur decât să urmărim arborele
  // de ColorSpace prin referințe indirecte, ICCBased și palete.
  const channels = pixels.length / (width * height);
  if (channels !== 1 && channels !== 3) return null;
  return { kind: 'raw', pixels, width, height, channels };
}

function collectRawStream(
  pdf: Buffer,
  text: string,
  start: number,
  offsets: Map<number, number>,
): { dict: string; raw: Buffer } | null {
  const streamAt = text.indexOf('stream', start);
  if (streamAt < 0) return null;
  const endAt = text.indexOf('endobj', start);
  if (endAt >= 0 && endAt < streamAt) return null;
  const dict = text.slice(start, streamAt);
  const length = resolveLength(dict, text, offsets);
  if (!length || length <= 0) return null;
  const dataAt = streamAt + 6 + (text.startsWith('\r\n', streamAt + 6) ? 2 : 1);
  if (dataAt + length > pdf.length) return null;
  return { dict, raw: pdf.subarray(dataAt, dataAt + length) };
}

function inflateIfNeeded(dict: string, raw: Buffer): Buffer | null {
  if (!/FlateDecode/.test(dict)) return raw;
  try {
    return inflateSync(raw);
  } catch {
    return null;
  }
}

/**
 * Transformarea pe care viewer-ul o aplică imaginii. `null` = nu am găsit matrice,
 * tratăm ca identitate. `'unknown'` = matrice strâmbă — nu ghici, lasă PDF-ul la Vision.
 */
export function detectPdfImageTransform(pdf: Buffer): AxisImageTransform | 'unknown' | null {
  const text = pdf.toString('latin1');
  const offsets = new Map<number, number>();
  for (const m of text.matchAll(/(?:^|[\s>])(\d+)\s+\d+\s+obj\b/g)) {
    offsets.set(Number(m[1]), m.index! + m[0].length);
  }

  const kinds = new Set<AxisImageTransform>();
  let sawMatrix = false;
  for (const [, start] of offsets) {
    const got = collectRawStream(pdf, text, start, offsets);
    if (!got || /\/Subtype\s*\/Image\b/.test(got.dict)) continue;
    const inflated = inflateIfNeeded(got.dict, got.raw);
    if (!inflated) continue;
    const content = inflated.toString('latin1');
    if (!/\bDo\b/.test(content) || !/\bcm\b/.test(content)) continue;
    const matrix = parsePlacementMatrix(content);
    if (!matrix) continue;
    sawMatrix = true;
    const kind = classifyPdfImageMatrix(matrix[0], matrix[1], matrix[2], matrix[3]);
    if (!kind) return 'unknown';
    kinds.add(kind);
  }
  if (!sawMatrix) return null;
  if (kinds.size !== 1) return 'unknown';
  return [...kinds][0]!;
}

/**
 * Imaginile de pagină dintr-un PDF de CIV, în ordinea din fișier, deja puse
 * cum le arată un viewer. Gol înseamnă „nu e un scan simplu” — apelantul cade
 * înapoi pe files:annotate.
 */
export function extractCivPdfImages(pdf: Buffer): CivPdfImage[] {
  const placement = detectPdfImageTransform(pdf);
  if (placement === 'unknown') return [];

  const text = pdf.toString('latin1');
  const offsets = new Map<number, number>();
  for (const m of text.matchAll(/(?:^|[\s>])(\d+)\s+\d+\s+obj\b/g)) {
    offsets.set(Number(m[1]), m.index! + m[0].length);
  }

  const decoded: DecodedImage[] = [];
  for (const [, start] of offsets) {
    const got = collectRawStream(pdf, text, start, offsets);
    if (!got || !/\/Subtype\s*\/Image\b/.test(got.dict)) continue;
    const image = decodeImage(got.dict, got.raw);
    if (!image) continue;
    decoded.push(image);
    if (decoded.length > MAX_IMAGES) return [];
  }

  const steps: AxisImageTransform[] = [];
  if (placement && placement !== 'identity') steps.push(placement);
  const pageRot = rotateToTransform(pageRotateDegrees(text));
  if (pageRot !== 'identity') steps.push(pageRot);

  const images: CivPdfImage[] = [];
  for (const raw of decoded) {
    const out = applyAxisTransforms(raw, steps);
    if (!out || out.data.length > MAX_ENCODED_BYTES) continue;
    images.push(out);
  }
  return images;
}
