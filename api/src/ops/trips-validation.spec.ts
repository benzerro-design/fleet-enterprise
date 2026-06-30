import { BadRequestException } from '@nestjs/common';
import { assertValidTripOdometer } from './trips-validation';

describe('trips-validation', () => {
  it('rejects odometer end below start', () => {
    expect(() =>
      assertValidTripOdometer({ odometerStartKm: 5000, odometerEndKm: 4000 }),
    ).toThrow(BadRequestException);
  });

  it('allows valid odometer range', () => {
    expect(() =>
      assertValidTripOdometer({ odometerStartKm: 4000, odometerEndKm: 5000 }),
    ).not.toThrow();
  });

  it('allows only start or only end', () => {
    expect(() => assertValidTripOdometer({ odometerStartKm: 1000 })).not.toThrow();
    expect(() => assertValidTripOdometer({ odometerEndKm: 2000 })).not.toThrow();
  });
});
