import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export async function assertVehicleInTenant(
  prisma: PrismaService,
  tenantSlug: string,
  vehicleId: string,
): Promise<{ id: string; registrationNumber: string }> {
  const v = await prisma.vehicle.findFirst({
    where: { id: vehicleId, tenant: { slug: tenantSlug } },
    select: { id: true, registrationNumber: true },
  });
  if (!v) {
    throw new NotFoundException('Vehicle not found for this tenant');
  }
  return v;
}
