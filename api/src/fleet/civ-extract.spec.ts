import { mapCiv2024TextToPreview } from './civ-2024-extract';
import { detectCivDocumentFormat, mapCivExtractTextToPreview } from './civ-extract';
import { findCivSeriesInFrontText, stripDanglingCivParens } from './civ-label-map';
import { parseCivFuelTypeText } from './vehicle-fuel-resolve';
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
    expect(g.civProfile.seatsIncludingDriver).toBe(9);
    expect(g.civProfile.maxSpeedKmh).toBe(160);
    expect(g.civSeries).toBe('S869740');
    expect(g.civProfile.bodyType).toMatch(/AF.*utilizare multipl/i);
    expect(g.civProfile.vehicleClass).toBe('-');
    expect(g.civMentions).toMatch(/FILTRU DE PARTICULE/);
    expect(g.civMentions).toMatch(/ASG04_4856239/);
    expect(g.civProfile.typeVariantVersion).toBe('V / A / YHVM-P2S10N(1T)');
    expect(g.civProfile.curbMassKg).toBe(1734);
    expect(g.civProfile.maxBrakedTrailerMassKg).toBe(1400);
    expect(g.civProfile.engineSerial).toBe('FĂRĂ SERIE');
    expect(String(g.civProfile.propulsionSystem)).toMatch(/Motor cu ardere intern/i);
    expect(g.civProfile.nationalEmissionCode).toBe('E6');
    expect(g.civProfile.emissionStandard).toBe('Euro 6; 715/2007*2018/1832 AP');
    expect(g.civProfile.co2Gkm).toBe('NEDC: 138 (g/km) | WLTP: 169 (g/km)');
    expect(String(g.civProfile.tyresFront)).toMatch(/ET46/);
  });

  it('scanul îndreptat citește rubricile după etichetă, nu după poziție', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const ocr = fs.readFileSync(
      path.join(__dirname, '../../scripts/fixtures/civ-2024-proace-derotated.ocr.txt'),
      'utf8',
    );
    const g = mapCivExtractTextToPreview(ocr, 'unknown', 'file');
    expect(g.formatUsed).toBe('2024');

    // Rubricile numerice sunt renumerotate față de 2016 (Lungime e „9”, nu „10”); potrivirea
    // pe textul etichetei le prinde oricum.
    expect(g.civProfile.lengthMm).toBe(5309);
    expect(g.civProfile.wheelbaseMm).toBe(3275);
    expect(g.civProfile.engineCode).toBe('YH01');
    expect(g.civProfile.driveType).toMatch(/FATA/i);

    // Astea lipseau complet cât timp citeam doar pe poziție.
    expect(g.civProfile.maxTechnicalMassKg).toBe(2790);
    expect(g.civProfile.curbMassKg).toBe(1734);
    expect(g.civProfile.axleCount).toBe(2);
    expect(g.civProfile.engineCapacityCm3).toBe(1499);
    expect(g.civProfile.fuelTankCapacityL).toBe(70);
    expect(g.civProfile.maxSpeedKmh).toBe(160);

    // Blocul de identificare stă pe pagina 1 la 2024.
    expect(g.civProfile.brand).toBe('TOYOTA');
    expect(g.civProfile.homologationCategory).toBe('M1');
    expect(g.civProfile.typeVariantVersion).toBe('V / A / YHVM-P2S10N(1T)');
    expect(g.civProfile.typeApprovalNumber).toMatch(/0537/);
    expect(g.civProfile.typeApprovalNumber).not.toMatch(/2017/);
    expect(g.civProfile.vehicleClass).toBe('-');
    expect(g.civSeries).toBe('S869740');
    expect(g.civIssuedOn).toBe('2025-06-23');
    expect(g.civRarOffice).toMatch(/Călărași/i);

    // U.2 e o rubrică proprie („Turație motor” pe card), nu turația nominală de la P.4.
    expect(g.civProfile.stationaryNoiseRpm).toBe(2625);
    expect(g.civProfile.engineRpm).toBe(3500);

    // Scanul la rezoluția lui citește corect 9 la S.1 (rasterizarea PDF îl dădea 6),
    // dar rămâne o rubrică cu sosii, deci tot cerem confirmare.
    expect(g.civProfile.seatsIncludingDriver).toBe(9);
    const seatWarning = g.civWarnings?.find((w) => w.target === 'seatsIncludingDriver');
    expect(seatWarning).toBeDefined();

    // Ștampila reprezentanței vine cu data spațiată de OCR („16 / 06 / 2025”).
    expect(g.civMentions).toContain('FILTRU DE PARTICULE');
    expect(g.civMentions).toContain('REPREZENTANTA CL / ASG04_4856239 / 16/06/2025');

    const filled = Object.values(g.civProfile).filter((v) => v != null && v !== '').length;
    expect(filled).toBeGreaterThanOrEqual(45);
  });

  // Maparea trebuie să vină din reguli, nu din recunoașterea acestui exemplar. Mutăm tot ce
  // ar putea fi memorat și cerem același număr de câmpuri ca pe scanul original.
  describe('nu e potrivită pe Proace', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const ocr = fs.readFileSync(
      path.join(__dirname, '../../scripts/fixtures/civ-2024-proace-derotated.ocr.txt'),
      'utf8',
    );
    const filled = (text: string) => {
      const g = mapCivExtractTextToPreview(text, 'unknown', 'file');
      return {
        g,
        n: Object.values(g.civProfile).filter((v) => v != null && v !== '').length,
      };
    };
    const reference = filled(ocr).n;

    it('citește marcă și model care nu există în nicio listă din cod', () => {
      const { g, n } = filled(ocr.replace(/TOYOTA/g, 'SSANGYONG').replace(/Proace/g, 'Korando'));
      expect(g.civProfile.brand).toBe('SSANGYONG');
      expect(g.civProfile.commercialName).toBe('Korando');
      expect(n).toBe(reference);
    });

    it('citește reprezentanța RAR dintr-un județ nelistat', () => {
      // RAR are birouri în toate județele; valoarea stă sub etichetă, nu într-un tabel al nostru.
      const { g } = filled(ocr.replace(/Călăraşi/g, 'Vaslui'));
      expect(g.civRarOffice).toBe('Vaslui');
    });

    it('acceptă seria cu altă literă și altă grupare a cifrelor', () => {
      const { g } = filled(ocr.replace(/RO S 869 740/g, 'RO B 4477 12'));
      expect(g.civSeries).toBe('B447712');
    });

    it('pune „-” la clasă pe orice categorie în afară de M2/M3, nu doar pe M1', () => {
      const { g, n } = filled(
        ocr.replace(/Categorie de omologare: M1/, 'Categorie de omologare: N1'),
      );
      expect(g.civProfile.homologationCategory).toBe('N1');
      expect(g.civProfile.vehicleClass).toBe('-');
      expect(n).toBe(reference);
    });

    it('rămâne completă pe un vehicul străin de fixture din toate punctele', () => {
      const { g, n } = filled(
        ocr
          .replace(/TOYOTA/g, 'SSANGYONG')
          .replace(/Proace/g, 'Korando')
          .replace(/YARVAYHVMGZ008341/g, 'KPTS0B1DSMP123456')
          .replace(/Călăraşi/g, 'Vaslui')
          .replace(/RO S 869 740/g, 'RO B 4477 12')
          .replace(/Categorie de omologare: M1/, 'Categorie de omologare: N1')
          .replace(/conducătorului auto: 9/, 'conducătorului auto: 3'),
      );
      expect(n).toBe(reference);
      expect(g.civProfile.seatsIncludingDriver).toBe(3);
      expect(g.civProfile.engineCapacityCm3).toBe(1499);
    });
  });
});

describe('CIV 2024 grid — D.2 / S.1 / V.9 fără tokeni de marcă', () => {
  it('compune D.2 din celule (familie + cod + nT), nu din YHVM', () => {
    const text = `
=== CIV FAȚĂ ===
23-06-2025 2007 WXYZ
AAAAAAAAAAAAAAAAA
Q7M12B
2T ) C D

=== CIV VERSO ===
F.1 N.1 P.1
5309 1920
`;
    const g = mapCiv2024TextToPreview(text, 'text');
    expect(g.civProfile.typeVariantVersion).toBe('D / C / WXYZ-Q7M12B(2T)');
  });

  it('S.1 din grilă când cifra ≠ Euro (E6 + 5 locuri)', () => {
    const g = mapCiv2024TextToPreview(
      `=== CIV VERSO ===\nE6 Alb 5 0 160 80 2625 68 xx\nF.1 N.1 P.1\n5309\n`,
      'text',
    );
    expect(g.civProfile.seatsIncludingDriver).toBe(5);
  });

  it('nu inventează 9 locuri când E6 se ciocnește cu cifra 6 din OCR', () => {
    const g = mapCiv2024TextToPreview(
      `=== CIV VERSO ===\nE6 Gri 6 0 160 80 2625 68 xx\nF.1 N.1 P.1\n5309\n`,
      'text',
    );
    expect(g.civProfile.seatsIncludingDriver).toBeUndefined();
  });

  it('AF + M1 nu înseamnă 9 locuri (coliziune E6/6 rămâne gol)', () => {
    const g = mapCiv2024TextToPreview(
      `=== CIV FAȚĂ ===
AF
cu utilizare multiplă
Autoturism M1

=== CIV VERSO ===
E6 Gri 6 0 160 80 2625 68 xx
F.1 N.1 P.1
5309
`,
      'text',
    );
    expect(g.civProfile.homologationCategory).toBe('M1');
    expect(g.civProfile.bodyType).toMatch(/AF/i);
    expect(g.civProfile.seatsIncludingDriver).toBeUndefined();

    const seats = g.civWarnings?.find((w) => w.target === 'seatsIncludingDriver');
    expect(seats?.rubric).toBe('S.1');
    expect(seats?.read).toBe('6');
    expect(seats?.candidates[0]).toBe('9');
    expect(seats?.message).toMatch(/Euro 6/);
  });

  it('semnalează S.1 imposibil pentru categorie (M1 cu 12 locuri)', () => {
    const g = mapCiv2024TextToPreview(
      `=== CIV FAȚĂ ===
Autoturism M1

=== CIV VERSO ===
E6 Alb 12 0 160 80 2625 68 xx
F.1 N.1 P.1
5309
`,
      'text',
    );
    expect(g.civProfile.seatsIncludingDriver).toBeUndefined();
    expect(g.civWarnings?.[0]?.message).toMatch(/imposibil pe categoria M1/);
  });

  it('S.1 plauzibil nu produce avertisment', () => {
    const g = mapCiv2024TextToPreview(
      `=== CIV VERSO ===\nE6 Alb 5 0 160 80 2625 68 xx\nF.1 N.1 P.1\n5309\n`,
      'text',
    );
    expect(g.civProfile.seatsIncludingDriver).toBe(5);
    expect(g.civWarnings ?? []).toHaveLength(0);
  });

  it('V.9 din regulamente UE fragmentate (nu șir hardcodat Proace)', () => {
    const g = mapCiv2024TextToPreview(
      `=== CIV VERSO ===
Euro 6
715
2007
*
2018
1832
AP
F.1 N.1 P.1
5309
`,
      'text',
    );
    expect(g.civProfile.emissionStandard).toBe('Euro 6; 715/2007*2018/1832 AP');
  });

  it('V.9 Euro 5 + 715/2007*692/2008', () => {
    const g = mapCiv2024TextToPreview(
      `=== CIV VERSO ===
Euro 5; 715/2007*692/2008
F.1 N.1 P.1
5309
`,
      'text',
    );
    expect(g.civProfile.emissionStandard).toBe('Euro 5; 715/2007*692/2008');
  });
});

describe('CIV 2024 — UAT-036 (PHEV / serie / dată / paranteze)', () => {
  it('nu lipește S + Data eliberării într-o serie falsă', () => {
    expect(
      findCivSeriesInFrontText(`S eliberare
08: e1 * 2007 / 46 * 1918 * 10 (
3560 XX1`),
    ).toBeNull();
  });

  it('barcode-ul rupt Proace rămâne S869740', () => {
    expect(
      findCivSeriesInFrontText(`S eliberare vehicul VEHICULULUI
86: e2 * cu
23-06-2025 2007 YHVM
9740 AF183D0901G65E6`),
    ).toBe('S869740');
  });

  it('P.3 colectează BENZINA + ELECTRIC, fără ELECTRIC din glosarul EN', () => {
    const g = mapCiv2024TextToPreview(
      `
=== CIV FAȚĂ ===
Vehicle Identity Card
Mențiuni: FILTRU DE PARTICULE PHEV PLUG-IN
Categorie de folosință: AUTOTURISM )
Număr omologare de tip: e1 * 2007 / 46 * 1918 * 10 (
Data eliberării: 14/03/2024
eliberare 05/10/2021

=== CIV VERSO ===
F.1 N.1 P.1
5309
P.3. Tip combustibil sau sursă de energie: BENZINA + ELECTRIC
Electric motor power the fuel source
MOTORINA glossary noise
`,
      'text',
    );
    expect(g.civProfile.fuelType).toBe('BENZINA + ELECTRIC');
    expect(g.civProfile.usageCategory).toMatch(/^AUTOTURISM$/i);
    expect(String(g.civProfile.typeApprovalNumber ?? '')).not.toMatch(/\($/);
    expect(g.civMentions).toMatch(/FILTRU DE PARTICULE/);
    expect(g.civMentions).toMatch(/PHEV/);
    expect(g.civMentions).toMatch(/PLUG-IN/);
    expect(parseCivFuelTypeText(g.civProfile.fuelType)).toBe('hybrid');
  });

  it('eticheta Data eliberării nu e suprascrisă de o dată mai veche lângă eliberare', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const ocr = fs.readFileSync(
      path.join(__dirname, '../../scripts/fixtures/civ-2024-proace-derotated.ocr.txt'),
      'utf8',
    );
    const poisoned = ocr.replace('=== CIV FAȚĂ ===', '=== CIV FAȚĂ ===\neliberare 05/10/2021\n');
    const g = mapCivExtractTextToPreview(poisoned, 'unknown', 'file');
    expect(g.civIssuedOn).toBe('2025-06-23');
    expect(g.civSeries).toBe('S869740');
    expect(g.civProfile.fuelType).toMatch(/MOTORINA/i);
  });

  // Scanul real BMW X5 xDrive45e (B108VDF): față cu glosar englezesc și barcode degradat,
  // verso citit curat pe etichete. Complementul Proace-ului, care are fața rotită.
  describe('scan real BMW X5 xDrive45e', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const ocr = fs.readFileSync(
      path.join(__dirname, '../../scripts/fixtures/civ-2024-bmw-b108vdf.ocr.txt'),
      'utf8',
    );
    const g = mapCivExtractTextToPreview(ocr, 'unknown', 'file');

    it('citește identificarea și motorizarea de pe verso', () => {
      expect(g.civProfile.brand).toBe('BMW');
      expect(g.civProfile.commercialName).toMatch(/X5 xDrive45e/i);
      expect(g.vin).toBe('WBATA610209F62120');
      expect(g.civProfile.fuelType).toBe('BENZINA + ELECTRIC');
      expect(parseCivFuelTypeText(g.civProfile.fuelType)).toBe('hybrid');
      expect(g.civProfile.usageCategory).toMatch(/^AUTOTURISM$/i);
      expect(String(g.civProfile.typeApprovalNumber ?? '')).not.toMatch(/\($/);
    });

    it('ia data eliberării de pe verso, nu „Data naşterii” de pe față', () => {
      expect(g.civIssuedOn).toBe('2021-02-11');
    });

    it('nu inventează serie din glosarul englezesc (Soho s 0 8 3 5 6 0)', () => {
      expect(g.civSeries).toBeNull();
      const warning = g.civWarnings?.find((w) => w.target === 'civSeries');
      expect(warning?.message).toMatch(/Completează seria/i);
    });

    it('citește caseta Mențiuni întreagă, nu doar fraza cunoscută', () => {
      expect(g.civMentions).toContain('FILTRU DE PARTICULE');
      expect(g.civMentions).toMatch(/CINT \/ TVV: ACBM350811YP1E6/);
      expect(g.civMentions).toMatch(/275 \/ 45 R20/);
      expect(g.civMentions).toMatch(/265 \/ 50 R19/);
      // Blocul se oprește înainte de glosarul englezesc de pe față.
      expect(g.civMentions).not.toMatch(/Registration certificate/i);
      expect(g.civMentions).not.toMatch(/ARVAL/i);
    });

    it('nu raportează mențiuni pe care cardul nu le are', () => {
      expect(g.civMentions).not.toMatch(/PHEV/);
    });
  });

  it('stripDanglingCivParens lasă (1T) intact', () => {
    expect(stripDanglingCivParens('YHVM-P2S10N(1T)')).toBe('YHVM-P2S10N(1T)');
    expect(stripDanglingCivParens('( 1T )')).toBe('( 1T )');
    expect(stripDanglingCivParens('AUTOTURISM )')).toBe('AUTOTURISM');
    expect(stripDanglingCivParens('e1 * 2007 / 46 * 1918 * 10 (')).toBe('e1 * 2007 / 46 * 1918 * 10');
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
