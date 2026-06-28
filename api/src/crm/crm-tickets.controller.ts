import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CrmTicketRoutingLevel,
  CrmTicketStatus,
  MembershipRole,
} from '@prisma/client';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TenantId } from '../fleet/tenant-id.decorator';
import type {
  CommentTicketInput,
  CreateTicketInput,
  PatchTicketInput,
  ResolveTicketInput,
  ReturnTicketInput,
  RouteTicketInput,
  TransformTicketInput,
} from './crm-tickets.service';
import { CrmTicketsService } from './crm-tickets.service';

@Controller('tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CrmTicketsController {
  constructor(private readonly tickets: CrmTicketsService) {}

  @Get('stats')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  stats(@TenantId() tenantSlug: string, @Query('clientId') clientId?: string) {
    return this.tickets.getStats(tenantSlug, { clientId: clientId?.trim() });
  }

  @Get('board')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  board(
    @TenantId() tenantSlug: string,
    @Query('clientId') clientId?: string,
    @Query('inbox') inbox?: string,
  ) {
    return this.tickets.listBoard(tenantSlug, {
      clientId: clientId?.trim(),
      inbox: parseInbox(inbox),
    });
  }

  @Get()
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  list(
    @TenantId() tenantSlug: string,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
    @Query('q') q?: string,
    @Query('clientId') clientId?: string,
    @Query('status') status?: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('routingLevel') routingLevel?: string,
    @Query('inbox') inbox?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(pageSizeStr ?? '50', 10) || 50), 200);
    return this.tickets.listPaged(tenantSlug, {
      page,
      pageSize,
      q: q?.trim(),
      clientId: clientId?.trim(),
      status: parseStatus(status),
      vehicleId: vehicleId?.trim(),
      routingLevel: parseRoutingLevel(routingLevel),
      inbox: parseInbox(inbox),
    });
  }

  @Get(':id')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  get(@TenantId() tenantSlug: string, @Param('id') id: string) {
    return this.tickets.getDetail(tenantSlug, id);
  }

  @Post()
  @Roles(MembershipRole.tenant_admin)
  @HttpCode(201)
  create(
    @TenantId() tenantSlug: string,
    @Body() body: CreateTicketInput,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.tickets.create(tenantSlug, body, actorUserId);
  }

  @Patch(':id')
  @Roles(MembershipRole.tenant_admin)
  patch(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: PatchTicketInput,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.tickets.patch(tenantSlug, id, body, actorUserId);
  }

  @Post(':id/comments')
  @Roles(MembershipRole.tenant_admin)
  @HttpCode(200)
  comment(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: CommentTicketInput,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.tickets.addComment(tenantSlug, id, body, actorUserId);
  }

  @Post(':id/route')
  @Roles(MembershipRole.tenant_admin)
  @HttpCode(200)
  route(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: RouteTicketInput,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.tickets.route(tenantSlug, id, body, actorUserId);
  }

  @Post(':id/return')
  @Roles(MembershipRole.tenant_admin)
  @HttpCode(200)
  returnToClient(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: ReturnTicketInput,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.tickets.returnToClient(tenantSlug, id, body, actorUserId);
  }

  @Post(':id/resolve')
  @Roles(MembershipRole.tenant_admin)
  @HttpCode(200)
  resolve(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: ResolveTicketInput,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.tickets.resolve(tenantSlug, id, body, actorUserId);
  }

  @Post(':id/transform')
  @Roles(MembershipRole.tenant_admin)
  @HttpCode(200)
  transform(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: TransformTicketInput,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.tickets.transform(tenantSlug, id, body, actorUserId);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(MembershipRole.tenant_admin)
  async remove(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @CurrentUserId() actorUserId?: string,
  ) {
    await this.tickets.delete(tenantSlug, id, actorUserId);
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

function parseInbox(raw: string | undefined): 'all' | 'lstar' | undefined {
  if (!raw?.trim()) return undefined;
  const s = raw.trim();
  if (s === 'all') return 'all';
  if (s === 'lstar') return 'lstar';
  throw new BadRequestException('inbox must be all or lstar');
}
