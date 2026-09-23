import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    tenantId: string;
    actorUserId?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    meta?: Prisma.InputJsonValue;
  }) {
    await this.prisma.auditLog.create({
      data: {
        tenantId: params.tenantId,
        actorUserId: params.actorUserId ?? undefined,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        meta: params.meta ?? undefined,
      },
    });
  }

  async logVehicle(params: {
    tenantUuid: string;
    actorUserId?: string | null;
    action: string;
    vehicleId: string;
    meta?: Prisma.InputJsonValue;
  }) {
    await this.log({
      tenantId: params.tenantUuid,
      actorUserId: params.actorUserId,
      action: params.action,
      entityType: 'vehicle',
      entityId: params.vehicleId,
      meta: params.meta,
    });
  }

  async listForTenant(params: {
    tenantUuid: string;
    skip: number;
    take: number;
    entityType?: string;
    action?: string;
    q?: string;
    from?: string;
    to?: string;
    actorUserId?: string;
  }) {
    const fromRaw = params.from?.trim() ?? '';
    const toRaw = params.to?.trim() ?? '';
    const from = fromRaw ? new Date(fromRaw) : null;
    const to = toRaw ? new Date(toRaw) : null;
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(toRaw) && !Number.isNaN(to.getTime())) {
      to.setUTCHours(23, 59, 59, 999);
    }
    const q = params.q?.trim();
    const createdAt: { gte?: Date; lte?: Date } = {};
    if (from && !Number.isNaN(from.getTime())) createdAt.gte = from;
    if (to && !Number.isNaN(to.getTime())) createdAt.lte = to;
    const where = {
      tenantId: params.tenantUuid,
      ...(params.entityType ? { entityType: params.entityType } : {}),
      ...(params.action?.trim() ? { action: params.action.trim() } : {}),
      ...(params.actorUserId ? { actorUserId: params.actorUserId } : {}),
      ...(createdAt.gte || createdAt.lte ? { createdAt } : {}),
      ...(q
        ? {
            OR: [
              { action: { contains: q, mode: 'insensitive' as const } },
              { entityType: { contains: q, mode: 'insensitive' as const } },
              { entityId: { contains: q, mode: 'insensitive' as const } },
              { actor: { email: { contains: q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: {
          actor: { select: { email: true, displayName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
    ]);

    return {
      total,
      items: rows.map((r) => ({
        id: r.id,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        meta: r.meta,
        createdAt: r.createdAt.toISOString(),
        actorEmail: r.actor?.email ?? null,
        actorDisplayName: r.actor?.displayName ?? null,
      })),
    };
  }
}
