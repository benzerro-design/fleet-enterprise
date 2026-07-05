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
  Prisma,
  ServiceAppointmentStatus,
  ServiceCaseSourceType,
  ServiceCaseStage,
  ServiceCaseStatus,
  ServiceCaseWorkflowType,
  PostApprovalPath,
  WorkOrderQuoteStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AccessContext } from '../iam/access-context.types';
import {
  assertClientAccess,
  assertServiceCaseWrite,
  canAckAppointmentAsDriver,
  canConfirmAppointment,
  canReadTicket,
  isTenantWideAccess,
} from '../iam/client-access';
import { PrismaService } from '../prisma/prisma.service';
import { resolveSupplierInTenant } from '../suppliers/supplier-resolve';

export const SERVICE_CASE_STAGE_ORDER: ServiceCaseStage[] = [
  ServiceCaseStage.intake,
  ServiceCaseStage.scheduled,
  ServiceCaseStage.work_order,
  ServiceCaseStage.in_service,
  ServiceCaseStage.out_service,
  ServiceCaseStage.quote,
  ServiceCaseStage.approval,
  ServiceCaseStage.invoiced,
  ServiceCaseStage.cost,
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
  inServiceAt: string | null;
  outServiceAt: string | null;
  displayNumber: string | null;
  odometerKmIn: number | null;
  odometerKmOut: number | null;
  repairPathNote: string | null;
  serviceOrderType: string;
  readyAt: string | null;
  estimatedRepairAt: string | null;
  createdAt: string;
  latestQuote: QuoteSummary | null;
  approvedQuote: QuoteSummary | null;
  pendingQuote: QuoteSummary | null;
};

export type QuoteSummary = {
  id: string;
  workOrderId: string;
  version: number;
  status: WorkOrderQuoteStatus;
  totalGrossCents: number;
  currency: string;
  invoicedAt: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  costEntryId: string | null;
};

export type ServiceAppointmentRecord = {
  id: string;
  serviceCaseId: string;
  vehicleId: string;
  supplierId: string | null;
  supplierLegalName: string | null;
  title: string;
  scheduledAt: string;
  endAt: string;
  durationMin: number;
  location: string | null;
  status: ServiceAppointmentStatus;
  notes: string | null;
  managerConfirmedAt: string | null;
  driverAcknowledgedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateServiceAppointmentInput = {
  scheduledAt: string;
  supplierId?: string | null;
  location?: string | null;
  notes?: string | null;
  status?: ServiceAppointmentStatus;
  title?: string | null;
  durationMin?: number;
};

export type UpdateServiceAppointmentInput = {
  scheduledAt?: string;
  supplierId?: string | null;
  location?: string | null;
  notes?: string | null;
  status?: ServiceAppointmentStatus;
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
  awaitingPostApproval: boolean;
  postApprovalPath: PostApprovalPath | null;
  createdAt: string;
  updatedAt: string;
  workOrders: WorkOrderRecord[];
  appointments: ServiceAppointmentRecord[];
};

export type PostApprovalInput = {
  path: 'immediate' | 'reschedule';
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
    in_service: 'In service',
    out_service: 'Out service',
    quote: 'Deviz',
    approval: 'Aprobare deviz',
    invoiced: 'Facturat',
    cost: 'Cost',
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
    } else if (access && !isTenantWideAccess(access)) {
      assertClientAccess(access, row.clientId);
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
    if (access) assertServiceCaseWrite(access, ticket.clientId);

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

    if (access) assertServiceCaseWrite(access, row.clientId);

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

  async createAppointment(
    tenantSlug: string,
    caseId: string,
    dto: CreateServiceAppointmentInput,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<ServiceAppointmentRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const serviceCase = await this.prisma.serviceCase.findFirst({
      where: { id: caseId, tenantId: tenant.id },
      include: { sourceTicket: true },
    });
    if (!serviceCase) throw new NotFoundException('Service case not found');
    if (!serviceCase.vehicleId) {
      throw new BadRequestException('Service case has no vehicle — cannot schedule');
    }
    if (access) assertServiceCaseWrite(access, serviceCase.clientId);

    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('Invalid scheduledAt');
    }

    let supplierId = serviceCase.supplierId;
    if (dto.supplierId !== undefined) {
      if (dto.supplierId) {
        await resolveSupplierInTenant(this.prisma, tenant.id, dto.supplierId);
        supplierId = dto.supplierId;
      } else {
        supplierId = null;
      }
    }

    const durationMin = dto.durationMin ?? 60;
    if (!Number.isInteger(durationMin) || durationMin < 15) {
      throw new BadRequestException('Invalid durationMin');
    }

    const appointment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.serviceAppointment.create({
        data: {
          tenantId: tenant.id,
          serviceCaseId: caseId,
          vehicleId: serviceCase.vehicleId!,
          supplierId,
          title: dto.title?.trim() || serviceCase.title,
          scheduledAt,
          durationMin,
          location: dto.location?.trim() || null,
          notes: dto.notes?.trim() || null,
          status: dto.status ?? ServiceAppointmentStatus.scheduled,
        },
        include: { supplier: { select: { legalName: true } } },
      });

      const currentIdx = SERVICE_CASE_STAGE_ORDER.indexOf(serviceCase.currentStage);
      const scheduledIdx = SERVICE_CASE_STAGE_ORDER.indexOf(ServiceCaseStage.scheduled);
      if (currentIdx < scheduledIdx) {
        await tx.serviceCase.update({
          where: { id: caseId },
          data: { currentStage: ServiceCaseStage.scheduled, supplierId },
        });
        if (serviceCase.sourceTicketId) {
          await tx.crmTicketEvent.create({
            data: {
              tenantId: tenant.id,
              ticketId: serviceCase.sourceTicketId,
              kind: CrmTicketEventKind.workflow_advance,
              body: `Programare stabilită: ${scheduledAt.toLocaleString('ro-RO')}.`,
              payload: {
                fromStage: serviceCase.currentStage,
                toStage: ServiceCaseStage.scheduled,
                serviceCaseId: caseId,
                appointmentId: created.id,
              },
              actorUserId: actorUserId ?? null,
            },
          });
        }
      } else if (supplierId !== serviceCase.supplierId) {
        await tx.serviceCase.update({
          where: { id: caseId },
          data: { supplierId },
        });
      }

      await tx.maintenanceWorkOrder.updateMany({
        where: { serviceCaseId: caseId },
        data: { plannedAt: scheduledAt, supplierId },
      });

      return created;
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'service_appointment.create',
      entityType: 'service_appointment',
      entityId: appointment.id,
      meta: { serviceCaseId: caseId },
    });

    return this.toAppointmentRecord(appointment);
  }

  async updateAppointment(
    tenantSlug: string,
    appointmentId: string,
    dto: UpdateServiceAppointmentInput,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<ServiceAppointmentRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const existing = await this.prisma.serviceAppointment.findFirst({
      where: { id: appointmentId, tenantId: tenant.id },
      include: { serviceCase: { include: { sourceTicket: true } } },
    });
    if (!existing) throw new NotFoundException('Appointment not found');

    if (access) assertServiceCaseWrite(access, existing.serviceCase.clientId);

    let supplierId = existing.supplierId;
    if (dto.supplierId !== undefined) {
      if (dto.supplierId) {
        await resolveSupplierInTenant(this.prisma, tenant.id, dto.supplierId);
        supplierId = dto.supplierId;
      } else {
        supplierId = null;
      }
    }

    const data: Prisma.ServiceAppointmentUpdateInput = {};
    if (dto.scheduledAt !== undefined) {
      const scheduledAt = new Date(dto.scheduledAt);
      if (Number.isNaN(scheduledAt.getTime())) throw new BadRequestException('Invalid scheduledAt');
      data.scheduledAt = scheduledAt;
    }
    if (dto.location !== undefined) data.location = dto.location?.trim() || null;
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.supplierId !== undefined) {
      data.supplier = supplierId
        ? { connect: { id: supplierId } }
        : { disconnect: true };
    }

    const appointment = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.serviceAppointment.update({
        where: { id: appointmentId },
        data,
        include: { supplier: { select: { legalName: true } } },
      });

      if (dto.scheduledAt !== undefined || dto.supplierId !== undefined) {
        await tx.maintenanceWorkOrder.updateMany({
          where: { serviceCaseId: existing.serviceCaseId },
          data: {
            ...(dto.scheduledAt !== undefined ? { plannedAt: updated.scheduledAt } : {}),
            ...(dto.supplierId !== undefined ? { supplierId } : {}),
          },
        });
        if (dto.supplierId !== undefined) {
          await tx.serviceCase.update({
            where: { id: existing.serviceCaseId },
            data: { supplierId },
          });
        }
      }

      return updated;
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'service_appointment.update',
      entityType: 'service_appointment',
      entityId: appointmentId,
      meta: { serviceCaseId: existing.serviceCaseId },
    });

    return this.toAppointmentRecord(appointment);
  }

  async confirmAppointment(
    tenantSlug: string,
    appointmentId: string,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<ServiceCaseRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const existing = await this.prisma.serviceAppointment.findFirst({
      where: { id: appointmentId, tenantId: tenant.id },
      include: { serviceCase: true },
    });
    if (!existing) throw new NotFoundException('Appointment not found');
    if (existing.status === ServiceAppointmentStatus.cancelled) {
      throw new BadRequestException('Cannot confirm cancelled appointment');
    }
    if (access && !canConfirmAppointment(access, existing.serviceCase.clientId)) {
      throw new ForbiddenException('Cannot confirm appointment');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.serviceAppointment.update({
        where: { id: appointmentId },
        data: {
          status: ServiceAppointmentStatus.confirmed,
          managerConfirmedAt: new Date(),
        },
      });

      const serviceCase = await tx.serviceCase.findFirst({ where: { id: existing.serviceCaseId } });
      if (!serviceCase?.vehicleId) return;

      await this.ensureWorkOrderTx(
        tx,
        tenant.id,
        serviceCase,
        existing.supplierId ?? serviceCase.supplierId,
        actorUserId,
      );

      const workOrderIdx = SERVICE_CASE_STAGE_ORDER.indexOf(ServiceCaseStage.work_order);
      const currentIdx = SERVICE_CASE_STAGE_ORDER.indexOf(serviceCase.currentStage);
      if (currentIdx < workOrderIdx) {
        await tx.serviceCase.update({
          where: { id: serviceCase.id },
          data: { currentStage: ServiceCaseStage.work_order },
        });
      }

      await tx.maintenanceWorkOrder.updateMany({
        where: { serviceCaseId: serviceCase.id },
        data: { plannedAt: existing.scheduledAt, supplierId: existing.supplierId ?? serviceCase.supplierId },
      });

      if (serviceCase.sourceTicketId) {
        await tx.crmTicketEvent.create({
          data: {
            tenantId: tenant.id,
            ticketId: serviceCase.sourceTicketId,
            kind: CrmTicketEventKind.workflow_advance,
            body: `Programare confirmată: ${existing.scheduledAt.toLocaleString('ro-RO')}.`,
            payload: { appointmentId, serviceCaseId: serviceCase.id },
            actorUserId: actorUserId ?? null,
          },
        });
      }
    });

    const reloaded = await this.prisma.serviceCase.findFirst({
      where: { id: existing.serviceCaseId },
      include: this.caseInclude(),
    });
    return this.toRecord(reloaded!);
  }

  async acknowledgeAppointment(
    tenantSlug: string,
    appointmentId: string,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<ServiceCaseRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const existing = await this.prisma.serviceAppointment.findFirst({
      where: { id: appointmentId, tenantId: tenant.id },
      include: { serviceCase: true },
    });
    if (!existing) throw new NotFoundException('Appointment not found');
    if (access && !canAckAppointmentAsDriver(access, existing.serviceCase.clientId)) {
      throw new ForbiddenException('Cannot acknowledge appointment');
    }

    await this.prisma.serviceAppointment.update({
      where: { id: appointmentId },
      data: { driverAcknowledgedAt: new Date() },
    });

    const reloaded = await this.prisma.serviceCase.findFirst({
      where: { id: existing.serviceCaseId },
      include: this.caseInclude(),
    });
    return this.toRecord(reloaded!);
  }

  async applyPostApproval(
    tenantSlug: string,
    caseId: string,
    dto: PostApprovalInput,
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
    if (access) assertServiceCaseWrite(access, row.clientId);
    if (!row.awaitingPostApproval) {
      throw new BadRequestException('Service case is not awaiting post-approval decision');
    }

    const path = dto.path === 'reschedule' ? PostApprovalPath.reschedule : PostApprovalPath.immediate;

    await this.prisma.$transaction(async (tx) => {
      if (path === PostApprovalPath.immediate) {
        await tx.serviceCase.update({
          where: { id: caseId },
          data: {
            awaitingPostApproval: false,
            postApprovalPath: PostApprovalPath.immediate,
            currentStage: ServiceCaseStage.work_order,
          },
        });
      } else {
        await tx.serviceCase.update({
          where: { id: caseId },
          data: {
            awaitingPostApproval: false,
            postApprovalPath: PostApprovalPath.reschedule,
            currentStage: ServiceCaseStage.scheduled,
          },
        });
      }

      if (row.sourceTicketId) {
        await tx.crmTicketEvent.create({
          data: {
            tenantId: tenant.id,
            ticketId: row.sourceTicketId,
            kind: CrmTicketEventKind.workflow_advance,
            body:
              path === PostApprovalPath.immediate
                ? 'Deviz aprobat — execuție reparație (factură apoi cost).'
                : 'Deviz aprobat — reprogramare service (fără deviz nou).',
            payload: { serviceCaseId: caseId, postApprovalPath: path },
            actorUserId: actorUserId ?? null,
          },
        });
      }

      const wo = await tx.maintenanceWorkOrder.findFirst({ where: { serviceCaseId: caseId } });
      if (wo) {
        await tx.maintenanceWorkOrder.update({
          where: { id: wo.id },
          data: {
            repairPathNote:
              path === PostApprovalPath.immediate
                ? 'Reparație directă după aprobare deviz'
                : 'Reparație cu reprogramare după aprobare deviz',
          },
        });
      }
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
    return this.ensureWorkOrderTx(this.prisma, tenantId, serviceCase, supplierId, actorUserId);
  }

  private async ensureWorkOrderTx(
    tx: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    serviceCase: { id: string; vehicleId: string | null; title: string; sourceTicketId: string | null },
    supplierId: string | null,
    actorUserId?: string,
  ) {
    if (!serviceCase.vehicleId) {
      throw new BadRequestException('Service case has no vehicle — cannot create work order');
    }
    const existing = await tx.maintenanceWorkOrder.findFirst({
      where: { serviceCaseId: serviceCase.id },
    });
    if (existing) return existing;

    const year = new Date().getFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const seq =
      (await tx.maintenanceWorkOrder.count({
        where: { tenantId, createdAt: { gte: yearStart } },
      })) + 1;
    const displayNumber = `WO-${year}-${String(seq).padStart(4, '0')}`;

    const wo = await tx.maintenanceWorkOrder.create({
      data: {
        tenantId,
        serviceCaseId: serviceCase.id,
        vehicleId: serviceCase.vehicleId,
        supplierId,
        title: serviceCase.title,
        displayNumber,
        status: supplierId ? MaintenanceWorkOrderStatus.sent : MaintenanceWorkOrderStatus.draft,
      },
    });

    if (serviceCase.sourceTicketId) {
      await tx.crmTicketLink.create({
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
        include: {
          supplier: { select: { legalName: true } },
          quotes: {
            orderBy: { version: 'desc' as const },
            take: 5,
            select: {
              id: true,
              workOrderId: true,
              version: true,
              status: true,
              totalNetCents: true,
              totalVatCents: true,
              currency: true,
              invoicedAt: true,
              invoiceNumber: true,
              invoiceDate: true,
              costEntryId: true,
            },
          },
        },
      },
      appointments: {
        orderBy: { scheduledAt: 'asc' as const },
        include: { supplier: { select: { legalName: true } }, serviceCase: { select: { title: true } } },
      },
    };
  }

  private toAppointmentRecord(row: {
    id: string;
    serviceCaseId: string;
    vehicleId: string;
    supplierId: string | null;
    title: string | null;
    scheduledAt: Date;
    durationMin: number;
    location: string | null;
    status: ServiceAppointmentStatus;
    notes: string | null;
    managerConfirmedAt?: Date | null;
    driverAcknowledgedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
    supplier?: { legalName: string } | null;
    serviceCase?: { title: string };
  }): ServiceAppointmentRecord {
    const durationMin = row.durationMin ?? 60;
    const title = row.title?.trim() || row.serviceCase?.title || 'Programare';
    return {
      id: row.id,
      serviceCaseId: row.serviceCaseId,
      vehicleId: row.vehicleId,
      supplierId: row.supplierId,
      supplierLegalName: row.supplier?.legalName ?? null,
      title,
      scheduledAt: row.scheduledAt.toISOString(),
      endAt: new Date(row.scheduledAt.getTime() + durationMin * 60_000).toISOString(),
      durationMin,
      location: row.location,
      status: row.status,
      notes: row.notes,
      managerConfirmedAt: row.managerConfirmedAt?.toISOString() ?? null,
      driverAcknowledgedAt: row.driverAcknowledgedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
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
      awaitingPostApproval?: boolean;
      postApprovalPath?: PostApprovalPath | null;
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
        inServiceAt: Date | null;
        outServiceAt: Date | null;
        displayNumber: string | null;
        odometerKmIn: number | null;
        odometerKmOut: number | null;
        repairPathNote: string | null;
        serviceOrderType: string;
        readyAt: Date | null;
        estimatedRepairAt: Date | null;
        createdAt: Date;
        supplier?: { legalName: string } | null;
        quotes?: Array<{
          id: string;
          workOrderId: string;
          version: number;
          status: WorkOrderQuoteStatus;
          totalNetCents: number;
          totalVatCents: number;
          currency: string;
          invoicedAt: Date | null;
          invoiceNumber: string | null;
          invoiceDate: Date | null;
          costEntryId: string | null;
        }>;
      }>;
      appointments?: Array<{
        id: string;
        serviceCaseId: string;
        vehicleId: string;
        supplierId: string | null;
        title: string | null;
        scheduledAt: Date;
        durationMin: number;
        location: string | null;
        status: ServiceAppointmentStatus;
        notes: string | null;
        createdAt: Date;
        updatedAt: Date;
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
      awaitingPostApproval: row.awaitingPostApproval ?? false,
      postApprovalPath: row.postApprovalPath ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      workOrders: (row.workOrders ?? []).map((wo) => {
        const quotes = wo.quotes ?? [];
        const approved = quotes.find((q) => q.status === WorkOrderQuoteStatus.approved);
        const submitted = quotes.find((q) => q.status === WorkOrderQuoteStatus.submitted);
        const display = approved ?? submitted ?? quotes[0];
        const toSummary = (
          q: (typeof quotes)[number] | null | undefined,
        ): QuoteSummary | null =>
          q
            ? {
                id: q.id,
                workOrderId: q.workOrderId,
                version: q.version,
                status: q.status,
                totalGrossCents: q.totalNetCents + q.totalVatCents,
                currency: q.currency,
                invoicedAt: q.invoicedAt?.toISOString() ?? null,
                invoiceNumber: q.invoiceNumber ?? null,
                invoiceDate: q.invoiceDate?.toISOString() ?? null,
                costEntryId: q.costEntryId ?? null,
              }
            : null;
        return {
          id: wo.id,
          serviceCaseId: wo.serviceCaseId,
          vehicleId: wo.vehicleId,
          supplierId: wo.supplierId,
          supplierLegalName: wo.supplier?.legalName ?? null,
          title: wo.title,
          status: wo.status,
          plannedAt: wo.plannedAt?.toISOString() ?? null,
          completedAt: wo.completedAt?.toISOString() ?? null,
          inServiceAt: wo.inServiceAt?.toISOString() ?? null,
          outServiceAt: wo.outServiceAt?.toISOString() ?? null,
          displayNumber: wo.displayNumber ?? null,
          odometerKmIn: wo.odometerKmIn ?? null,
          odometerKmOut: wo.odometerKmOut ?? null,
          repairPathNote: wo.repairPathNote ?? null,
          serviceOrderType: wo.serviceOrderType,
          readyAt: wo.readyAt?.toISOString() ?? null,
          estimatedRepairAt: wo.estimatedRepairAt?.toISOString() ?? null,
          createdAt: wo.createdAt.toISOString(),
          latestQuote: toSummary(display),
          approvedQuote: toSummary(approved ?? null),
          pendingQuote: toSummary(submitted ?? null),
        };
      }),
      appointments: (row.appointments ?? []).map((a) => this.toAppointmentRecord(a)),
    };
  }
}
