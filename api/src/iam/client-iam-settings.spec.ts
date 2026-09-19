import {
  effectiveRequireDriverAck,
  parseClientIamSettings,
  parseClientIamSettingsPatch,
} from './client-iam-settings';

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

describe('effectiveRequireDriverAck', () => {
  it('inherits client default when override is null', () => {
    expect(effectiveRequireDriverAck({ requireDriverAck: false }, null)).toBe(false);
    expect(effectiveRequireDriverAck({ requireDriverAck: true }, null)).toBe(true);
    expect(effectiveRequireDriverAck(null, null)).toBe(true);
  });

  it('lets L1 override win', () => {
    expect(effectiveRequireDriverAck({ requireDriverAck: true }, false)).toBe(false);
    expect(effectiveRequireDriverAck({ requireDriverAck: false }, true)).toBe(true);
  });
});
