import { BadRequestException } from '@nestjs/common';
import { TireHotelService } from './tire-hotel.service';
import type { TireDomainService } from './tire-domain.service';
import { parseIntakeTreadNotes } from './tire-intake-inspection';

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

  it('strips rim fields from intake when set is tyre_only', async () => {
    jest.spyOn(service as never, 'resolveFeeCentsForSetTx' as never).mockResolvedValue(500 as never);
    jest.spyOn(service as never, 'resolveHotelMinMonthsTx' as never).mockResolvedValue(1 as never);

    const createdStay = {
      id: 'stay-1',
      setId: 'set-1',
      supplierId: 'sup-1',
      locationCode: 'A-1',
      checkInAt: new Date('2026-01-01T12:00:00Z'),
      checkOutAt: null,
      intakePhotos: null,
      intakeTreadNotes: null,
      feeCents: 500,
      contractRef: null,
      accountingNote: null,
    };

    const setRow = {
      id: 'set-1',
      tenantId: 't1',
      vehicleId: 'veh-1',
      mountedAs: 'tyre_only',
      season: 'winter',
      name: null,
      items: [
        {
          assetId: 'asset-1',
          asset: { id: 'asset-1', brand: null, model: null, size: '205/55R16', dot: null, treadMm: null, serialOrQr: null },
        },
      ],
      vehicle: { id: 'veh-1', registrationNumber: 'B123ABC', clientId: 'client-1' },
    };

    const tx = {
      user: { findFirst: jest.fn().mockResolvedValue(null) },
      tireSet: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ id: 'set-1', opsLockUntil: null, opsLockByUserId: null })
          .mockResolvedValueOnce(setRow),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      tireStorageStay: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(createdStay),
      },
      tirePlacement: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 'pl-client' }),
      },
      tireAsset: { update: jest.fn().mockResolvedValue({}) },
    };

    jest.spyOn(tires, 'placeAssetTx').mockResolvedValue(undefined);

    await service.checkInTx(tx as never, {
      tenantId: 't1',
      supplierId: 'sup-1',
      setId: 'set-1',
      locationCode: 'A-1',
      feeCents: 500,
      intakeInspection: {
        assets: [{ assetId: 'asset-1', treadMm: 4 }],
        rimCondition: 'ok',
        rimNotes: 'should drop',
      },
    });

    const createArg = (tx.tireStorageStay.create as jest.Mock).mock.calls[0][0];
    const parsed = parseIntakeTreadNotes(createArg.data.intakeTreadNotes);
    expect(parsed.structured?.rimCondition).toBeUndefined();
    expect(parsed.structured?.rimNotes).toBeUndefined();
  });
});

describe('TireHotelService.recordStayAfterStoreTx', () => {
  const service = new TireHotelService({} as never, {} as never);

  it('stores intakeTreadNotes from seasonal close', async () => {
    const tx = {
      tireStorageStay: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn(),
      },
    };

    await service.recordStayAfterStoreTx(tx as never, {
      tenantId: 't1',
      supplierId: 'sup-1',
      setId: 'set-1',
      workOrderId: 'wo-1',
      locationCode: 'A1',
      intakeTreadNotes: 'FL 4.2mm; FR 4.0mm',
      sourceSystem: 'tyre_close_seasonal',
    });

    expect(tx.tireStorageStay.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          intakeTreadNotes: expect.stringContaining('4.2'),
          sourceSystem: 'tyre_close_seasonal',
          workOrderId: 'wo-1',
          locationCode: 'A1',
        }),
      }),
    );
  });
});
