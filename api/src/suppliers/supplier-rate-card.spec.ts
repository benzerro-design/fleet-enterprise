import {
  centsToRonNumber,
  defaultLaborUnitCents,
  effectivePartsDiscountForBasis,
  mergeClientSupplierRateOverlay,
  parseOptionalRonToCents,
  parsePartsPriceBasis,
} from './supplier-rate-card';

describe('supplier-rate-card', () => {
  describe('parsePartsPriceBasis', () => {
    it('acceptă net', () => {
      expect(parsePartsPriceBasis('net')).toBe('net');
    });
    it('default list', () => {
      expect(parsePartsPriceBasis('list')).toBe('list');
      expect(parsePartsPriceBasis(undefined)).toBe('list');
      expect(parsePartsPriceBasis(null)).toBe('list');
      expect(parsePartsPriceBasis('')).toBe('list');
      expect(parsePartsPriceBasis('x')).toBe('list');
      expect(parsePartsPriceBasis('NET')).toBe('list');
    });
  });

  describe('parseOptionalRonToCents', () => {
    it('undefined rămâne absent', () => {
      expect(parseOptionalRonToCents(undefined, 'x')).toBeUndefined();
    });
    it('null/gol șterge', () => {
      expect(parseOptionalRonToCents(null, 'x')).toBeNull();
      expect(parseOptionalRonToCents('', 'x')).toBeNull();
    });
    it('parsează RON cu virgulă', () => {
      expect(parseOptionalRonToCents('180,50', 'x')).toBe(18050);
      expect(parseOptionalRonToCents(' 180,50 ', 'x')).toBe(18050);
    });
    it('acceptă număr și zero', () => {
      expect(parseOptionalRonToCents(180.5, 'x')).toBe(18050);
      expect(parseOptionalRonToCents(0, 'x')).toBe(0);
      expect(parseOptionalRonToCents('0', 'x')).toBe(0);
    });
    it('reject negativ', () => {
      expect(() => parseOptionalRonToCents(-1, 'labor')).toThrow(/labor/);
      expect(() => parseOptionalRonToCents('-0,01', 'labor')).toThrow(/labor/);
    });
    it('reject text și infinit', () => {
      expect(() => parseOptionalRonToCents('abc', 'labor')).toThrow(/labor/);
      expect(() => parseOptionalRonToCents(Number.POSITIVE_INFINITY, 'labor')).toThrow(/labor/);
    });
  });

  describe('centsToRonNumber', () => {
    it('null și non-finite', () => {
      expect(centsToRonNumber(null)).toBeNull();
      expect(centsToRonNumber(undefined)).toBeNull();
      expect(centsToRonNumber(Number.NaN)).toBeNull();
    });
    it('cenți întregi în RON', () => {
      expect(centsToRonNumber(18050)).toBe(180.5);
      expect(centsToRonNumber(0)).toBe(0);
    });
  });

  describe('defaultLaborUnitCents', () => {
    it('preferă mecanic', () => {
      expect(
        defaultLaborUnitCents({
          laborRateMechanicalCents: 18000,
          laborRateBodyCents: 20000,
          laborRatePaintCents: null,
          laborRateDiagnosticCents: null,
        }),
      ).toBe(18000);
    });
    it('cade pe body dacă mecanic lipsește', () => {
      expect(
        defaultLaborUnitCents({
          laborRateMechanicalCents: null,
          laborRateBodyCents: 20000,
          laborRatePaintCents: null,
          laborRateDiagnosticCents: null,
        }),
      ).toBe(20000);
    });
    it('card gol sau absent e null', () => {
      expect(defaultLaborUnitCents(null)).toBeNull();
      expect(defaultLaborUnitCents(undefined)).toBeNull();
      expect(
        defaultLaborUnitCents({
          laborRateMechanicalCents: null,
          laborRateBodyCents: null,
          laborRatePaintCents: null,
          laborRateDiagnosticCents: null,
        }),
      ).toBeNull();
    });
    it('sare peste tarife zero', () => {
      expect(
        defaultLaborUnitCents({
          laborRateMechanicalCents: 0,
          laborRateBodyCents: 0,
          laborRatePaintCents: 15000,
          laborRateDiagnosticCents: 9000,
        }),
      ).toBe(15000);
    });
    it('toate zero rămâne null', () => {
      expect(
        defaultLaborUnitCents({
          laborRateMechanicalCents: 0,
          laborRateBodyCents: 0,
          laborRatePaintCents: 0,
          laborRateDiagnosticCents: 0,
        }),
      ).toBeNull();
    });
    it('cade pe diagnostic dacă restul lipsesc sau nu sunt pozitive', () => {
      expect(
        defaultLaborUnitCents({
          laborRateMechanicalCents: 0,
          laborRateBodyCents: Number.NaN,
          laborRatePaintCents: -1,
          laborRateDiagnosticCents: 9500,
        }),
      ).toBe(9500);
    });
  });

  describe('effectivePartsDiscountForBasis', () => {
    it('zero pe net', () => {
      expect(effectivePartsDiscountForBasis('net', 15)).toBe(0);
    });
    it('păstrează pe list', () => {
      expect(effectivePartsDiscountForBasis('list', 15)).toBe(15);
    });
    it('list cu valoare invalidă cade pe 0', () => {
      expect(effectivePartsDiscountForBasis('list', Number.NaN)).toBe(0);
      expect(effectivePartsDiscountForBasis('list', 0)).toBe(0);
    });
  });

  describe('mergeClientSupplierRateOverlay', () => {
    const catalog = {
      category: 'service_auto',
      partsDiscountPercent: 10,
      laborDiscountPercent: 5,
      laborRateMechanicalCents: 18000,
      laborRateBodyCents: 20000,
      laborRatePaintCents: null as number | null,
      laborRateDiagnosticCents: null as number | null,
      partsPriceBasis: 'list',
      pricingNotes: 'catalog',
    };

    it('fără overlay moștenește catalogul', () => {
      const m = mergeClientSupplierRateOverlay(catalog, null);
      expect(m.partsDiscountPercent).toBe(10);
      expect(m.laborDiscountPercent).toBe(5);
      expect(m.laborRateMechanicalCents).toBe(18000);
      expect(m.partsPriceBasis).toBe('list');
      expect(m.overlayActive).toBe(false);
    });

    it('overlay discount și tarif au prioritate; null moștenește', () => {
      const m = mergeClientSupplierRateOverlay(catalog, {
        partsDiscountPercent: 20,
        laborDiscountPercent: null,
        laborRateMechanicalCents: 15000,
        laborRateBodyCents: null,
        laborRatePaintCents: null,
        laborRateDiagnosticCents: null,
        partsPriceBasis: null,
        pricingNotes: null,
      });
      expect(m.partsDiscountPercent).toBe(20);
      expect(m.laborDiscountPercent).toBe(5);
      expect(m.laborRateMechanicalCents).toBe(15000);
      expect(m.laborRateBodyCents).toBe(20000);
      expect(m.overlayActive).toBe(true);
    });

    it('bază net pe overlay forțează discount piese 0', () => {
      const m = mergeClientSupplierRateOverlay(catalog, {
        partsDiscountPercent: 25,
        laborDiscountPercent: null,
        laborRateMechanicalCents: null,
        laborRateBodyCents: null,
        laborRatePaintCents: null,
        laborRateDiagnosticCents: null,
        partsPriceBasis: 'net',
        pricingNotes: null,
      });
      expect(m.partsPriceBasis).toBe('net');
      expect(m.partsDiscountPercent).toBe(0);
    });

    it('0 pe overlay e override valid', () => {
      const m = mergeClientSupplierRateOverlay(catalog, {
        partsDiscountPercent: 0,
        laborDiscountPercent: 0,
        laborRateMechanicalCents: null,
        laborRateBodyCents: null,
        laborRatePaintCents: null,
        laborRateDiagnosticCents: null,
        partsPriceBasis: null,
        pricingNotes: null,
      });
      expect(m.partsDiscountPercent).toBe(0);
      expect(m.laborDiscountPercent).toBe(0);
      expect(m.overlayActive).toBe(true);
    });
  });
});
