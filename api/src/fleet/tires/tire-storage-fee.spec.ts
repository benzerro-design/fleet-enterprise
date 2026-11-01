import {
  dominantRimInchFromSizes,
  parseRimInchFromTireSize,
  parseTireStorageFeeBandsInput,
  resolveTireStorageFeeCents,
} from './tire-storage-fee';

describe('tire-storage-fee', () => {
  describe('parseRimInchFromTireSize', () => {
    it('parses spaced and compact sizes', () => {
      expect(parseRimInchFromTireSize('205/55 R16')).toBe(16);
      expect(parseRimInchFromTireSize('205/55R16')).toBe(16);
      expect(parseRimInchFromTireSize('265/50 R19 110W')).toBe(19);
      expect(parseRimInchFromTireSize('junk')).toBeNull();
    });
  });

  describe('dominantRimInchFromSizes', () => {
    it('picks mode then max on tie', () => {
      expect(dominantRimInchFromSizes(['205/55 R16', '205/55 R16', '225/45 R17'])).toBe(16);
      expect(dominantRimInchFromSizes(['205/55 R16', '225/45 R17'])).toBe(17);
    });
  });

  describe('resolveTireStorageFeeCents', () => {
    const catalog = {
      tireStorageFeeTyreOnlyCents: 10000,
      tireStorageFeeOnRimCents: 15000,
      tireStorageFeeBands: [
        { maxRimInch: 16, tyreOnlyCents: 8000, onRimCents: 12000 },
        { maxRimInch: 18, tyreOnlyCents: 11000, onRimCents: 16000 },
      ],
    };

    it('uses matching band by rim and mountedAs', () => {
      expect(
        resolveTireStorageFeeCents({ catalog, mountedAs: 'tyre_only', rimInch: 16 }),
      ).toBe(8000);
      expect(
        resolveTireStorageFeeCents({ catalog, mountedAs: 'on_rim', rimInch: 17 }),
      ).toBe(16000);
      expect(
        resolveTireStorageFeeCents({ catalog, mountedAs: 'tyre_only', rimInch: 19 }),
      ).toBe(11000);
    });

    it('falls back to flat defaults when no rim', () => {
      expect(
        resolveTireStorageFeeCents({ catalog, mountedAs: 'on_rim', rimInch: null }),
      ).toBe(15000);
    });
  });

  describe('parseTireStorageFeeBandsInput', () => {
    it('parses RON bands', () => {
      expect(
        parseTireStorageFeeBandsInput([
          { maxRimInch: 16, tyreOnlyRon: '80', onRimRon: '120' },
        ]),
      ).toEqual([{ maxRimInch: 16, tyreOnlyCents: 8000, onRimCents: 12000 }]);
    });
  });
});
