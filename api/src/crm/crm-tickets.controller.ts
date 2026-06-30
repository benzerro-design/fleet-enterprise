import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  CrmTicketRoutingLevel,
  CrmTicketStatus,
  CrmTicketType,
  MembershipRole,
} from '@prisma/client';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TenantId } from '../fleet/tenant-id.decorator';
import { AccessContextService } from '../iam/access-context.service';
import { CurrentAccess } from '../iam/current-access.decorator';
import type { AccessContext } from '../iam/access-context.types';
import type {
  CommentTicketInput,
  CreateTicketInput,
  EditCommentInput,
  PatchTicketInput,
  ResolveTicketInput,
  ReturnTicketInput,
  RouteTicketInput,
  ToggleReactionInput,
  TransformTicketInput,
} from './crm-tickets.service';
import { CrmTicketsService } from './crm-tickets.service';

const CRM_READ = [
  MembershipRole.tenant_admin,
  MembershipRole.tenant_viewer,
  MembershipRole.client_user,
] as const;

const CRM_WRITE = [MembershipRole.tenant_admin, MembershipRole.client_user] as const;

@Controller('tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CrmTicketsController {
  constructor(
    private readonly tickets: CrmTicketsService,
    private readonly accessContext: AccessContextService,
  ) {}

  @Get('stats')
  @Roles(...CRM_READ)
  stats(
    @TenantId() tenantSlug: string,
    @Query('clientId') clientId: string | undefined,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.tickets.getStats(tenantSlug, { clientId: clientId?.trim() }, access);
  }

  @Get('focus')
  @Roles(...CRM_READ)
  focus(
    @TenantId() tenantSlug: string,
    @Query('clientId') clientId: string | undefined,
    @Query('page') pageStr: string | undefined,
    @Query('pageSize') pageSizeStr: string | undefined,
    @CurrentAccess() access: AccessContext,
  ) {
    const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(pageSizeStr ?? '50', 10) || 50), 200);
    return this.tickets.listFocus(
      tenantSlug,
      {
        clientId: clientId?.trim(),
        page,
        pageSize,
      },
      access,
    );
  }

  @Get('board')
  @Roles(...CRM_READ)
  board(
    @TenantId() tenantSlug: string,
    @Query('clientId') clientId: string | undefined,
    @Query('inbox') inbox: string | undefined,
    @CurrentAccess() access: AccessContext,
  ) {
    const parsed = parseInbox(inbox);
    return this.tickets.listBoard(
      tenantSlug,
      {
        clientId: clientId?.trim(),
        inbox: parsed === 'focus' ? undefined : parsed,
      },
      access,
    );
  }

  @Get()
  @Roles(...CRM_READ)
  list(
    @TenantId() tenantSlug: string,
    @Query('page') pageStr: string | undefined,
    @Query('pageSize') pageSizeStr: string | undefined,
    @Query('q') q: string | undefined,
    @Query('clientId') clientId: string | undefined,
    @Query('status') status: string | undefined,
    @Query('vehicleId') vehicleId: string | undefined,
    @Query('routingLevel') routingLevel: string | undefined,
    @Query('ticketType') ticketType: string | undefined,
    @Query('inbox') inbox: string | undefined,
    @CurrentAccess() access: AccessContext,
  ) {
    const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(pageSizeStr ?? '50', 10) || 50), 200);
    return this.tickets.listPaged(
      tenantSlug,
      {
        page,
        pageSize,
        q: q?.trim(),
        clientId: clientId?.trim(),
        status: parseStatus(status),
        vehicleId: vehicleId?.trim(),
        routingLevel: parseRoutingLevel(routingLevel),
        ticketType: parseTicketType(ticketType),
        inbox: parseInbox(inbox),
      },
      access,
    );
  }

  @Get('export')
  @Roles(...CRM_READ)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="tickets.csv"')
  async exportCsv(
    @TenantId() tenantSlug: string,
    @Query('q') q: string | undefined,
    @Query('clientId') clientId: string | undefined,
    @Query('status') status: string | undefined,
    @Query('vehicleId') vehicleId: string | undefined,
    @Query('routingLevel') routingLevel: string | undefined,
    @Query('ticketType') ticketType: string | undefined,
    @Query('inbox') inbox: string | undefined,
    @CurrentAccess() access: AccessContext,
  ) {
    const csv = await this.tickets.exportCsv(
      tenantSlug,
      {
        q: q?.trim(),
        clientId: clientId?.trim(),
        status: parseStatus(status),
        vehicleId: vehicleId?.trim(),
        routingLevel: parseRoutingLevel(routingLevel),
        ticketType: parseTicketType(ticketType),
        inbox: parseInbox(inbox),
      },
      access,
    );
    return new StreamableFile(Buffer.from(csv, 'utf8'));
  }

  @Get('notifications')
  @Roles(...CRM_READ)
  notifications(
    @TenantId() tenantSlug: string,
    @CurrentUserId() actorUserId: string | undefined,
    @Query('unread') unread?: string,
  ) {
    return this.tickets.listNotifications(tenantSlug, actorUserId, {
      unreadOnly: unread === '1' || unread === 'true',
    });
  }

  @Patch('notifications/read-all')
  @Roles(...CRM_READ)
  @HttpCode(204)
  async markAllNotificationsRead(
    @TenantId() tenantSlug: string,
    @CurrentUserId() actorUserId: string | undefined,
  ) {
    await this.tickets.markAllNotificationsRead(tenantSlug, actorUserId);
  }

  @Patch('notifications/:notificationId/read')
  @Roles(...CRM_READ)
  @HttpCode(204)
  async markNotificationRead(
    @TenantId() tenantSlug: string,
    @Param('notificationId') notificationId: string,
    @CurrentUserId() actorUserId: string | undefined,
  ) {
    await this.tickets.markNotificationRead(tenantSlug, notificationId, actorUserId);
  }

  @Get(':id')
  @Roles(...CRM_READ)
  get(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.tickets.getDetail(tenantSlug, id, access);
  }

  @Post()
  @Roles(...CRM_WRITE)
  @HttpCode(201)
  create(
    @TenantId() tenantSlug: string,
    @Body() body: CreateTicketInput,
    @CurrentUserId() actorUserId: string | undefined,
    @CurrentAccess() access: AccessContext,
  ) {
    const actor = this.accessContext.toActor(access, body.clientId);
    return this.tickets.create(tenantSlug, body, actorUserId, access, actor);
  }

  @Patch(':id')
  @Roles(...CRM_WRITE)
  patch(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: PatchTicketInput,
    @CurrentUserId() actorUserId: string | undefined,
    @CurrentAccess() access: AccessContext,
  ) {
    const actor = this.accessContext.toActor(access);
    return this.tickets.patch(tenantSlug, id, body, actorUserId, access, actor);
  }

  @Post(':id/claim')
  @Roles(...CRM_WRITE)
  @HttpCode(200)
  claim(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @CurrentUserId() actorUserId: string | undefined,
    @CurrentAccess() access: AccessContext,
  ) {
    const actor = this.accessContext.toActor(access);
    return this.tickets.claim(tenantSlug, id, actorUserId, access, actor);
  }

  @Post(':id/comments')
  @Roles(...CRM_WRITE)
  @HttpCode(200)
  comment(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: CommentTicketInput,
    @CurrentUserId() actorUserId: string | undefined,
    @CurrentAccess() access: AccessContext,
  ) {
    const actor = this.accessContext.toActor(access);
    return this.tickets.addComment(tenantSlug, id, body, actorUserId, access, actor);
  }

  @Post(':id/events/:eventId/reactions')
  @Roles(...CRM_WRITE)
  @HttpCode(200)
  toggleReaction(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Param('eventId') eventId: string,
    @Body() body: ToggleReactionInput,
    @CurrentUserId() actorUserId: string | undefined,
    @CurrentAccess() access: AccessContext,
  ) {
    const actor = this.accessContext.toActor(access);
    return this.tickets.toggleReaction(tenantSlug, id, eventId, body, actorUserId, access, actor);
  }

  @Patch(':id/events/:eventId')
  @Roles(...CRM_WRITE)
  editComment(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Param('eventId') eventId: string,
    @Body() body: EditCommentInput,
    @CurrentUserId() actorUserId: string | undefined,
    @CurrentAccess() access: AccessContext,
  ) {
    const actor = this.accessContext.toActor(access);
    return this.tickets.editComment(tenantSlug, id, eventId, body, actorUserId, access, actor);
  }

  @Post(':id/route')
  @Roles(...CRM_WRITE)
  @HttpCode(200)
  route(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: RouteTicketInput,
    @CurrentUserId() actorUserId: string | undefined,
    @CurrentAccess() access: AccessContext,
  ) {
    const actor = this.accessContext.toActor(access);
    return this.tickets.route(tenantSlug, id, body, actorUserId, access, actor);
  }

  @Post(':id/return')
  @Roles(MembershipRole.tenant_admin)
  @HttpCode(200)
  returnToClient(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: ReturnTicketInput,
    @CurrentUserId() actorUserId: string | undefined,
    @CurrentAccess() access: AccessContext,
  ) {
    const actor = this.accessContext.toActor(access);
    return this.tickets.returnToClient(tenantSlug, id, body, actorUserId, access, actor);
  }

  @Post(':id/resolve')
  @Roles(...CRM_WRITE)
  @HttpCode(200)
  resolve(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: ResolveTicketInput,
    @CurrentUserId() actorUserId: string | undefined,
    @CurrentAccess() access: AccessContext,
  ) {
    const actor = this.accessContext.toActor(access);
    return this.tickets.resolve(tenantSlug, id, body, actorUserId, access, actor);
  }

  @Post(':id/transform')
  @Roles(MembershipRole.tenant_admin)
  @HttpCode(200)
  transform(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: TransformTicketInput,
    @CurrentUserId() actorUserId: string | undefined,
    @CurrentAccess() access: AccessContext,
  ) {
    const actor = this.accessContext.toActor(access);
    return this.tickets.transform(tenantSlug, id, body, actorUserId, access, actor);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(MembershipRole.tenant_admin)
  async remove(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @CurrentUserId() actorUserId: string | undefined,
    @CurrentAccess() access: AccessContext,
  ) {
    await this.tickets.delete(tenantSlug, id, actorUserId, access);
  }
}

function parseStatus(raw: string | undefined): CrmTicketStatus | undefined {
  if (!raw?.trim()) return undefined;
  const s = raw.trim();
  if (s === 'open' || s === 'in_progress' || s === 'resolved' || s === 'cancelled') return s;
  throw new BadRequestException('Invalid status');
}

function parseRoutingLevel(raw: string | undefined): CrmTicketRoutingLevel | undefined {
  if (!raw?.trim()) return undefined;
  const s = raw.trim();
  if (s === 'L0' || s === 'L1' || s === 'L1N' || s === 'L_STAR') return s;
  throw new BadRequestException('Invalid routingLevel');
}

function parseInbox(raw: string | undefined): 'all' | 'lstar' | 'focus' | undefined {
  if (!raw?.trim()) return undefined;
  const s = raw.trim();
  if (s === 'all') return 'all';
  if (s === 'lstar') return 'lstar';
  if (s === 'focus') return 'focus';
  throw new BadRequestException('inbox must be all, lstar, or focus');
}

function parseTicketType(raw: string | undefined): CrmTicketType | undefined {
  if (!raw?.trim()) return undefined;
  const s = raw.trim();
  const allowed: CrmTicketType[] = [
    'itp',
    'damage',
    'maintenance',
    'document',
    'transport',
    'technical',
    'other',
  ];
  if (allowed.includes(s as CrmTicketType)) return s as CrmTicketType;
  throw new BadRequestException('Invalid ticketType');
}
