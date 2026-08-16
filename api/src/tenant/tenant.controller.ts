import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Put,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MembershipRole } from '@prisma/client';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TenantId } from '../fleet/tenant-id.decorator';
import { FLEET_READ_ROLES } from '../iam/role-sets';
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

  @Get('iam-strategy')
  @Roles(MembershipRole.tenant_admin)
  getIamStrategy(@TenantId() tenantSlug: string) {
    return this.tenant.getIamStrategy(tenantSlug);
  }

  @Put('iam-strategy')
  @Roles(MembershipRole.tenant_admin)
  putIamStrategy(
    @TenantId() tenantSlug: string,
    @Body() body: unknown,
    @CurrentUserId() actorUserId?: string,
  ) {
    if (!actorUserId) throw new BadRequestException('Missing actor');
    return this.tenant.setIamStrategy(tenantSlug, body, actorUserId);
  }

  @Post('iam-strategy/reset')
  @Roles(MembershipRole.tenant_admin)
  resetIamStrategy(@TenantId() tenantSlug: string, @CurrentUserId() actorUserId?: string) {
    if (!actorUserId) throw new BadRequestException('Missing actor');
    return this.tenant.resetIamStrategy(tenantSlug, actorUserId);
  }

  @Get('work-order-settings')
  @Roles(...FLEET_READ_ROLES)
  getWorkOrderSettings(@TenantId() tenantSlug: string) {
    return this.tenant.getWorkOrderSettings(tenantSlug);
  }

  @Patch('work-order-settings')
  @Roles(MembershipRole.tenant_admin)
  patchWorkOrderSettings(
    @TenantId() tenantSlug: string,
    @Body() body: unknown,
    @CurrentUserId() actorUserId?: string,
  ) {
    if (!actorUserId) throw new BadRequestException('Missing actor');
    return this.tenant.setWorkOrderSettings(tenantSlug, body, actorUserId);
  }

  @Get('mail-settings')
  @Roles(...FLEET_READ_ROLES)
  getMailSettings(@TenantId() tenantSlug: string) {
    return this.tenant.getMailSettings(tenantSlug);
  }

  @Patch('mail-settings')
  @Roles(MembershipRole.tenant_admin)
  patchMailSettings(
    @TenantId() tenantSlug: string,
    @Body() body: unknown,
    @CurrentUserId() actorUserId?: string,
  ) {
    if (!actorUserId) throw new BadRequestException('Missing actor');
    return this.tenant.setMailSettings(tenantSlug, body, actorUserId);
  }

  @Get('integrations-settings')
  @Roles(...FLEET_READ_ROLES)
  getIntegrationsSettings(@TenantId() tenantSlug: string) {
    return this.tenant.getIntegrationsSettings(tenantSlug);
  }

  @Patch('integrations-settings')
  @Roles(MembershipRole.tenant_admin)
  patchIntegrationsSettings(
    @TenantId() tenantSlug: string,
    @Body() body: unknown,
    @CurrentUserId() actorUserId?: string,
  ) {
    if (!actorUserId) throw new BadRequestException('Missing actor');
    return this.tenant.setIntegrationsSettings(tenantSlug, body, actorUserId);
  }

  @Post('integrations-settings/intercars/test')
  @Roles(MembershipRole.tenant_admin)
  testInterCars(
    @TenantId() tenantSlug: string,
    @CurrentUserId() actorUserId?: string,
  ) {
    if (!actorUserId) throw new BadRequestException('Missing actor');
    return this.tenant.testInterCarsConnection(tenantSlug, actorUserId);
  }

  @Get('service-types/active')
  @Roles(...FLEET_READ_ROLES)
  listActiveServiceTypes(@TenantId() tenantSlug: string) {
    return this.tenant.listActiveServiceTypes(tenantSlug);
  }

  @Get('service-types')
  @Roles(MembershipRole.tenant_admin)
  listServiceTypes(@TenantId() tenantSlug: string) {
    return this.tenant.listServiceTypes(tenantSlug);
  }

  @Post('service-types')
  @Roles(MembershipRole.tenant_admin)
  createServiceType(
    @TenantId() tenantSlug: string,
    @Body() body: unknown,
    @CurrentUserId() actorUserId?: string,
  ) {
    if (!actorUserId) throw new BadRequestException('Missing actor');
    return this.tenant.createServiceType(tenantSlug, body, actorUserId);
  }

  @Patch('service-types/:id')
  @Roles(MembershipRole.tenant_admin)
  patchServiceType(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUserId() actorUserId?: string,
  ) {
    if (!actorUserId) throw new BadRequestException('Missing actor');
    return this.tenant.patchServiceType(tenantSlug, id, body, actorUserId);
  }

  @Delete('service-types/:id')
  @Roles(MembershipRole.tenant_admin)
  deleteServiceType(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @CurrentUserId() actorUserId?: string,
  ) {
    if (!actorUserId) throw new BadRequestException('Missing actor');
    return this.tenant.deleteServiceType(tenantSlug, id, actorUserId);
  }
}

function parseMembershipRole(raw: string | undefined): MembershipRole {
  if (raw !== 'tenant_admin' && raw !== 'tenant_viewer') {
    throw new BadRequestException('role must be tenant_admin or tenant_viewer');
  }
  return raw;
}
