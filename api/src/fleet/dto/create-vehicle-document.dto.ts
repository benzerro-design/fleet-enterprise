export type CreateVehicleDocumentDto = {
  documentTypeCode: string;
  title: string;
  expiresOn?: string | null;
  fileUrl?: string | null;
  /** FLEET-027 */
  vehicleEquipmentId?: string | null;
};
