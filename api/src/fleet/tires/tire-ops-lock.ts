import { ConflictException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

export const TIRE_OPS_LOCK_TTL_MS = 120_000;

type Tx = {
  tireSet: Prisma.TransactionClient['tireSet'];
};

export async function acquireTireSetOpsLock(
  tx: Tx,
  params: { tenantId: string; setId: string; actorUserId?: string | null },
): Promise<void> {
  const now = new Date();
  const row = await tx.tireSet.findFirst({
    where: { id: params.setId, tenantId: params.tenantId },
    select: { id: true, opsLockUntil: true, opsLockByUserId: true },
  });
  if (!row) return;
  if (row.opsLockUntil && row.opsLockUntil > now) {
    const sameActor =
      params.actorUserId &&
      row.opsLockByUserId &&
      row.opsLockByUserId === params.actorUserId;
    if (!sameActor) {
      throw new ConflictException(
        `Setul este blocat de o altă operațiune până la ${row.opsLockUntil.toISOString()}`,
      );
    }
  }
  await tx.tireSet.update({
    where: { id: params.setId },
    data: {
      opsLockUntil: new Date(now.getTime() + TIRE_OPS_LOCK_TTL_MS),
      opsLockByUserId: params.actorUserId?.trim() || null,
    },
  });
}

export async function releaseTireSetOpsLock(
  tx: Tx,
  params: { tenantId: string; setId: string },
): Promise<void> {
  await tx.tireSet.updateMany({
    where: { id: params.setId, tenantId: params.tenantId },
    data: { opsLockUntil: null, opsLockByUserId: null },
  });
}
