import {
  BadRequestException,
  ForbiddenException,
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
import type { AccessContext, ActorContext } from '../iam/access-context.types';
import {
  canPerformTicketAction,
  canReadTicket,
  routingLevelLabel,
  ticketListScope,
} from '../iam/client-access';
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
  eventOdometerKm: number | null;
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
  actorRoutingLevel: CrmTicketRoutingLevel | null;
  actorDisplayName: string | null;
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
  eventOdometerKm?: number | null;
  updateVehicleOdometer?: boolean;
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
  comment: string;
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
    access?: AccessContext,
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

    const where = this.listWhere(tenant.id, { ...params, clientId: resolvedClientUuid }, access);

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

  async listBoard(
    tenantSlug: string,
    params: { clientId?: string; inbox?: 'all' | 'lstar' },
    access?: AccessContext,
  ) {
    const tenant = await this.ensureTenant(tenantSlug);
    let resolvedClientUuid: string | undefined;
    if (params.clientId?.trim()) {
      resolvedClientUuid = (await resolveClientInTenant(this.prisma, tenant.id, params.clientId)).id;
    }

    const baseWhere = this.listWhere(
      tenant.id,
      {
        clientId: resolvedClientUuid,
        inbox: params.inbox,
      },
      access,
    );

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
    access?: AccessContext,
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

    const scope = access ? ticketListScope(access) : {};
    const where: Prisma.CrmTicketWhereInput = {
      AND: [
        { tenantId: tenant.id },
        { status: { in: ['open', 'in_progress'] } },
        resolvedClientUuid ? { clientId: resolvedClientUuid } : {},
        scope,
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

  async getStats(
    tenantSlug: string,
    params?: { clientId?: string },
    access?: AccessContext,
  ): Promise<TicketStats> {
    const tenant = await this.ensureTenant(tenantSlug);
    let resolvedClientUuid: string | undefined;
    if (params?.clientId?.trim()) {
      resolvedClientUuid = (await resolveClientInTenant(this.prisma, tenant.id, params.clientId)).id;
    }

    const clientFilter = resolvedClientUuid ? { clientId: resolvedClientUuid } : {};
    const scope = access ? ticketListScope(access) : {};
    const baseFilter = { ...clientFilter, ...scope };
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [open, inProgress, lstarQueue, resolvedLast7Days] = await Promise.all([
      this.prisma.crmTicket.count({
        where: { tenantId: tenant.id, status: 'open', ...baseFilter },
      }),
      this.prisma.crmTicket.count({
        where: { tenantId: tenant.id, status: 'in_progress', ...baseFilter },
      }),
      this.prisma.crmTicket.count({
        where: {
          tenantId: tenant.id,
          routingLevel: CrmTicketRoutingLevel.L_STAR,
          status: { in: ['open', 'in_progress'] },
          ...baseFilter,
        },
      }),
      this.prisma.crmTicket.count({
        where: {
          tenantId: tenant.id,
          status: 'resolved',
          resolvedAt: { gte: weekAgo },
          ...baseFilter,
        },
      }),
    ]);

    return { open, inProgress, lstarQueue, resolvedLast7Days };
  }

  async getDetail(
    tenantSlug: string,
    id: string,
    access?: AccessContext,
  ): Promise<TicketDetailPayload> {
    const tenant = await this.ensureTenant(tenantSlug);
    const row = await this.prisma.crmTicket.findFirst({
      where: { id, tenantId: tenant.id },
      include: this.ticketInclude(),
    });
    if (!row) throw new NotFoundException('Ticket not found');
    if (access && !canReadTicket(access, row)) {
      throw new ForbiddenException('Ticket not accessible');
    }

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
        actorRoutingLevel: e.actorRoutingLevel,
        actorDisplayName: e.actorDisplayName,
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

  async create(
    tenantSlug: string,
    dto: CreateTicketInput,
    actorUserId?: string,
    access?: AccessContext,
    actor?: ActorContext,
  ) {
    const tenant = await this.ensureTenant(tenantSlug);
    const client = await resolveClientInTenant(this.prisma, tenant.id, dto.clientId);
    if (access && !canPerformTicketAction(access, 'create')) {
      throw new ForbiddenException('Cannot create ticket');
    }
    if (access && !access.isTenantWide && !access.allowedClientIds.includes(client.id)) {
      throw new ForbiddenException('Client not accessible');
    }
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

    const routingLevel =
      dto.routingLevel ??
      (actor?.routingLevel === CrmTicketRoutingLevel.L0
        ? CrmTicketRoutingLevel.L0
        : actor?.routingLevel === CrmTicketRoutingLevel.L_STAR
          ? CrmTicketRoutingLevel.L_STAR
          : CrmTicketRoutingLevel.L1);
    const assignedQueue =
      routingLevel === CrmTicketRoutingLevel.L_STAR
        ? FLOTAX_OPS_QUEUE
        : this.clientQueue(client.id);

    let eventOdometerKm: number | null = null;
    if (dto.eventOdometerKm != null) {
      if (!Number.isFinite(dto.eventOdometerKm) || dto.eventOdometerKm < 0) {
        throw new BadRequestException('eventOdometerKm must be a non-negative integer');
      }
      if (!vehicleId) {
        throw new BadRequestException('eventOdometerKm requires a vehicle');
      }
      eventOdometerKm = Math.round(dto.eventOdometerKm);
    }

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
        eventOdometerKm,
        createdByUserId: actorUserId ?? null,
        ownerUserId: actorUserId ?? null,
        status: CrmTicketStatus.open,
      },
      include: this.ticketInclude(),
    });

    await this.appendEvent(tenant.id, row.id, {
      kind: CrmTicketEventKind.status,
      body: actor
        ? `Tichet creat de ${actor.displayName} (${routingLevelLabel(actor.routingLevel)})`
        : 'Tichet creat',
      actor,
      payload: { status: 'open', routingLevel, assignedQueue },
    });

    if (eventOdometerKm != null && vehicleId) {
      await this.syncTicketOdometer(
        tenant.id,
        row.id,
        vehicleId,
        eventOdometerKm,
        dto.updateVehicleOdometer !== false,
        actorUserId,
        actor,
      );
    }

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'crm_ticket.create',
      entityType: 'crm_ticket',
      entityId: row.id,
      meta: { subject, clientId: client.code },
    });

    const fresh = await this.prisma.crmTicket.findFirstOrThrow({
      where: { id: row.id },
      include: this.ticketInclude(),
    });
    return this.toRecord(fresh);
  }

  async patch(
    tenantSlug: string,
    id: string,
    dto: PatchTicketInput,
    actorUserId?: string,
    access?: AccessContext,
    actor?: ActorContext,
  ) {
    const tenant = await this.ensureTenant(tenantSlug);
    const existing = await this.prisma.crmTicket.findFirst({
      where: { id, tenantId: tenant.id },
    });
    if (!existing) throw new NotFoundException('Ticket not found');
    if (access && !canPerformTicketAction(access, 'patch', existing)) {
      throw new ForbiddenException('Cannot update ticket');
    }

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
        body: actor
          ? `Status → ${dto.status} (${actor.displayName}, ${routingLevelLabel(actor.routingLevel)})`
          : `Status → ${dto.status}`,
        actor,
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

  async claim(
    tenantSlug: string,
    id: string,
    actorUserId?: string,
    access?: AccessContext,
    actor?: ActorContext,
  ) {
    const tenant = await this.ensureTenant(tenantSlug);
    const ticket = await this.ensureTicket(tenant.id, id);
    if (!actorUserId) {
      throw new BadRequestException('Actor required to claim ticket');
    }
    if (access && !canPerformTicketAction(access, 'claim', ticket)) {
      throw new ForbiddenException('Cannot claim ticket');
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
      body: actor
        ? `Tichet preluat de ${actor.displayName} (${routingLevelLabel(actor.routingLevel)})`
        : 'Tichet preluat',
      actor,
      payload: { ownerUserId: actorUserId },
    });

    return this.toRecord(row);
  }

  async addComment(
    tenantSlug: string,
    id: string,
    dto: CommentTicketInput,
    actorUserId?: string,
    access?: AccessContext,
    actor?: ActorContext,
  ) {
    const tenant = await this.ensureTenant(tenantSlug);
    const ticket = await this.ensureTicket(tenant.id, id);
    if (access && !canPerformTicketAction(access, 'comment', ticket)) {
      throw new ForbiddenException('Cannot comment on ticket');
    }
    const body = dto.body?.trim();
    if (!body) throw new BadRequestException('body is required');

    await this.appendEvent(tenant.id, id, {
      kind: CrmTicketEventKind.comment,
      body: actor
        ? `${actor.displayName} (${routingLevelLabel(actor.routingLevel)}): ${body}`
        : body,
      actor,
    });

    await this.prisma.crmTicket.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    return this.getDetail(tenantSlug, id, access);
  }

  async route(
    tenantSlug: string,
    id: string,
    dto: RouteTicketInput,
    actorUserId?: string,
    access?: AccessContext,
    actor?: ActorContext,
  ) {
    const tenant = await this.ensureTenant(tenantSlug);
    const ticket = await this.ensureTicket(tenant.id, id);
    if (access && !canPerformTicketAction(access, 'route', ticket)) {
      throw new ForbiddenException('Cannot route ticket');
    }
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
      body: actor
        ? `${actor.displayName} (${routingLevelLabel(actor.routingLevel)}): ${reason}`
        : reason,
      actor,
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

  async returnToClient(
    tenantSlug: string,
    id: string,
    dto: ReturnTicketInput,
    actorUserId?: string,
    access?: AccessContext,
    actor?: ActorContext,
  ) {
    const tenant = await this.ensureTenant(tenantSlug);
    const ticket = await this.ensureTicket(tenant.id, id);
    if (access && !canPerformTicketAction(access, 'return', ticket)) {
      throw new ForbiddenException('Cannot return ticket');
    }
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
      body: actor
        ? `${actor.displayName} (${routingLevelLabel(actor.routingLevel)}): ${reason}`
        : reason,
      actor,
      payload: { action: 'return', toLevel: 'L1', assignedQueue },
    });

    return this.toRecord(row);
  }

  async resolve(
    tenantSlug: string,
    id: string,
    dto: ResolveTicketInput,
    actorUserId?: string,
    access?: AccessContext,
    actor?: ActorContext,
  ) {
    const tenant = await this.ensureTenant(tenantSlug);
    const ticket = await this.ensureTicket(tenant.id, id);
    if (access && !canPerformTicketAction(access, 'resolve', ticket)) {
      throw new ForbiddenException('Cannot resolve ticket');
    }

    const comment = dto.comment?.trim();
    if (!comment) {
      throw new BadRequestException('comment is required — descrie exact cum s-a rezolvat');
    }

    const row = await this.prisma.crmTicket.update({
      where: { id },
      data: {
        status: CrmTicketStatus.resolved,
        resolvedAt: new Date(),
      },
      include: this.ticketInclude(),
    });

    const resolveBody = actor
      ? `Rezolvat de ${actor.displayName} (${routingLevelLabel(actor.routingLevel)}) — ${comment}`
      : `Rezolvat — ${comment}`;

    await this.appendEvent(tenant.id, id, {
      kind: CrmTicketEventKind.comment,
      body: resolveBody,
      actor,
      payload: { resolution: true },
    });

    await this.appendEvent(tenant.id, id, {
      kind: CrmTicketEventKind.status,
      body: resolveBody,
      actor,
      payload: { status: 'resolved' },
    });

    if (dto.closeReminder !== false && ticket.reminderActionId) {
      await this.prisma.reminderAction.updateMany({
        where: { id: ticket.reminderActionId, tenantId: tenant.id },
        data: { isActive: false },
      });
      await this.appendEvent(tenant.id, id, {
        kind: CrmTicketEventKind.transform,
        body: actor
          ? `Reminder închis la rezolvare (${actor.displayName}, ${routingLevelLabel(actor.routingLevel)})`
          : 'Reminder închis la rezolvare',
        actor,
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
    access?: AccessContext,
    actor?: ActorContext,
  ) {
    const tenant = await this.ensureTenant(tenantSlug);
    const ticket = await this.ensureTicket(tenant.id, id);
    if (access && !canPerformTicketAction(access, 'transform', ticket)) {
      throw new ForbiddenException('Cannot transform ticket');
    }

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
      body: actor
        ? `${eventBody} (${actor.displayName}, ${routingLevelLabel(actor.routingLevel)})`
        : eventBody,
      actor,
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

    return { ticket: await this.getDetail(tenantSlug, id, access), createdEntityId: entityId };
  }

  async delete(
    tenantSlug: string,
    id: string,
    actorUserId?: string,
    access?: AccessContext,
  ) {
    const tenant = await this.ensureTenant(tenantSlug);
    const existing = await this.prisma.crmTicket.findFirst({
      where: { id, tenantId: tenant.id },
    });
    if (!existing) throw new NotFoundException('Ticket not found');
    if (access && !canPerformTicketAction(access, 'delete', existing)) {
      throw new ForbiddenException('Cannot delete ticket');
    }

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
    access?: AccessContext,
  ): Prisma.CrmTicketWhereInput {
    const parts: Prisma.CrmTicketWhereInput[] = [{ tenantId }];

    const scope = access ? ticketListScope(access) : {};
    if (Object.keys(scope).length > 0) {
      parts.push(scope);
    }

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
      eventOdometerKm: row.eventOdometerKm,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async syncTicketOdometer(
    tenantId: string,
    ticketId: string,
    vehicleId: string,
    odometerKm: number,
    updateVehicle: boolean,
    actorUserId?: string,
    actor?: ActorContext,
  ) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenantId },
      select: { odometerKm: true, registrationNumber: true },
    });
    if (!vehicle) return;

    const willUpdateVehicle = updateVehicle && odometerKm >= vehicle.odometerKm;
    if (willUpdateVehicle) {
      await this.prisma.odometerReading.create({
        data: {
          vehicleId,
          odometerKm,
          source: 'ops',
          sourceRef: `crm_ticket:${ticketId}`,
          notes: 'Km eveniment la creare tichet CRM',
          recordedByUserId: actorUserId ?? null,
        },
      });
      await this.prisma.vehicle.update({
        where: { id: vehicleId },
        data: {
          odometerKm,
          updatedByUserId: actorUserId ?? undefined,
        },
      });
    }

    const body = actor
      ? `Km eveniment: ${odometerKm.toLocaleString('ro-RO')}${willUpdateVehicle ? ' — vehicul actualizat' : ''} (${actor.displayName}, ${routingLevelLabel(actor.routingLevel)})`
      : `Km eveniment: ${odometerKm.toLocaleString('ro-RO')}${willUpdateVehicle ? ' — vehicul actualizat' : ''}`;

    await this.appendEvent(tenantId, ticketId, {
      kind: CrmTicketEventKind.odometer,
      body,
      actor,
      payload: {
        odometerKm,
        vehicleUpdated: willUpdateVehicle,
        previousVehicleKm: vehicle.odometerKm,
      },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'crm_ticket.odometer',
      entityType: 'crm_ticket',
      entityId: ticketId,
      meta: { odometerKm, vehicleUpdated: willUpdateVehicle },
    });
  }

  private async appendEvent(
    tenantId: string,
    ticketId: string,
    input: {
      kind: CrmTicketEventKind;
      body?: string | null;
      actor?: ActorContext;
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
        actorUserId: input.actor?.userId ?? null,
        actorRoutingLevel: input.actor?.routingLevel ?? null,
        actorDisplayName: input.actor?.displayName ?? null,
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
