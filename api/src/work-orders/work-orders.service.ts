import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CrmTicketEventKind,
  MaintenanceWorkOrderStatus,
  Prisma,
  ServiceCaseStage,
  ServiceCaseStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { assertClientFleetWrite } from '../iam/client-access';
import type { AccessContext } from '../iam/access-context.types';
import { PrismaService } from '../prisma/prisma.service';
import { SERVICE_CASE_STAGE_ORDER } from '../service-cases/service-cases.service';

const MAX_PAGE_SIZE = 200;

export type WorkOrderListRow = {
  id: string;
  title: string;
  status: MaintenanceWorkOrderStatus;
  createdAt: string;
  updatedAt: string;
  plannedAt: string | null;
  completedAt: string | null;
  vehicleId: string;
  registrationNumber: string;
  clientId: string;
  clientCode: string;
  clientLegalName: string;
  supplierId: string | null;
  supplierCode: string | null;
  supplierLegalName: string | null;
  serviceCaseId: string;
  serviceCaseStage: string;
  workflowType: string;
  sourceTicketId: string | null;
  ticketDisplayId: string | null;
};

export type WorkOrderDetail = WorkOrderListRow & {
  notes: string | null;
  serviceCaseTitle: string;
  serviceCaseStatus: string;
  linkedAppointmentId: string | null;
  linkedAppointmentScheduledAt: string | null;
  inServiceAt: string | null;
  outServiceAt: string | null;
};

export type WorkOrderListParams = {
  page: number;
  pageSize: number;
  q?: string;
  status?: MaintenanceWorkOrderStatus;
  supplierId?: string;
  vehicleId?: string;
  clientId?: string;
};

export type WorkOrderStats = {
  open: number;
  inProgress: number;
  waitingParts: number;
  done: number;
};

function ticketDisplayId(ticketId: string | null | undefined): string | null {
  if (!ticketId) return null;
  return ticketId.slice(-6).toUpperCase();
}

@Injectable()
export class WorkOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private listInclude() {
    return {
      vehicle: {
        select: {
          registrationNumber: true,
          clientId: true,
          client: { select: { code: true, legalName: true } },
        },
      },
      supplier: { select: { id: true, code: true, legalName: true } },
      serviceCase: {
        select: {
          id: true,
          title: true,
          status: true,
          currentStage: true,
          workflowType: true,
          sourceTicketId: true,
          clientId: true,
        },
      },
    } as const;
  }

  private toListRow(row: {
    id: string;
    title: string;
    status: MaintenanceWorkOrderStatus;
    createdAt: Date;
    updatedAt: Date;
    plannedAt: Date | null;
    completedAt: Date | null;
    vehicleId: string;
    supplierId: string | null;
    serviceCaseId: string;
    vehicle: {
      registrationNumber: string;
      clientId: string;
      client: { code: string; legalName: string };
    };
    supplier: { code: string; legalName: string } | null;
    serviceCase: {
      currentStage: string;
      workflowType: string;
      sourceTicketId: string | null;
    };
  }): WorkOrderListRow {
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      plannedAt: row.plannedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      vehicleId: row.vehicleId,
      registrationNumber: row.vehicle.registrationNumber,
      clientId: row.vehicle.clientId,
      clientCode: row.vehicle.client.code,
      clientLegalName: row.vehicle.client.legalName,
      supplierId: row.supplierId,
      supplierCode: row.supplier?.code ?? null,
      supplierLegalName: row.supplier?.legalName ?? null,
      serviceCaseId: row.serviceCaseId,
      serviceCaseStage: row.serviceCase.currentStage,
      workflowType: row.serviceCase.workflowType,
      sourceTicketId: row.serviceCase.sourceTicketId,
      ticketDisplayId: ticketDisplayId(row.serviceCase.sourceTicketId),
    };
  }

  private listWhere(tenantId: string, params: WorkOrderListParams): Prisma.MaintenanceWorkOrderWhereInput {
    const parts: Prisma.MaintenanceWorkOrderWhereInput[] = [{ tenantId }];
    if (params.status) parts.push({ status: params.status });
    if (params.supplierId?.trim()) parts.push({ supplierId: params.supplierId.trim() });
    if (params.vehicleId?.trim()) parts.push({ vehicleId: params.vehicleId.trim() });
    if (params.clientId?.trim()) {
      parts.push({
        OR: [
          { vehicle: { clientId: params.clientId.trim() } },
          { serviceCase: { clientId: params.clientId.trim() } },
        ],
      });
    }
    const q = params.q?.trim();
    if (q) {
      parts.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { vehicle: { registrationNumber: { contains: q, mode: 'insensitive' } } },
          { supplier: { legalName: { contains: q, mode: 'insensitive' } } },
          { supplier: { code: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }
    return { AND: parts };
  }

  async listPaged(tenantSlug: string, params: WorkOrderListParams) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return { items: [], total: 0, page: params.page, pageSize: params.pageSize };
    }
    const pageSize = Math.min(Math.max(1, params.pageSize), MAX_PAGE_SIZE);
    const page = Math.max(1, params.page);
    const skip = (page - 1) * pageSize;
    const where = this.listWhere(tenant.id, params);

    const [total, rows] = await Promise.all([
      this.prisma.maintenanceWorkOrder.count({ where }),
      this.prisma.maintenanceWorkOrder.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        skip,
        take: pageSize,
        include: this.listInclude(),
      }),
    ]);

    return {
      items: rows.map((r) => this.toListRow(r)),
      total,
      page,
      pageSize,
    };
  }

  async getStats(tenantSlug: string, clientId?: string): Promise<WorkOrderStats> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) return { open: 0, inProgress: 0, waitingParts: 0, done: 0 };

    const clientFilter: Prisma.MaintenanceWorkOrderWhereInput | undefined = clientId?.trim()
      ? {
          OR: [
            { vehicle: { clientId: clientId.trim() } },
            { serviceCase: { clientId: clientId.trim() } },
          ],
        }
      : undefined;

    const base: Prisma.MaintenanceWorkOrderWhereInput = {
      tenantId: tenant.id,
      ...(clientFilter ? { AND: [clientFilter] } : {}),
    };

    const [open, inProgress, waitingParts, done] = await Promise.all([
      this.prisma.maintenanceWorkOrder.count({
        where: {
          ...base,
          status: {
            in: [
              MaintenanceWorkOrderStatus.draft,
              MaintenanceWorkOrderStatus.sent,
              MaintenanceWorkOrderStatus.in_progress,
              MaintenanceWorkOrderStatus.waiting_parts,
            ],
          },
        },
      }),
      this.prisma.maintenanceWorkOrder.count({
        where: { ...base, status: MaintenanceWorkOrderStatus.in_progress },
      }),
      this.prisma.maintenanceWorkOrder.count({
        where: { ...base, status: MaintenanceWorkOrderStatus.waiting_parts },
      }),
      this.prisma.maintenanceWorkOrder.count({
        where: { ...base, status: MaintenanceWorkOrderStatus.done },
      }),
    ]);

    return { open, inProgress, waitingParts, done };
  }

  async getById(tenantSlug: string, id: string): Promise<WorkOrderDetail> {
    const row = await this.prisma.maintenanceWorkOrder.findFirst({
      where: { id, tenant: { slug: tenantSlug } },
      include: {
        ...this.listInclude(),
        serviceCase: {
          select: {
            id: true,
            title: true,
            status: true,
            currentStage: true,
            workflowType: true,
            sourceTicketId: true,
            clientId: true,
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Work order not found');

    const linked = await this.resolveLinkedAppointment(row.tenantId, row.serviceCaseId, row.plannedAt);

    const list = this.toListRow(row);
    return {
      ...list,
      notes: row.notes,
      serviceCaseTitle: row.serviceCase.title,
      serviceCaseStatus: row.serviceCase.status,
      linkedAppointmentId: linked?.id ?? null,
      linkedAppointmentScheduledAt: linked?.scheduledAt.toISOString() ?? null,
      inServiceAt: row.inServiceAt?.toISOString() ?? null,
      outServiceAt: row.outServiceAt?.toISOString() ?? null,
    };
  }

  async recordServiceTimes(
    tenantSlug: string,
    id: string,
    dto: { inServiceAt?: string | null; outServiceAt?: string | null },
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<WorkOrderDetail> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const wo = await this.prisma.maintenanceWorkOrder.findFirst({
      where: { id, tenantId: tenant.id },
      include: {
        vehicle: { select: { clientId: true } },
        serviceCase: { select: { id: true, currentStage: true, sourceTicketId: true, clientId: true } },
      },
    });
    if (!wo) throw new NotFoundException('Work order not found');
    if (access) {
      try {
        assertClientFleetWrite(access, wo.vehicle.clientId);
      } catch {
        throw new ForbiddenException('Cannot update service times');
      }
    }

    const data: { inServiceAt?: Date | null; outServiceAt?: Date | null; status?: MaintenanceWorkOrderStatus } =
      {};

    if (dto.inServiceAt !== undefined) {
      if (dto.inServiceAt === null || dto.inServiceAt === '') {
        data.inServiceAt = null;
      } else {
        const d = new Date(dto.inServiceAt);
        if (Number.isNaN(d.getTime())) throw new BadRequestException('Invalid inServiceAt');
        data.inServiceAt = d;
      }
    }

    if (dto.outServiceAt !== undefined) {
      if (dto.outServiceAt === null || dto.outServiceAt === '') {
        data.outServiceAt = null;
      } else {
        const d = new Date(dto.outServiceAt);
        if (Number.isNaN(d.getTime())) throw new BadRequestException('Invalid outServiceAt');
        data.outServiceAt = d;
      }
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Provide inServiceAt and/or outServiceAt');
    }

    const nextIn = data.inServiceAt !== undefined ? data.inServiceAt : wo.inServiceAt;
    const nextOut = data.outServiceAt !== undefined ? data.outServiceAt : wo.outServiceAt;
    if (nextIn && nextOut && nextOut.getTime() < nextIn.getTime()) {
      throw new BadRequestException('outServiceAt must be after inServiceAt');
    }

    if (data.inServiceAt && wo.status === MaintenanceWorkOrderStatus.draft) {
      data.status = MaintenanceWorkOrderStatus.in_progress;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.maintenanceWorkOrder.update({ where: { id }, data });

      const ticketId = wo.serviceCase.sourceTicketId;
      if (data.inServiceAt) {
        await this.ensureCaseStageAtLeast(
          tx,
          tenant.id,
          wo.serviceCaseId,
          ServiceCaseStage.in_service,
          ticketId,
          actorUserId,
          `Intrare service: ${data.inServiceAt.toLocaleString('ro-RO')}.`,
        );
      }
      if (data.outServiceAt) {
        await this.ensureCaseStageAtLeast(
          tx,
          tenant.id,
          wo.serviceCaseId,
          ServiceCaseStage.out_service,
          ticketId,
          actorUserId,
          `Ieșire service: ${data.outServiceAt.toLocaleString('ro-RO')}.`,
        );
      }
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'work_order.service_times',
      entityType: 'maintenance_work_order',
      entityId: id,
      meta: { inServiceAt: nextIn?.toISOString(), outServiceAt: nextOut?.toISOString() },
    });

    return this.getById(tenantSlug, id);
  }

  private async ensureCaseStageAtLeast(
    tx: Prisma.TransactionClient,
    tenantId: string,
    serviceCaseId: string,
    targetStage: ServiceCaseStage,
    sourceTicketId: string | null,
    actorUserId?: string,
    eventBody?: string,
  ) {
    const serviceCase = await tx.serviceCase.findFirst({ where: { id: serviceCaseId, tenantId } });
    if (!serviceCase) return;

    const currentIdx = SERVICE_CASE_STAGE_ORDER.indexOf(serviceCase.currentStage);
    const targetIdx = SERVICE_CASE_STAGE_ORDER.indexOf(targetStage);
    if (targetIdx <= currentIdx) return;

    await tx.serviceCase.update({
      where: { id: serviceCaseId },
      data: { currentStage: targetStage },
    });

    if (sourceTicketId) {
      await tx.crmTicketEvent.create({
        data: {
          tenantId,
          ticketId: sourceTicketId,
          kind: CrmTicketEventKind.workflow_advance,
          body: eventBody ?? `Dosar avansat la etapa ${targetStage}.`,
          payload: { fromStage: serviceCase.currentStage, toStage: targetStage, serviceCaseId },
          actorUserId: actorUserId ?? null,
        },
      });
    }
  }

  private async resolveLinkedAppointment(
    tenantId: string,
    serviceCaseId: string,
    plannedAt: Date | null,
  ): Promise<{ id: string; scheduledAt: Date } | null> {
    if (plannedAt) {
      const exact = await this.prisma.serviceAppointment.findFirst({
        where: {
          tenantId,
          serviceCaseId,
          scheduledAt: plannedAt,
          status: { not: 'cancelled' },
        },
        select: { id: true, scheduledAt: true },
      });
      if (exact) return exact;
    }

    return this.prisma.serviceAppointment.findFirst({
      where: {
        tenantId,
        serviceCaseId,
        status: { not: 'cancelled' },
        ...(plannedAt ? { scheduledAt: { gte: new Date(plannedAt.getTime() - 86_400_000) } } : {}),
      },
      orderBy: { scheduledAt: 'asc' },
      select: { id: true, scheduledAt: true },
    });
  }

  async complete(tenantSlug: string, id: string, actorUserId?: string, access?: AccessContext) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const wo = await this.prisma.maintenanceWorkOrder.findFirst({
      where: { id, tenantId: tenant.id },
      include: {
        vehicle: { select: { clientId: true } },
        serviceCase: true,
        quotes: {
          where: { status: 'approved' },
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });
    if (!wo) throw new NotFoundException('Work order not found');
    if (access) {
      try {
        assertClientFleetWrite(access, wo.vehicle.clientId);
      } catch {
        throw new ForbiddenException('Cannot complete work order');
      }
    }
    if (wo.status === MaintenanceWorkOrderStatus.done) {
      throw new BadRequestException('Work order is already completed');
    }

    const approvedQuote = wo.quotes[0];
    if (!approvedQuote?.invoicedAt) {
      throw new BadRequestException('Record invoice on approved quote before completing');
    }
    if (!approvedQuote?.costEntryId) {
      throw new BadRequestException('Post cost from quote before completing');
    }

    const stageIdx = SERVICE_CASE_STAGE_ORDER.indexOf(wo.serviceCase.currentStage);
    const costIdx = SERVICE_CASE_STAGE_ORDER.indexOf(ServiceCaseStage.cost);
    if (stageIdx < costIdx) {
      throw new BadRequestException('Service case must reach cost stage before completion');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.maintenanceWorkOrder.update({
        where: { id },
        data: {
          status: MaintenanceWorkOrderStatus.done,
          completedAt: new Date(),
        },
      });

      await tx.serviceCase.update({
        where: { id: wo.serviceCaseId },
        data: {
          currentStage: ServiceCaseStage.closed,
          status: ServiceCaseStatus.completed,
          closedAt: new Date(),
        },
      });

      if (wo.serviceCase.sourceTicketId) {
        await tx.crmTicketEvent.create({
          data: {
            tenantId: tenant.id,
            ticketId: wo.serviceCase.sourceTicketId,
            kind: CrmTicketEventKind.workflow_advance,
            body: 'Comandă service finalizată — dosar închis.',
            payload: {
              fromStage: wo.serviceCase.currentStage,
              toStage: ServiceCaseStage.closed,
              serviceCaseId: wo.serviceCaseId,
              workOrderId: id,
            },
            actorUserId: actorUserId ?? null,
          },
        });
      }
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'work_order.complete',
      entityType: 'maintenance_work_order',
      entityId: id,
      meta: { serviceCaseId: wo.serviceCaseId },
    });

    return this.getById(tenantSlug, id);
  }
}
