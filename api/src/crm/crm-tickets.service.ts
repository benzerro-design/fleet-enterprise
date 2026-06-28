import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CrmTicketEventKind,
  CrmTicketLinkEntityType,
  CrmTicketPriority,
  CrmTicketRoutingLevel,
  CrmTicketStatus,
  CrmTicketType,
  Prisma,
  ReminderSourceType,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { resolveClientInTenant } from '../clients/client-resolve';
import { PrismaService } from '../prisma/prisma.service';

const MAX_PAGE_SIZE = 200;
export const FLOTAX_OPS_QUEUE = 'flotax:ops';

export type TicketRecord = {
  id: string;
  displayId: string;
  clientId: string;
  clientCode: string;
  clientLegalName: string;
  ticketType: CrmTicketType;
  subject: string;
  description: string | null;
  status: CrmTicketStatus;
  priority: CrmTicketPriority;
  routingLevel: CrmTicketRoutingLevel;
  assignedQueue: string;
  vehicleId: string | null;
  registrationNumber: string | null;
  vehicleOdometerKm: number | null;
  driverId: string | null;
  driverFullName: string | null;
  reminderActionId: string | null;
  createdByUserId: string | null;
  createdByEmail: string | null;
  ownerUserId: string | null;
  ownerEmail: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TicketEventRecord = {
  id: string;
  kind: CrmTicketEventKind;
  body: string | null;
  payload: unknown;
  actorUserId: string | null;
  actorEmail: string | null;
  createdAt: string;
};

export type TicketLinkRecord = {
  id: string;
  entityType: CrmTicketLinkEntityType;
  entityId: string;
  createdAt: string;
};

export type TicketDetailPayload = {
  ticket: TicketRecord;
  events: TicketEventRecord[];
  links: TicketLinkRecord[];
};

export type TicketStats = {
  open: number;
  inProgress: number;
  lstarQueue: number;
  resolvedLast7Days: number;
};

export type CreateTicketInput = {
  clientId: string;
  subject: string;
  description?: string | null;
  priority?: CrmTicketPriority;
  ticketType?: CrmTicketType;
  vehicleId?: string | null;
  driverId?: string | null;
  reminderActionId?: string | null;
  routingLevel?: CrmTicketRoutingLevel;
};

export type PatchTicketInput = {
  subject?: string;
  description?: string | null;
  status?: CrmTicketStatus;
  priority?: CrmTicketPriority;
  ticketType?: CrmTicketType;
  ownerUserId?: string | null;
};

export type CommentTicketInput = { body: string };

export type RouteTicketInput = {
  targetLevel: 'L_STAR' | 'L1';
  reason: string;
};

export type ReturnTicketInput = { reason: string };

export type ResolveTicketInput = {
  comment?: string | null;
  closeReminder?: boolean;
};

export type TransformTicketInput =
  | {
      entityType: 'maintenance';
      title?: string;
      notes?: string | null;
    }
  | {
      entityType: 'cost';
      category?: string;
      amountCents?: number;
      notes?: string | null;
    }
  | {
      entityType: 'trip';
      originLabel?: string | null;
      destLabel?: string | null;
      notes?: string | null;
    };

type TicketRow = Prisma.CrmTicketGetPayload<{
  include: {
    client: { select: { code: true; legalName: true } };
    vehicle: { select: { registrationNumber: true; odometerKm: true } };
    driver: { select: { fullName: true } };
    createdBy: { select: { email: true } };
    owner: { select: { email: true } };
  };
}>;

@Injectable()
export class CrmTicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  displayId(id: string): string {
    return id.slice(-6).toUpperCase();
  }

  clientQueue(clientUuid: string): string {
    return `client:${clientUuid}`;
  }

  async listPaged(
    tenantSlug: string,
    params: {
      page?: number;
      pageSize?: number;
      q?: string;
      clientId?: string;
      status?: CrmTicketStatus;
      vehicleId?: string;
      routingLevel?: CrmTicketRoutingLevel;
      ticketType?: CrmTicketType;
      inbox?: 'all' | 'lstar' | 'focus';
    },
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return { items: [], total: 0, page: params.page ?? 1, pageSize: params.pageSize ?? 50 };
    }

    const pageSize = Math.min(Math.max(1, params.pageSize ?? 50), MAX_PAGE_SIZE);
    const page = Math.max(1, params.page ?? 1);
    const skip = (page - 1) * pageSize;

    let resolvedClientUuid: string | undefined;
    if (params.clientId?.trim()) {
      resolvedClientUuid = (await resolveClientInTenant(this.prisma, tenant.id, params.clientId)).id;
    }

    const where = this.listWhere(tenant.id, { ...params, clientId: resolvedClientUuid });

    const [total, rows] = await Promise.all([
      this.prisma.crmTicket.count({ where }),
      this.prisma.crmTicket.findMany({
        where,
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        skip,
        take: pageSize,
        include: this.ticketInclude(),
      }),
    ]);

    return {
      items: rows.map((r) => this.toRecord(r)),
      total,
      page,
      pageSize,
    };
  }

  async listBoard(tenantSlug: string, params: { clientId?: string; inbox?: 'all' | 'lstar' }) {
    const tenant = await this.ensureTenant(tenantSlug);
    let resolvedClientUuid: string | undefined;
    if (params.clientId?.trim()) {
      resolvedClientUuid = (await resolveClientInTenant(this.prisma, tenant.id, params.clientId)).id;
    }

    const baseWhere = this.listWhere(tenant.id, {
      clientId: resolvedClientUuid,
      inbox: params.inbox,
    });

    const statuses: CrmTicketStatus[] = ['open', 'in_progress', 'resolved'];
    const columns = await Promise.all(
      statuses.map(async (status) => {
        const rows = await this.prisma.crmTicket.findMany({
          where: { ...baseWhere, status },
          orderBy: { updatedAt: 'desc' },
          take: 50,
          include: this.ticketInclude(),
        });
        return { status, items: rows.map((r) => this.toRecord(r)) };
      }),
    );

    const lstarRows = await this.prisma.crmTicket.findMany({
      where: {
        ...baseWhere,
        routingLevel: CrmTicketRoutingLevel.L_STAR,
        status: { in: ['open', 'in_progress'] },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: this.ticketInclude(),
    });

    return {
      columns,
      lstar: lstarRows.map((r) => this.toRecord(r)),
    };
  }

  async listFocus(
    tenantSlug: string,
    params?: { clientId?: string; page?: number; pageSize?: number },
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return { items: [], total: 0, page: params?.page ?? 1, pageSize: params?.pageSize ?? 50 };
    }

    const pageSize = Math.min(Math.max(1, params?.pageSize ?? 50), MAX_PAGE_SIZE);
    const page = Math.max(1, params?.page ?? 1);
    const skip = (page - 1) * pageSize;

    let resolvedClientUuid: string | undefined;
    if (params?.clientId?.trim()) {
      resolvedClientUuid = (await resolveClientInTenant(this.prisma, tenant.id, params.clientId)).id;
    }

    const where: Prisma.CrmTicketWhereInput = {
      AND: [
        { tenantId: tenant.id },
        { status: { in: ['open', 'in_progress'] } },
        resolvedClientUuid ? { clientId: resolvedClientUuid } : {},
        {
          OR: [
            {
              routingLevel: CrmTicketRoutingLevel.L_STAR,
              ownerUserId: null,
            },
            { priority: { in: [CrmTicketPriority.urgent, CrmTicketPriority.high] } },
          ],
        },
      ],
    };

    const [total, rows] = await Promise.all([
      this.prisma.crmTicket.count({ where }),
      this.prisma.crmTicket.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
        skip,
        take: pageSize,
        include: this.ticketInclude(),
      }),
    ]);

    return {
      items: rows.map((r) => this.toRecord(r)),
      total,
      page,
      pageSize,
    };
  }

  async getStats(tenantSlug: string, params?: { clientId?: string }): Promise<TicketStats> {
    const tenant = await this.ensureTenant(tenantSlug);
    let resolvedClientUuid: string | undefined;
    if (params?.clientId?.trim()) {
      resolvedClientUuid = (await resolveClientInTenant(this.prisma, tenant.id, params.clientId)).id;
    }

    const clientFilter = resolvedClientUuid ? { clientId: resolvedClientUuid } : {};
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [open, inProgress, lstarQueue, resolvedLast7Days] = await Promise.all([
      this.prisma.crmTicket.count({
        where: { tenantId: tenant.id, status: 'open', ...clientFilter },
      }),
      this.prisma.crmTicket.count({
        where: { tenantId: tenant.id, status: 'in_progress', ...clientFilter },
      }),
      this.prisma.crmTicket.count({
        where: {
          tenantId: tenant.id,
          routingLevel: CrmTicketRoutingLevel.L_STAR,
          status: { in: ['open', 'in_progress'] },
          ...clientFilter,
        },
      }),
      this.prisma.crmTicket.count({
        where: {
          tenantId: tenant.id,
          status: 'resolved',
          resolvedAt: { gte: weekAgo },
          ...clientFilter,
        },
      }),
    ]);

    return { open, inProgress, lstarQueue, resolvedLast7Days };
  }

  async getDetail(tenantSlug: string, id: string): Promise<TicketDetailPayload> {
    const tenant = await this.ensureTenant(tenantSlug);
    const row = await this.prisma.crmTicket.findFirst({
      where: { id, tenantId: tenant.id },
      include: this.ticketInclude(),
    });
    if (!row) throw new NotFoundException('Ticket not found');

    const [events, links] = await Promise.all([
      this.prisma.crmTicketEvent.findMany({
        where: { ticketId: id, tenantId: tenant.id },
        orderBy: { createdAt: 'asc' },
        include: { actor: { select: { email: true } } },
      }),
      this.prisma.crmTicketLink.findMany({
        where: { ticketId: id, tenantId: tenant.id },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return {
      ticket: this.toRecord(row),
      events: events.map((e) => ({
        id: e.id,
        kind: e.kind,
        body: e.body,
        payload: e.payload ?? null,
        actorUserId: e.actorUserId,
        actorEmail: e.actor?.email ?? null,
        createdAt: e.createdAt.toISOString(),
      })),
      links: links.map((l) => ({
        id: l.id,
        entityType: l.entityType,
        entityId: l.entityId,
        createdAt: l.createdAt.toISOString(),
      })),
    };
  }

  async create(tenantSlug: string, dto: CreateTicketInput, actorUserId?: string) {
    const tenant = await this.ensureTenant(tenantSlug);
    const client = await resolveClientInTenant(this.prisma, tenant.id, dto.clientId);
    const subject = dto.subject?.trim();
    if (!subject) throw new BadRequestException('subject is required');

    const vehicleId = await this.resolveOptionalVehicle(tenant.id, client.id, dto.vehicleId);
    const driverId = await this.resolveOptionalDriver(tenant.id, client.id, dto.driverId);
    const reminderActionId = await this.resolveOptionalReminder(
      tenant.id,
      vehicleId,
      dto.reminderActionId,
    );

    let ticketType = dto.ticketType ?? CrmTicketType.other;
    if (reminderActionId && !dto.ticketType) {
      const reminder = await this.prisma.reminderAction.findFirst({
        where: { id: reminderActionId, tenantId: tenant.id },
        select: { sourceType: true, title: true },
      });
      if (reminder) {
        ticketType = this.inferTicketTypeFromReminder(reminder.sourceType, reminder.title);
      }
    }

    const routingLevel = dto.routingLevel ?? CrmTicketRoutingLevel.L1;
    const assignedQueue =
      routingLevel === CrmTicketRoutingLevel.L_STAR
        ? FLOTAX_OPS_QUEUE
        : this.clientQueue(client.id);

    const row = await this.prisma.crmTicket.create({
      data: {
        tenantId: tenant.id,
        clientId: client.id,
        ticketType,
        subject,
        description: dto.description?.trim() || null,
        priority: dto.priority ?? CrmTicketPriority.normal,
        routingLevel,
        assignedQueue,
        vehicleId,
        driverId,
        reminderActionId,
        createdByUserId: actorUserId ?? null,
        ownerUserId: actorUserId ?? null,
        status: CrmTicketStatus.open,
      },
      include: this.ticketInclude(),
    });

    await this.appendEvent(tenant.id, row.id, {
      kind: CrmTicketEventKind.status,
      body: 'Tichet creat',
      actorUserId,
      payload: { status: 'open', routingLevel, assignedQueue },
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'crm_ticket.create',
      entityType: 'crm_ticket',
      entityId: row.id,
      meta: { subject, clientId: client.code },
    });

    return this.toRecord(row);
  }

  async patch(tenantSlug: string, id: string, dto: PatchTicketInput, actorUserId?: string) {
    const tenant = await this.ensureTenant(tenantSlug);
    const existing = await this.prisma.crmTicket.findFirst({
      where: { id, tenantId: tenant.id },
    });
    if (!existing) throw new NotFoundException('Ticket not found');

    const data: Prisma.CrmTicketUpdateInput = {};
    if (dto.subject !== undefined) {
      const s = dto.subject.trim();
      if (!s) throw new BadRequestException('subject cannot be empty');
      data.subject = s;
    }
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.ticketType !== undefined) data.ticketType = dto.ticketType;
    if (dto.ownerUserId !== undefined) {
      data.owner = dto.ownerUserId
        ? { connect: { id: dto.ownerUserId } }
        : { disconnect: true };
    }

    if (dto.status !== undefined && dto.status !== existing.status) {
      data.status = dto.status;
      if (dto.status === CrmTicketStatus.resolved || dto.status === CrmTicketStatus.cancelled) {
        data.resolvedAt = new Date();
      } else {
        data.resolvedAt = null;
      }
      await this.appendEvent(tenant.id, id, {
        kind: CrmTicketEventKind.status,
        body: `Status → ${dto.status}`,
        actorUserId,
        payload: { from: existing.status, to: dto.status },
      });
      await this.audit.log({
        tenantId: tenant.id,
        actorUserId,
        action: 'crm_ticket.status',
        entityType: 'crm_ticket',
        entityId: id,
        meta: { from: existing.status, to: dto.status },
      });
    }

    const row = await this.prisma.crmTicket.update({
      where: { id },
      data,
      include: this.ticketInclude(),
    });

    return this.toRecord(row);
  }

  async claim(tenantSlug: string, id: string, actorUserId?: string) {
    const tenant = await this.ensureTenant(tenantSlug);
    const ticket = await this.ensureTicket(tenant.id, id);
    if (!actorUserId) {
      throw new BadRequestException('Actor required to claim ticket');
    }

    const row = await this.prisma.crmTicket.update({
      where: { id },
      data: {
        ownerUserId: actorUserId,
        status:
          ticket.status === CrmTicketStatus.open ? CrmTicketStatus.in_progress : ticket.status,
      },
      include: this.ticketInclude(),
    });

    await this.appendEvent(tenant.id, id, {
      kind: CrmTicketEventKind.status,
      body: 'Tichet preluat',
      actorUserId,
      payload: { ownerUserId: actorUserId },
    });

    return this.toRecord(row);
  }

  async addComment(tenantSlug: string, id: string, dto: CommentTicketInput, actorUserId?: string) {
    const tenant = await this.ensureTenant(tenantSlug);
    await this.ensureTicket(tenant.id, id);
    const body = dto.body?.trim();
    if (!body) throw new BadRequestException('body is required');

    await this.appendEvent(tenant.id, id, {
      kind: CrmTicketEventKind.comment,
      body,
      actorUserId,
    });

    await this.prisma.crmTicket.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    return this.getDetail(tenantSlug, id);
  }

  async route(tenantSlug: string, id: string, dto: RouteTicketInput, actorUserId?: string) {
    const tenant = await this.ensureTenant(tenantSlug);
    const ticket = await this.ensureTicket(tenant.id, id);
    const reason = dto.reason?.trim();
    if (!reason) throw new BadRequestException('reason is required');

    let routingLevel: CrmTicketRoutingLevel;
    let assignedQueue: string;
    if (dto.targetLevel === 'L_STAR') {
      routingLevel = CrmTicketRoutingLevel.L_STAR;
      assignedQueue = FLOTAX_OPS_QUEUE;
    } else if (dto.targetLevel === 'L1') {
      routingLevel = CrmTicketRoutingLevel.L1;
      assignedQueue = this.clientQueue(ticket.clientId);
    } else {
      throw new BadRequestException('targetLevel must be L_STAR or L1');
    }

    const row = await this.prisma.crmTicket.update({
      where: { id },
      data: {
        routingLevel,
        assignedQueue,
        status:
          ticket.status === CrmTicketStatus.resolved || ticket.status === CrmTicketStatus.cancelled
            ? ticket.status
            : CrmTicketStatus.in_progress,
        ownerUserId: null,
      },
      include: this.ticketInclude(),
    });

    await this.appendEvent(tenant.id, id, {
      kind: CrmTicketEventKind.routing,
      body: reason,
      actorUserId,
      payload: {
        fromLevel: ticket.routingLevel,
        toLevel: routingLevel,
        assignedQueue,
      },
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'crm_ticket.route',
      entityType: 'crm_ticket',
      entityId: id,
      meta: { toLevel: routingLevel, reason },
    });

    return this.toRecord(row);
  }

  async returnToClient(tenantSlug: string, id: string, dto: ReturnTicketInput, actorUserId?: string) {
    const tenant = await this.ensureTenant(tenantSlug);
    const ticket = await this.ensureTicket(tenant.id, id);
    const reason = dto.reason?.trim();
    if (!reason) throw new BadRequestException('reason is required');
    if (ticket.routingLevel !== CrmTicketRoutingLevel.L_STAR) {
      throw new BadRequestException('Return is only available for L★ tickets');
    }

    const assignedQueue = this.clientQueue(ticket.clientId);
    const row = await this.prisma.crmTicket.update({
      where: { id },
      data: {
        routingLevel: CrmTicketRoutingLevel.L1,
        assignedQueue,
        ownerUserId: null,
      },
      include: this.ticketInclude(),
    });

    await this.appendEvent(tenant.id, id, {
      kind: CrmTicketEventKind.routing,
      body: reason,
      actorUserId,
      payload: { action: 'return', toLevel: 'L1', assignedQueue },
    });

    return this.toRecord(row);
  }

  async resolve(tenantSlug: string, id: string, dto: ResolveTicketInput, actorUserId?: string) {
    const tenant = await this.ensureTenant(tenantSlug);
    const ticket = await this.ensureTicket(tenant.id, id);

    const row = await this.prisma.crmTicket.update({
      where: { id },
      data: {
        status: CrmTicketStatus.resolved,
        resolvedAt: new Date(),
      },
      include: this.ticketInclude(),
    });

    const comment = dto.comment?.trim();
    if (comment) {
      await this.appendEvent(tenant.id, id, {
        kind: CrmTicketEventKind.comment,
        body: comment,
        actorUserId,
      });
    }

    await this.appendEvent(tenant.id, id, {
      kind: CrmTicketEventKind.status,
      body: 'Rezolvat',
      actorUserId,
      payload: { status: 'resolved' },
    });

    if (dto.closeReminder !== false && ticket.reminderActionId) {
      await this.prisma.reminderAction.updateMany({
        where: { id: ticket.reminderActionId, tenantId: tenant.id },
        data: { isActive: false },
      });
      await this.appendEvent(tenant.id, id, {
        kind: CrmTicketEventKind.transform,
        body: 'Reminder închis la rezolvare',
        actorUserId,
        payload: { reminderActionId: ticket.reminderActionId },
      });
    }

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'crm_ticket.resolve',
      entityType: 'crm_ticket',
      entityId: id,
      meta: {},
    });

    return this.toRecord(row);
  }

  async transform(
    tenantSlug: string,
    id: string,
    dto: TransformTicketInput,
    actorUserId?: string,
  ) {
    const tenant = await this.ensureTenant(tenantSlug);
    const ticket = await this.ensureTicket(tenant.id, id);

    if (!ticket.vehicleId) {
      throw new BadRequestException('Ticket has no vehicle — cannot transform');
    }

    let entityType: CrmTicketLinkEntityType;
    let entityId: string;
    let eventBody: string;

    if (dto.entityType === 'maintenance') {
      const title = dto.title?.trim() || ticket.subject;
      const maint = await this.prisma.maintenanceEntry.create({
        data: {
          tenantId: tenant.id,
          vehicleId: ticket.vehicleId,
          title,
          notes: dto.notes?.trim() || ticket.description,
        },
      });
      entityType = CrmTicketLinkEntityType.maintenance;
      entityId = maint.id;
      eventBody = `Creată mentenanță: ${title}`;
    } else if (dto.entityType === 'cost') {
      const cost = await this.prisma.costEntry.create({
        data: {
          tenantId: tenant.id,
          vehicleId: ticket.vehicleId,
          category: dto.category?.trim() || 'alte',
          amountCents: dto.amountCents ?? 0,
          notes: dto.notes?.trim() || ticket.description,
        },
      });
      entityType = CrmTicketLinkEntityType.cost;
      entityId = cost.id;
      eventBody = `Creat cost: ${cost.category}`;
    } else if (dto.entityType === 'trip') {
      let driverName: string | null = null;
      if (ticket.driverId) {
        const driver = await this.prisma.driver.findUnique({
          where: { id: ticket.driverId },
          select: { fullName: true },
        });
        driverName = driver?.fullName ?? null;
      }
      const trip = await this.prisma.trip.create({
        data: {
          tenantId: tenant.id,
          vehicleId: ticket.vehicleId,
          reference: `CRM-${this.displayId(ticket.id)}`,
          originLabel: dto.originLabel?.trim() || null,
          destLabel: dto.destLabel?.trim() || null,
          driverId: ticket.driverId,
          driverName,
        },
      });
      entityType = CrmTicketLinkEntityType.trip;
      entityId = trip.id;
      eventBody = `Creată cursă${dto.destLabel ? `: ${dto.destLabel}` : ''}`;
    } else {
      throw new BadRequestException('Unsupported entityType');
    }

    await this.prisma.crmTicketLink.create({
      data: {
        tenantId: tenant.id,
        ticketId: id,
        entityType,
        entityId,
      },
    });

    await this.appendEvent(tenant.id, id, {
      kind: CrmTicketEventKind.transform,
      body: eventBody,
      actorUserId,
      payload: { entityType: dto.entityType, entityId },
    });

    if (ticket.status === CrmTicketStatus.open) {
      await this.prisma.crmTicket.update({
        where: { id },
        data: { status: CrmTicketStatus.in_progress },
      });
    }

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'crm_ticket.transform',
      entityType: 'crm_ticket',
      entityId: id,
      meta: { entityType: dto.entityType, entityId },
    });

    return { ticket: await this.getDetail(tenantSlug, id), createdEntityId: entityId };
  }

  async delete(tenantSlug: string, id: string, actorUserId?: string) {
    const tenant = await this.ensureTenant(tenantSlug);
    const existing = await this.prisma.crmTicket.findFirst({
      where: { id, tenantId: tenant.id },
    });
    if (!existing) throw new NotFoundException('Ticket not found');

    await this.prisma.crmTicket.delete({ where: { id } });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'crm_ticket.delete',
      entityType: 'crm_ticket',
      entityId: id,
      meta: { subject: existing.subject },
    });
  }

  private ticketInclude() {
    return {
      client: { select: { code: true, legalName: true } },
      vehicle: { select: { registrationNumber: true, odometerKm: true } },
      driver: { select: { fullName: true } },
      createdBy: { select: { email: true } },
      owner: { select: { email: true } },
    } as const;
  }

  private listWhere(
    tenantId: string,
    params: {
      q?: string;
      clientId?: string;
      status?: CrmTicketStatus;
      vehicleId?: string;
      routingLevel?: CrmTicketRoutingLevel;
      ticketType?: CrmTicketType;
      inbox?: 'all' | 'lstar' | 'focus';
    },
  ): Prisma.CrmTicketWhereInput {
    const parts: Prisma.CrmTicketWhereInput[] = [{ tenantId }];

    if (params.clientId) parts.push({ clientId: params.clientId });
    if (params.status) parts.push({ status: params.status });
    if (params.vehicleId?.trim()) parts.push({ vehicleId: params.vehicleId.trim() });
    if (params.routingLevel) parts.push({ routingLevel: params.routingLevel });
    if (params.ticketType) parts.push({ ticketType: params.ticketType });
    if (params.inbox === 'lstar') {
      parts.push({
        routingLevel: CrmTicketRoutingLevel.L_STAR,
        status: { in: ['open', 'in_progress'] },
      });
    }
    if (params.inbox === 'focus') {
      parts.push({
        status: { in: ['open', 'in_progress'] },
        OR: [
          {
            routingLevel: CrmTicketRoutingLevel.L_STAR,
            ownerUserId: null,
          },
          { priority: { in: [CrmTicketPriority.urgent, CrmTicketPriority.high] } },
        ],
      });
    }

    const q = params.q?.trim();
    if (q) {
      parts.push({
        OR: [
          { subject: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    return { AND: parts };
  }

  private toRecord(row: TicketRow): TicketRecord {
    return {
      id: row.id,
      displayId: this.displayId(row.id),
      clientId: row.clientId,
      clientCode: row.client.code,
      clientLegalName: row.client.legalName,
      ticketType: row.ticketType,
      subject: row.subject,
      description: row.description,
      status: row.status,
      priority: row.priority,
      routingLevel: row.routingLevel,
      assignedQueue: row.assignedQueue,
      vehicleId: row.vehicleId,
      registrationNumber: row.vehicle?.registrationNumber ?? null,
      vehicleOdometerKm: row.vehicle?.odometerKm ?? null,
      driverId: row.driverId,
      driverFullName: row.driver?.fullName ?? null,
      reminderActionId: row.reminderActionId,
      createdByUserId: row.createdByUserId,
      createdByEmail: row.createdBy?.email ?? null,
      ownerUserId: row.ownerUserId,
      ownerEmail: row.owner?.email ?? null,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async appendEvent(
    tenantId: string,
    ticketId: string,
    input: {
      kind: CrmTicketEventKind;
      body?: string | null;
      actorUserId?: string;
      payload?: unknown;
    },
  ) {
    await this.prisma.crmTicketEvent.create({
      data: {
        tenantId,
        ticketId,
        kind: input.kind,
        body: input.body ?? null,
        payload:
          input.payload === undefined || input.payload === null
            ? undefined
            : (input.payload as Prisma.InputJsonValue),
        actorUserId: input.actorUserId ?? null,
      },
    });
  }

  private async ensureTenant(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  private async ensureTicket(tenantId: string, id: string) {
    const ticket = await this.prisma.crmTicket.findFirst({
      where: { id, tenantId },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  private async resolveOptionalVehicle(
    tenantId: string,
    clientId: string,
    vehicleId?: string | null,
  ): Promise<string | null> {
    const raw = vehicleId?.trim();
    if (!raw) return null;
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: raw, tenantId, clientId },
    });
    if (!vehicle) throw new BadRequestException('Vehicle not found for client');
    return vehicle.id;
  }

  private async resolveOptionalDriver(
    tenantId: string,
    clientId: string,
    driverId?: string | null,
  ): Promise<string | null> {
    const raw = driverId?.trim();
    if (!raw) return null;
    const driver = await this.prisma.driver.findFirst({
      where: { id: raw, tenantId, clientId },
    });
    if (!driver) throw new BadRequestException('Driver not found for client');
    return driver.id;
  }

  private async resolveOptionalReminder(
    tenantId: string,
    vehicleId: string | null,
    reminderActionId?: string | null,
  ): Promise<string | null> {
    const raw = reminderActionId?.trim();
    if (!raw) return null;
    const reminder = await this.prisma.reminderAction.findFirst({
      where: { id: raw, tenantId },
    });
    if (!reminder) throw new BadRequestException('Reminder not found');
    if (vehicleId && reminder.vehicleId !== vehicleId) {
      throw new BadRequestException('Reminder does not belong to ticket vehicle');
    }
    return reminder.id;
  }

  private inferTicketTypeFromReminder(
    sourceType: ReminderSourceType,
    title: string,
  ): CrmTicketType {
    const t = title.toLowerCase();
    if (sourceType === 'vehicle_itp' || t.includes('itp')) return CrmTicketType.itp;
    if (sourceType === 'document') return CrmTicketType.document;
    if (sourceType === 'maintenance' || sourceType === 'maintenance_plan') {
      return CrmTicketType.maintenance;
    }
    if (t.includes('daun')) return CrmTicketType.damage;
    if (t.includes('transport') || t.includes('curs')) return CrmTicketType.transport;
    return CrmTicketType.other;
  }
}
