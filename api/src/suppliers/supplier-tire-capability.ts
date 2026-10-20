import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

export const TIRE_HOTEL_SERVICE_CODE = 'tire_storage';

export async function supplierHasTireStorage(
  prisma: Pick<PrismaService, 'supplierService'>,
  tenantId: string,
  supplierId: string,
): Promise<boolean> {
  const hit = await prisma.supplierService.findFirst({
    where: {
      tenantId,
      supplierId,
      serviceType: { code: TIRE_HOTEL_SERVICE_CODE },
    },
    select: { id: true },
  });
  return Boolean(hit);
}

export async function assertSupplierTireStorage(
  prisma: Pick<PrismaService, 'supplierService'>,
  tenantId: string,
  supplierId: string,
): Promise<void> {
  const ok = await supplierHasTireStorage(prisma, tenantId, supplierId);
  if (!ok) {
    throw new ForbiddenException('Supplier does not offer tire storage (hotel)');
  }
}
