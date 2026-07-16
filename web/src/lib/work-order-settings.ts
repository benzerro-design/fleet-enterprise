export type WorkOrderSettings = {
  requireServiceKm: boolean;
  updateFleetOdometerFromServiceKm: boolean;
};

export const DEFAULT_WORK_ORDER_SETTINGS: WorkOrderSettings = {
  requireServiceKm: true,
  updateFleetOdometerFromServiceKm: true,
};

export const workOrderSettingsBrowserBase = "/api/tenant/work-order-settings";
