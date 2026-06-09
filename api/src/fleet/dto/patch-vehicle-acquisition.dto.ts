export type AcquisitionType = 'cash' | 'financial_leasing' | 'operational_leasing';

export type PatchVehicleAcquisitionDto = {
  acquisitionType?: AcquisitionType | null;
  acquiredOn?: string | null;
  dealerName?: string | null;
  financierName?: string | null;
  purchasePriceCents?: number | null;
  downPaymentCents?: number | null;
  contractNumber?: string | null;
  contractStartOn?: string | null;
  contractEndOn?: string | null;
  monthlyPaymentCents?: number | null;
  residualValueCents?: number | null;
  warrantyExpiresOn?: string | null;
  warrantyKmLimit?: number | null;
  warrantyProvider?: string | null;
  acquisitionNotes?: string | null;
};

export type CreateVehiclePhotoDto = {
  fileUrl: string;
  fileName?: string | null;
  caption?: string | null;
};
