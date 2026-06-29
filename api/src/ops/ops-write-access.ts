import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MembershipRole } from '@prisma/client';
import type { AccessContext } from '../iam/access-context.types';
import {
  assertClientAccess,
  assertClientFleetWrite,
  canWriteClientFleet,
  isDriverOnlyClientUser,
} from '../iam/client-access';
import {
  assertDriverAssignedVehicle,
  assertDriverCostNotes,
  driverIdsFromAccess,
  isDriverWritableCostCategory,
} from '../iam/driver-access';
import { resolveClientInTenant } from '../clients/client-resolve';
import type { PrismaService } from '../prisma/prisma.service';

function denyViewerWrite(access: AccessContext | undefined): void {
  if (access?.membershipRole === MembershipRole.tenant_viewer) {
    throw new ForbiddenException('Insufficient permissions for fleet write');
  }
}

export async function assertVehicleOpsWrite(
  prisma: PrismaService,
  tenantSlug: string,
  vehicleId: string,
  access?: AccessContext,
): Promise<void> {
  denyViewerWrite(access);
  if (!access || access.isTenantWide) return;

  if (!canWriteClientFleet(access)) {
    throw new ForbiddenException('Insufficient permissions for fleet write');
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, tenant: { slug: tenantSlug } },
    select: { clientId: true },
  });
  if (!vehicle) throw new NotFoundException('Vehicle not found');
  assertClientAccess(access, vehicle.clientId);
}

/** Citire vehicul — client scope sau vehicule alocate (șofer). */
export async function assertVehicleOpsRead(
  prisma: PrismaService,
  tenantSlug: string,
  vehicleId: string,
  access?: AccessContext,
): Promise<void> {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, tenant: { slug: tenantSlug } },
    select: { clientId: true },
  });
  if (!vehicle) throw new NotFoundException('Vehicle not found');
  if (access && !access.isTenantWide) {
    if (isDriverOnlyClientUser(access)) {
      if ((access.assignedVehicleIds ?? []).includes(vehicleId)) return;
      const ownIds = driverIdsFromAccess(access);
      const drove = await prisma.trip.findFirst({
        where: {
          vehicleId,
          driverId: { in: ownIds },
          tenant: { slug: tenantSlug },
        },
        select: { id: true },
      });
      if (!drove) {
        throw new ForbiddenException('Vehicle not in driver scope');
      }
      return;
    }
    assertClientAccess(access, vehicle.clientId);
  }
}

/** Curse — șofer pe vehicule alocate; manager pe client. */
export async function assertTripVehicleWrite(
  prisma: PrismaService,
  tenantSlug: string,
  vehicleId: string,
  access?: AccessContext,
): Promise<void> {
  denyViewerWrite(access);
  if (!access || access.isTenantWide) return;
  if (isDriverOnlyClientUser(access)) {
    await assertVehicleOpsRead(prisma, tenantSlug, vehicleId, access);
    return;
  }
  await assertVehicleOpsWrite(prisma, tenantSlug, vehicleId, access);
}

/** Fotografii / odometru — șofer pe vehicule alocate. */
export async function assertDriverMediaWrite(
  prisma: PrismaService,
  tenantSlug: string,
  vehicleId: string,
  access?: AccessContext,
): Promise<void> {
  denyViewerWrite(access);
  if (!access || access.isTenantWide) return;
  if (isDriverOnlyClientUser(access)) {
    await assertVehicleOpsRead(prisma, tenantSlug, vehicleId, access);
    return;
  }
  await assertVehicleOpsWrite(prisma, tenantSlug, vehicleId, access);
}

export async function assertCostCreateWrite(
  prisma: PrismaService,
  tenantSlug: string,
  vehicleId: string,
  category: string,
  notes: string | null | undefined,
  access?: AccessContext,
): Promise<void> {
  denyViewerWrite(access);
  if (!access || access.isTenantWide) return;
  if (isDriverOnlyClientUser(access)) {
    await assertVehicleOpsRead(prisma, tenantSlug, vehicleId, access);
    assertDriverCostNotes(category, notes);
    return;
  }
  await assertVehicleOpsWrite(prisma, tenantSlug, vehicleId, access);
}

export async function assertCostPatchWrite(
  prisma: PrismaService,
  tenantSlug: string,
  vehicleId: string,
  category: string,
  notes: string | null | undefined,
  access?: AccessContext,
): Promise<void> {
  denyViewerWrite(access);
  if (access && isDriverOnlyClientUser(access)) {
    await assertVehicleOpsRead(prisma, tenantSlug, vehicleId, access);
    assertDriverCostNotes(category, notes);
    return;
  }
  await assertVehicleOpsWrite(prisma, tenantSlug, vehicleId, access);
}

export async function assertClientCodeOpsWrite(
  prisma: PrismaService,
  tenantId: string,
  clientIdOrCode: string,
  access?: AccessContext,
): Promise<string> {
  denyViewerWrite(access);
  if (!access || access.isTenantWide) {
    const client = await resolveClientInTenant(prisma, tenantId, clientIdOrCode);
    return client.id;
  }

  const client = await resolveClientInTenant(prisma, tenantId, clientIdOrCode);
  assertClientFleetWrite(access, client.id);
  return client.id;
}

export async function assertDriverOpsWrite(
  prisma: PrismaService,
  tenantSlug: string,
  driverId: string,
  access?: AccessContext,
): Promise<void> {
  denyViewerWrite(access);
  if (!access || access.isTenantWide) return;

  if (!canWriteClientFleet(access)) {
    throw new ForbiddenException('Insufficient permissions for fleet write');
  }

  const driver = await prisma.driver.findFirst({
    where: { id: driverId, tenant: { slug: tenantSlug } },
    select: { clientId: true },
  });
  if (!driver) throw new NotFoundException('Driver not found');
  assertClientAccess(access, driver.clientId);
}

async function vehicleIdFromTrip(prisma: PrismaService, tenantSlug: string, tripId: string): Promise<string> {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, tenant: { slug: tenantSlug } },
    select: { vehicleId: true },
  });
  if (!trip) throw new NotFoundException('Trip not found');
  return trip.vehicleId;
}

async function vehicleIdFromMaintenance(prisma: PrismaService, tenantSlug: string, id: string): Promise<string> {
  const row = await prisma.maintenanceEntry.findFirst({
    where: { id, tenant: { slug: tenantSlug } },
    select: { vehicleId: true },
  });
  if (!row) throw new NotFoundException('Maintenance entry not found');
  return row.vehicleId;
}

async function vehicleIdFromDocument(prisma: PrismaService, tenantSlug: string, id: string): Promise<string> {
  const row = await prisma.vehicleDocument.findFirst({
    where: { id, vehicle: { tenant: { slug: tenantSlug } } },
    select: { vehicleId: true },
  });
  if (!row) throw new NotFoundException('Document not found');
  return row.vehicleId;
}

export async function assertTripOpsRead(
  prisma: PrismaService,
  tenantSlug: string,
  tripId: string,
  access?: AccessContext,
): Promise<void> {
  const row = await prisma.trip.findFirst({
    where: { id: tripId, tenant: { slug: tenantSlug } },
    select: { driverId: true, vehicle: { select: { clientId: true } } },
  });
  if (!row) throw new NotFoundException('Trip not found');
  if (!access || access.isTenantWide) return;
  if (isDriverOnlyClientUser(access)) {
    const ownIds = driverIdsFromAccess(access);
    if (!row.driverId || !ownIds.includes(row.driverId)) {
      throw new ForbiddenException('Trip not in driver scope');
    }
    return;
  }
  assertClientAccess(access, row.vehicle.clientId);
}

export async function assertTripOpsWrite(
  prisma: PrismaService,
  tenantSlug: string,
  tripId: string,
  access?: AccessContext,
): Promise<void> {
  const row = await prisma.trip.findFirst({
    where: { id: tripId, tenant: { slug: tenantSlug } },
    select: { driverId: true, vehicleId: true, vehicle: { select: { clientId: true } } },
  });
  if (!row) throw new NotFoundException('Trip not found');
  if (access && isDriverOnlyClientUser(access)) {
    const ownIds = driverIdsFromAccess(access);
    if (!row.driverId || !ownIds.includes(row.driverId)) {
      throw new ForbiddenException('Trip not in driver scope');
    }
    const assigned = access.assignedVehicleIds ?? [];
    if (!assigned.includes(row.vehicleId)) {
      throw new ForbiddenException('Trip on historical vehicle is read-only');
    }
    denyViewerWrite(access);
    return;
  }
  const vehicleId = row.vehicleId;
  await assertTripVehicleWrite(prisma, tenantSlug, vehicleId, access);
}

/** Generare foaie parcurs — șofer doar pentru sine; L≥1 pe client. */
export async function assertTripSheetGenerate(
  prisma: PrismaService,
  tenantSlug: string,
  vehicleIds: string[],
  driverIdFilter: string | null | undefined,
  access?: AccessContext,
): Promise<string | null> {
  denyViewerWrite(access);
  if (!access || access.isTenantWide) return driverIdFilter ?? null;

  if (isDriverOnlyClientUser(access)) {
    const ownIds = driverIdsFromAccess(access);
    if (ownIds.length === 0) {
      throw new ForbiddenException('Driver profile not linked');
    }
    const effectiveDriverId = driverIdFilter?.trim() || ownIds[0];
    if (!ownIds.includes(effectiveDriverId)) {
      throw new ForbiddenException('Driver can only generate documents for self');
    }
    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    const assigned = new Set(access.assignedVehicleIds ?? []);
    for (const vehicleId of vehicleIds) {
      if (assigned.has(vehicleId)) continue;
      const drove = await prisma.trip.findFirst({
        where: { tenantId: tenant.id, vehicleId, driverId: effectiveDriverId },
        select: { id: true },
      });
      if (!drove) {
        throw new ForbiddenException('Vehicle not in driver trip history');
      }
    }
    return effectiveDriverId;
  }

  for (const vehicleId of vehicleIds) {
    await assertVehicleOpsWrite(prisma, tenantSlug, vehicleId, access);
  }
  return driverIdFilter ?? null;
}

export async function assertCostOpsWrite(
  prisma: PrismaService,
  tenantSlug: string,
  id: string,
  access?: AccessContext,
  patch?: { category?: string; notes?: string | null },
): Promise<void> {
  const row = await prisma.costEntry.findFirst({
    where: { id, tenant: { slug: tenantSlug } },
    select: { vehicleId: true, category: true, notes: true },
  });
  if (!row) throw new NotFoundException('Cost not found');
  const category = patch?.category ?? row.category;
  const notes = patch?.notes !== undefined ? patch.notes : row.notes;
  if (access && isDriverOnlyClientUser(access)) {
    if (!isDriverWritableCostCategory(row.category)) {
      throw new ForbiddenException('Cost not editable by driver');
    }
  }
  await assertCostPatchWrite(prisma, tenantSlug, row.vehicleId, category, notes, access);
}

export async function assertMaintenanceOpsWrite(
  prisma: PrismaService,
  tenantSlug: string,
  id: string,
  access?: AccessContext,
): Promise<void> {
  if (access && isDriverOnlyClientUser(access)) {
    throw new ForbiddenException('Insufficient permissions for fleet write');
  }
  const vehicleId = await vehicleIdFromMaintenance(prisma, tenantSlug, id);
  await assertVehicleOpsWrite(prisma, tenantSlug, vehicleId, access);
}

export async function assertDocumentOpsWrite(
  prisma: PrismaService,
  tenantSlug: string,
  id: string,
  access?: AccessContext,
): Promise<void> {
  if (access && isDriverOnlyClientUser(access)) {
    throw new ForbiddenException('Insufficient permissions for fleet write');
  }
  const vehicleId = await vehicleIdFromDocument(prisma, tenantSlug, id);
  await assertVehicleOpsWrite(prisma, tenantSlug, vehicleId, access);
}

export async function assertReminderOpsWrite(
  prisma: PrismaService,
  tenantSlug: string,
  id: string,
  access?: AccessContext,
): Promise<void> {
  if (access && isDriverOnlyClientUser(access)) {
    throw new ForbiddenException('Insufficient permissions for fleet write');
  }
  const row = await prisma.reminderAction.findFirst({
    where: { id, tenant: { slug: tenantSlug } },
    select: { vehicleId: true },
  });
  if (!row) throw new NotFoundException('Reminder not found');
  await assertVehicleOpsWrite(prisma, tenantSlug, row.vehicleId, access);
}

export async function assertMaintenancePlanWrite(
  prisma: PrismaService,
  tenantSlug: string,
  vehicleId: string,
  access?: AccessContext,
): Promise<void> {
  if (access && isDriverOnlyClientUser(access)) {
    throw new ForbiddenException('Insufficient permissions for fleet write');
  }
  await assertVehicleOpsWrite(prisma, tenantSlug, vehicleId, access);
}
