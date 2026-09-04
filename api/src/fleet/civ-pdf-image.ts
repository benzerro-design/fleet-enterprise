import { deflateSync, inflateSync } from 'node:zlib';

/**
 * CIV-urile scanate sunt, în practică, o singură imagine împachetată în PDF.
 * Trimis la Vision ca PDF, Google îl rasterizează singur, la o rezoluție pe care nu
 * o controlăm — de acolo venea confuzia 6/9 la S.1 pe un scan de 300 DPI.
 *
 * Scoatem imaginea exact cum stă în fișier, fără reeșantionare: JPEG-ul trece octet
 * cu octet, pixelii bruți se reîmpachetează în PNG. Nu mărim și nu „curățăm” nimic —
 * plafonul de informație e scanul, nu DPI-ul la care am desena noi. Orientarea rămâne
 * treaba derotării din civ-ocr-layout, care lucrează pe coordonate.
 */
export interface CivPdfImage {
  mime: 'image/jpeg' | 'image/png';
  data: Buffer;
  width: number;
  height: number;
}

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

function decodeImage(dict: string, stream: Buffer): CivPdfImage | null {
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
    return { mime: 'image/jpeg', data: stream, width, height };
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
  return { mime: 'image/png', data: encodePng(pixels, width, height, channels), width, height };
}

/**
 * Imaginile de pagină dintr-un PDF de CIV, în ordinea din fișier.
 * Gol înseamnă „nu e un scan simplu” — apelantul trebuie să cadă înapoi pe files:annotate.
 */
export function extractCivPdfImages(pdf: Buffer): CivPdfImage[] {
  const text = pdf.toString('latin1');

  const offsets = new Map<number, number>();
  for (const m of text.matchAll(/(?:^|[\s>])(\d+)\s+\d+\s+obj\b/g)) {
    offsets.set(Number(m[1]), m.index! + m[0].length);
  }

  const images: CivPdfImage[] = [];
  for (const [, start] of offsets) {
    const streamAt = text.indexOf('stream', start);
    if (streamAt < 0) continue;
    // Majoritatea obiectelor n-au stream; fără limita asta ar împrumuta stream-ul următorului.
    const endAt = text.indexOf('endobj', start);
    if (endAt >= 0 && endAt < streamAt) continue;
    const dict = text.slice(start, streamAt);
    if (!/\/Subtype\s*\/Image\b/.test(dict)) continue;

    const length = resolveLength(dict, text, offsets);
    if (!length || length <= 0) continue;
    // După cuvântul `stream` vine CRLF sau LF, apoi imediat octeții.
    const dataAt = streamAt + 6 + (text.startsWith('\r\n', streamAt + 6) ? 2 : 1);
    if (dataAt + length > pdf.length) continue;

    const image = decodeImage(dict, pdf.subarray(dataAt, dataAt + length));
    if (!image) continue;
    if (image.data.length > MAX_ENCODED_BYTES) continue;
    images.push(image);
    if (images.length > MAX_IMAGES) return [];
  }
  return images;
}
