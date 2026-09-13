import { parseClientIamSettings, parseClientIamSettingsPatch } from './client-iam-settings';

describe('parseClientIamSettings', () => {
  it('defaults conservatively', () => {
    expect(parseClientIamSettings(null)).toEqual({
      allowClientOcr: false,
      allowClientAcquisition: false,
      requireDriverAck: true,
    });
  });

  it('reads flags', () => {
    expect(
      parseClientIamSettings({
        allowClientOcr: true,
        allowClientAcquisition: true,
        requireDriverAck: false,
      }),
    ).toEqual({
      allowClientOcr: true,
      allowClientAcquisition: true,
      requireDriverAck: false,
    });
  });
});

describe('parseClientIamSettingsPatch', () => {
  it('rejects non-boolean', () => {
    expect(() => parseClientIamSettingsPatch({ allowClientOcr: 'yes' })).toThrow(/boolean/);
  });
});
