import {
  analyzeOdometerTimeline,
  computeCurrentKmFromTimeline,
  validateNewOdometerEntry,
} from './vehicle-odometer-timeline';

function d(iso: string): Date {
  return new Date(iso);
}

describe('vehicle-odometer-timeline', () => {
  it('computeCurrentKmFromTimeline uses last valid monotonic reading', () => {
    const readings = [
      { odometerKm: 128596, recordedAt: d('2026-06-19T10:00:00Z') },
      { odometerKm: 128536, recordedAt: d('2026-06-20T10:00:00Z') },
      { odometerKm: 128430, recordedAt: d('2026-06-29T10:00:00Z') },
    ];
    expect(computeCurrentKmFromTimeline(readings)).toBe(128596);
  });

  it('ignores invalid later reading with lower km (migration + fault trip)', () => {
    const readings = [
      { odometerKm: 100_000, recordedAt: d('2026-05-31T10:00:00Z') },
      { odometerKm: 4_000, recordedAt: d('2026-06-30T10:00:00Z') },
    ];
    expect(computeCurrentKmFromTimeline(readings)).toBe(100_000);
  });

  it('detects critical violations when km decreases over time', () => {
    const analysis = analyzeOdometerTimeline([
      { odometerKm: 128596, recordedAt: d('2026-06-19T10:00:00Z') },
      { odometerKm: 128536, recordedAt: d('2026-06-20T10:00:00Z') },
    ]);
    expect(analysis.isConsistent).toBe(false);
    expect(analysis.hasCriticalViolations).toBe(true);
    expect(analysis.violations).toHaveLength(1);
    expect(analysis.currentKmFromTimeline).toBe(128596);
  });

  it('allows backdated entry when km fits timeline', () => {
    const existing = [{ odometerKm: 100000, recordedAt: d('2026-06-01T10:00:00Z') }];
    const validation = validateNewOdometerEntry(
      existing,
      { odometerKm: 100500, recordedAt: d('2026-06-15T10:00:00Z') },
      100000,
    );
    expect(validation.severity).not.toBe('critical');
    expect(validation.newCurrentKm).toBe(100500);
    expect(validation.willUpdateCurrentKm).toBe(true);
  });

  it('flags critical when backdated km exceeds later reading', () => {
    const existing = [
      { odometerKm: 100000, recordedAt: d('2026-06-01T10:00:00Z') },
      { odometerKm: 100200, recordedAt: d('2026-06-20T10:00:00Z') },
    ];
    const validation = validateNewOdometerEntry(
      existing,
      { odometerKm: 100500, recordedAt: d('2026-06-10T10:00:00Z') },
      100200,
    );
    expect(validation.severity).toBe('critical');
    expect(validation.willUpdateCurrentKm).toBe(false);
    expect(validation.newCurrentKm).toBe(100200);
  });

  it('does not lower current km when invalid later reading is added', () => {
    const existing = [{ odometerKm: 100_000, recordedAt: d('2026-05-31T10:00:00Z') }];
    const validation = validateNewOdometerEntry(
      existing,
      { odometerKm: 4_000, recordedAt: d('2026-06-30T10:00:00Z') },
      100_000,
    );
    expect(validation.severity).toBe('critical');
    expect(validation.willUpdateCurrentKm).toBe(false);
    expect(validation.newCurrentKm).toBe(100_000);
  });
});
