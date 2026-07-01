import {
  BadRequestException,
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

    const list = this.toListRow(row);
    return {
      ...list,
      notes: row.notes,
      serviceCaseTitle: row.serviceCase.title,
      serviceCaseStatus: row.serviceCase.status,
    };
  }

  async complete(tenantSlug: string, id: string, actorUserId?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const wo = await this.prisma.maintenanceWorkOrder.findFirst({
      where: { id, tenantId: tenant.id },
      include: {
        serviceCase: true,
        quotes: {
          where: { status: 'approved' },
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });
    if (!wo) throw new NotFoundException('Work order not found');
    if (wo.status === MaintenanceWorkOrderStatus.done) {
      throw new BadRequestException('Work order is already completed');
    }

    const approvedQuote = wo.quotes[0];
    if (!approvedQuote?.invoicedAt) {
      throw new BadRequestException('Record invoice on approved quote before completing');
    }

    const stageIdx = SERVICE_CASE_STAGE_ORDER.indexOf(wo.serviceCase.currentStage);
    const invoicedIdx = SERVICE_CASE_STAGE_ORDER.indexOf(ServiceCaseStage.invoiced);
    if (stageIdx < invoicedIdx) {
      throw new BadRequestException('Service case must reach invoiced stage before completion');
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
