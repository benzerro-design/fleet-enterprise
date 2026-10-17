import { Body, Controller, Delete, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TenantId } from '../fleet/tenant-id.decorator';
import { CurrentAccess } from '../iam/current-access.decorator';
import type { AccessContext } from '../iam/access-context.types';
import { FLEET_READ_ROLES, FLEET_WRITE_ROLES } from '../iam/role-sets';
import { TachographService, type TachographDayInput } from './tachograph.service';

@Controller('trips/tachograph-days')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TachographController {
  constructor(private readonly tachograph: TachographService) {}

  @Get()
  @Roles(...FLEET_READ_ROLES)
  list(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('driverId') driverId?: string,
  ) {
    return this.tachograph.list(tenantSlug, access, { from, to, vehicleId, driverId });
  }

  @Put()
  @Roles(...FLEET_WRITE_ROLES)
  upsert(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Body() body: TachographDayInput,
  ) {
    return this.tachograph.upsert(tenantSlug, access, body);
  }

  @Delete(':id')
  @Roles(...FLEET_WRITE_ROLES)
  remove(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Param('id') id: string,
  ) {
    return this.tachograph.remove(tenantSlug, access, id);
  }
}
