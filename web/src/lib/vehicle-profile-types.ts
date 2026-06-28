import type { VehicleCivProfile } from "@/lib/vehicle-civ-fields";

export type CivImportSource = {
  documentId: string;
  title: string;
  fileUrl: string;
  fileName: string | null;
  expiresOn: string | null;
  uploadedAt: string;
} | null;

export type VehicleCivPayload = {
  civSeries: string | null;
  civIssuedOn: string | null;
  civRarOffice: string | null;
  civMentions: string | null;
  civProfile: VehicleCivProfile;
  civImportedFromDocumentId: string | null;
  civFilledCount: number;
  civTotalFields: number;
  importSource: CivImportSource;
};

export type OdometerReadingRow = {
  id: string;
  vehicleId: string;
  odometerKm: number;
  source: "manual" | "tracking" | "import";
  sourceRef: string | null;
  notes: string | null;
  recordedAt: string;
  recordedByEmail: string | null;
};

export type OdometerReadingsPayload = {
  items: OdometerReadingRow[];
  vehicleOdometerKm: number;
};

export type AcquisitionType = "cash" | "financial_leasing" | "operational_leasing";

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

export type VehiclePhotoRow = {
  id: string;
  vehicleId: string;
  fileUrl: string;
  fileName: string | null;
  caption: string | null;
  sortOrder: number;
  createdAt: string;
  uploadedByEmail: string | null;
};

export type VehiclePhotosPayload = {
  items: VehiclePhotoRow[];
};

export type VehicleProfileTab =
  | "basic"
  | "advanced"
  | "acquisition"
  | "photos"
  | "odometer"
  | "maintenance_plan"
  | "drivers";

export type MaintenancePlanPayload = import("@/lib/maintenance-plan-types").MaintenancePlanPayload;
