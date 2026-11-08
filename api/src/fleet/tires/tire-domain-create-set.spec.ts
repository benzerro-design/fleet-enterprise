import { BadRequestException } from '@nestjs/common';
import { TireDomainService } from './tire-domain.service';

jest.mock('../../ops/ops-write-access', () => ({
  assertVehicleOpsWrite: jest.fn().mockResolvedValue(undefined),
  assertVehicleOpsRead: jest.fn().mockResolvedValue(undefined),
}));

describe('TireDomainService.createSet mountedAs', () => {
  it('tyre_only empty seed creates set without cloning rims', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'set-1',
      season: 'winter',
      name: null,
      mountedAs: 'tyre_only',
      _count: { items: 0 },
    });
    const prisma = {
      vehicle: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'veh-1',
            tenantId: 't1',
            clientId: 'c1',
          })
          .mockResolvedValueOnce({ id: 'veh-1', registrationNumber: 'B108VDF' }),
      },
      tireSet: {
        create,
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'set-1',
            season: 'winter',
            name: null,
            mountedAs: 'tyre_only',
            archivedAt: null,
            _count: { items: 0 },
            items: [],
            placements: [],
            storageStays: [],
          },
        ]),
      },
      tirePlacement: { findMany: jest.fn().mockResolvedValue([]) },
      tireEvent: { create: jest.fn().mockResolvedValue({}) },
    };

    const service = new TireDomainService(prisma as never);
    const result = await service.createSet('demo', 'veh-1', {
      season: 'winter',
      mountedAs: 'tyre_only',
      seedFrom: 'empty',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mountedAs: 'tyre_only',
          season: 'winter',
        }),
      }),
    );
    expect(result.mountedAs).toBe('tyre_only');
    expect(result.itemCount).toBe(0);
    expect(result.location).toBe('at_client');
  });

  it('rejects invalid mountedAs via assertCreateTireSetDto path in service', async () => {
    const prisma = {
      vehicle: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'veh-1',
          tenantId: 't1',
          clientId: 'c1',
        }),
      },
    };
    const service = new TireDomainService(prisma as never);
    await expect(
      service.createSet('demo', 'veh-1', {
        season: 'winter',
        mountedAs: 'bogus' as never,
        seedFrom: 'empty',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('TireDomainService.scrapSet', () => {
  it('rejects mounted sets', async () => {
    const prisma = {
      tenant: { findUnique: jest.fn().mockResolvedValue({ id: 't1', slug: 'demo' }) },
      tireSet: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'set-1',
          vehicleId: 'veh-1',
          tenantId: 't1',
          items: [{ assetId: 'a1' }],
          storageStays: [],
          placements: [{ id: 'pl-1' }],
        }),
      },
    };
    const service = new TireDomainService(prisma as never);
    await expect(service.scrapSet('demo', 'set-1')).rejects.toThrow(/mounted/i);
  });

  it('rejects open hotel stay', async () => {
    const prisma = {
      tenant: { findUnique: jest.fn().mockResolvedValue({ id: 't1', slug: 'demo' }) },
      tireSet: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'set-1',
          vehicleId: 'veh-1',
          tenantId: 't1',
          items: [{ assetId: 'a1' }],
          storageStays: [{ id: 'stay-1' }],
          placements: [],
        }),
      },
    };
    const service = new TireDomainService(prisma as never);
    await expect(service.scrapSet('demo', 'set-1')).rejects.toThrow(/hotel/i);
  });
});
