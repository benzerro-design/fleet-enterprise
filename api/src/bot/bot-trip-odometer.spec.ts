import { tripOdometerEventAt, trustedKmAtTime, planBotTripOdometer } from './bot-trip-odometer';

function d(iso: string): Date {
  return new Date(iso);
}

describe('bot-trip-odometer', () => {
  it('trustedKmAtTime respects existing later-dated lower readings when planning earlier trip', () => {
    const existing = [
      { odometerKm: 45_400, recordedAt: d('2026-06-29T17:00:00Z') },
    ];
    const at = d('2026-06-16T15:30:00Z');
    expect(trustedKmAtTime(existing, [], at, 45_200)).toBe(45_200);
    const planned = planBotTripOdometer({
      existing,
      planned: [],
      startedAt: at,
      endedAt: d('2026-06-16T20:30:00Z'),
      distanceKm: 124,
      floorKm: 45_200,
    });
    expect(planned.odoStart).toBe(45_200);
    expect(planned.odoEnd).toBe(45_324);
  });

  it('chains planned trips on same vehicle by event time', () => {
    const existing: { odometerKm: number; recordedAt: Date }[] = [];
    const session: { odometerKm: number; recordedAt: Date }[] = [];
    const floor = 128_400;

    const first = planBotTripOdometer({
      existing,
      planned: session,
      startedAt: d('2026-06-20T13:30:00Z'),
      endedAt: d('2026-06-20T16:30:00Z'),
      distanceKm: 116,
      floorKm: floor,
    });
    session.push({ recordedAt: first.eventAt, odometerKm: first.odoEnd! });

    const second = planBotTripOdometer({
      existing,
      planned: session,
      startedAt: d('2026-06-20T14:30:00Z'),
      endedAt: d('2026-06-20T17:30:00Z'),
      distanceKm: 116,
      floorKm: floor,
    });

    expect(second.odoStart).toBeGreaterThanOrEqual(first.odoEnd!);
    expect(second.odoEnd).toBeGreaterThan(first.odoEnd!);
  });

  it('sorts event at by endedAt for odometer', () => {
    expect(
      tripOdometerEventAt(d('2026-06-20T13:30:00Z'), d('2026-06-20T16:30:00Z')).getTime(),
    ).toBe(d('2026-06-20T16:30:00Z').getTime());
  });
});
