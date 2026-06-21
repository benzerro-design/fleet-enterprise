export type VehicleStatus =
  | 'active'
  | 'inactive'
  | 'in_maintenance'
  | 'decommissioned';

export type VehicleType =
  | 'car'
  | 'van_lt_3_5'
  | 'van_gt_3_5'
  | 'tractor_unit'
  | 'trailer'
  | 'semi_trailer';

export type VehicleDocument = {
  id: string;
  documentTypeCode: string;
  title: string;
  expiresOn: string | null;
  fileUrl: string | null;
  createdAt: string;
};

export type VehicleRecord = {
  id: string;
  tenantId: string;
  /** Cod client (afișare / filtre / compat API). */
  clientId: string;
  clientRefId: string;
  clientLegalName: string;
  registrationNumber: string;
  type: VehicleType;
  brand: string | null;
  model: string | null;
  vin: string | null;
  status: VehicleStatus;
  odometerKm: number;
  fuelType: string | null;
  itpExpiresOn: string | null;
  itpStationName: string | null;
  itpReminderOffsetsDays: number[] | null;
  itpReminderMenuSyncEnabled: boolean;
  civSeries: string | null;
  civIssuedOn: string | null;
  civRarOffice: string | null;
  civMentions: string | null;
  civProfile: Record<string, string | number | null>;
  civImportedFromDocumentId: string | null;
  documents: VehicleDocument[];
  createdAt: string;
  updatedAt: string;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdByEmail: string | null;
  updatedByEmail: string | null;
};

export type VehicleListResponse = {
  items: VehicleRecord[];
  total: number;
  page: number;
  pageSize: number;
};
