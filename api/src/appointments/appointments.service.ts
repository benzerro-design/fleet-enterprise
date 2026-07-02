import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CrmTicketEventKind,
  Prisma,
  ServiceAppointmentStatus,
  ServiceCaseSourceType,
  ServiceCaseStage,
  ServiceCaseStatus,
  ServiceCaseWorkflowType,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { SERVICE_CASE_STAGE_ORDER } from '../service-cases/service-cases.service';
import { resolveSupplierInTenant } from '../suppliers/supplier-resolve';
import {
  type AppointmentStats,
  type CalendarAppointmentRecord,
  type CalendarListParams,
  type CreateCalendarAppointmentInput,
  endAtIso,
  ticketDisplayId,
  type UpdateCalendarAppointmentInput,
} from './appointments.types';

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function startOfWeekMonday(d: Date): Date {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private calendarInclude() {
    return {
      vehicle: {
        select: {
          registrationNumber: true,
          clientId: true,
          client: { select: { code: true, legalName: true } },
        },
      },
      supplier: { select: { id: true, code: true, legalName: true, category: true } },
      serviceCase: { select: { id: true, title: true, workflowType: true, sourceTicketId: true } },
    } as const;
  }

  private toCalendarRecord(row: {
    id: string;
    title: string | null;
    scheduledAt: Date;
    durationMin: number;
    status: ServiceAppointmentStatus;
    location: string | null;
    notes: string | null;
    vehicleId: string;
    supplierId: string | null;
    serviceCaseId: string;
    createdAt: Date;
    updatedAt: Date;
    vehicle: {
      registrationNumber: string;
      clientId: string;
      client: { code: string; legalName: string };
    };
    supplier: { id: string; code: string; legalName: string; category: string } | null;
    serviceCase: {
      id: string;
      title: string;
      workflowType: string;
      sourceTicketId: string | null;
    };
  }): CalendarAppointmentRecord {
    const title = row.title?.trim() || row.serviceCase.title;
    return {
      id: row.id,
      title,
      scheduledAt: row.scheduledAt.toISOString(),
      endAt: endAtIso(row.scheduledAt, row.durationMin),
      durationMin: row.durationMin,
      status: row.status,
      location: row.location,
      notes: row.notes,
      vehicleId: row.vehicleId,
      registrationNumber: row.vehicle.registrationNumber,
      clientId: row.vehicle.clientId,
      clientCode: row.vehicle.client.code,
      clientLegalName: row.vehicle.client.legalName,
      supplierId: row.supplierId,
      supplierCode: row.supplier?.code ?? null,
      supplierLegalName: row.supplier?.legalName ?? null,
      supplierCategory: (row.supplier?.category as CalendarAppointmentRecord['supplierCategory']) ?? null,
      serviceCaseId: row.serviceCaseId,
      workflowType: row.serviceCase.workflowType,
      sourceTicketId: row.serviceCase.sourceTicketId,
      ticketDisplayId: ticketDisplayId(row.serviceCase.sourceTicketId),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private calendarWhere(
    tenantId: string,
    params: CalendarListParams,
  ): Prisma.ServiceAppointmentWhereInput {
    const from = new Date(params.from);
    const to = new Date(params.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Invalid from/to range');
    }

    const parts: Prisma.ServiceAppointmentWhereInput[] = [
      { tenantId },
      { scheduledAt: { gte: from, lt: to } },
    ];

    if (params.supplierIds?.length) {
      parts.push({ supplierId: { in: params.supplierIds } });
    }
    if (params.vehicleId?.trim()) {
      parts.push({ vehicleId: params.vehicleId.trim() });
    }
    if (params.clientId?.trim()) {
      parts.push({ vehicle: { clientId: params.clientId.trim() } });
    }
    if (params.status) {
      parts.push({ status: params.status });
    }

    return { AND: parts };
  }

  async listCalendar(tenantSlug: string, params: CalendarListParams): Promise<CalendarAppointmentRecord[]> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) return [];

    const rows = await this.prisma.serviceAppointment.findMany({
      where: this.calendarWhere(tenant.id, params),
      orderBy: { scheduledAt: 'asc' },
      include: this.calendarInclude(),
    });

    return rows.map((r) => this.toCalendarRecord(r));
  }

  async getStats(tenantSlug: string, clientId?: string): Promise<AppointmentStats> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) return { today: 0, thisWeek: 0, confirmed: 0, scheduled: 0 };

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const weekStart = startOfWeekMonday(now);
    const weekEnd = addDays(weekStart, 7);

    const clientFilter: Prisma.ServiceAppointmentWhereInput | undefined = clientId?.trim()
      ? { vehicle: { clientId: clientId.trim() } }
      : undefined;

    const base: Prisma.ServiceAppointmentWhereInput = {
      tenantId: tenant.id,
      ...(clientFilter ? { AND: [clientFilter] } : {}),
    };

    const [today, thisWeek, confirmed, scheduled] = await Promise.all([
      this.prisma.serviceAppointment.count({
        where: {
          ...base,
          scheduledAt: { gte: todayStart, lte: todayEnd },
          status: { not: ServiceAppointmentStatus.cancelled },
        },
      }),
      this.prisma.serviceAppointment.count({
        where: {
          ...base,
          scheduledAt: { gte: weekStart, lt: weekEnd },
          status: { not: ServiceAppointmentStatus.cancelled },
        },
      }),
      this.prisma.serviceAppointment.count({
        where: { ...base, status: ServiceAppointmentStatus.confirmed },
      }),
      this.prisma.serviceAppointment.count({
        where: { ...base, status: ServiceAppointmentStatus.scheduled },
      }),
    ]);

    return { today, thisWeek, confirmed, scheduled };
  }

  async getById(tenantSlug: string, id: string): Promise<CalendarAppointmentRecord> {
    const row = await this.prisma.serviceAppointment.findFirst({
      where: { id, tenant: { slug: tenantSlug } },
      include: this.calendarInclude(),
    });
    if (!row) throw new NotFoundException('Appointment not found');
    return this.toCalendarRecord(row);
  }

  async create(
    tenantSlug: string,
    dto: CreateCalendarAppointmentInput,
    actorUserId?: string,
  ): Promise<CalendarAppointmentRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: dto.vehicleId, tenantId: tenant.id },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('Invalid scheduledAt');
    }

    const durationMin = dto.durationMin ?? 60;
    if (!Number.isInteger(durationMin) || durationMin < 15 || durationMin > 24 * 60) {
      throw new BadRequestException('durationMin must be between 15 and 1440');
    }

    let supplierId: string | null = null;
    if (dto.supplierId) {
      await resolveSupplierInTenant(this.prisma, tenant.id, dto.supplierId);
      supplierId = dto.supplierId;
    }

    const row = await this.prisma.$transaction(async (tx) => {
      let serviceCase = dto.serviceCaseId
        ? await tx.serviceCase.findFirst({
            where: { id: dto.serviceCaseId, tenantId: tenant.id },
          })
        : dto.sourceTicketId
          ? await tx.serviceCase.findFirst({
              where: { sourceTicketId: dto.sourceTicketId, tenantId: tenant.id },
            })
          : null;

      if (!serviceCase) {
        serviceCase = await tx.serviceCase.create({
          data: {
            tenantId: tenant.id,
            clientId: vehicle.clientId,
            vehicleId: vehicle.id,
            workflowType: ServiceCaseWorkflowType.repair,
            sourceType: dto.sourceTicketId ? ServiceCaseSourceType.ticket : ServiceCaseSourceType.direct,
            sourceTicketId: dto.sourceTicketId ?? null,
            currentStage: ServiceCaseStage.intake,
            status: ServiceCaseStatus.active,
            supplierId,
            title: dto.title?.trim() || `Programare ${vehicle.registrationNumber}`,
          },
        });
      }

      const title = dto.title?.trim() || serviceCase.title;

      const created = await tx.serviceAppointment.create({
        data: {
          tenantId: tenant.id,
          serviceCaseId: serviceCase.id,
          vehicleId: vehicle.id,
          supplierId: supplierId ?? serviceCase.supplierId,
          title,
          scheduledAt,
          durationMin,
          location: dto.location?.trim() || null,
          notes: dto.notes?.trim() || null,
          status: ServiceAppointmentStatus.scheduled,
        },
        include: this.calendarInclude(),
      });

      const currentIdx = SERVICE_CASE_STAGE_ORDER.indexOf(serviceCase.currentStage);
      const scheduledIdx = SERVICE_CASE_STAGE_ORDER.indexOf(ServiceCaseStage.scheduled);
      if (currentIdx < scheduledIdx) {
        await tx.serviceCase.update({
          where: { id: serviceCase.id },
          data: {
            currentStage: ServiceCaseStage.scheduled,
            supplierId: supplierId ?? serviceCase.supplierId,
          },
        });
      }

      await tx.maintenanceWorkOrder.updateMany({
        where: { serviceCaseId: serviceCase.id },
        data: { plannedAt: scheduledAt, supplierId: supplierId ?? undefined },
      });

      if (serviceCase.sourceTicketId) {
        await tx.crmTicketEvent.create({
          data: {
            tenantId: tenant.id,
            ticketId: serviceCase.sourceTicketId,
            kind: CrmTicketEventKind.workflow_advance,
            body: `Programare în programator: ${scheduledAt.toLocaleString('ro-RO')}.`,
            payload: { serviceCaseId: serviceCase.id, appointmentId: created.id },
            actorUserId: actorUserId ?? null,
          },
        });
      }

      return created;
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'appointment.create',
      entityType: 'service_appointment',
      entityId: row.id,
      meta: { vehicleId: dto.vehicleId },
    });

    return this.toCalendarRecord(row);
  }

  async update(
    tenantSlug: string,
    id: string,
    dto: UpdateCalendarAppointmentInput,
    actorUserId?: string,
  ): Promise<CalendarAppointmentRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const existing = await this.prisma.serviceAppointment.findFirst({
      where: { id, tenantId: tenant.id },
      include: { serviceCase: true },
    });
    if (!existing) throw new NotFoundException('Appointment not found');

    const data: Prisma.ServiceAppointmentUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title?.trim() || null;
    if (dto.location !== undefined) data.location = dto.location?.trim() || null;
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.durationMin !== undefined) {
      if (!Number.isInteger(dto.durationMin) || dto.durationMin < 15 || dto.durationMin > 24 * 60) {
        throw new BadRequestException('durationMin must be between 15 and 1440');
      }
      data.durationMin = dto.durationMin;
    }
    if (dto.scheduledAt !== undefined) {
      const scheduledAt = new Date(dto.scheduledAt);
      if (Number.isNaN(scheduledAt.getTime())) throw new BadRequestException('Invalid scheduledAt');
      data.scheduledAt = scheduledAt;
    }
    if (dto.supplierId !== undefined) {
      if (dto.supplierId) {
        await resolveSupplierInTenant(this.prisma, tenant.id, dto.supplierId);
        data.supplier = { connect: { id: dto.supplierId } };
      } else {
        data.supplier = { disconnect: true };
      }
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.serviceAppointment.update({
        where: { id },
        data,
        include: this.calendarInclude(),
      });

      if (dto.scheduledAt !== undefined || dto.supplierId !== undefined) {
        await tx.maintenanceWorkOrder.updateMany({
          where: { serviceCaseId: existing.serviceCaseId },
          data: {
            ...(dto.scheduledAt !== undefined ? { plannedAt: updated.scheduledAt } : {}),
            ...(dto.supplierId !== undefined
              ? { supplierId: dto.supplierId || null }
              : {}),
          },
        });
        if (dto.supplierId !== undefined) {
          await tx.serviceCase.update({
            where: { id: existing.serviceCaseId },
            data: { supplierId: dto.supplierId || null },
          });
        }
      }

      return updated;
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'appointment.update',
      entityType: 'service_appointment',
      entityId: id,
      meta: {},
    });

    return this.toCalendarRecord(row);
  }
}
