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
  clientId: string;
  registrationNumber: string;
  type: VehicleType;
  vin: string | null;
  status: VehicleStatus;
  odometerKm: number;
  itpExpiresOn: string | null;
  itpStationName: string | null;
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
