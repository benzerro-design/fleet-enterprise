import { readFileSync } from 'node:fs';
import path from 'node:path';
import { encodeCivMarginStripJpegs, parseCivSeriesFromMarginOcr } from './civ-barcode';
import { extractCivPdfImages } from './civ-pdf-image';

describe('parseCivSeriesFromMarginOcr', () => {
  it('O spațiat și 0 citit în loc de O dau O835601', () => {
    expect(parseCivSeriesFromMarginOcr('O 8 3 5 6 0 1')).toBe('O835601');
    expect(parseCivSeriesFromMarginOcr('0 8 3 5 6 0 1')).toBe('O835601');
    expect(parseCivSeriesFromMarginOcr('O835601')).toBe('O835601');
  });

  it('nu inventează serie din CUI sau date', () => {
    expect(parseCivSeriesFromMarginOcr('18824870')).toBeNull();
    expect(parseCivSeriesFromMarginOcr('10.05.2021')).toBeNull();
  });

  it('Proace pe muchie rămâne S869740', () => {
    expect(parseCivSeriesFromMarginOcr('S 8 6 9 7 4 0')).toBe('S869740');
    expect(parseCivSeriesFromMarginOcr('RO S 8 6 9 7 4 0')).toBe('S869740');
  });
});

describe('encodeCivMarginStripJpegs', () => {
  it('scoate 4 JPEG-uri de pe fața BMW, rotite pe orizontală', () => {
    const pdf = readFileSync(
      path.join(__dirname, '../../scripts/_civ_preview/bmw-b108vdf-fata.pdf'),
    );
    const [img] = extractCivPdfImages(pdf);
    const strips = encodeCivMarginStripJpegs(img!.data);
    expect(strips).toHaveLength(4);
    for (const s of strips) {
      expect(s[0]).toBe(0xff);
      expect(s[1]).toBe(0xd8);
      expect(s.length).toBeGreaterThan(800);
    }
  });
});
