import type { AccessContext } from '../iam/access-context.types';
import { vehicleLinkedClientScope } from '../iam/client-access';

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
