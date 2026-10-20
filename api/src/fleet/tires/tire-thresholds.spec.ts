import {
  isDotAged,
  isTreadLow,
  parseDotManufacture,
  treadLowThresholdMm,
} from './tire-thresholds';
import {
  isWithin14DaysBeforeWindow as seasonWindow14,
  nextSeasonWindowStart,
} from './tire-season-reminders';

describe('parseDotManufacture', () => {
  it('parses WWYY from DOT suffix', () => {
    expect(parseDotManufacture('DOT X7K9 4520')).toEqual({
      kind: 'wwyy',
      isoYear: 2020,
      isoWeek: 45,
    });
  });

  it('falls back to year_only when week invalid', () => {
    expect(parseDotManufacture('DOT 0020')).toEqual({ kind: 'year_only', isoYear: 2020 });
  });

  it('returns null for short input', () => {
    expect(parseDotManufacture('12')).toBeNull();
  });
});

describe('isTreadLow', () => {
  it('uses summer threshold 3.0 mm', () => {
    expect(treadLowThresholdMm('summer')).toBe(3.0);
    expect(isTreadLow(2.9, 'summer')).toBe(true);
    expect(isTreadLow(3.0, 'summer')).toBe(false);
  });

  it('uses winter threshold 4.0 mm', () => {
    expect(isTreadLow(3.5, 'winter')).toBe(true);
    expect(isTreadLow(null, 'winter')).toBe(false);
  });
});

describe('isDotAged', () => {
  it('flags tyres older than max age from ISO week', () => {
    const now = new Date('2030-01-01T00:00:00.000Z');
    expect(isDotAged('DOT 4520', now)).toBe(true);
  });

  it('year-only DOT waits until calendar year exceeds max age', () => {
    const now = new Date('2025-06-01T00:00:00.000Z');
    expect(isDotAged('DOT 0020', now)).toBe(false);
    expect(isDotAged('DOT 0018', now)).toBe(true);
  });
});

describe('nextSeasonWindowStart', () => {
  it('during winter points to next Apr 1 UTC', () => {
    const now = new Date('2026-01-15T12:00:00.000Z');
    expect(nextSeasonWindowStart(now).toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });

  it('during summer before Nov points to Nov 1 same year', () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    expect(nextSeasonWindowStart(now).toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });
});

describe('isWithin14DaysBeforeWindow (season reminders)', () => {
  it('true when window is 10 days ahead', () => {
    const now = new Date('2026-10-22T00:00:00.000Z');
    const windowStart = new Date('2026-11-01T00:00:00.000Z');
    expect(seasonWindow14(windowStart, now)).toBe(true);
  });

  it('false when window is more than 14 days ahead', () => {
    const now = new Date('2026-10-01T00:00:00.000Z');
    const windowStart = new Date('2026-11-01T00:00:00.000Z');
    expect(seasonWindow14(windowStart, now)).toBe(false);
  });
});
