import { fleetServerFetch } from "@/lib/fleet-server";
import type { VehicleRecord } from "@/lib/fleet-api";
import type {
  OdometerReadingsPayload,
  VehicleAcquisitionPayload,
  VehicleCivPayload,
  VehiclePhotosPayload,
} from "@/lib/vehicle-profile-types";
import type { MaintenancePlanPayload } from "@/lib/maintenance-plan-types";
import type { VehicleMobilityPayload } from "@/lib/vehicle-mobility-types";
import type { DriverAssignmentRecord } from "@/lib/drivers-api";

const OPS_PREVIEW_PAGE_SIZE = 50;

export type MaintenanceListPayload = {
  items: Array<{
    id: string;
    title: string;
    provider: string | null;
    costAllocationCode: string | null;
    invoiceNumber: string | null;
    invoiceDate: string | null;
    performedAt: string | null;
    odometerKm: number | null;
    costCents: number | null;
  }>;
  total: number;
};

export type CostListPayload = {
  items: Array<{
    id: string;
    category: string;
    provider: string | null;
    amountCents: number;
    odometerKm: number | null;
    fuelLiters: number | null;
    invoiceNumber: string | null;
    invoiceDate: string | null;
    incurredOn: string;
  }>;
  total: number;
};

export type DocumentListPayload = {
  items: Array<{
    id: string;
    title: string;
    documentTypeCode: string;
    expiresOn: string | null;
    fileUrl: string | null;
    reminder?: import("@/lib/document-reminders").DocumentReminderSummary;
  }>;
  total: number;
};

export const EMPTY_MAINTENANCE_PLAN: MaintenancePlanPayload = {
  items: [],
  vehicleOdometerKm: 0,
  stats: { total: 0, active: 0, dueSoon: 0, overdue: 0, syncedReminders: 0 },
};

export const EMPTY_ACQUISITION: VehicleAcquisitionPayload = {
  acquisitionType: null,
  acquiredOn: null,
  dealerName: null,
  financierName: null,
  purchasePriceCents: null,
  downPaymentCents: null,
  contractNumber: null,
  contractStartOn: null,
  contractEndOn: null,
  monthlyPaymentCents: null,
  residualValueCents: null,
  warrantyExpiresOn: null,
  warrantyKmLimit: null,
  warrantyProvider: null,
  acquisitionNotes: null,
};

export const EMPTY_CIV: VehicleCivPayload = {
  civSeries: null,
  civIssuedOn: null,
  civRarOffice: null,
  civMentions: null,
  civProfile: {},
  civImportedFromDocumentId: null,
  civFilledCount: 0,
  civTotalFields: 0,
  importSource: null,
};

async function getVehicle(id: string): Promise<VehicleRecord | null> {
  try {
    const res = await fleetServerFetch(`/fleet/vehicles/${id}`);
    if (!res) return null;
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return (await res.json()) as VehicleRecord;
  } catch {
    return null;
  }
}

async function getVehicleCiv(id: string): Promise<VehicleCivPayload | null> {
  try {
    const res = await fleetServerFetch(`/fleet/vehicles/${id}/civ`);
    if (!res?.ok) return null;
    return (await res.json()) as VehicleCivPayload;
  } catch {
    return null;
  }
}

async function getOdometerReadings(id: string): Promise<OdometerReadingsPayload | null> {
  try {
    const res = await fleetServerFetch(`/fleet/vehicles/${id}/odometer-readings`);
    if (!res?.ok) return null;
    return (await res.json()) as OdometerReadingsPayload;
  } catch {
    return null;
  }
}

function maintenanceListQuery(registrationNumber: string): string {
  const q = new URLSearchParams();
  q.set("page", "1");
  q.set("pageSize", String(OPS_PREVIEW_PAGE_SIZE));
  q.set("registrationNumber", registrationNumber.trim());
  return q.toString();
}

function costsListQuery(registrationNumber: string): string {
  const q = new URLSearchParams();
  q.set("page", "1");
  q.set("pageSize", String(OPS_PREVIEW_PAGE_SIZE));
  q.set("registrationNumber", registrationNumber.trim());
  return q.toString();
}

function documentsListQuery(registrationNumber: string): string {
  const q = new URLSearchParams();
  q.set("page", "1");
  q.set("pageSize", String(OPS_PREVIEW_PAGE_SIZE));
  q.set("registrationNumber", registrationNumber.trim());
  return q.toString();
}

async function getMaintenanceForVehicle(registrationNumber: string): Promise<MaintenanceListPayload | null> {
  const res = await fleetServerFetch(`/maintenance?${maintenanceListQuery(registrationNumber)}`);
  if (!res?.ok) return null;
  return (await res.json()) as MaintenanceListPayload;
}

async function getCostsForVehicle(registrationNumber: string): Promise<CostListPayload | null> {
  const res = await fleetServerFetch(`/costs?${costsListQuery(registrationNumber)}`);
  if (!res?.ok) return null;
  return (await res.json()) as CostListPayload;
}

async function getDocumentsForVehicle(registrationNumber: string): Promise<DocumentListPayload | null> {
  const res = await fleetServerFetch(`/documents?${documentsListQuery(registrationNumber)}`);
  if (!res?.ok) return null;
  return (await res.json()) as DocumentListPayload;
}

async function getDriverAssignments(id: string): Promise<DriverAssignmentRecord[]> {
  try {
    const res = await fleetServerFetch(`/fleet/vehicles/${id}/driver-assignments`);
    if (!res?.ok) return [];
    return (await res.json()) as DriverAssignmentRecord[];
  } catch {
    return [];
  }
}

async function getVehicleMobility(id: string): Promise<VehicleMobilityPayload | null> {
  try {
    const res = await fleetServerFetch(`/fleet/vehicles/${id}/mobility`);
    if (!res?.ok) return null;
    return (await res.json()) as VehicleMobilityPayload;
  } catch {
    return null;
  }
}

async function getVehicleAcquisition(id: string): Promise<VehicleAcquisitionPayload | null> {
  try {
    const res = await fleetServerFetch(`/fleet/vehicles/${id}/acquisition`);
    if (!res?.ok) return null;
    return (await res.json()) as VehicleAcquisitionPayload;
  } catch {
    return null;
  }
}

async function getVehiclePhotos(id: string): Promise<VehiclePhotosPayload | null> {
  try {
    const res = await fleetServerFetch(`/fleet/vehicles/${id}/photos`);
    if (!res?.ok) return null;
    return (await res.json()) as VehiclePhotosPayload;
  } catch {
    return null;
  }
}

async function getMaintenancePlan(id: string): Promise<MaintenancePlanPayload | null> {
  try {
    const res = await fleetServerFetch(`/fleet/vehicles/${id}/maintenance-plan`);
    if (!res?.ok) return null;
    return (await res.json()) as MaintenancePlanPayload;
  } catch {
    return null;
  }
}

export type VehicleDetailData = {
  vehicle: VehicleRecord;
  maintenanceList: MaintenanceListPayload | null;
  costsList: CostListPayload | null;
  documentsList: DocumentListPayload | null;
  civPayload: VehicleCivPayload;
  acquisitionPayload: VehicleAcquisitionPayload;
  photosPayload: VehiclePhotosPayload;
  odometerPayload: OdometerReadingsPayload;
  mobilityPayload: VehicleMobilityPayload | null;
  maintenancePlanPayload: MaintenancePlanPayload;
  driverAssignments: DriverAssignmentRecord[];
};

export async function loadVehicleDetail(id: string): Promise<VehicleDetailData | null> {
  const vehicle = await getVehicle(id);
  if (!vehicle) return null;

  const [maintenanceList, costsList, documentsList, civ, acquisition, photos, odometer, mobility, maintenancePlan, driverAssignments] =
    await Promise.all([
    getMaintenanceForVehicle(vehicle.registrationNumber),
    getCostsForVehicle(vehicle.registrationNumber),
    getDocumentsForVehicle(vehicle.registrationNumber),
    getVehicleCiv(id),
    getVehicleAcquisition(id),
    getVehiclePhotos(id),
    getOdometerReadings(id),
    getVehicleMobility(id),
    getMaintenancePlan(id),
    getDriverAssignments(id),
  ]);

  return {
    vehicle,
    maintenanceList,
    costsList,
    documentsList,
    civPayload: civ ?? EMPTY_CIV,
    acquisitionPayload: acquisition ?? EMPTY_ACQUISITION,
    photosPayload: photos ?? { items: [] },
    odometerPayload: odometer ?? { items: [], vehicleOdometerKm: vehicle.odometerKm },
    mobilityPayload: mobility,
    maintenancePlanPayload: maintenancePlan ?? {
      ...EMPTY_MAINTENANCE_PLAN,
      vehicleOdometerKm: vehicle.odometerKm,
    },
    driverAssignments,
  };
}
