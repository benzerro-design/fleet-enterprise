export type ClientIamSettings = {
  allowClientOcr: boolean;
  allowClientAcquisition: boolean;
  requireDriverAck: boolean;
  driverCanNegotiateAppointment: boolean;
  /** Manager client: selecție multiplă pe lista de tichete. Admin L* are oricum. Șoferul niciodată. */
  ticketListBulkSelect: boolean;
  /** Tab-uri Curente/Istoric pe PROGRAMĂRI. Admin L* are oricum. Șoferul niciodată. */
  appointmentProposalHistoryTabs: boolean;
};

export const DEFAULT_CLIENT_IAM_SETTINGS: ClientIamSettings = {
  allowClientOcr: false,
  allowClientAcquisition: false,
  requireDriverAck: true,
  driverCanNegotiateAppointment: false,
  ticketListBulkSelect: false,
  appointmentProposalHistoryTabs: false,
};

/** Normalizează răspunsul API (câmpuri lipsă = default). */
export function normalizeClientIamSettings(data: Partial<ClientIamSettings> | null | undefined): ClientIamSettings {
  return {
    allowClientOcr: data?.allowClientOcr === true,
    allowClientAcquisition: data?.allowClientAcquisition === true,
    requireDriverAck: data?.requireDriverAck !== false,
    driverCanNegotiateAppointment: data?.driverCanNegotiateAppointment === true,
    ticketListBulkSelect: data?.ticketListBulkSelect === true,
    appointmentProposalHistoryTabs: data?.appointmentProposalHistoryTabs === true,
  };
}
