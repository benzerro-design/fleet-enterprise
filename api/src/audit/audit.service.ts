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
  }) {
    const where = {
      tenantId: params.tenantUuid,
      ...(params.entityType ? { entityType: params.entityType } : {}),
      ...(params.action?.trim() ? { action: params.action.trim() } : {}),
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
