import { Controller, Delete, Get, HttpCode, Param, UseGuards } from '@nestjs/common';
import { MembershipRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { TenantId } from '../fleet/tenant-id.decorator';
import { SupplierMembershipsService } from './supplier-memberships.service';

@Controller('tenant/supplier-memberships')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupplierMembershipsController {
  constructor(private readonly memberships: SupplierMembershipsService) {}

  @Get()
  @Roles(MembershipRole.tenant_admin)
  list(@TenantId() tenantSlug: string) {
    return this.memberships.list(tenantSlug);
  }

  @Delete(':id')
  @Roles(MembershipRole.tenant_admin)
  @HttpCode(204)
  async remove(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @CurrentUserId() actorUserId?: string,
  ) {
    await this.memberships.remove(tenantSlug, id, actorUserId);
  }
}
