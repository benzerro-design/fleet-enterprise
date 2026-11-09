import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TenantId } from '../fleet/tenant-id.decorator';
import { CurrentAccess } from '../iam/current-access.decorator';
import type { AccessContext } from '../iam/access-context.types';
import { FLEET_READ_ROLES, FLEET_WRITE_ROLES } from '../iam/role-sets';
import { PartnerTireWarehouseService } from './partner-tire-warehouse.service';

@Controller('partner/tire-warehouse')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PartnerTireWarehouseController {
  constructor(private readonly warehouses: PartnerTireWarehouseService) {}

  @Get('warehouses')
  @Roles(...FLEET_READ_ROLES)
  listWarehouses(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Query('supplierId') supplierId?: string,
  ) {
    return this.warehouses.listWarehouses(tenantSlug, access, supplierId?.trim());
  }

  @Post('warehouses')
  @Roles(...FLEET_WRITE_ROLES)
  createWarehouse(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Body() body: unknown,
  ) {
    return this.warehouses.createWarehouse(tenantSlug, access, body);
  }

  @Patch('warehouses/:id')
  @Roles(...FLEET_WRITE_ROLES)
  patchWarehouse(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.warehouses.patchWarehouse(tenantSlug, access, id, body);
  }

  @Get('warehouses/:id/zones')
  @Roles(...FLEET_READ_ROLES)
  listZones(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Param('id') warehouseId: string,
  ) {
    return this.warehouses.listZones(tenantSlug, access, warehouseId);
  }

  @Post('warehouses/:id/zones')
  @Roles(...FLEET_WRITE_ROLES)
  createZone(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Param('id') warehouseId: string,
    @Body() body: unknown,
  ) {
    return this.warehouses.createZone(tenantSlug, access, warehouseId, body);
  }

  @Patch('zones/:id')
  @Roles(...FLEET_WRITE_ROLES)
  patchZone(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Param('id') zoneId: string,
    @Body() body: unknown,
  ) {
    return this.warehouses.patchZone(tenantSlug, access, zoneId, body);
  }

  @Get('zones/:id/rows')
  @Roles(...FLEET_READ_ROLES)
  listRows(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Param('id') zoneId: string,
  ) {
    return this.warehouses.listRows(tenantSlug, access, zoneId);
  }

  @Post('zones/:id/rows')
  @Roles(...FLEET_WRITE_ROLES)
  createRow(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Param('id') zoneId: string,
    @Body() body: unknown,
  ) {
    return this.warehouses.createRow(tenantSlug, access, zoneId, body);
  }

  @Patch('rows/:id')
  @Roles(...FLEET_WRITE_ROLES)
  patchRow(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Param('id') rowId: string,
    @Body() body: unknown,
  ) {
    return this.warehouses.patchRow(tenantSlug, access, rowId, body);
  }

  @Get('rows/:id/locations')
  @Roles(...FLEET_READ_ROLES)
  listLocations(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Param('id') rowId: string,
  ) {
    return this.warehouses.listLocations(tenantSlug, access, rowId);
  }

  @Post('rows/:id/locations')
  @Roles(...FLEET_WRITE_ROLES)
  createLocation(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Param('id') rowId: string,
    @Body() body: unknown,
  ) {
    return this.warehouses.createLocation(tenantSlug, access, rowId, body);
  }

  @Patch('locations/:id')
  @Roles(...FLEET_WRITE_ROLES)
  patchLocation(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Param('id') locationId: string,
    @Body() body: unknown,
  ) {
    return this.warehouses.patchLocation(tenantSlug, access, locationId, body);
  }

  @Get('locations/:id/label')
  @Roles(...FLEET_READ_ROLES)
  locationLabel(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Param('id') locationId: string,
  ) {
    return this.warehouses.locationLabel(tenantSlug, access, locationId);
  }
}
