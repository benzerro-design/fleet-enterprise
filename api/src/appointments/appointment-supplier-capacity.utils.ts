import { BadRequestException } from '@nestjs/common';
import { Prisma, ServiceAppointmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { endAtIso } from './appointments.types';

const INACTIVE: ServiceAppointmentStatus[] = [
  ServiceAppointmentStatus.cancelled,
  ServiceAppointmentStatus.no_show,
];

/**
 * SCHED-004 — câte programări active overlap pe [start, end) pentru un furnizor.
 */
export async function assertSupplierSlotCapacity(
  prisma: PrismaService | Prisma.TransactionClient,
  opts: {
    tenantId: string;
    supplierId: string;
    scheduledAt: Date;
    durationMin: number;
    /** La update — exclude programarea curentă. */
    excludeAppointmentId?: string;
  },
): Promise<void> {
  const supplier = await prisma.supplier.findFirst({
    where: { id: opts.supplierId, tenantId: opts.tenantId },
    select: { slotCapacity: true, legalName: true },
  });
  if (!supplier) throw new BadRequestException('Supplier not found');

  const capacity = Math.max(1, supplier.slotCapacity ?? 1);
  const start = opts.scheduledAt;
  const end = new Date(endAtIso(start, opts.durationMin));

  const candidates = await prisma.serviceAppointment.findMany({
    where: {
      tenantId: opts.tenantId,
      supplierId: opts.supplierId,
      status: { notIn: INACTIVE },
      scheduledAt: { not: null, lt: end },
      ...(opts.excludeAppointmentId ? { id: { not: opts.excludeAppointmentId } } : {}),
    },
    select: { id: true, scheduledAt: true, durationMin: true },
  });

  let count = 0;
  for (const row of candidates) {
    if (!row.scheduledAt) continue;
    const rowEnd = new Date(endAtIso(row.scheduledAt, row.durationMin));
    if (rowEnd > start) count += 1;
  }

  if (count >= capacity) {
    throw new BadRequestException(
      `Capacitate furnizor atinsă (${capacity} slot${capacity === 1 ? '' : 'uri'} concomitente) pentru ${supplier.legalName}. Alegeți alt interval.`,
    );
  }
}
