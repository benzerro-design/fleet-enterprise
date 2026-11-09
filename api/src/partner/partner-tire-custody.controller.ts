import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TenantId } from '../fleet/tenant-id.decorator';
import { CurrentAccess } from '../iam/current-access.decorator';
import type { AccessContext } from '../iam/access-context.types';
import { FLEET_READ_ROLES, FLEET_WRITE_ROLES } from '../iam/role-sets';
import { PartnerTireCustodyService } from './partner-tire-custody.service';

@Controller('partner/tire-custody')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PartnerTireCustodyController {
  constructor(private readonly custody: PartnerTireCustodyService) {}

  @Get('stock')
  @Roles(...FLEET_READ_ROLES)
  listStock(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Query('supplierId') supplierId?: string,
    @Query('q') q?: string,
  ) {
    return this.custody.listStock(tenantSlug, access, {
      supplierId: supplierId?.trim(),
      q: q?.trim(),
    });
  }

  @Post('stock/:stayId/assign-location')
  @Roles(...FLEET_WRITE_ROLES)
  assignLocation(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Param('stayId') stayId: string,
    @Body() body: unknown,
  ) {
    return this.custody.assignLocation(tenantSlug, access, stayId, body);
  }

  @Get('assets/:assetId')
  @Roles(...FLEET_READ_ROLES)
  getAsset(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Param('assetId') assetId: string,
    @Query('supplierId') supplierId?: string,
  ) {
    return this.custody.getAsset(tenantSlug, access, assetId, {
      supplierId: supplierId?.trim(),
    });
  }
}
