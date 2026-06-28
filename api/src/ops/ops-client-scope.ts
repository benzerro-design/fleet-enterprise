import type { AccessContext } from '../iam/access-context.types';
import {
  isDriverOnlyClientUser,
  vehicleLinkedClientScope,
} from '../iam/client-access';

export function driverOnlyEmptyPage(access: AccessContext | undefined, page: number, pageSize: number) {
  if (access && isDriverOnlyClientUser(access)) {
    return { items: [], total: 0, page, pageSize };
  }
  return null;
}

export function mergeVehicleLinkedScope<T extends object>(
  parts: T[],
  access?: AccessContext,
): void {
  if (!access) return;
  const linked = vehicleLinkedClientScope(access);
  if (Object.keys(linked).length > 0) {
    parts.push(linked as T);
  }
}
