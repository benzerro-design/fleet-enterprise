import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TenantId } from '../fleet/tenant-id.decorator';
import { CurrentAccess } from '../iam/current-access.decorator';
import type { AccessContext } from '../iam/access-context.types';
import { FLEET_READ_ROLES, FLEET_WRITE_ROLES } from '../iam/role-sets';
import { PartnerTireHotelService } from './partner-tire-hotel.service';

type AuthedRequest = Request & { user?: { id?: string } };

@Controller('partner/tire-hotel')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PartnerTireHotelController {
  constructor(private readonly hotel: PartnerTireHotelService) {}

  @Get('capability')
  @Roles(...FLEET_READ_ROLES)
  capability(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Query('supplierId') supplierId?: string,
  ) {
    return this.hotel.capability(tenantSlug, access, supplierId?.trim());
  }

  @Get('stays')
  @Roles(...FLEET_READ_ROLES)
  listStays(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Query('supplierId') supplierId?: string,
    @Query('plate') plate?: string,
  ) {
    return this.hotel.listActiveStays(tenantSlug, access, {
      supplierId: supplierId?.trim(),
      plate: plate?.trim(),
    });
  }

  @Get('search')
  @Roles(...FLEET_READ_ROLES)
  search(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Query('supplierId') supplierId?: string,
    @Query('plate') plate?: string,
  ) {
    return this.hotel.searchSetsForCheckIn(tenantSlug, access, {
      supplierId: supplierId?.trim(),
      plate: plate ?? '',
    });
  }

  @Post('check-in')
  @Roles(...FLEET_WRITE_ROLES)
  checkIn(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Body() body: unknown,
    @Req() req: AuthedRequest,
  ) {
    return this.hotel.checkIn(tenantSlug, access, body, req.user?.id);
  }

  @Post('check-out')
  @Roles(...FLEET_WRITE_ROLES)
  checkOut(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Body() body: unknown,
    @Req() req: AuthedRequest,
  ) {
    return this.hotel.checkOut(tenantSlug, access, body, req.user?.id);
  }
}
