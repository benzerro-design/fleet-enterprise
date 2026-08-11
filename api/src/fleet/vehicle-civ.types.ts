import type { VehicleCivProfile } from './vehicle-civ-fields';

export type OdometerReadingRecord = {
  id: string;
  vehicleId: string;
  odometerKm: number;
  source: 'manual' | 'tracking' | 'import' | 'ops';
  sourceRef: string | null;
  notes: string | null;
  recordedAt: string;
  recordedByEmail: string | null;
};

export type CivImportSource = {
  documentId: string;
  title: string;
  fileUrl: string;
  fileName: string | null;
  /** Scan verso (document separat civ_verso), dacă există. */
  fileUrlVerso?: string | null;
  fileNameVerso?: string | null;
  documentIdVerso?: string | null;
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
