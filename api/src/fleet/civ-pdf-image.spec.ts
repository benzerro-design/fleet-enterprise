import { readFileSync } from 'node:fs';
import path from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';
import {
  classifyPdfImageMatrix,
  detectPdfImageTransform,
  extractCivPdfImages,
  transformPixels,
} from './civ-pdf-image';

const fixture = (p: string) => path.join(__dirname, '../../scripts/_civ_preview', p);

/** PDF minimal cu un singur XObject imagine — cât să treacă de parser, nu un PDF valid complet. */
function pdfWithImage(dict: string, stream: Buffer, content?: string): Buffer {
  const parts: Buffer[] = [Buffer.from('%PDF-1.4\n')];
  if (content) {
    parts.push(
      Buffer.from(
        `2 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`,
      ),
    );
  }
  parts.push(Buffer.from(`1 0 obj\n<< ${dict} /Length ${stream.length} >>\nstream\n`));
  parts.push(stream);
  parts.push(Buffer.from('\nendstream\nendobj\n%%EOF\n'));
  return Buffer.concat(parts);
}

const rgbPixels = (w: number, h: number) => Buffer.alloc(w * h * 3, 0x7f);

function pngIdat(png: Buffer): Buffer {
  const parts: Buffer[] = [];
  let i = 8;
  while (i + 12 <= png.length) {
    const len = png.readUInt32BE(i);
    if (png.toString('latin1', i + 4, i + 8) === 'IDAT') {
      parts.push(png.subarray(i + 8, i + 8 + len));
    }
    i += 12 + len;
  }
  return Buffer.concat(parts);
}

describe('extractCivPdfImages', () => {
  it('scoate JPEG-ul octet cu octet, fără reîncodare', () => {
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(900_000, 0x41)]);
    const [img] = extractCivPdfImages(
      pdfWithImage('/Subtype /Image /Width 1000 /Height 900 /BitsPerComponent 8 /Filter /DCTDecode', jpeg),
    );
    expect(img?.mime).toBe('image/jpeg');
    expect(img?.data.equals(jpeg)).toBe(true);
    expect([img?.width, img?.height]).toEqual([1000, 900]);
  });

  it('reîmpachetează pixelii Flate în PNG valid, la aceleași dimensiuni', () => {
    const [img] = extractCivPdfImages(
      pdfWithImage(
        '/Subtype /Image /Width 800 /Height 700 /BitsPerComponent 8 /Filter /FlateDecode',
        deflateSync(rgbPixels(800, 700)),
      ),
    );
    expect(img?.mime).toBe('image/png');
    expect(img?.data.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    // IHDR poartă lățimea și înălțimea pe primii octeți ai payload-ului.
    expect(img!.data.readUInt32BE(16)).toBe(800);
    expect(img!.data.readUInt32BE(20)).toBe(700);
  });

  it('ignoră siglele și ștampilele mici', () => {
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.alloc(4_000, 0x41)]);
    expect(
      extractCivPdfImages(
        pdfWithImage('/Subtype /Image /Width 120 /Height 90 /BitsPerComponent 8 /Filter /DCTDecode', jpeg),
      ),
    ).toEqual([]);
  });

  it('renunță la formatele pe care nu le putem trece fără pierdere', () => {
    const data = Buffer.alloc(900_000, 0x41);
    for (const filter of ['/JPXDecode', '/CCITTFaxDecode', '/JBIG2Decode']) {
      expect(
        extractCivPdfImages(
          pdfWithImage(`/Subtype /Image /Width 1000 /Height 900 /BitsPerComponent 8 /Filter ${filter}`, data),
        ),
      ).toEqual([]);
    }
  });

  it('nu confundă un obiect fără stream cu stream-ul următorului', () => {
    const pdf = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<< /Subtype /Image /Width 1000 /Height 900 >>\nendobj\n' +
        '2 0 obj\n<< /Length 4 >>\nstream\nabcd\nendstream\nendobj\n',
    );
    expect(extractCivPdfImages(pdf)).toEqual([]);
  });

  it('nu se sufocă pe fișiere care nu sunt PDF', () => {
    expect(extractCivPdfImages(Buffer.alloc(0))).toEqual([]);
    expect(extractCivPdfImages(Buffer.from('nu sunt un pdf'))).toEqual([]);
  });

  describe('matricea de plasare', () => {
    it('compune cele trei cm de pe Proace în flip vertical, nu în rotație', () => {
      // Viewer-ul aplică, în ordine: scară Y-jos, încă un flip Y, apoi plasarea imaginii.
      const mul = (
        A: [number, number, number, number, number, number],
        B: [number, number, number, number, number, number],
      ) =>
        [
          A[0] * B[0] + A[2] * B[1],
          A[1] * B[0] + A[3] * B[1],
          A[0] * B[2] + A[2] * B[3],
          A[1] * B[2] + A[3] * B[3],
          A[0] * B[4] + A[2] * B[5] + A[4],
          A[1] * B[4] + A[3] * B[5] + A[5],
        ] as [number, number, number, number, number, number];
      const m1: [number, number, number, number, number, number] = [0.75, 0, 0, -0.75, 0, 792];
      const m2: [number, number, number, number, number, number] = [1, 0, 0, -1, 0, 1056.32];
      const m3: [number, number, number, number, number, number] = [746.72, 0, 0, -1056, 34.72, 1056.16];
      const composed = mul(mul(m1, m2), m3);
      expect(classifyPdfImageMatrix(...composed.slice(0, 4) as [number, number, number, number])).toBe(
        'flipV',
      );
    });

    it('Logan / Fiesta (a>0, d>0) rămân identitate', () => {
      expect(classifyPdfImageMatrix(1913.49, 0, 0, 1403.092)).toBe('identity');
    });

    it('flipV mută primul rând jos, fără interpolare', () => {
      const src = Buffer.from([1, 2, 3, 4, 5, 6]);
      const out = transformPixels(src, 3, 2, 1, 'flipV');
      expect([...out.pixels]).toEqual([4, 5, 6, 1, 2, 3]);
    });

    it('aplică flipV din content stream pe pixeli cunoscuți', () => {
      const w = 800;
      const h = 700;
      const pixels = Buffer.alloc(w * h * 3, 0x7f);
      pixels[0] = 255;
      pixels[1] = 0;
      pixels[2] = 0; // stânga-sus roșu
      const bottom = (h - 1) * w * 3;
      pixels[bottom] = 0;
      pixels[bottom + 1] = 0;
      pixels[bottom + 2] = 255; // stânga-jos albastru
      const pdf = pdfWithImage(
        '/Subtype /Image /Width 800 /Height 700 /BitsPerComponent 8 /Filter /FlateDecode',
        deflateSync(pixels),
        'q 800 0 0 -700 0 700 cm /Im1 Do Q',
      );
      expect(detectPdfImageTransform(pdf)).toBe('flipV');
      const [img] = extractCivPdfImages(pdf);
      expect(img?.mime).toBe('image/png');
      const raw = inflateSync(pngIdat(img!.data));
      const stride = w * 3 + 1;
      expect([raw[1], raw[2], raw[3]]).toEqual([0, 0, 255]);
      const last = (h - 1) * stride;
      expect([raw[last + 1], raw[last + 2], raw[last + 3]]).toEqual([255, 0, 0]);
    });
  });

  describe('pe scanuri reale', () => {
    it('Proace 2024: matricea din pagină e flip vertical, scanul rămâne la 300 DPI', () => {
      const pdf = readFileSync(fixture('proace/fata.pdf'));
      expect(detectPdfImageTransform(pdf)).toBe('flipV');
      const [img] = extractCivPdfImages(pdf);
      expect(img?.mime).toBe('image/png');
      expect([img?.width, img?.height]).toEqual([2480, 3507]);
    }, 60_000);

    it('Logan 2016 (pixeli Flate) iese exact la rezoluția scanului, fără mărire', () => {
      const pdf = readFileSync(fixture('logan-fata.pdf'));
      expect(detectPdfImageTransform(pdf)).toBe('identity');
      const [img] = extractCivPdfImages(pdf);
      expect(img?.mime).toBe('image/png');
      expect([img?.width, img?.height]).toEqual([1912, 1402]);
    });
  });
});
