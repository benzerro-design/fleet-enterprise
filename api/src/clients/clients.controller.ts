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
import { ClientStatus, MembershipRole } from '@prisma/client';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TenantId } from '../fleet/tenant-id.decorator';
import type { CreateClientInput, PatchClientInput } from './clients.service';
import { ClientsService } from './clients.service';

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  list(
    @TenantId() tenantSlug: string,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
    @Query('q') q?: string,
    @Query('status') status?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(pageSizeStr ?? '50', 10) || 50), 200);
    return this.clients.listPaged(tenantSlug, {
      page,
      pageSize,
      q: q?.trim(),
      status: parseClientStatus(status),
    });
  }

  @Get(':id')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  get(@TenantId() tenantSlug: string, @Param('id') id: string) {
    return this.clients.getById(tenantSlug, id);
  }

  @Post()
  @Roles(MembershipRole.tenant_admin)
  create(
    @TenantId() tenantSlug: string,
    @Body() body: CreateClientInput,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.clients.create(tenantSlug, body, actorUserId);
  }

  @Patch(':id')
  @Roles(MembershipRole.tenant_admin)
  patch(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: PatchClientInput,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.clients.patch(tenantSlug, id, body, actorUserId);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(MembershipRole.tenant_admin)
  async remove(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @CurrentUserId() actorUserId?: string,
  ) {
    await this.clients.delete(tenantSlug, id, actorUserId);
  }
}

function parseClientStatus(raw: string | undefined): ClientStatus | undefined {
  if (!raw?.trim()) return undefined;
  const s = raw.trim();
  if (s === 'active' || s === 'inactive') return s;
  throw new BadRequestException('status must be active or inactive');
}
