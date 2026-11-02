import { assertTyreCloseDto } from './work-order-tyre-close.service';

describe('assertTyreCloseDto storage_only', () => {
  it('requires storageOnly payload', () => {
    expect(() =>
      assertTyreCloseDto({ intent: 'storage_only', odometerKm: 1000 }),
    ).toThrow(/storageOnly/);
  });

  it('accepts hotel storage without readings when set may be off-vehicle', () => {
    const dto = assertTyreCloseDto({
      intent: 'storage_only',
      odometerKm: 12000,
      storageOnly: {
        setId: 'set1',
        storeAt: 'at_supplier_hotel',
        hotelSupplierId: 'sup-hotel',
        locationCode: 'A-1',
      },
    });
    expect(dto.storageOnly?.setId).toBe('set1');
    expect(dto.storageOnly?.hotelSupplierId).toBe('sup-hotel');
    expect(dto.seasonalSwap).toBeUndefined();
  });

  it('rejects storageOnly on other intents', () => {
    expect(() =>
      assertTyreCloseDto({
        intent: 'diagnostic_wheel',
        odometerKm: 1,
        storageOnly: { setId: 's', storeAt: 'at_client' },
        outcomes: [{ position: 'fl', outcome: 'inspected_ok', treadMm: 5 }],
      }),
    ).toThrow(/only valid for storage_only/);
  });
});
