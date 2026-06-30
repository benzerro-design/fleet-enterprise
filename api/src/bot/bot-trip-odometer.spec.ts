import { minKmAfterTime, planBotTripOdometer, tripOdometerEventAt } from './bot-trip-odometer';

function d(iso: string): Date {
  return new Date(iso);
}

describe('bot-trip-odometer', () => {
  it('caps odoEnd below future seed reading on same vehicle', () => {
    const existing = [
      { odometerKm: 45_648, recordedAt: d('2026-06-16T18:31:00Z') },
    ];
    const planned = planBotTripOdometer({
      existing,
      planned: [],
      startedAt: d('2026-06-16T13:31:00Z'),
      endedAt: d('2026-06-16T15:31:00Z'),
      distanceKm: 124,
      floorKm: 45_200,
    });
    expect(planned.feasible).toBe(true);
    expect(planned.odoEnd).toBeLessThanOrEqual(45_648);
    expect(planned.odoStart).toBeLessThanOrEqual(45_648 - 124);
    expect(planned.odoEnd).toBeGreaterThan(planned.odoStart);
  });

  it('respects future reading when planning earlier trip in month', () => {
    const existing = [
      { odometerKm: 45_648, recordedAt: d('2026-06-28T12:30:00Z') },
    ];
    const planned = planBotTripOdometer({
      existing,
      planned: [],
      startedAt: d('2026-06-26T10:30:00Z'),
      endedAt: d('2026-06-26T12:30:00Z'),
      distanceKm: 124,
      floorKm: 45_200,
    });
    expect(planned.feasible).toBe(true);
    expect(planned.odoEnd).toBeLessThanOrEqual(45_648);
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
    expect(first.feasible).toBe(true);
    session.push({ recordedAt: first.eventAt, odometerKm: first.odoEnd! });

    const second = planBotTripOdometer({
      existing,
      planned: session,
      startedAt: d('2026-06-20T14:30:00Z'),
      endedAt: d('2026-06-20T17:30:00Z'),
      distanceKm: 116,
      floorKm: floor,
    });

    expect(second.feasible).toBe(true);
    expect(second.odoStart).toBeGreaterThanOrEqual(first.odoEnd!);
    expect(second.odoEnd!).toBeGreaterThan(first.odoEnd!);
  });

  it('minKmAfterTime finds next reading', () => {
    const existing = [
      { odometerKm: 100, recordedAt: d('2026-06-01T10:00:00Z') },
      { odometerKm: 200, recordedAt: d('2026-06-20T10:00:00Z') },
    ];
    expect(minKmAfterTime(existing, [], d('2026-06-10T10:00:00Z'))).toBe(200);
  });

  it('sorts event at by endedAt for odometer', () => {
    expect(
      tripOdometerEventAt(d('2026-06-20T13:30:00Z'), d('2026-06-20T16:30:00Z')).getTime(),
    ).toBe(d('2026-06-20T16:30:00Z').getTime());
  });
});
