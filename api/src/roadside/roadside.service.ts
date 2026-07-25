import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CrmTicketEventKind,
  Prisma,
  RoadsideInterventionKind,
  RoadsideInterventionStatus,
  SupplierCategory,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { nextRoadsideDisplayNumber } from './roadside-display-number';

const MAX_PAGE_SIZE = 200;

export type RoadsideInterventionRecord = {
  id: string;
  displayNumber: string | null;
  serviceCaseId: string;
  sourceTicketId: string | null;
  workOrderId: string | null;
  clientId: string;
  clientLegalName: string;
  vehicleId: string | null;
  vehicleReg: string | null;
  supplierId: string | null;
  supplierLegalName: string | null;
  kind: RoadsideInterventionKind;
  status: RoadsideInterventionStatus;
  locationText: string | null;
  requestedAt: string | null;
  dispatchedAt: string | null;
  onSiteAt: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateRoadsideInterventionInput = {
  serviceCaseId?: string;
  ticketId?: string;
  workOrderId?: string | null;
  kind: RoadsideInterventionKind;
  supplierId?: string | null;
  locationText?: string | null;
  notes?: string | null;
  status?: RoadsideInterventionStatus;
};

export type PatchRoadsideInterventionInput = {
  workOrderId?: string | null;
  supplierId?: string | null;
  kind?: RoadsideInterventionKind;
  status?: RoadsideInterventionStatus;
  locationText?: string | null;
  notes?: string | null;
  requestedAt?: string | null;
  dispatchedAt?: string | null;
  onSiteAt?: string | null;
  completedAt?: string | null;
};

export type RoadsideListParams = {
  page: number;
  pageSize: number;
  serviceCaseId?: string;
  ticketId?: string;
  workOrderId?: string;
  status?: RoadsideInterventionStatus;
  kind?: RoadsideInterventionKind;
};

type InterventionRow = Prisma.RoadsideInterventionGetPayload<{
  include: {
    client: { select: { legalName: true } };
    vehicle: { select: { registrationNumber: true } };
    supplier: { select: { legalName: true } };
  };
}>;

@Injectable()
export class RoadsideService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private toRecord(row: InterventionRow): RoadsideInterventionRecord {
    return {
      id: row.id,
      displayNumber: row.displayNumber,
      serviceCaseId: row.serviceCaseId,
      sourceTicketId: row.sourceTicketId,
      workOrderId: row.workOrderId,
      clientId: row.clientId,
      clientLegalName: row.client.legalName,
      vehicleId: row.vehicleId,
      vehicleReg: row.vehicle?.registrationNumber ?? null,
      supplierId: row.supplierId,
      supplierLegalName: row.supplier?.legalName ?? null,
      kind: row.kind,
      status: row.status,
      locationText: row.locationText,
      requestedAt: row.requestedAt?.toISOString() ?? null,
      dispatchedAt: row.dispatchedAt?.toISOString() ?? null,
      onSiteAt: row.onSiteAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private includeRelations() {
    return {
      client: { select: { legalName: true } },
      vehicle: { select: { registrationNumber: true } },
      supplier: { select: { legalName: true } },
    } as const;
  }

  private listWhere(tenantId: string, params: RoadsideListParams): Prisma.RoadsideInterventionWhereInput {
    const parts: Prisma.RoadsideInterventionWhereInput[] = [{ tenantId }];
    if (params.serviceCaseId) parts.push({ serviceCaseId: params.serviceCaseId });
    if (params.ticketId) parts.push({ sourceTicketId: params.ticketId });
    if (params.workOrderId) parts.push({ workOrderId: params.workOrderId });
    if (params.status) parts.push({ status: params.status });
    if (params.kind) parts.push({ kind: params.kind });
    return { AND: parts };
  }

  private kindLabel(kind: RoadsideInterventionKind): string {
    const labels: Record<RoadsideInterventionKind, string> = {
      tow: 'Tractare',
      jump_start: 'Pornire baterie',
      tire_change: 'Schimbare roată',
      lockout: 'Deblocare uși',
      fuel_delivery: 'Livrare combustibil',
      other: 'Altele',
    };
    return labels[kind] ?? kind;
  }

  private statusLabel(status: RoadsideInterventionStatus): string {
    const labels: Record<RoadsideInterventionStatus, string> = {
      draft: 'draft',
      requested: 'solicitată',
      dispatched: 'trimisă',
      on_site: 'la fața locului',
      completed: 'finalizată',
      cancelled: 'anulată',
    };
    return labels[status] ?? status;
  }

  private eventBody(
    displayNumber: string | null,
    kind: RoadsideInterventionKind,
    status: RoadsideInterventionStatus,
  ): string {
    const nr = displayNumber ?? '—';
    return `Asistență rutieră (${this.kindLabel(kind)}) ${this.statusLabel(status)} — ${nr}.`;
  }

  private async appendTicketEvent(
    tx: Prisma.TransactionClient,
    tenantId: string,
    ticketId: string | null | undefined,
    intervention: {
      id: string;
      displayNumber: string | null;
      kind: RoadsideInterventionKind;
      status: RoadsideInterventionStatus;
    },
    actorUserId?: string,
  ) {
    if (!ticketId) return;
    await tx.crmTicketEvent.create({
      data: {
        tenantId,
        ticketId,
        kind: CrmTicketEventKind.roadside_update,
        body: this.eventBody(intervention.displayNumber, intervention.kind, intervention.status),
        payload: {
          interventionId: intervention.id,
          displayNumber: intervention.displayNumber,
          kind: intervention.kind,
          status: intervention.status,
        },
        actorUserId: actorUserId ?? null,
      },
    });
  }

  private timestampsForStatus(
    status: RoadsideInterventionStatus,
    existing?: {
      requestedAt: Date | null;
      dispatchedAt: Date | null;
      onSiteAt: Date | null;
      completedAt: Date | null;
    },
  ): Partial<{
    requestedAt: Date;
    dispatchedAt: Date;
    onSiteAt: Date;
    completedAt: Date;
  }> {
    const now = new Date();
    const out: Partial<{
      requestedAt: Date;
      dispatchedAt: Date;
      onSiteAt: Date;
      completedAt: Date;
    }> = {};
    if (status === 'requested' && !existing?.requestedAt) out.requestedAt = now;
    if (status === 'dispatched' && !existing?.dispatchedAt) {
      out.dispatchedAt = now;
      if (!existing?.requestedAt) out.requestedAt = now;
    }
    if (status === 'on_site' && !existing?.onSiteAt) {
      out.onSiteAt = now;
      if (!existing?.dispatchedAt) out.dispatchedAt = now;
      if (!existing?.requestedAt) out.requestedAt = now;
    }
    if (status === 'completed' && !existing?.completedAt) {
      out.completedAt = now;
      if (!existing?.onSiteAt) out.onSiteAt = now;
      if (!existing?.dispatchedAt) out.dispatchedAt = now;
      if (!existing?.requestedAt) out.requestedAt = now;
    }
    return out;
  }

  async listPaged(tenantSlug: string, params: RoadsideListParams) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return { items: [], total: 0, page: params.page, pageSize: params.pageSize };
    }
    const pageSize = Math.min(Math.max(1, params.pageSize), MAX_PAGE_SIZE);
    const page = Math.max(1, params.page);
    const skip = (page - 1) * pageSize;
    const where = this.listWhere(tenant.id, params);

    const [total, rows] = await Promise.all([
      this.prisma.roadsideIntervention.count({ where }),
      this.prisma.roadsideIntervention.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: pageSize,
        include: this.includeRelations(),
      }),
    ]);

    return {
      items: rows.map((r) => this.toRecord(r)),
      total,
      page,
      pageSize,
    };
  }

  async getById(tenantSlug: string, id: string): Promise<RoadsideInterventionRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Intervention not found');
    const row = await this.prisma.roadsideIntervention.findFirst({
      where: { id, tenantId: tenant.id },
      include: this.includeRelations(),
    });
    if (!row) throw new NotFoundException('Intervention not found');
    return this.toRecord(row);
  }

  async create(
    tenantSlug: string,
    input: CreateRoadsideInterventionInput,
    actorUserId?: string,
  ): Promise<RoadsideInterventionRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    if (!input.kind) {
      throw new BadRequestException('kind is required');
    }

    let serviceCaseId = input.serviceCaseId?.trim() || null;
    if (!serviceCaseId && input.ticketId?.trim()) {
      const sc = await this.prisma.serviceCase.findFirst({
        where: { tenantId: tenant.id, sourceTicketId: input.ticketId.trim() },
        select: { id: true },
      });
      if (!sc) {
        throw new BadRequestException('Nu există dosar pentru ticketId — creați mai întâi service case.');
      }
      serviceCaseId = sc.id;
    }
    if (!serviceCaseId) {
      throw new BadRequestException('serviceCaseId (sau ticketId) este obligatoriu');
    }

    const serviceCase = await this.prisma.serviceCase.findFirst({
      where: { id: serviceCaseId, tenantId: tenant.id },
      select: {
        id: true,
        clientId: true,
        vehicleId: true,
        sourceTicketId: true,
      },
    });
    if (!serviceCase) throw new NotFoundException('Service case not found');

    let workOrderId = input.workOrderId?.trim() || null;
    if (workOrderId) {
      const wo = await this.prisma.maintenanceWorkOrder.findFirst({
        where: { id: workOrderId, tenantId: tenant.id, serviceCaseId: serviceCase.id },
      });
      if (!wo) throw new BadRequestException('workOrderId must belong to the same service case');
    }

    if (input.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: {
          id: input.supplierId,
          tenantId: tenant.id,
          category: SupplierCategory.roadside_assistance,
        },
      });
      if (!supplier) {
        throw new BadRequestException('supplierId must be a roadside_assistance supplier');
      }
    }

    const status: RoadsideInterventionStatus = input.status ?? RoadsideInterventionStatus.draft;
    const autoTs = this.timestampsForStatus(status);
    const now = new Date();
    const displayNumber = await nextRoadsideDisplayNumber(this.prisma, tenant.id, now);

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.roadsideIntervention.create({
        data: {
          tenantId: tenant.id,
          displayNumber,
          serviceCaseId: serviceCase.id,
          sourceTicketId: serviceCase.sourceTicketId,
          workOrderId,
          clientId: serviceCase.clientId,
          vehicleId: serviceCase.vehicleId,
          supplierId: input.supplierId ?? null,
          kind: input.kind,
          status,
          locationText: input.locationText?.trim() || null,
          notes: input.notes?.trim() || null,
          ...autoTs,
        },
        include: this.includeRelations(),
      });

      await this.appendTicketEvent(
        tx,
        tenant.id,
        serviceCase.sourceTicketId,
        {
          id: row.id,
          displayNumber: row.displayNumber,
          kind: row.kind,
          status: row.status,
        },
        actorUserId,
      );

      return row;
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'roadside_intervention.create',
      entityType: 'roadside_intervention',
      entityId: created.id,
      meta: { serviceCaseId: serviceCase.id, kind: input.kind, status },
    });

    return this.toRecord(created);
  }

  async patch(
    tenantSlug: string,
    id: string,
    input: PatchRoadsideInterventionInput,
    actorUserId?: string,
  ): Promise<RoadsideInterventionRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Intervention not found');

    const existing = await this.prisma.roadsideIntervention.findFirst({
      where: { id, tenantId: tenant.id },
    });
    if (!existing) throw new NotFoundException('Intervention not found');

    if (input.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: {
          id: input.supplierId,
          tenantId: tenant.id,
          category: SupplierCategory.roadside_assistance,
        },
      });
      if (!supplier) {
        throw new BadRequestException('supplierId must be a roadside_assistance supplier');
      }
    }

    if (input.workOrderId) {
      const wo = await this.prisma.maintenanceWorkOrder.findFirst({
        where: {
          id: input.workOrderId,
          tenantId: tenant.id,
          serviceCaseId: existing.serviceCaseId,
        },
      });
      if (!wo) throw new BadRequestException('workOrderId must belong to the same service case');
    }

    const data: Prisma.RoadsideInterventionUncheckedUpdateInput = {};
    if (input.workOrderId !== undefined) data.workOrderId = input.workOrderId;
    if (input.supplierId !== undefined) data.supplierId = input.supplierId;
    if (input.kind !== undefined) data.kind = input.kind;
    if (input.locationText !== undefined) data.locationText = input.locationText?.trim() || null;
    if (input.notes !== undefined) data.notes = input.notes?.trim() || null;
    if (input.requestedAt !== undefined) {
      data.requestedAt = input.requestedAt ? new Date(input.requestedAt) : null;
    }
    if (input.dispatchedAt !== undefined) {
      data.dispatchedAt = input.dispatchedAt ? new Date(input.dispatchedAt) : null;
    }
    if (input.onSiteAt !== undefined) {
      data.onSiteAt = input.onSiteAt ? new Date(input.onSiteAt) : null;
    }
    if (input.completedAt !== undefined) {
      data.completedAt = input.completedAt ? new Date(input.completedAt) : null;
    }

    let statusChanged = false;
    if (input.status !== undefined) {
      data.status = input.status;
      statusChanged = input.status !== existing.status;
      const autoTs = this.timestampsForStatus(input.status, existing);
      Object.assign(data, autoTs);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.roadsideIntervention.update({
        where: { id },
        data,
        include: this.includeRelations(),
      });

      if (statusChanged || input.kind !== undefined) {
        await this.appendTicketEvent(
          tx,
          tenant.id,
          existing.sourceTicketId,
          {
            id: row.id,
            displayNumber: row.displayNumber,
            kind: row.kind,
            status: row.status,
          },
          actorUserId,
        );
      }

      return row;
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'roadside_intervention.patch',
      entityType: 'roadside_intervention',
      entityId: id,
      meta: input,
    });

    return this.toRecord(updated);
  }
}
