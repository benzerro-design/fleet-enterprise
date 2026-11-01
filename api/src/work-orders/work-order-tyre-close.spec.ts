import { BadRequestException } from '@nestjs/common';
import { ServiceOrderType } from '@prisma/client';

jest.mock('../fleet/tires/tire-recommended-replace', () => ({
  applyRecommendedReplaceFlags: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../ops/cost-tire-links', () => ({
  attachTireLinksToWorkOrderCosts: jest.fn().mockResolvedValue(undefined),
}));

import {
  assertTyreCloseDto,
  rejectIfTyreCloseAlreadyClaimed,
  WorkOrderTyreCloseService,
} from './work-order-tyre-close.service';

describe('rejectIfTyreCloseAlreadyClaimed', () => {
  it('throws when optimistic claim count is 0', () => {
    expect(() => rejectIfTyreCloseAlreadyClaimed(0)).toThrow(BadRequestException);
    expect(() => rejectIfTyreCloseAlreadyClaimed(0)).toThrow(/already applied/i);
  });

  it('allows count >= 1', () => {
    expect(() => rejectIfTyreCloseAlreadyClaimed(1)).not.toThrow();
  });
});

describe('assertTyreCloseDto', () => {
  it('accepts inspected_ok with treadMm', () => {
    const dto = assertTyreCloseDto({
      intent: 'diagnostic_wheel',
      odometerKm: 1000,
      outcomes: [{ position: 'fl', outcome: 'inspected_ok', treadMm: 5.2 }],
    });
    expect(dto.intent).toBe('diagnostic_wheel');
    expect(dto.outcomes).toHaveLength(1);
  });

  it('rejects inspected_ok without treadMm', () => {
    expect(() =>
      assertTyreCloseDto({
        intent: 'diagnostic_wheel',
        outcomes: [{ position: 'fl', outcome: 'inspected_ok' }],
      }),
    ).toThrow(/treadMm/i);
  });

  it('requires demountReadings on seasonalSwap', () => {
    expect(() =>
      assertTyreCloseDto({
        intent: 'seasonal_changeover',
        seasonalSwap: {
          demountSetId: 'a',
          mountSetId: 'b',
          storeAt: 'at_client',
        },
      }),
    ).toThrow(/demountReadings/i);
  });

  it('requires seasonalSwap or outcomes', () => {
    expect(() => assertTyreCloseDto({ intent: 'purchase' })).toThrow(BadRequestException);
  });

  it('rejects replaced without newAsset.dot', () => {
    expect(() =>
      assertTyreCloseDto({
        intent: 'roadside_puncture',
        odometerKm: 10,
        outcomes: [
          {
            position: 'fl',
            outcome: 'replaced',
            treadMm: 7,
            newAsset: { treadMm: 7 },
          },
        ],
      }),
    ).toThrow(/dot/i);
  });

  it('accepts seasonalSwap with demountReadings', () => {
    const dto = assertTyreCloseDto({
      intent: 'seasonal_changeover',
      odometerKm: 50000,
      seasonalSwap: {
        demountSetId: 'set-a',
        mountSetId: 'set-b',
        storeAt: 'at_supplier_hotel',
        demountReadings: [
          { position: 'fl', treadMm: 4.2 },
          { position: 'fr', treadMm: 4.0, dot: '2218' },
        ],
      },
    });
    expect(dto.seasonalSwap?.demountReadings).toHaveLength(2);
  });
});

describe('WorkOrderTyreCloseService.applyTyreClose claim', () => {
  it('aborts transaction when updateMany claim returns 0', async () => {
    const tx = {
      maintenanceWorkOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn(),
      },
    };
    const prisma = {
      maintenanceWorkOrder: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'wo-1',
          tenantId: 't1',
          vehicleId: 'veh-1',
          supplierId: 'sup-1',
          serviceOrderType: ServiceOrderType.R,
          tyreCloseAppliedAt: null,
          odometerKmOut: null,
          odometerKmIn: null,
          vehicle: { id: 'veh-1', clientId: 'c1', tenantId: 't1' },
          serviceCase: { clientId: 'c1' },
        }),
      },
      $transaction: jest.fn(async (cb: (inner: typeof tx) => Promise<void>) => cb(tx)),
    };

    const service = new WorkOrderTyreCloseService(
      prisma as never,
      {} as never,
      {} as never,
      { getById: jest.fn() } as never,
    );

    await expect(
      service.applyTyreClose('demo', 'wo-1', {
        intent: 'purchase',
        odometerKm: 12000,
        outcomes: [{ position: 'fl', outcome: 'inspected_ok', treadMm: 4 }],
      }),
    ).rejects.toThrow(/already applied/i);

    expect(tx.maintenanceWorkOrder.update).not.toHaveBeenCalled();
  });

  it('proceeds past claim when updateMany returns 1', async () => {
    const syncFitmentProjectionTx = jest.fn().mockResolvedValue(undefined);
    const tx = {
      maintenanceWorkOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
      tireEvent: { create: jest.fn().mockResolvedValue({}) },
      tirePlacement: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const prisma = {
      maintenanceWorkOrder: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'wo-1',
          tenantId: 't1',
          vehicleId: 'veh-1',
          supplierId: 'sup-1',
          serviceOrderType: ServiceOrderType.R,
          tyreCloseAppliedAt: null,
          odometerKmOut: null,
          odometerKmIn: null,
          vehicle: { id: 'veh-1', clientId: 'c1', tenantId: 't1' },
          serviceCase: { clientId: 'c1' },
        }),
      },
      $transaction: jest.fn(async (cb: (inner: typeof tx) => Promise<void>) => cb(tx)),
    };

    const getById = jest.fn().mockResolvedValue({ id: 'wo-1' });
    const service = new WorkOrderTyreCloseService(
      prisma as never,
      { syncFitmentProjectionTx } as never,
      {} as never,
      { getById } as never,
    );

    await service.applyTyreClose('demo', 'wo-1', {
      intent: 'purchase',
      odometerKm: 12000,
      outcomes: [{ position: 'fl', outcome: 'deferred' }],
    });

    expect(tx.maintenanceWorkOrder.updateMany).toHaveBeenCalled();
    expect(syncFitmentProjectionTx).toHaveBeenCalled();
    expect(tx.maintenanceWorkOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'wo-1' } }),
    );
    expect(getById).toHaveBeenCalled();
  });
});
