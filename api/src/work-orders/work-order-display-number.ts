import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

type Db = Prisma.TransactionClient | PrismaService;

/** Generează următorul WO-YYYY-NNNN pentru tenant (an = data comenzii). */
export async function nextWorkOrderDisplayNumber(
  db: Db,
  tenantId: string,
  referenceDate: Date,
): Promise<string> {
  const year = referenceDate.getUTCFullYear();
  const prefix = `WO-${year}-`;
  const rows = await db.maintenanceWorkOrder.findMany({
    where: { tenantId, displayNumber: { startsWith: prefix } },
    select: { displayNumber: true },
  });
  let maxSeq = 0;
  for (const row of rows) {
    const m = row.displayNumber?.match(/^WO-\d{4}-(\d+)$/);
    if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
  }
  return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
}

export async function ensureWorkOrderDisplayNumber(
  db: Db,
  tenantId: string,
  workOrderId: string,
  createdAt: Date,
  current: string | null | undefined,
): Promise<string> {
  if (current?.trim()) return current.trim();
  const displayNumber = await nextWorkOrderDisplayNumber(db, tenantId, createdAt);
  await db.maintenanceWorkOrder.update({
    where: { id: workOrderId },
    data: { displayNumber },
  });
  return displayNumber;
}
