import { detectCivDocumentFormat, mapCivExtractTextToPreview } from './civ-extract';
import { parseWebUploadUrl, webUploadObjectKey } from '../storage/web-upload-storage';

const LOGAN = `
=== CIV FAȚĂ ===
Mențiuni:
-
A. Număr de înmatriculare: B-157-EFI
C.2. Proprietar: CARAIAC MARIUS
P 541981

=== CIV VERSO ===
D.1. Marcă: DACIA
P.3. Tip combustibil sau sursă de energie: MOTORINA
`;

const PROACE_2024 = `
=== CIV FAȚĂ ===
Mențiuni:
-
Vehicle Identity Card
A. Număr de înmatriculare: B-15-NPY
Serie CIV: P778899

=== CIV VERSO ===
D.1. Marcă: TOYOTA
D.3. Denumire comercială: PROACE
P.3. Tip combustibil sau sursă de energie: MOTORINA
`;

const VERSO_ONLY_2016 = `
=== CIV VERSO ===
D.1. Marcă: DACIA
P.3. Tip combustibil: MOTORINA
`;

describe('detectCivDocumentFormat', () => {
  it('clasifică Logan (cu proprietar) ca 2016', () => {
    expect(detectCivDocumentFormat(LOGAN)).toBe('2016');
    expect(mapCivExtractTextToPreview(LOGAN, 'unknown', 'text').formatUsed).toBe('2016');
  });

  it('clasifică Proace fără proprietar ca 2024', () => {
    expect(detectCivDocumentFormat(PROACE_2024)).toBe('2024');
    expect(mapCivExtractTextToPreview(PROACE_2024, 'unknown', 'file').formatUsed).toBe('2024');
  });

  it('verso-only 2016 rămâne 2016 (nu 2024)', () => {
    expect(detectCivDocumentFormat(VERSO_ONLY_2016)).toBe('2016');
  });

  it('OCR Proace grilă → 2024, nu standingPlaces din glosar', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const ocr = fs.readFileSync(
      path.join(__dirname, '../../scripts/fixtures/civ-2024-proace.ocr.txt'),
      'utf8',
    );
    expect(detectCivDocumentFormat(ocr)).toBe('2024');
    const g = mapCivExtractTextToPreview(ocr, 'unknown', 'file');
    expect(g.formatUsed).toBe('2024');
    expect(g.civProfile.brand).toBe('TOYOTA');
    expect(g.civProfile.lengthMm).toBe(5309);
    expect(g.civProfile.standingPlaces).not.toBe(3);
    expect(g.civProfile.manufactureYear).toBe(2021);
    expect(g.civProfile.homologationCategory).toBe('M1');
    expect(g.civProfile.engineRpm).toBe(3500);
    expect(g.civIssuedOn).toBe('2025-06-23');
    expect(g.civRarOffice).toMatch(/Călărași/i);
    expect(String(g.civProfile.tyresFront ?? '')).toMatch(/215\/65/);
    expect(g.civProfile.seatsIncludingDriver).toBe(6);
    expect(g.civProfile.maxSpeedKmh).toBe(160);
    expect(g.civSeries).toBe('S869740');
    expect(g.civProfile.bodyType).toMatch(/AF.*utilizare multipl/i);
    expect(g.civProfile.vehicleClass).toBe('-');
    expect(g.civMentions).toMatch(/FILTRU DE PARTICULE/);
    expect(g.civMentions).toMatch(/ASG04_4856239/);
  });
});

describe('parseWebUploadUrl / object key', () => {
  it('parsează /uploads/documents/...', () => {
    const ref = parseWebUploadUrl(
      '/uploads/documents/1788193632745-n6xh68fa-CIV_fa__-Toyota_Proace_-_CIV_-_Fata.pdf',
    );
    expect(ref?.kind).toBe('documents');
    expect(ref?.fileName).toContain('Toyota_Proace');
    expect(webUploadObjectKey(ref!.kind, ref!.fileName)).toBe(
      `uploads/documents/${ref!.fileName}`,
    );
  });
});
