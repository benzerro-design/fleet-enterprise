import {
  effectiveAppointmentProposeFleetFirst,
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
      appointmentProposeFleetFirst: false,
      ticketListBulkSelect: false,
      appointmentProposalHistoryTabs: false,
      allowClientAdminCreateUsers: false,
    });
  });

  it('reads flags', () => {
    expect(
      parseClientIamSettings({
        allowClientOcr: true,
        allowClientAcquisition: true,
        requireDriverAck: false,
        ticketListBulkSelect: true,
        appointmentProposalHistoryTabs: true,
        appointmentProposeFleetFirst: true,
        driverCanNegotiateAppointment: true,
        allowClientAdminCreateUsers: true,
      }),
    ).toEqual({
      allowClientOcr: true,
      allowClientAcquisition: true,
      requireDriverAck: true,
      driverCanNegotiateAppointment: true,
      appointmentProposeFleetFirst: true,
      ticketListBulkSelect: true,
      appointmentProposalHistoryTabs: true,
      allowClientAdminCreateUsers: true,
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
      appointmentProposeFleetFirst: false,
      ticketListBulkSelect: false,
      appointmentProposalHistoryTabs: false,
      allowClientAdminCreateUsers: false,
    });
  });

  it('ignores fleet-first when negotiate is off', () => {
    expect(
      parseClientIamSettings({
        appointmentProposeFleetFirst: true,
        driverCanNegotiateAppointment: false,
      }).appointmentProposeFleetFirst,
    ).toBe(false);
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

  it('accepts appointment proposal history flag', () => {
    expect(parseClientIamSettingsPatch({ appointmentProposalHistoryTabs: true })).toEqual({
      appointmentProposalHistoryTabs: true,
    });
  });

  it('accepts propose fleet-first flag', () => {
    expect(parseClientIamSettingsPatch({ appointmentProposeFleetFirst: true })).toEqual({
      appointmentProposeFleetFirst: true,
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

describe('effectiveAppointmentProposeFleetFirst', () => {
  it('requires negotiate', () => {
    expect(effectiveAppointmentProposeFleetFirst({ appointmentProposeFleetFirst: true })).toBe(false);
    expect(
      effectiveAppointmentProposeFleetFirst({
        appointmentProposeFleetFirst: true,
        driverCanNegotiateAppointment: true,
      }),
    ).toBe(true);
  });
});
