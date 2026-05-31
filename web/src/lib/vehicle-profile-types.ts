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

export type VehicleProfileTab = "basic" | "advanced" | "odometer";
