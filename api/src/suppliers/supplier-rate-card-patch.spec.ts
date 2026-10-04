import { supplierSupportsQuoteDiscountDefaults } from './supplier-discount-eligibility';
import {
  nextPartsPriceBasis,
  parseDiscountPercent,
  parseSupplierRatePatch,
  resolveSupplierCreateDiscounts,
  resolveSupplierDiscountPatch,
} from './supplier-rate-card';

const emptyDiscounts = {
  partsPriceBasis: undefined,
  partsDiscountPercent: undefined,
  laborDiscountPercent: undefined,
};

describe('supplier rate patch', () => {
  describe('parseSupplierRatePatch', () => {
    it('patch gol nu atinge niciun câmp', () => {
      expect(parseSupplierRatePatch({})).toEqual({});
    });

    it('convertește doar tarifele trimise, inclusiv zero', () => {
      expect(
        parseSupplierRatePatch({
          laborRateMechanicalRon: '180,50',
          laborRateBodyRon: 0,
        }),
      ).toEqual({
        laborRateMechanicalCents: 18050,
        laborRateBodyCents: 0,
      });
    });

    it('null și gol șterg tariful', () => {
      expect(
        parseSupplierRatePatch({
          laborRatePaintRon: null,
          laborRateDiagnosticRon: '',
        }),
      ).toEqual({
        laborRatePaintCents: null,
        laborRateDiagnosticCents: null,
      });
    });

    it('reject tarif negativ cu numele câmpului', () => {
      expect(() => parseSupplierRatePatch({ laborRatePaintRon: -5 })).toThrow(
        /laborRatePaintRon/,
      );
    });

    it('baza net/list; null sau absent nu schimbă baza', () => {
      expect(parseSupplierRatePatch({ partsPriceBasis: 'net' })).toEqual({
        partsPriceBasis: 'net',
      });
      expect(parseSupplierRatePatch({ partsPriceBasis: 'list' })).toEqual({
        partsPriceBasis: 'list',
      });
      expect(parseSupplierRatePatch({ partsPriceBasis: 'altceva' })).toEqual({
        partsPriceBasis: 'list',
      });
      expect(parseSupplierRatePatch({ partsPriceBasis: null })).toEqual({});
      expect(parseSupplierRatePatch({})).toEqual({});
    });

    it('note: trim, gol devine null, absent rămâne afară', () => {
      expect(parseSupplierRatePatch({ pricingNotes: '  listă 2026  ' })).toEqual({
        pricingNotes: 'listă 2026',
      });
      expect(parseSupplierRatePatch({ pricingNotes: '   ' })).toEqual({
        pricingNotes: null,
      });
      expect(parseSupplierRatePatch({ pricingNotes: null })).toEqual({
        pricingNotes: null,
      });
    });
  });

  describe('nextPartsPriceBasis', () => {
    it('patch absent sau null păstrează stocat', () => {
      expect(nextPartsPriceBasis(undefined, 'net')).toBe('net');
      expect(nextPartsPriceBasis(null, 'list')).toBe('list');
    });
    it('patch explicit câștigă', () => {
      expect(nextPartsPriceBasis('net', 'list')).toBe('net');
      expect(nextPartsPriceBasis('list', 'net')).toBe('list');
    });
  });

  describe('parseDiscountPercent', () => {
    it('null/gol = 0, virgulă rotunjită', () => {
      expect(parseDiscountPercent(null, 'partsDiscountPercent')).toBe(0);
      expect(parseDiscountPercent('', 'partsDiscountPercent')).toBe(0);
      expect(parseDiscountPercent('12,555', 'partsDiscountPercent')).toBe(12.56);
    });
    it('reject în afara 0–100', () => {
      expect(() => parseDiscountPercent(-1, 'partsDiscountPercent')).toThrow(
        /partsDiscountPercent/,
      );
      expect(() => parseDiscountPercent(100.01, 'laborDiscountPercent')).toThrow(
        /laborDiscountPercent/,
      );
      expect(() => parseDiscountPercent('x', 'partsDiscountPercent')).toThrow(
        /partsDiscountPercent/,
      );
    });
  });

  describe('resolveSupplierDiscountPatch', () => {
    it('categorie neeligibilă forțează ambele la 0 fără parsare', () => {
      expect(supplierSupportsQuoteDiscountDefaults('dealer')).toBe(false);
      expect(
        resolveSupplierDiscountPatch({
          discountsEligible: false,
          storedPartsPriceBasis: 'list',
          partsPriceBasis: 'list',
          partsDiscountPercent: 'nope',
          laborDiscountPercent: 40,
        }),
      ).toEqual({ partsDiscountPercent: 0, laborDiscountPercent: 0 });
    });

    it('list păstrează discountul de piese trimis', () => {
      expect(
        resolveSupplierDiscountPatch({
          discountsEligible: supplierSupportsQuoteDiscountDefaults('service_auto'),
          storedPartsPriceBasis: 'list',
          partsPriceBasis: 'list',
          partsDiscountPercent: '15,5',
          laborDiscountPercent: undefined,
        }),
      ).toEqual({ partsDiscountPercent: 15.5 });
    });

    it('net forțează discountul de piese la 0 și lasă manopera', () => {
      expect(
        resolveSupplierDiscountPatch({
          discountsEligible: true,
          storedPartsPriceBasis: 'list',
          partsPriceBasis: 'net',
          partsDiscountPercent: 15,
          laborDiscountPercent: 10,
        }),
      ).toEqual({ partsDiscountPercent: 0, laborDiscountPercent: 10 });
    });

    it('trecere la net fără discount în patch tot pune piesele pe 0', () => {
      expect(
        resolveSupplierDiscountPatch({
          discountsEligible: true,
          storedPartsPriceBasis: 'list',
          partsPriceBasis: 'net',
          partsDiscountPercent: undefined,
          laborDiscountPercent: undefined,
        }),
      ).toEqual({ partsDiscountPercent: 0 });
    });

    it('trecere de la net la list nu inventează un discount', () => {
      expect(
        resolveSupplierDiscountPatch({
          discountsEligible: true,
          storedPartsPriceBasis: 'net',
          ...emptyDiscounts,
          partsPriceBasis: 'list',
        }),
      ).toEqual({});
    });

    it('patch fără bază și fără discount piese nu atinge discountul', () => {
      expect(
        resolveSupplierDiscountPatch({
          discountsEligible: true,
          storedPartsPriceBasis: 'net',
          partsPriceBasis: undefined,
          partsDiscountPercent: undefined,
          laborDiscountPercent: 8,
        }),
      ).toEqual({ laborDiscountPercent: 8 });
    });

    it('bază null folosește stocat: net curăță, list nu', () => {
      expect(
        resolveSupplierDiscountPatch({
          discountsEligible: true,
          storedPartsPriceBasis: 'net',
          partsPriceBasis: null,
          partsDiscountPercent: undefined,
          laborDiscountPercent: undefined,
        }),
      ).toEqual({ partsDiscountPercent: 0 });
      expect(
        resolveSupplierDiscountPatch({
          discountsEligible: true,
          storedPartsPriceBasis: 'list',
          partsPriceBasis: null,
          partsDiscountPercent: undefined,
          laborDiscountPercent: undefined,
        }),
      ).toEqual({});
    });

    it('discount invalid pe list aruncă', () => {
      expect(() =>
        resolveSupplierDiscountPatch({
          discountsEligible: true,
          storedPartsPriceBasis: 'list',
          partsPriceBasis: undefined,
          partsDiscountPercent: 150,
          laborDiscountPercent: undefined,
        }),
      ).toThrow(/partsDiscountPercent/);
    });
  });

  describe('resolveSupplierCreateDiscounts', () => {
    it('bază net forțează discount piese 0 la create', () => {
      expect(
        resolveSupplierCreateDiscounts({
          discountsEligible: true,
          partsPriceBasis: 'net',
          partsDiscountPercent: 15,
          laborDiscountPercent: 5,
        }),
      ).toEqual({ partsDiscountPercent: 0, laborDiscountPercent: 5 });
    });

    it('bază list păstrează discountul', () => {
      expect(
        resolveSupplierCreateDiscounts({
          discountsEligible: true,
          partsPriceBasis: 'list',
          partsDiscountPercent: 12,
          laborDiscountPercent: 0,
        }),
      ).toEqual({ partsDiscountPercent: 12, laborDiscountPercent: 0 });
    });

    it('categorie neeligibilă zero ambele', () => {
      expect(
        resolveSupplierCreateDiscounts({
          discountsEligible: false,
          partsPriceBasis: 'list',
          partsDiscountPercent: 20,
          laborDiscountPercent: 10,
        }),
      ).toEqual({ partsDiscountPercent: 0, laborDiscountPercent: 0 });
    });
  });
});
