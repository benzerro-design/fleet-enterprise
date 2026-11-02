import { rsaDropoffMapsUrl, rsaMissionDropoffQrPayload } from './rsa-dropoff-qr';

describe('rsa-dropoff-qr', () => {
  it('builds dropoff QR payload', () => {
    expect(
      rsaMissionDropoffQrPayload({
        missionId: 'm1',
        vehicleReg: 'B-01-RSA',
        dropoffLocationText: 'Service Nord',
      }),
    ).toBe('FE:rsa-mission:m1|veh:B-01-RSA|to:Service Nord');
  });

  it('omits empty optional parts', () => {
    expect(rsaMissionDropoffQrPayload({ missionId: 'abc' })).toBe('FE:rsa-mission:abc');
  });

  it('maps URL', () => {
    expect(rsaDropoffMapsUrl('Str. Exemplu 1')).toContain('google.com/maps');
    expect(rsaDropoffMapsUrl(null)).toBeNull();
  });
});
