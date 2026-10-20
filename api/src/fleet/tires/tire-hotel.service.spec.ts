import { BadRequestException } from '@nestjs/common';
import { TireHotelService } from './tire-hotel.service';
import type { TireDomainService } from './tire-domain.service';

describe('TireHotelService.checkInTx', () => {
  const tires = {
    placeAssetTx: jest.fn(),
  } as unknown as TireDomainService;

  const service = new TireHotelService({} as never, tires);

  function baseTx(overrides: {
    set?: Record<string, unknown> | null;
    openStay?: unknown;
    foreignHotel?: unknown;
    mountedOnVehicle?: unknown;
  }) {
    return {
      tireSet: {
        findFirst: jest.fn().mockResolvedValue(
          overrides.set === null
            ? null
            : {
                id: 'set-1',
                tenantId: 't1',
                vehicleId: 'veh-1',
                items: [{ assetId: 'asset-1' }],
                vehicle: { id: 'veh-1', registrationNumber: 'B123ABC' },
                ...(overrides.set ?? {}),
              },
        ),
      },
      tireStorageStay: {
        findFirst: jest.fn().mockResolvedValue(overrides.openStay ?? null),
        create: jest.fn(),
      },
      tirePlacement: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(overrides.foreignHotel ?? null)
          .mockResolvedValueOnce(overrides.mountedOnVehicle ?? null),
      },
      tireEvent: { create: jest.fn() },
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects check-in when any set asset is still mounted on vehicle', async () => {
    const tx = baseTx({ mountedOnVehicle: { id: 'pl-1' } });

    await expect(
      service.checkInTx(tx as never, {
        tenantId: 't1',
        supplierId: 'sup-1',
        setId: 'set-1',
        locationCode: 'A-1',
      }),
    ).rejects.toThrow(/montat pe vehicul/i);

    expect(tx.tireStorageStay.create).not.toHaveBeenCalled();
  });
});
