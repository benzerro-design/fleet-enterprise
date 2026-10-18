import { BadRequestException, Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { MembershipRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { TenantId } from '../fleet/tenant-id.decorator';
import { CurrentAccess } from '../iam/current-access.decorator';
import type { AccessContext } from '../iam/access-context.types';
import { ProceduresService } from './procedures.service';
import { QuoteApprovalSettingsService } from './quote-approval-settings.service';

@Controller('tenant/procedures')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProceduresController {
  constructor(private readonly procedures: ProceduresService) {}

  @Get()
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  list(@TenantId() tenantSlug: string, @CurrentAccess() access: AccessContext) {
    return this.procedures.list(tenantSlug, access);
  }

  @Post()
  @Roles(MembershipRole.tenant_admin)
  create(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Body() body: { title?: string; steps?: unknown; screenPath?: string | null; status?: string },
    @CurrentUserId() actorUserId?: string,
  ) {
    if (!actorUserId) throw new BadRequestException('Missing actor');
    return this.procedures.create(tenantSlug, access, body, actorUserId);
  }

  @Patch(':id')
  @Roles(MembershipRole.tenant_admin)
  update(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Param('id') id: string,
    @Body() body: { title?: string; steps?: unknown; screenPath?: string | null; status?: string },
    @CurrentUserId() actorUserId?: string,
  ) {
    if (!actorUserId) throw new BadRequestException('Missing actor');
    return this.procedures.update(tenantSlug, access, id, body, actorUserId);
  }
}

@Controller('tenant/quote-approval-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuoteApprovalSettingsController {
  constructor(private readonly settings: QuoteApprovalSettingsService) {}

  @Get()
  @Roles(MembershipRole.tenant_admin)
  get(@TenantId() tenantSlug: string) {
    return this.settings.get(tenantSlug);
  }

  @Patch()
  @Roles(MembershipRole.tenant_admin)
  patch(
    @TenantId() tenantSlug: string,
    @Body() body: unknown,
    @CurrentUserId() actorUserId?: string,
  ) {
    if (!actorUserId) throw new BadRequestException('Missing actor');
    const o = body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
    if (o && typeof o.clientId === 'string' && o.clientId.trim()) {
      return this.settings.setForClient(tenantSlug, body, actorUserId);
    }
    return this.settings.set(tenantSlug, body, actorUserId);
  }
}
