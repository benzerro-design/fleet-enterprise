import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WorkOrderPhotoKind, WorkOrderPhotoPhase } from '@prisma/client';
import type { AccessContext } from '../iam/access-context.types';
import { assertPartnerSupplierId, assertPartnerWrite, isPartnerUser } from '../iam/partner-access';
import { PrismaService } from '../prisma/prisma.service';

export type WorkOrderPhotoRecord = {
  id: string;
  workOrderId: string;
  kind: WorkOrderPhotoKind;
  phase: WorkOrderPhotoPhase;
  url: string;
  caption: string | null;
  createdAt: string;
};

@Injectable()
export class WorkOrderPhotosService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantSlug: string, workOrderId: string, access?: AccessContext) {
    await this.assertCanRead(tenantSlug, workOrderId, access);
    const rows = await this.prisma.workOrderPhoto.findMany({
      where: { workOrderId, tenant: { slug: tenantSlug } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toRecord(r));
  }

  async create(
    tenantSlug: string,
    workOrderId: string,
    input: { kind?: string; phase?: string; url?: string; caption?: string | null },
    actorUserId: string,
    access?: AccessContext,
  ) {
    await this.assertCanWrite(tenantSlug, workOrderId, access);
    const kind = input.kind === 'defect' ? WorkOrderPhotoKind.defect : WorkOrderPhotoKind.condition;
    const phase = parsePhase(input.phase, kind);
    const url = input.url?.trim() ?? '';
    if (!url.startsWith('/uploads/')) {
      throw new BadRequestException('url invalid');
    }
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    const row = await this.prisma.workOrderPhoto.create({
      data: {
        tenantId: tenant.id,
        workOrderId,
        kind,
        phase,
        url,
        caption: input.caption?.trim() || null,
        createdByUserId: actorUserId,
      },
    });
    return this.toRecord(row);
  }

  private toRecord(row: {
    id: string;
    workOrderId: string;
    kind: WorkOrderPhotoKind;
    phase: WorkOrderPhotoPhase;
    url: string;
    caption: string | null;
    createdAt: Date;
  }): WorkOrderPhotoRecord {
    return {
      id: row.id,
      workOrderId: row.workOrderId,
      kind: row.kind,
      phase: row.phase,
      url: row.url,
      caption: row.caption,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async loadWo(tenantSlug: string, workOrderId: string) {
    const wo = await this.prisma.maintenanceWorkOrder.findFirst({
      where: { id: workOrderId, tenant: { slug: tenantSlug } },
      select: { id: true, supplierId: true, vehicle: { select: { clientId: true } } },
    });
    if (!wo) throw new NotFoundException('Work order not found');
    return wo;
  }

  private async assertCanRead(tenantSlug: string, workOrderId: string, access?: AccessContext) {
    const wo = await this.loadWo(tenantSlug, workOrderId);
    if (!access || access.membershipRole === 'tenant_admin' || access.membershipRole === 'tenant_viewer') {
      return;
    }
    if (isPartnerUser(access)) {
      assertPartnerSupplierId(access, wo.supplierId);
      return;
    }
    if (access.membershipRole === 'client_user') {
      const clientIds = access.allowedClientIds ?? [];
      if (!clientIds.includes(wo.vehicle.clientId)) throw new ForbiddenException('Work order access denied');
      return;
    }
    throw new ForbiddenException('Work order access denied');
  }

  private async assertCanWrite(tenantSlug: string, workOrderId: string, access?: AccessContext) {
    const wo = await this.loadWo(tenantSlug, workOrderId);
    if (!access) return;
    if (isPartnerUser(access)) {
      assertPartnerWrite(access);
      assertPartnerSupplierId(access, wo.supplierId);
      return;
    }
    if (access.membershipRole === 'tenant_admin') return;
    if (access.membershipRole === 'client_user') {
      const clientIds = access.allowedClientIds ?? [];
      if (!clientIds.includes(wo.vehicle.clientId)) throw new ForbiddenException('Work order access denied');
      return;
    }
    throw new ForbiddenException('Work order access denied');
  }
}

function parsePhase(raw: string | undefined, kind: WorkOrderPhotoKind): WorkOrderPhotoPhase {
  if (kind === WorkOrderPhotoKind.defect) return WorkOrderPhotoPhase.defect;
  if (raw === 'in' || raw === 'check' || raw === 'out') return raw;
  throw new BadRequestException('phase must be in, check or out');
}
