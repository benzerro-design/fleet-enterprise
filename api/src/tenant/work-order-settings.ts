export type WorkOrderSettings = {
  /** Km in / km out obligatorii la marcarea in/out service. */
  requireServiceKm: boolean;
  /** Actualizează odometrul flotă al vehiculului din km in/out (doar dacă >= km curent). */
  updateFleetOdometerFromServiceKm: boolean;
};

export const DEFAULT_WORK_ORDER_SETTINGS: WorkOrderSettings = {
  requireServiceKm: true,
  updateFleetOdometerFromServiceKm: true,
};

export function parseWorkOrderSettings(raw: unknown): WorkOrderSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_WORK_ORDER_SETTINGS };
  }
  const o = raw as Record<string, unknown>;
  return {
    requireServiceKm:
      typeof o.requireServiceKm === 'boolean'
        ? o.requireServiceKm
        : DEFAULT_WORK_ORDER_SETTINGS.requireServiceKm,
    updateFleetOdometerFromServiceKm:
      typeof o.updateFleetOdometerFromServiceKm === 'boolean'
        ? o.updateFleetOdometerFromServiceKm
        : DEFAULT_WORK_ORDER_SETTINGS.updateFleetOdometerFromServiceKm,
  };
}

export function parseWorkOrderSettingsPatch(body: unknown): Partial<WorkOrderSettings> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Invalid body');
  }
  const o = body as Record<string, unknown>;
  const patch: Partial<WorkOrderSettings> = {};
  if (o.requireServiceKm !== undefined) {
    if (typeof o.requireServiceKm !== 'boolean') throw new Error('requireServiceKm must be boolean');
    patch.requireServiceKm = o.requireServiceKm;
  }
  if (o.updateFleetOdometerFromServiceKm !== undefined) {
    if (typeof o.updateFleetOdometerFromServiceKm !== 'boolean') {
      throw new Error('updateFleetOdometerFromServiceKm must be boolean');
    }
    patch.updateFleetOdometerFromServiceKm = o.updateFleetOdometerFromServiceKm;
  }
  if (Object.keys(patch).length === 0) throw new Error('No settings to update');
  return patch;
}
