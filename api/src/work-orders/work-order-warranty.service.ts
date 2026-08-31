import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MaintenanceWorkOrderStatus,
  Prisma,
  WorkOrderQuoteLineType,
  WorkOrderQuoteStatus,
  WorkOrderWarrantyStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { assertClientFleetWrite } from '../iam/client-access';
import type { AccessContext } from '../iam/access-context.types';
import { assertPartnerSupplierId, isPartnerUser } from '../iam/partner-access';
import { PrismaService } from '../prisma/prisma.service';
import { parseWorkOrderSettings } from '../tenant/work-order-settings';

export type WarrantyRecord = {
  id: string;
  workOrderId: string;
  sourceQuoteId: string | null;
  status: WorkOrderWarrantyStatus;
  startsAt: string | null;
  startsKm: number | null;
  conditionsPdfUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lines: Array<{
    id: string;
    sortOrder: number;
    sourceQuoteLineId: string | null;
    lineType: WorkOrderQuoteLineType;
    description: string;
    partNumber: string | null;
    warrantyMonths: number;
    warrantyKm: number | null;
  }>;
};

export type SyncWarrantyInput = {
  quoteId?: string;
};

export type PatchWarrantyInput = {
  conditionsPdfUrl?: string | null;
  notes?: string | null;
  lines?: Array<{
    id: string;
    warrantyMonths?: number;
    warrantyKm?: number | null;
  }>;
};

@Injectable()
export class WorkOrderWarrantyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private warrantyInclude() {
    return { lines: { orderBy: { sortOrder: 'asc' as const } } };
  }

  private toRecord(row: {
    id: string;
    workOrderId: string;
    sourceQuoteId: string | null;
    status: WorkOrderWarrantyStatus;
    startsAt: Date | null;
    startsKm: number | null;
    conditionsPdfUrl: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    lines: Array<{
      id: string;
      sortOrder: number;
      sourceQuoteLineId: string | null;
      lineType: WorkOrderQuoteLineType;
      description: string;
      partNumber: string | null;
      warrantyMonths: number;
      warrantyKm: number | null;
    }>;
  }): WarrantyRecord {
    return {
      id: row.id,
      workOrderId: row.workOrderId,
      sourceQuoteId: row.sourceQuoteId,
      status: row.status,
      startsAt: row.startsAt?.toISOString() ?? null,
      startsKm: row.startsKm,
      conditionsPdfUrl: row.conditionsPdfUrl,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      lines: row.lines.map((line) => ({
        id: line.id,
        sortOrder: line.sortOrder,
        sourceQuoteLineId: line.sourceQuoteLineId,
        lineType: line.lineType,
        description: line.description,
        partNumber: line.partNumber,
        warrantyMonths: line.warrantyMonths,
        warrantyKm: line.warrantyKm,
      })),
    };
  }

  private async assertWoAccess(
    tenantSlug: string,
    workOrderId: string,
    access?: AccessContext,
    requireWrite = false,
  ) {
    const wo = await this.prisma.maintenanceWorkOrder.findFirst({
      where: { id: workOrderId, tenant: { slug: tenantSlug } },
      include: { vehicle: { select: { clientId: true } } },
    });
    if (!wo) throw new NotFoundException('Work order not found');
    if (access) {
      if (isPartnerUser(access)) {
        assertPartnerSupplierId(access, wo.supplierId);
      } else if (requireWrite) {
        assertClientFleetWrite(access, wo.vehicle.clientId);
      } else if (!access.isTenantWide) {
        const ids = access.allowedClientIds ?? [];
        if (!ids.includes(wo.vehicle.clientId)) {
          throw new ForbiddenException('Work order access denied');
        }
      }
    }
    return wo;
  }

  async get(tenantSlug: string, workOrderId: string, access?: AccessContext): Promise<WarrantyRecord | null> {
    await this.assertWoAccess(tenantSlug, workOrderId, access);
    const row = await this.prisma.workOrderWarranty.findFirst({
      where: { workOrderId, tenant: { slug: tenantSlug } },
      include: this.warrantyInclude(),
    });
    return row ? this.toRecord(row) : null;
  }

  async syncFromQuote(
    tenantSlug: string,
    workOrderId: string,
    dto: SyncWarrantyInput = {},
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<WarrantyRecord> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, workOrderSettings: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    await this.assertWoAccess(tenantSlug, workOrderId, access, true);
    const settings = parseWorkOrderSettings(tenant.workOrderSettings);

    const quote = await this.prisma.workOrderQuote.findFirst({
      where: {
        tenantId: tenant.id,
        workOrderId,
        status: WorkOrderQuoteStatus.approved,
        ...(dto.quoteId?.trim() ? { id: dto.quoteId.trim() } : {}),
      },
      orderBy: { version: 'desc' },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!quote) throw new BadRequestException('Deviz aprobat necesar pentru garanție');

    const explicitlyApprovedLines = quote.lines.filter((line) => line.approvalStatus === 'approved');
    const hasLineDecisions = quote.lines.some((line) => line.approvalStatus !== 'pending');
    const approvedLines = hasLineDecisions ? explicitlyApprovedLines : quote.lines;
    if (!approvedLines.length) {
      throw new BadRequestException('Devizul aprobat nu are linii aprobate pentru garanție');
    }

    const existing = await this.prisma.workOrderWarranty.findUnique({ where: { workOrderId } });
    if (existing?.status === WorkOrderWarrantyStatus.locked) {
      throw new BadRequestException('Garanția este blocată');
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const warranty = await tx.workOrderWarranty.upsert({
        where: { workOrderId },
        create: {
          tenantId: tenant.id,
          workOrderId,
          sourceQuoteId: quote.id,
          status: WorkOrderWarrantyStatus.draft,
        },
        update: {
          sourceQuoteId: quote.id,
          status: existing?.status ?? WorkOrderWarrantyStatus.draft,
        },
      });

      await tx.workOrderWarrantyLine.deleteMany({ where: { warrantyId: warranty.id } });
      await tx.workOrderWarrantyLine.createMany({
        data: approvedLines.map((line, idx) => ({
          tenantId: tenant.id,
          warrantyId: warranty.id,
          sortOrder: line.sortOrder ?? idx,
          sourceQuoteLineId: line.id,
          lineType: line.lineType,
          description: line.description,
          partNumber: line.partNumber,
          warrantyMonths:
            line.warrantyMonths ??
            (line.lineType === 'parts'
              ? settings.defaultPartsWarrantyMonths
              : settings.defaultLaborWarrantyMonths),
          warrantyKm:
            line.warrantyKm ??
            (line.lineType === 'parts' ? settings.defaultPartsWarrantyKm : null),
        })),
      });

      return tx.workOrderWarranty.findUniqueOrThrow({
        where: { id: warranty.id },
        include: this.warrantyInclude(),
      });
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'work_order_warranty.sync_from_quote',
      entityType: 'work_order_warranty',
      entityId: row.id,
      meta: { workOrderId, quoteId: quote.id },
    });

    return this.toRecord(row);
  }

  async patch(
    tenantSlug: string,
    workOrderId: string,
    dto: PatchWarrantyInput,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<WarrantyRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    const wo = await this.assertWoAccess(tenantSlug, workOrderId, access, true);
    if (wo.status === MaintenanceWorkOrderStatus.done) {
      throw new BadRequestException('Garanția nu se poate modifica după finalizarea comenzii');
    }

    const existing = await this.prisma.workOrderWarranty.findFirst({
      where: { tenantId: tenant.id, workOrderId },
      include: this.warrantyInclude(),
    });
    if (!existing) throw new NotFoundException('Warranty not found');
    if (existing.status === WorkOrderWarrantyStatus.locked) {
      throw new BadRequestException('Garanția este blocată');
    }

    const data: Prisma.WorkOrderWarrantyUpdateInput = {};
    if (dto.conditionsPdfUrl !== undefined) {
      data.conditionsPdfUrl = dto.conditionsPdfUrl?.trim() || null;
    }
    if (dto.notes !== undefined) {
      data.notes = dto.notes?.trim() || null;
    }
    const lineIds = new Set(existing.lines.map((line) => line.id));

    const row = await this.prisma.$transaction(async (tx) => {
      if (Object.keys(data).length) {
        await tx.workOrderWarranty.update({ where: { id: existing.id }, data });
      }
      for (const line of dto.lines ?? []) {
        if (!lineIds.has(line.id)) throw new BadRequestException('Linie garanție invalidă');
        const lineData: Prisma.WorkOrderWarrantyLineUpdateInput = {};
        if (line.warrantyMonths !== undefined) {
          if (!Number.isFinite(line.warrantyMonths) || line.warrantyMonths < 0) {
            throw new BadRequestException('Luni garanție invalide');
          }
          lineData.warrantyMonths = Math.round(line.warrantyMonths);
        }
        if (line.warrantyKm !== undefined) {
          if (line.warrantyKm !== null && (!Number.isFinite(line.warrantyKm) || line.warrantyKm < 0)) {
            throw new BadRequestException('Km garanție invalid');
          }
          lineData.warrantyKm = line.warrantyKm === null ? null : Math.round(line.warrantyKm);
        }
        if (Object.keys(lineData).length) {
          await tx.workOrderWarrantyLine.update({ where: { id: line.id }, data: lineData });
        }
      }
      return tx.workOrderWarranty.findUniqueOrThrow({
        where: { id: existing.id },
        include: this.warrantyInclude(),
      });
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'work_order_warranty.patch',
      entityType: 'work_order_warranty',
      entityId: row.id,
      meta: { workOrderId },
    });

    return this.toRecord(row);
  }
}
