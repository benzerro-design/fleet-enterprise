import { decode as decodeJpeg, encode as encodeJpeg } from 'jpeg-js';
import { PNG } from 'pngjs';
import { parseCivSeriesFromBarcode } from './civ-label-map';

/**
 * Benzile de pe cele 4 muchii ale paginii, rotite cu muchia lungă orizontală.
 * Acolo stă barcode-ul seriei CIV (RAR: jos-dreapta pe p1); după scan, muchia e necunoscută.
 * Nu e o decupare pe specimen — aceleași 4 muchii pe orice față.
 */
export function encodeCivMarginStripJpegs(imageBuf: Buffer): Buffer[] {
  const rgba = decodeRgba(imageBuf);
  if (!rgba) return [];
  return marginRects(rgba.width, rgba.height)
    .map((r) => cropRgba(rgba.data, rgba.width, r.x, r.y, r.w, r.h))
    .map((img) => (img.width >= img.height ? img : rotateRgba90cw(img)))
    .map((img) => Buffer.from(encodeJpeg(img, 92).data));
}

/**
 * Text OCR de pe o bandă de muchie: human-readable-ul de lângă barcode
 * (`O 8 3 5 6 0 1` sau `O835601` sau `0835601` cu O citit 0).
 */
export function parseCivSeriesFromMarginOcr(text: string): string | null {
  const spaced = [
    ...text.matchAll(/\b([A-Z0-9])(?:[\s.,]+)(\d)(?:[\s.,]+)(\d)(?:[\s.,]+)(\d)(?:[\s.,]+)(\d)(?:[\s.,]+)(\d)(?:[\s.,]+)(\d)\b/gi),
  ];
  for (const m of spaced) {
    const compact = `${m[1]}${m[2]}${m[3]}${m[4]}${m[5]}${m[6]}${m[7]}`.toUpperCase();
    const series = parseCivSeriesFromBarcode(compact);
    if (series) return series;
  }
  const glued = [...text.matchAll(/(?<![A-Z0-9])([A-Z0]\d{6})(?![A-Z0-9])/gi)];
  for (const m of glued) {
    const series = parseCivSeriesFromBarcode(m[1]!.toUpperCase());
    if (series) return series;
  }
  return null;
}

function decodeRgba(buf: Buffer): { data: Buffer; width: number; height: number } | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8) {
    try {
      const img = decodeJpeg(buf, { maxResolutionInMP: 40, useTArray: true });
      return { data: Buffer.from(img.data), width: img.width, height: img.height };
    } catch {
      return null;
    }
  }
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50) {
    try {
      const img = PNG.sync.read(buf);
      return { data: Buffer.from(img.data), width: img.width, height: img.height };
    } catch {
      return null;
    }
  }
  return null;
}

function marginRects(
  width: number,
  height: number,
): Array<{ x: number; y: number; w: number; h: number }> {
  const band = Math.max(80, Math.min(240, Math.round(Math.min(width, height) * 0.16)));
  return [
    { x: 0, y: 0, w: width, h: band },
    { x: width - band, y: 0, w: band, h: height },
    { x: 0, y: height - band, w: width, h: band },
    { x: 0, y: 0, w: band, h: height },
  ];
}

function cropRgba(
  src: Buffer,
  srcW: number,
  x0: number,
  y0: number,
  cw: number,
  ch: number,
): { data: Buffer; width: number; height: number } {
  const data = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    src.copy(data, y * cw * 4, ((y0 + y) * srcW + x0) * 4, ((y0 + y) * srcW + x0 + cw) * 4);
  }
  return { data, width: cw, height: ch };
}

function rotateRgba90cw(img: { data: Buffer; width: number; height: number }): {
  data: Buffer;
  width: number;
  height: number;
} {
  const { width: w, height: h, data: src } = img;
  const data = Buffer.alloc(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      src.copy(data, (x * h + (h - 1 - y)) * 4, (y * w + x) * 4, (y * w + x) * 4 + 4);
    }
  }
  return { data, width: h, height: w };
}
