import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

/** Canonical code used in seeds and capability checks. */
export const TIRE_HOTEL_SERVICE_CODE = 'tire_storage';

/** Codes that count as tire hotel (tenant catalog may use aliases / custom slugs). */
export const TIRE_HOTEL_SERVICE_CODE_ALIASES = [
  TIRE_HOTEL_SERVICE_CODE,
  'tire_hotel',
  'tyre_storage',
  'tyre_hotel',
  'hotel_anvelope',
  'hotel_anvelopa',
  'depozitare_anvelope',
  'depozit_anvelope',
] as const;

export function looksLikeTireHotelService(
  code: string,
  label: string,
  description: string,
): boolean {
  const normalized = code.trim().toLowerCase();
  if ((TIRE_HOTEL_SERVICE_CODE_ALIASES as readonly string[]).includes(normalized)) {
    return true;
  }
  const blob = `${normalized} ${label} ${description}`.toLowerCase();
  const hotelish =
    blob.includes('hotel') ||
    blob.includes('depozit') ||
    blob.includes('storage') ||
    blob.includes('lager');
  const tireish =
    blob.includes('anvelop') ||
    blob.includes('tire') ||
    blob.includes('tyre') ||
    blob.includes('roti') ||
    blob.includes('roți') ||
    blob.includes('jante') ||
    blob.includes('wheel');
  return hotelish && tireish;
}

export async function supplierHasTireStorage(
  prisma: Pick<PrismaService, 'supplierService'> | { supplierService: PrismaService['supplierService'] },
  tenantId: string,
  supplierId: string,
): Promise<boolean> {
  const rows = await prisma.supplierService.findMany({
    where: { tenantId, supplierId },
    select: {
      serviceType: {
        select: { code: true, label: true, clientDescription: true, active: true },
      },
    },
  });
  for (const row of rows) {
    const st = row.serviceType;
    if (!st) continue;
    // Linked offering counts even if catalog row was later deactivated.
    if (looksLikeTireHotelService(st.code, st.label, st.clientDescription)) {
      return true;
    }
  }
  return false;
}

export async function assertSupplierTireStorage(
  prisma: Pick<PrismaService, 'supplierService'> | { supplierService: PrismaService['supplierService'] },
  tenantId: string,
  supplierId: string,
): Promise<void> {
  const ok = await supplierHasTireStorage(prisma, tenantId, supplierId);
  if (!ok) {
    throw new ForbiddenException('Supplier does not offer tire storage (hotel)');
  }
}

/** Ensure canonical tire_storage TenantServiceType exists and is active. */
export async function ensureTireStorageServiceType(
  prisma: Pick<PrismaService, 'tenantServiceType'>,
  tenantId: string,
): Promise<{ id: string; code: string }> {
  const existing = await prisma.tenantServiceType.findFirst({
    where: { tenantId, code: TIRE_HOTEL_SERVICE_CODE },
    select: { id: true, code: true, active: true },
  });
  if (existing) {
    if (!existing.active) {
      await prisma.tenantServiceType.update({
        where: { id: existing.id },
        data: {
          active: true,
          label: 'Hotel anvelope',
          clientDescription: 'Depozitare anvelope/roți',
        },
      });
    }
    return { id: existing.id, code: existing.code };
  }
  const created = await prisma.tenantServiceType.create({
    data: {
      tenantId,
      code: TIRE_HOTEL_SERVICE_CODE,
      label: 'Hotel anvelope',
      clientDescription: 'Depozitare anvelope/roți',
      sortOrder: 60,
      active: true,
      system: true,
    },
    select: { id: true, code: true },
  });
  return created;
}

/**
 * If any selected catalog row is hotel-like (code alias or label/desc),
 * ensure canonical `tire_storage` is also in the code list.
 */
export async function expandTireHotelServiceCodes(
  prisma: Pick<PrismaService, 'tenantServiceType'>,
  tenantId: string,
  codes: string[],
): Promise<string[]> {
  await ensureTireStorageServiceType(prisma, tenantId);
  if (codes.includes(TIRE_HOTEL_SERVICE_CODE)) return codes;
  if (codes.length === 0) return codes;
  const rows = await prisma.tenantServiceType.findMany({
    where: { tenantId, code: { in: codes } },
    select: { code: true, label: true, clientDescription: true },
  });
  const hotelSelected =
    codes.some((c) => (TIRE_HOTEL_SERVICE_CODE_ALIASES as readonly string[]).includes(c)) ||
    rows.some((r) => looksLikeTireHotelService(r.code, r.label, r.clientDescription));
  return hotelSelected ? [...codes, TIRE_HOTEL_SERVICE_CODE] : codes;
}
