import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WorkOrderMessageVisibility } from '@prisma/client';
import type { AccessContext } from '../iam/access-context.types';
import { assertPartnerSupplierId, isPartnerUser } from '../iam/partner-access';
import { PrismaService } from '../prisma/prisma.service';

export type WorkOrderMessageRecord = {
  id: string;
  workOrderId: string;
  body: string;
  visibility: WorkOrderMessageVisibility;
  authorUserId: string;
  authorEmail: string;
  authorDisplayName: string;
  createdAt: string;
};

@Injectable()
export class WorkOrderMessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    tenantSlug: string,
    workOrderId: string,
    access?: AccessContext,
  ): Promise<WorkOrderMessageRecord[]> {
    await this.assertCanRead(tenantSlug, workOrderId, access);
    const partner = access && isPartnerUser(access);
    const rows = await this.prisma.workOrderMessage.findMany({
      where: {
        workOrderId,
        tenant: { slug: tenantSlug },
        ...(partner ? { visibility: WorkOrderMessageVisibility.client_visible } : {}),
      },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { email: true, displayName: true } } },
    });
    return rows.map((r) => this.toRecord(r));
  }

  async create(
    tenantSlug: string,
    workOrderId: string,
    input: { body: string; visibility?: WorkOrderMessageVisibility },
    actorUserId: string,
    access?: AccessContext,
  ): Promise<WorkOrderMessageRecord> {
    const wo = await this.assertCanRead(tenantSlug, workOrderId, access);
    const body = input.body?.trim();
    if (!body) throw new BadRequestException('body is required');

    let visibility = input.visibility ?? WorkOrderMessageVisibility.client_visible;
    if (access && isPartnerUser(access)) {
      visibility = WorkOrderMessageVisibility.client_visible;
    }

    const row = await this.prisma.workOrderMessage.create({
      data: {
        tenantId: wo.tenantId,
        workOrderId,
        authorUserId: actorUserId,
        body,
        visibility,
      },
      include: { author: { select: { email: true, displayName: true } } },
    });
    return this.toRecord(row);
  }

  private async assertCanRead(
    tenantSlug: string,
    workOrderId: string,
    access?: AccessContext,
  ) {
    const wo = await this.prisma.maintenanceWorkOrder.findFirst({
      where: { id: workOrderId, tenant: { slug: tenantSlug } },
      select: { id: true, tenantId: true, supplierId: true, vehicle: { select: { clientId: true } } },
    });
    if (!wo) throw new NotFoundException('Work order not found');
    if (!access) return wo;

    if (access.isTenantWide) return wo;
    if (isPartnerUser(access)) {
      assertPartnerSupplierId(access, wo.supplierId);
      return wo;
    }
    if (access.membershipRole === 'client_user') {
      const clientIds = access.allowedClientIds ?? [];
      if (!clientIds.includes(wo.vehicle.clientId)) {
        throw new ForbiddenException('Work order access denied');
      }
      return wo;
    }
    throw new ForbiddenException('Work order access denied');
  }

  private toRecord(row: {
    id: string;
    workOrderId: string;
    body: string;
    visibility: WorkOrderMessageVisibility;
    authorUserId: string;
    createdAt: Date;
    author: { email: string; displayName: string | null };
  }): WorkOrderMessageRecord {
    return {
      id: row.id,
      workOrderId: row.workOrderId,
      body: row.body,
      visibility: row.visibility,
      authorUserId: row.authorUserId,
      authorEmail: row.author.email,
      authorDisplayName: row.author.displayName?.trim() || row.author.email,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
