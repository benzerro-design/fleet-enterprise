import { buildPublicUrl, resolveWebOrigin, webOriginLooksBroken } from './web-origin';

describe('web-origin', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.WEB_ORIGIN;
    delete process.env.WEB_PUBLIC_URL;
  });

  afterAll(() => {
    process.env = env;
  });

  it('flags truncated Cloud Run hosts', () => {
    expect(webOriginLooksBroken('https://fleet-web-stg.-run.app')).toBe(true);
    expect(webOriginLooksBroken('https://fleet-web-stg-.run.app')).toBe(true);
    expect(webOriginLooksBroken('https://fleet-web-stg.-run.app/invite/x')).toBe(true);
    expect(
      webOriginLooksBroken('https://fleet-web-stg-1096713529891.europe-west1.run.app'),
    ).toBe(false);
  });

  it('builds invite paths from WEB_ORIGIN without a trailing slash', () => {
    process.env.WEB_ORIGIN = 'https://fleet-web-stg-1096713529891.europe-west1.run.app/';
    expect(resolveWebOrigin()).toBe(
      'https://fleet-web-stg-1096713529891.europe-west1.run.app',
    );
    expect(buildPublicUrl('/invite/partner/abc')).toBe(
      'https://fleet-web-stg-1096713529891.europe-west1.run.app/invite/partner/abc',
    );
  });
});
