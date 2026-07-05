import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

type Db = Prisma.TransactionClient | PrismaService;

/** Generează următorul MOB-YYYY-NNNN pentru tenant. */
export async function nextMobilityDisplayNumber(
  db: Db,
  tenantId: string,
  referenceDate: Date,
): Promise<string> {
  const year = referenceDate.getUTCFullYear();
  const prefix = `MOB-${year}-`;
  const rows = await db.mobilityAssignment.findMany({
    where: { tenantId, displayNumber: { startsWith: prefix } },
    select: { displayNumber: true },
  });
  let maxSeq = 0;
  for (const row of rows) {
    const m = row.displayNumber?.match(/^MOB-\d{4}-(\d+)$/);
    if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
  }
  return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
}
