import type { AcquisitionType } from './dto/patch-vehicle-acquisition.dto';

export type VehicleAcquisitionPayload = {
  acquisitionType: AcquisitionType | null;
  acquiredOn: string | null;
  dealerName: string | null;
  financierName: string | null;
  purchasePriceCents: number | null;
  downPaymentCents: number | null;
  contractNumber: string | null;
  contractStartOn: string | null;
  contractEndOn: string | null;
  monthlyPaymentCents: number | null;
  residualValueCents: number | null;
  warrantyExpiresOn: string | null;
  warrantyKmLimit: number | null;
  warrantyProvider: string | null;
  acquisitionNotes: string | null;
};

export type VehiclePhotoRecord = {
  id: string;
  vehicleId: string;
  fileUrl: string;
  fileName: string | null;
  caption: string | null;
  sessionLabel: string | null;
  kind: 'exterior' | 'interior' | 'damage' | 'document' | 'other' | null;
  sortOrder: number;
  createdAt: string;
  uploadedByEmail: string | null;
};

export type VehiclePhotosPayload = {
  items: VehiclePhotoRecord[];
};
