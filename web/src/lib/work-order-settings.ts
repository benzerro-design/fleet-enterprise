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
  /**
   * Facturare pe comandă:
   * - per_work_order = o factură din liniile aprobate consolidate
   * - per_quote = factură separată pe fiecare deviz aprobat
   */
  quoteInvoiceMode: "per_work_order" | "per_quote";
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
  quoteInvoiceMode: "per_quote",
};

export const workOrderSettingsBrowserBase = "/api/tenant/work-order-settings";
