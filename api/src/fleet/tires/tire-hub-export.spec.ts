import { TireHubService } from './tire-hub.service';
import type { TireHubPayload } from './tire-hub.types';

describe('TireHubService.exportInventoryCsv', () => {
  it('emits UTF-8 BOM header and one row per inventory item', async () => {
    const hub: TireHubPayload = {
      generatedAt: new Date().toISOString(),
      summary: {
        setsMounted: 1,
        setsAtHotel: 0,
        setsAtClient: 0,
        assetsRecommendedReplace: 0,
        assetsDotAged: 0,
        assetsTreadLow: 0,
      },
      alerts: [],
      attentionSets: [],
      changeoverQueue: [],
      inventorySets: [
        {
          setId: 'set-1',
          vehicleId: 'veh-1',
          plate: 'B108VDF',
          clientId: 'c1',
          clientCode: 'ALPHA',
          clientName: 'Client Alpha',
          setName: 'Vară',
          season: 'summer',
          mountedAs: 'on_rim',
          itemCount: 2,
          location: 'on_vehicle',
          isMounted: true,
          atHotel: false,
          stayId: null,
          supplierId: null,
          supplierName: null,
          locationCode: null,
          checkInAt: null,
          feeCents: null,
          contractRef: null,
          intakeTreadNotes: null,
          photoCount: 0,
          minTreadMm: 4.5,
          worstDot: '2319',
          dominantBrand: 'Michelin',
          dominantSize: '205/55R16',
          itemsSeason: 'summer',
          seasonLabelMismatch: false,
          assetsRecommendedReplace: 0,
          hasOppositeSeasonStored: false,
          ownershipType: 'client',
          alertKinds: [],
          hrefWheels: '/fleet/vehicles/veh-1?tab=wheels',
          hrefCreateTicket: '/fleet/tickets/new',
          costCentsTotal: 0,
          costCount: 0,
          lastMountKm: 12000,
          lastDemountKm: null,
          recentEvents: [],
          items: [
            {
              assetId: 'a1',
              position: 'fl',
              brand: 'Michelin',
              model: 'Primacy',
              size: '205/55R16',
              dot: '2319',
              treadMm: 4.5,
              serialOrQr: null,
              recommendedReplace: false,
              ownershipType: 'client',
              runFlat: false,
              tpmsSensorPresent: false,
            },
            {
              assetId: 'a2',
              position: 'fr',
              brand: 'Michelin',
              model: 'Primacy',
              size: '205/55R16',
              dot: '2319',
              treadMm: 5.0,
              serialOrQr: null,
              recommendedReplace: false,
              ownershipType: 'client',
              runFlat: false,
              tpmsSensorPresent: false,
            },
          ],
        },
      ],
    };

    const service = new TireHubService({} as never);
    jest.spyOn(service, 'getHub').mockResolvedValue(hub);

    const csv = await service.exportInventoryCsv('demo');
    expect(csv.startsWith('\uFEFF')).toBe(true);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toContain('plate,clientCode');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('B108VDF');
    expect(lines[1]).toContain('a1');
    expect(lines[2]).toContain('a2');
  });
});
