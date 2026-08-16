export type WorkOrderSettings = {
  requireServiceKm: boolean;
  updateFleetOdometerFromServiceKm: boolean;
  requirePartCode: boolean;
  defaultPartsWarrantyMonths: number;
  defaultPartsWarrantyKm: number;
  defaultLaborWarrantyMonths: number;
  allowQuotePdfImport: boolean;
  allowPartsPriceVerify: boolean;
  allowPartsOrderLaunch: boolean;
  partsPriceSuspectPercent: number;
};

export const DEFAULT_WORK_ORDER_SETTINGS: WorkOrderSettings = {
  requireServiceKm: true,
  updateFleetOdometerFromServiceKm: true,
  requirePartCode: true,
  defaultPartsWarrantyMonths: 12,
  defaultPartsWarrantyKm: 20000,
  defaultLaborWarrantyMonths: 6,
  allowQuotePdfImport: true,
  allowPartsPriceVerify: true,
  allowPartsOrderLaunch: false,
  partsPriceSuspectPercent: 25,
};

export const workOrderSettingsBrowserBase = "/api/tenant/work-order-settings";
