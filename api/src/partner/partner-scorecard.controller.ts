import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TenantId } from '../fleet/tenant-id.decorator';
import { CurrentAccess } from '../iam/current-access.decorator';
import type { AccessContext } from '../iam/access-context.types';
import { FLEET_READ_ROLES } from '../iam/role-sets';
import { PartnerScorecardService } from './partner-scorecard.service';

@Controller('partner/scorecard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PartnerScorecardController {
  constructor(private readonly scorecard: PartnerScorecardService) {}

  /** PARTNER-015 — KPI răspuns / turnaround / deviație preț. */
  @Get()
  @Roles(...FLEET_READ_ROLES)
  get(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('supplierId') supplierId?: string,
    @Query('suppliers') suppliers?: string,
  ) {
    return this.scorecard.getScorecard(tenantSlug, access, {
      from,
      to,
      supplierId,
      suppliers,
    });
  }
}
