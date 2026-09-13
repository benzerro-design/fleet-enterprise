export type ClientIamSettings = {
  allowClientOcr: boolean;
  allowClientAcquisition: boolean;
  requireDriverAck: boolean;
};

export const DEFAULT_CLIENT_IAM_SETTINGS: ClientIamSettings = {
  allowClientOcr: false,
  allowClientAcquisition: false,
  requireDriverAck: true,
};
