/** Mirrors api service-case-workflow.utils tire codes (UI-safe). */
export const TIRE_SERVICE_TYPE_CODES = new Set(["tire_service"]);
export const TIRE_STORAGE_SERVICE_TYPE_CODES = new Set(["tire_storage"]);

export function isTireServiceTypeCode(code: string | null | undefined): boolean {
  return !!code && TIRE_SERVICE_TYPE_CODES.has(code);
}

export function isTireStorageTypeCode(code: string | null | undefined): boolean {
  return !!code && TIRE_STORAGE_SERVICE_TYPE_CODES.has(code);
}
