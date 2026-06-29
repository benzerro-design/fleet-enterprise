import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MembershipRole } from '@prisma/client';
import type { AccessContext } from '../iam/access-context.types';
import { assertClientAccess, assertClientFleetWrite, canWriteClientFleet } from '../iam/client-access';
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

/** Citire vehicul — verifică că userul client are acces la clientul vehiculului. */
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
    assertClientAccess(access, vehicle.clientId);
  }
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

async function vehicleIdFromCost(prisma: PrismaService, tenantSlug: string, id: string): Promise<string> {
  const row = await prisma.costEntry.findFirst({
    where: { id, tenant: { slug: tenantSlug } },
    select: { vehicleId: true },
  });
  if (!row) throw new NotFoundException('Cost not found');
  return row.vehicleId;
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

async function vehicleIdFromReminder(prisma: PrismaService, tenantSlug: string, id: string): Promise<string> {
  const row = await prisma.reminderAction.findFirst({
    where: { id, tenant: { slug: tenantSlug } },
    select: { vehicleId: true },
  });
  if (!row) throw new NotFoundException('Reminder not found');
  return row.vehicleId;
}

export async function assertTripOpsWrite(
  prisma: PrismaService,
  tenantSlug: string,
  tripId: string,
  access?: AccessContext,
): Promise<void> {
  const vehicleId = await vehicleIdFromTrip(prisma, tenantSlug, tripId);
  await assertVehicleOpsWrite(prisma, tenantSlug, vehicleId, access);
}

export async function assertCostOpsWrite(
  prisma: PrismaService,
  tenantSlug: string,
  id: string,
  access?: AccessContext,
): Promise<void> {
  const vehicleId = await vehicleIdFromCost(prisma, tenantSlug, id);
  await assertVehicleOpsWrite(prisma, tenantSlug, vehicleId, access);
}

export async function assertMaintenanceOpsWrite(
  prisma: PrismaService,
  tenantSlug: string,
  id: string,
  access?: AccessContext,
): Promise<void> {
  const vehicleId = await vehicleIdFromMaintenance(prisma, tenantSlug, id);
  await assertVehicleOpsWrite(prisma, tenantSlug, vehicleId, access);
}

export async function assertDocumentOpsWrite(
  prisma: PrismaService,
  tenantSlug: string,
  id: string,
  access?: AccessContext,
): Promise<void> {
  const vehicleId = await vehicleIdFromDocument(prisma, tenantSlug, id);
  await assertVehicleOpsWrite(prisma, tenantSlug, vehicleId, access);
}

export async function assertReminderOpsWrite(
  prisma: PrismaService,
  tenantSlug: string,
  id: string,
  access?: AccessContext,
): Promise<void> {
  const vehicleId = await vehicleIdFromReminder(prisma, tenantSlug, id);
  await assertVehicleOpsWrite(prisma, tenantSlug, vehicleId, access);
}
