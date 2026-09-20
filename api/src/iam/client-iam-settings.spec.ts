import {
  effectiveDriverCanNegotiate,
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
      driverCanNegotiateAppointment: false,
      ticketListBulkSelect: false,
    });
  });

  it('reads flags', () => {
    expect(
      parseClientIamSettings({
        allowClientOcr: true,
        allowClientAcquisition: true,
        requireDriverAck: false,
        ticketListBulkSelect: true,
      }),
    ).toEqual({
      allowClientOcr: true,
      allowClientAcquisition: true,
      requireDriverAck: false,
      driverCanNegotiateAppointment: false,
      ticketListBulkSelect: true,
    });
  });

  it('forces driver ack when negotiate is on', () => {
    expect(
      parseClientIamSettings({
        requireDriverAck: false,
        driverCanNegotiateAppointment: true,
      }),
    ).toEqual({
      allowClientOcr: false,
      allowClientAcquisition: false,
      requireDriverAck: true,
      driverCanNegotiateAppointment: true,
      ticketListBulkSelect: false,
    });
  });
});

describe('parseClientIamSettingsPatch', () => {
  it('rejects non-boolean', () => {
    expect(() => parseClientIamSettingsPatch({ allowClientOcr: 'yes' })).toThrow(/boolean/);
  });

  it('accepts negotiate flag', () => {
    expect(parseClientIamSettingsPatch({ driverCanNegotiateAppointment: true })).toEqual({
      driverCanNegotiateAppointment: true,
    });
  });

  it('accepts ticket list bulk flag', () => {
    expect(parseClientIamSettingsPatch({ ticketListBulkSelect: true })).toEqual({
      ticketListBulkSelect: true,
    });
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

  it('requires driver ack when negotiate is on unless override is false', () => {
    expect(
      effectiveRequireDriverAck({ driverCanNegotiateAppointment: true, requireDriverAck: false }, null),
    ).toBe(true);
    expect(
      effectiveRequireDriverAck({ driverCanNegotiateAppointment: true }, false),
    ).toBe(false);
  });
});

describe('effectiveDriverCanNegotiate', () => {
  it('defaults off', () => {
    expect(effectiveDriverCanNegotiate(null)).toBe(false);
    expect(effectiveDriverCanNegotiate({ driverCanNegotiateAppointment: true })).toBe(true);
  });
});
