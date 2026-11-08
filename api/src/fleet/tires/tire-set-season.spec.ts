import { pickSetSeason } from './tire-domain.types';

describe('pickSetSeason', () => {
  it('returns unknown when empty or only unknown', () => {
    expect(pickSetSeason([])).toBe('unknown');
    expect(pickSetSeason(['unknown', 'unknown'])).toBe('unknown');
  });

  it('returns unanimous known season', () => {
    expect(pickSetSeason(['winter', 'winter', 'unknown'])).toBe('winter');
    expect(pickSetSeason(['summer', 'summer'])).toBe('summer');
  });

  it('returns unknown when mixed known seasons', () => {
    expect(pickSetSeason(['summer', 'winter'])).toBe('unknown');
  });
});
