export type WorkOrderSettings = {
  requireServiceKm: boolean;
  updateFleetOdometerFromServiceKm: boolean;
  requirePartCode: boolean;
  defaultPartsWarrantyMonths: number;
  defaultPartsWarrantyKm: number;
  defaultLaborWarrantyMonths: number;
};

export const DEFAULT_WORK_ORDER_SETTINGS: WorkOrderSettings = {
  requireServiceKm: true,
  updateFleetOdometerFromServiceKm: true,
  requirePartCode: true,
  defaultPartsWarrantyMonths: 12,
  defaultPartsWarrantyKm: 20000,
  defaultLaborWarrantyMonths: 6,
};

export const workOrderSettingsBrowserBase = "/api/tenant/work-order-settings";
