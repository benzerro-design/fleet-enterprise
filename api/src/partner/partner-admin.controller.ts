import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TenantId } from '../fleet/tenant-id.decorator';
import { CurrentAccess } from '../iam/current-access.decorator';
import type { AccessContext } from '../iam/access-context.types';
import { FLEET_READ_ROLES } from '../iam/role-sets';
import { parseSupplierIdsQuery } from '../iam/partner-access';
import { PartnerAdminService } from './partner-admin.service';

@Controller('partner/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PartnerAdminController {
  constructor(private readonly partnerAdmin: PartnerAdminService) {}

  @Get('overview')
  @Roles(...FLEET_READ_ROLES)
  overview(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Query('supplierId') supplierId?: string,
    @Query('suppliers') suppliers?: string,
  ) {
    const filterIds = parseSupplierIdsQuery(supplierId, suppliers);
    return this.partnerAdmin.getOverview(tenantSlug, access, filterIds);
  }
}
