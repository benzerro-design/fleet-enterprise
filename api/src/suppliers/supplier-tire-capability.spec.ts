import {
  expandTireHotelServiceCodes,
  looksLikeTireHotelService,
  supplierHasTireStorage,
  TIRE_HOTEL_SERVICE_CODE,
} from './supplier-tire-capability';

describe('supplier-tire-capability', () => {
  describe('looksLikeTireHotelService', () => {
    it('matches canonical and alias codes', () => {
      expect(looksLikeTireHotelService('tire_storage', '', '')).toBe(true);
      expect(looksLikeTireHotelService('hotel_anvelope', '', '')).toBe(true);
      expect(looksLikeTireHotelService('depozitare_anvelope', '', '')).toBe(true);
    });

    it('matches label/description heuristics', () => {
      expect(
        looksLikeTireHotelService('custom_1', 'Hotel Anvelope', 'Depozitare anvelope/roți'),
      ).toBe(true);
      expect(looksLikeTireHotelService('x', 'Depozit anvelope', '')).toBe(true);
      expect(looksLikeTireHotelService('mechanics', 'Mecanică', 'Reparații')).toBe(false);
      expect(looksLikeTireHotelService('tire_service', 'Vulcanizare', 'Montaj')).toBe(false);
    });
  });

  describe('supplierHasTireStorage', () => {
    it('returns true for hotel-like offering even with custom code', async () => {
      const prisma = {
        supplierService: {
          findMany: jest.fn().mockResolvedValue([
            {
              serviceType: {
                code: 'svc_hotel_custom',
                label: 'Hotel Anvelope',
                clientDescription: 'Depozitare anvelope/roți',
                active: true,
              },
            },
          ]),
        },
      };
      await expect(supplierHasTireStorage(prisma as never, 't1', 's1')).resolves.toBe(true);
    });

    it('returns false when no hotel offering', async () => {
      const prisma = {
        supplierService: {
          findMany: jest.fn().mockResolvedValue([
            {
              serviceType: {
                code: 'mechanics',
                label: 'Mecanică',
                clientDescription: 'Reparații',
                active: true,
              },
            },
          ]),
        },
      };
      await expect(supplierHasTireStorage(prisma as never, 't1', 's1')).resolves.toBe(false);
    });
  });

  describe('expandTireHotelServiceCodes', () => {
    it('appends tire_storage when a hotel-like catalog row is selected', async () => {
      const prisma = {
        tenantServiceType: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'tst1',
            code: TIRE_HOTEL_SERVICE_CODE,
            active: true,
          }),
          findMany: jest.fn().mockResolvedValue([
            {
              code: 'svc_hotel_custom',
              label: 'Hotel Anvelope',
              clientDescription: 'Depozitare anvelope/roți',
            },
          ]),
        },
      };
      await expect(
        expandTireHotelServiceCodes(prisma as never, 't1', ['mechanics', 'svc_hotel_custom']),
      ).resolves.toEqual(['mechanics', 'svc_hotel_custom', TIRE_HOTEL_SERVICE_CODE]);
    });
  });
});
