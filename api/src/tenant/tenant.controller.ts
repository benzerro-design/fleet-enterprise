import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MembershipRole } from '@prisma/client';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TenantId } from '../fleet/tenant-id.decorator';
import { TenantService } from './tenant.service';

@Controller('tenant')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantController {
  constructor(private readonly tenant: TenantService) {}

  @Get('members')
  @Roles(MembershipRole.tenant_admin)
  listMembers(@TenantId() tenantSlug: string) {
    return this.tenant.listMembers(tenantSlug);
  }

  @Patch('members/:userId')
  @Roles(MembershipRole.tenant_admin)
  async patchMember(
    @TenantId() tenantSlug: string,
    @Param('userId') userId: string,
    @Body() body: { role?: string },
    @CurrentUserId() actorUserId?: string,
  ) {
    if (!actorUserId) throw new BadRequestException('Missing actor');
    const role = parseMembershipRole(body.role);
    await this.tenant.setMemberRole(tenantSlug, userId, role, actorUserId);
    return { ok: true };
  }

  @Get('audit-log')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  auditLog(
    @TenantId() tenantSlug: string,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(pageSizeStr ?? '50', 10) || 50), 200);
    return this.tenant.listAuditLog(tenantSlug, page, pageSize, entityType, action);
  }
}

function parseMembershipRole(raw: string | undefined): MembershipRole {
  if (raw !== 'tenant_admin' && raw !== 'tenant_viewer') {
    throw new BadRequestException('role must be tenant_admin or tenant_viewer');
  }
  return raw;
}
