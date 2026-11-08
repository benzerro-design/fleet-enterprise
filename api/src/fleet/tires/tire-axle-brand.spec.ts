import { BadRequestException } from '@nestjs/common';
import { validateAxleBrandPairs } from './tire-axle-brand';

describe('validateAxleBrandPairs', () => {
  it('allows same brand per axle, different front vs rear', () => {
    expect(() =>
      validateAxleBrandPairs([
        { position: 'fl', brand: 'Michelin' },
        { position: 'fr', brand: 'michelin' },
        { position: 'rl', brand: 'Continental' },
        { position: 'rr', brand: 'CONTINENTAL' },
      ]),
    ).not.toThrow();
  });

  it('rejects mixed brands within front axle', () => {
    expect(() =>
      validateAxleBrandPairs([
        { position: 'fl', brand: 'Michelin' },
        { position: 'fr', brand: 'Pirelli' },
        { position: 'rl', brand: 'X' },
        { position: 'rr', brand: 'X' },
      ]),
    ).toThrow(BadRequestException);
  });

  it('rejects mixed brands within rear axle', () => {
    expect(() =>
      validateAxleBrandPairs([
        { position: 'fl', brand: 'A' },
        { position: 'fr', brand: 'A' },
        { position: 'rl', brand: 'B' },
        { position: 'rr', brand: 'C' },
      ]),
    ).toThrow(/rl\/rr/i);
  });

  it('skips positions with missing brand', () => {
    expect(() =>
      validateAxleBrandPairs([
        { position: 'fl', brand: 'A' },
        { position: 'fr', brand: null },
      ]),
    ).not.toThrow();
  });
});
