import { readFileSync } from 'node:fs';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { extractCivPdfImages } from './civ-pdf-image';

const fixture = (p: string) => path.join(__dirname, '../../scripts/_civ_preview', p);

/** PDF minimal cu un singur XObject imagine — cât să treacă de parser, nu un PDF valid complet. */
function pdfWithImage(dict: string, stream: Buffer): Buffer {
  const head = Buffer.from(`%PDF-1.4\n1 0 obj\n<< ${dict} /Length ${stream.length} >>\nstream\n`);
  return Buffer.concat([head, stream, Buffer.from('\nendstream\nendobj\n%%EOF\n')]);
}

const rgbPixels = (w: number, h: number) => Buffer.alloc(w * h * 3, 0x7f);

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

  describe('pe scanuri reale', () => {
    it('Proace 2024 (JPEG) păstrează cei 300 DPI pe care files:annotate îi pierdea', () => {
      const [img] = extractCivPdfImages(readFileSync(fixture('proace/fata.pdf')));
      expect(img?.mime).toBe('image/jpeg');
      expect([img?.width, img?.height]).toEqual([2480, 3507]);
    });

    it('Logan 2016 (pixeli Flate) iese exact la rezoluția scanului, fără mărire', () => {
      const [img] = extractCivPdfImages(readFileSync(fixture('logan-fata.pdf')));
      expect(img?.mime).toBe('image/png');
      expect([img?.width, img?.height]).toEqual([1912, 1402]);
    });
  });
});
