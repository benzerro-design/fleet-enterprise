import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { AccessContext } from './access-context.types';
import { isDriverOnlyClientUser, vehicleClientScope } from './client-access';

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

/** ID-uri Driver entity legate de user (ClientMembership.driverId). */
export function driverIdsFromAccess(access: AccessContext): string[] {
  return access.clientMemberships
    .map((m) => m.driverId)
    .filter((id): id is string => Boolean(id));
}

/** L0 — listă curse: doar activitatea șoferului, indiferent de vehicul. */
export function mergeDriverTripListScope(
  parts: Prisma.TripWhereInput[],
  access?: AccessContext,
): void {
  if (!access || access.isTenantWide || !isDriverOnlyClientUser(access)) return;
  const ids = driverIdsFromAccess(access);
  parts.push(ids.length === 0 ? { id: { in: [] } } : { driverId: { in: ids } });
}

/** L0 — documente parcurs: doar cu driverIdFilter al șoferului. */
export function mergeDriverTripSheetScope(
  parts: Prisma.TripSheetDocumentWhereInput[],
  access?: AccessContext,
): void {
  if (!access || access.isTenantWide || !isDriverOnlyClientUser(access)) return;
  const ids = driverIdsFromAccess(access);
  parts.push(ids.length === 0 ? { id: { in: [] } } : { driverIdFilter: { in: ids } });
}

/** Vehicule pentru curse/doc parcurs L0: alocate + istoric curse. */
export async function tripOpsVehicleScope(
  prisma: PrismaService,
  tenantId: string,
  access: AccessContext,
): Promise<Prisma.VehicleWhereInput> {
  if (!isDriverOnlyClientUser(access)) {
    return vehicleClientScope(access);
  }
  const driverIds = driverIdsFromAccess(access);
  const assigned = access.assignedVehicleIds ?? [];
  const fromTrips =
    driverIds.length > 0
      ? (
          await prisma.trip.findMany({
            where: { tenantId, driverId: { in: driverIds } },
            select: { vehicleId: true },
            distinct: ['vehicleId'],
          })
        ).map((t) => t.vehicleId)
      : [];
  const ids = [...new Set([...assigned, ...fromTrips])];
  if (ids.length === 0) return { id: { in: [] } };
  return { id: { in: ids } };
}
