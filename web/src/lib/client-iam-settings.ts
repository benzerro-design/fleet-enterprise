export type ClientIamSettings = {
  allowClientOcr: boolean;
  allowClientAcquisition: boolean;
  requireDriverAck: boolean;
  driverCanNegotiateAppointment: boolean;
  /** Negociere ON: Propune rămâne în flotă până peeri Confirmă/Propune (mod B). */
  appointmentProposeFleetFirst: boolean;
  /** Manager client: selecție multiplă pe lista de tichete. Admin L* are oricum. Șoferul niciodată. */
  ticketListBulkSelect: boolean;
  /** Tab-uri Curente/Istoric pe PROGRAMĂRI. Admin L* are oricum. Șoferul niciodată. */
  appointmentProposalHistoryTabs: boolean;
  /** L1 (client_admin) poate crea useri direct pe clientul lui. Default off. */
  allowClientAdminCreateUsers: boolean;
};

export const DEFAULT_CLIENT_IAM_SETTINGS: ClientIamSettings = {
  allowClientOcr: false,
  allowClientAcquisition: false,
  requireDriverAck: true,
  driverCanNegotiateAppointment: false,
  appointmentProposeFleetFirst: false,
  ticketListBulkSelect: false,
  appointmentProposalHistoryTabs: false,
  allowClientAdminCreateUsers: false,
};

/** Normalizează răspunsul API (câmpuri lipsă = default). */
export function normalizeClientIamSettings(data: Partial<ClientIamSettings> | null | undefined): ClientIamSettings {
  const negotiate = data?.driverCanNegotiateAppointment === true;
  return {
    allowClientOcr: data?.allowClientOcr === true,
    allowClientAcquisition: data?.allowClientAcquisition === true,
    requireDriverAck: data?.requireDriverAck !== false,
    driverCanNegotiateAppointment: negotiate,
    appointmentProposeFleetFirst: negotiate && data?.appointmentProposeFleetFirst === true,
    ticketListBulkSelect: data?.ticketListBulkSelect === true,
    appointmentProposalHistoryTabs: data?.appointmentProposalHistoryTabs === true,
    allowClientAdminCreateUsers: data?.allowClientAdminCreateUsers === true,
  };
}
