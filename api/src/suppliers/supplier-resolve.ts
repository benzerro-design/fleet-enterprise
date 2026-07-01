import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

export async function resolveSupplierInTenant(
  prisma: PrismaService,
  tenantId: string,
  supplierId: string,
) {
  const row = await prisma.supplier.findFirst({
    where: { id: supplierId, tenantId },
  });
  if (!row) throw new NotFoundException('Supplier not found');
  return row;
}

/** Sincronizează câmpul text `provider` din denumirea furnizorului (compatibilitate). */
export async function providerLabelForSupplier(
  prisma: PrismaService,
  tenantId: string,
  supplierId: string | null | undefined,
  fallbackProvider?: string | null,
): Promise<string | null> {
  if (!supplierId?.trim()) return fallbackProvider?.trim() || null;
  const s = await prisma.supplier.findFirst({
    where: { id: supplierId.trim(), tenantId },
    select: { legalName: true },
  });
  if (!s) return fallbackProvider?.trim() || null;
  return s.legalName;
}
