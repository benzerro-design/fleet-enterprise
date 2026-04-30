export type CreateVehicleDocumentDto = {
  documentTypeCode: string;
  title: string;
  expiresOn?: string | null;
  fileUrl?: string | null;
};
