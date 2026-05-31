import type { PrismaService } from '../prisma/prisma.service';

export const ITP_COST_CATEGORY = 'ITP';
export const ITP_MAINTENANCE_ALLOCATION = 'itp';

export function isItpCostCategory(category: string | null | undefined): boolean {
  return category?.trim().toUpperCase() === ITP_COST_CATEGORY;
}

export function isItpMaintenanceAllocation(code: string | null | undefined): boolean {
  return code?.trim().toLowerCase() === ITP_MAINTENANCE_ALLOCATION;
}

export function isItpOpsEntry(
  categoryOrAllocation: string | null | undefined,
  kind: 'cost' | 'maintenance',
): boolean {
  return kind === 'cost'
    ? isItpCostCategory(categoryOrAllocation)
    : isItpMaintenanceAllocation(categoryOrAllocation);
}

/** Actualizează câmpurile ITP din profilul vehiculului după înregistrarea unei lucrări ITP. */
export async function syncVehicleItpFromOps(
  prisma: PrismaService,
  vehicleId: string,
  itpExpiresOn: Date,
  itpStationName?: string | null,
): Promise<void> {
  const data: { itpExpiresOn: Date; itpStationName?: string } = { itpExpiresOn };
  const station = itpStationName?.trim();
  if (station) data.itpStationName = station;
  await prisma.vehicle.update({
    where: { id: vehicleId },
    data,
  });
}

/** Sincronizează documentul itp_cert al vehiculului, dacă există. */
export async function syncItpCertDocument(
  prisma: PrismaService,
  vehicleId: string,
  expiresOn: Date,
): Promise<void> {
  const doc = await prisma.vehicleDocument.findFirst({
    where: { vehicleId, documentTypeCode: 'itp_cert' },
    orderBy: { createdAt: 'desc' },
  });
  if (!doc) return;
  await prisma.vehicleDocument.update({
    where: { id: doc.id },
    data: { expiresOn },
  });
}
