import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { AccessContext } from './access-context.types';
import { isDriverOnlyClientUser } from './client-access';

/** Categorii cost pe care șoferul le poate înregistra (note obligatorii). */
export const DRIVER_WRITABLE_COST_CATEGORIES = new Set([
  'Taxă pod',
  'Spălătorie',
  'Combustibil',
  'Parcare',
  'Amendă',
]);

export function isDriverWritableCostCategory(category: string): boolean {
  return DRIVER_WRITABLE_COST_CATEGORIES.has(category.trim());
}

export function assertDriverAssignedVehicle(access: AccessContext, vehicleId: string): void {
  const ids = access.assignedVehicleIds ?? [];
  if (!ids.includes(vehicleId)) {
    throw new ForbiddenException('Vehicle not in driver assignment scope');
  }
}

export function assertDriverCostNotes(category: string, notes?: string | null): void {
  if (!isDriverWritableCostCategory(category)) {
    throw new ForbiddenException('Cost category not allowed for driver');
  }
  if (!notes?.trim()) {
    throw new BadRequestException('notes is required for driver cost entries');
  }
}

export function canDriverWriteTrips(access: AccessContext): boolean {
  return isDriverOnlyClientUser(access);
}

export function canDriverWriteVehicleMedia(access: AccessContext): boolean {
  return isDriverOnlyClientUser(access);
}
