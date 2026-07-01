import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CrmTicketEventKind,
  CrmTicketLinkEntityType,
  CrmTicketStatus,
  CrmTicketType,
  MaintenanceWorkOrderStatus,
  ServiceCaseSourceType,
  ServiceCaseStage,
  ServiceCaseStatus,
  ServiceCaseWorkflowType,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AccessContext } from '../iam/access-context.types';
import { canPerformTicketAction, canReadTicket } from '../iam/client-access';
import { PrismaService } from '../prisma/prisma.service';
import { resolveSupplierInTenant } from '../suppliers/supplier-resolve';

export const SERVICE_CASE_STAGE_ORDER: ServiceCaseStage[] = [
  ServiceCaseStage.intake,
  ServiceCaseStage.scheduled,
  ServiceCaseStage.work_order,
  ServiceCaseStage.quote,
  ServiceCaseStage.approval,
  ServiceCaseStage.cost,
  ServiceCaseStage.invoiced,
  ServiceCaseStage.closed,
];

export type WorkOrderRecord = {
  id: string;
  serviceCaseId: string;
  vehicleId: string;
  supplierId: string | null;
  supplierLegalName: string | null;
  title: string;
  status: MaintenanceWorkOrderStatus;
  plannedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type ServiceCaseRecord = {
  id: string;
  clientId: string;
  vehicleId: string | null;
  workflowType: ServiceCaseWorkflowType;
  sourceType: ServiceCaseSourceType;
  sourceTicketId: string | null;
  currentStage: ServiceCaseStage;
  status: ServiceCaseStatus;
  supplierId: string | null;
  supplierLegalName: string | null;
  title: string;
  notes: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  workOrders: WorkOrderRecord[];
};

export type AdvanceServiceCaseInput = {
  targetStage?: ServiceCaseStage;
  supplierId?: string | null;
  notes?: string | null;
};

function workflowTypeForTicket(ticketType: CrmTicketType): ServiceCaseWorkflowType {
  switch (ticketType) {
    case CrmTicketType.damage:
      return ServiceCaseWorkflowType.damage;
    case CrmTicketType.itp:
      return ServiceCaseWorkflowType.itp;
    case CrmTicketType.maintenance:
    case CrmTicketType.technical:
      return ServiceCaseWorkflowType.repair;
    case CrmTicketType.document:
      return ServiceCaseWorkflowType.insurance_rca;
    default:
      return ServiceCaseWorkflowType.repair;
  }
}

function stageLabel(stage: ServiceCaseStage): string {
  const labels: Record<ServiceCaseStage, string> = {
    intake: 'Intake',
    scheduled: 'Programare',
    work_order: 'Comandă service',
    quote: 'Deviz',
    approval: 'Aprobare deviz',
    cost: 'Cost',
    invoiced: 'Facturat',
    closed: 'Închis',
  };
  return labels[stage];
}

@Injectable()
export class ServiceCasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getByTicketId(
    tenantSlug: string,
    ticketId: string,
    access?: AccessContext,
  ): Promise<ServiceCaseRecord | null> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) return null;
    const row = await this.prisma.serviceCase.findFirst({
      where: { tenantId: tenant.id, sourceTicketId: ticketId },
      include: this.caseInclude(),
    });
    if (!row) return null;
    if (access && row.sourceTicketId) {
      const ticket = await this.prisma.crmTicket.findFirst({
        where: { id: row.sourceTicketId, tenantId: tenant.id },
      });
      if (ticket && !canReadTicket(access, ticket)) {
        throw new ForbiddenException('Service case not accessible');
      }
    }
    return this.toRecord(row);
  }

  async startFromTicket(
    tenantSlug: string,
    ticketId: string,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<ServiceCaseRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const ticket = await this.prisma.crmTicket.findFirst({
      where: { id: ticketId, tenantId: tenant.id },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (access && !canPerformTicketAction(access, 'transform', ticket)) {
      throw new ForbiddenException('Cannot start service case');
    }

    const existing = await this.prisma.serviceCase.findFirst({
      where: { sourceTicketId: ticketId },
      include: this.caseInclude(),
    });
    if (existing) return this.toRecord(existing);

    const workflowType = workflowTypeForTicket(ticket.ticketType);
    const row = await this.prisma.serviceCase.create({
      data: {
        tenantId: tenant.id,
        clientId: ticket.clientId,
        vehicleId: ticket.vehicleId,
        workflowType,
        sourceType: ServiceCaseSourceType.ticket,
        sourceTicketId: ticket.id,
        sourceReminderActionId: ticket.reminderActionId,
        currentStage: ServiceCaseStage.intake,
        status: ServiceCaseStatus.active,
        title: ticket.subject,
        notes: ticket.description,
      },
      include: this.caseInclude(),
    });

    await this.prisma.crmTicketLink.create({
      data: {
        tenantId: tenant.id,
        ticketId: ticket.id,
        entityType: CrmTicketLinkEntityType.service_case,
        entityId: row.id,
      },
    });

    await this.prisma.crmTicketEvent.create({
      data: {
        tenantId: tenant.id,
        ticketId: ticket.id,
        kind: CrmTicketEventKind.workflow_advance,
        body: `Dosar lucrare creat (${workflowType}).`,
        payload: { stage: ServiceCaseStage.intake, serviceCaseId: row.id },
        actorUserId: actorUserId ?? null,
      },
    });

    if (ticket.status === CrmTicketStatus.open) {
      await this.prisma.crmTicket.update({
        where: { id: ticket.id },
        data: { status: CrmTicketStatus.in_progress },
      });
    }

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'service_case.start_from_ticket',
      entityType: 'service_case',
      entityId: row.id,
      meta: { ticketId },
    });

    return this.toRecord(row);
  }

  async advance(
    tenantSlug: string,
    caseId: string,
    dto: AdvanceServiceCaseInput,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<ServiceCaseRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const row = await this.prisma.serviceCase.findFirst({
      where: { id: caseId, tenantId: tenant.id },
      include: { sourceTicket: true },
    });
    if (!row) throw new NotFoundException('Service case not found');
    if (row.status === ServiceCaseStatus.completed || row.status === ServiceCaseStatus.cancelled) {
      throw new BadRequestException('Service case is already closed');
    }

    if (row.sourceTicket && access && !canPerformTicketAction(access, 'transform', row.sourceTicket)) {
      throw new ForbiddenException('Cannot advance service case');
    }

    const currentIdx = SERVICE_CASE_STAGE_ORDER.indexOf(row.currentStage);
    const nextStage =
      dto.targetStage ??
      (currentIdx < SERVICE_CASE_STAGE_ORDER.length - 1
        ? SERVICE_CASE_STAGE_ORDER[currentIdx + 1]
        : row.currentStage);

    if (SERVICE_CASE_STAGE_ORDER.indexOf(nextStage) <= currentIdx && nextStage !== row.currentStage) {
      throw new BadRequestException('Cannot move to an earlier stage');
    }

    let supplierId = row.supplierId;
    if (dto.supplierId !== undefined) {
      if (dto.supplierId) {
        await resolveSupplierInTenant(this.prisma, tenant.id, dto.supplierId);
        supplierId = dto.supplierId;
      } else {
        supplierId = null;
      }
    }

    const data: {
      currentStage: ServiceCaseStage;
      supplierId?: string | null;
      notes?: string | null;
      status?: ServiceCaseStatus;
      closedAt?: Date | null;
    } = {
      currentStage: nextStage,
      supplierId,
    };
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;

    if (nextStage === ServiceCaseStage.closed) {
      data.status = ServiceCaseStatus.completed;
      data.closedAt = new Date();
    }

    const updated = await this.prisma.serviceCase.update({
      where: { id: caseId },
      data,
      include: this.caseInclude(),
    });

    if (nextStage === ServiceCaseStage.work_order && row.vehicleId) {
      await this.ensureWorkOrder(tenant.id, updated, supplierId, actorUserId);
    }

    if (row.sourceTicketId) {
      await this.prisma.crmTicketEvent.create({
        data: {
          tenantId: tenant.id,
          ticketId: row.sourceTicketId,
          kind: CrmTicketEventKind.workflow_advance,
          body: `Dosar avansat: ${stageLabel(row.currentStage)} → ${stageLabel(nextStage)}.`,
          payload: {
            fromStage: row.currentStage,
            toStage: nextStage,
            serviceCaseId: caseId,
          },
          actorUserId: actorUserId ?? null,
        },
      });
    }

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'service_case.advance',
      entityType: 'service_case',
      entityId: caseId,
      meta: { from: row.currentStage, to: nextStage },
    });

    const reloaded = await this.prisma.serviceCase.findFirst({
      where: { id: caseId },
      include: this.caseInclude(),
    });
    return this.toRecord(reloaded!);
  }

  private async ensureWorkOrder(
    tenantId: string,
    serviceCase: { id: string; vehicleId: string | null; title: string; sourceTicketId: string | null },
    supplierId: string | null,
    actorUserId?: string,
  ) {
    if (!serviceCase.vehicleId) {
      throw new BadRequestException('Service case has no vehicle — cannot create work order');
    }
    const existing = await this.prisma.maintenanceWorkOrder.findFirst({
      where: { serviceCaseId: serviceCase.id },
    });
    if (existing) return existing;

    const wo = await this.prisma.maintenanceWorkOrder.create({
      data: {
        tenantId,
        serviceCaseId: serviceCase.id,
        vehicleId: serviceCase.vehicleId,
        supplierId,
        title: serviceCase.title,
        status: supplierId ? MaintenanceWorkOrderStatus.sent : MaintenanceWorkOrderStatus.draft,
      },
    });

    if (serviceCase.sourceTicketId) {
      await this.prisma.crmTicketLink.create({
        data: {
          tenantId,
          ticketId: serviceCase.sourceTicketId,
          entityType: CrmTicketLinkEntityType.work_order,
          entityId: wo.id,
        },
      });
    }

    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'work_order.create',
      entityType: 'maintenance_work_order',
      entityId: wo.id,
      meta: { serviceCaseId: serviceCase.id },
    });

    return wo;
  }

  private caseInclude() {
    return {
      supplier: { select: { legalName: true } },
      workOrders: {
        orderBy: { createdAt: 'asc' as const },
        include: { supplier: { select: { legalName: true } } },
      },
    };
  }

  private toRecord(
    row: {
      id: string;
      clientId: string;
      vehicleId: string | null;
      workflowType: ServiceCaseWorkflowType;
      sourceType: ServiceCaseSourceType;
      sourceTicketId: string | null;
      currentStage: ServiceCaseStage;
      status: ServiceCaseStatus;
      supplierId: string | null;
      title: string;
      notes: string | null;
      closedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      supplier?: { legalName: string } | null;
      workOrders?: Array<{
        id: string;
        serviceCaseId: string;
        vehicleId: string;
        supplierId: string | null;
        title: string;
        status: MaintenanceWorkOrderStatus;
        plannedAt: Date | null;
        completedAt: Date | null;
        createdAt: Date;
        supplier?: { legalName: string } | null;
      }>;
    },
  ): ServiceCaseRecord {
    return {
      id: row.id,
      clientId: row.clientId,
      vehicleId: row.vehicleId,
      workflowType: row.workflowType,
      sourceType: row.sourceType,
      sourceTicketId: row.sourceTicketId,
      currentStage: row.currentStage,
      status: row.status,
      supplierId: row.supplierId,
      supplierLegalName: row.supplier?.legalName ?? null,
      title: row.title,
      notes: row.notes,
      closedAt: row.closedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      workOrders: (row.workOrders ?? []).map((wo) => ({
        id: wo.id,
        serviceCaseId: wo.serviceCaseId,
        vehicleId: wo.vehicleId,
        supplierId: wo.supplierId,
        supplierLegalName: wo.supplier?.legalName ?? null,
        title: wo.title,
        status: wo.status,
        plannedAt: wo.plannedAt?.toISOString() ?? null,
        completedAt: wo.completedAt?.toISOString() ?? null,
        createdAt: wo.createdAt.toISOString(),
      })),
    };
  }
}
