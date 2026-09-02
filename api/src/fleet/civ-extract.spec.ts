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
