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

  @Get('zones/:id/shelves')
  @Roles(...FLEET_READ_ROLES)
  listShelves(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Param('id') zoneId: string,
  ) {
    return this.warehouses.listShelves(tenantSlug, access, zoneId);
  }

  @Post('zones/:id/shelves')
  @Roles(...FLEET_WRITE_ROLES)
  createShelf(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Param('id') zoneId: string,
    @Body() body: unknown,
  ) {
    return this.warehouses.createShelf(tenantSlug, access, zoneId, body);
  }

  @Patch('shelves/:id')
  @Roles(...FLEET_WRITE_ROLES)
  patchShelf(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Param('id') shelfId: string,
    @Body() body: unknown,
  ) {
    return this.warehouses.patchShelf(tenantSlug, access, shelfId, body);
  }

  @Get('shelves/:id/label')
  @Roles(...FLEET_READ_ROLES)
  shelfLabel(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Param('id') shelfId: string,
  ) {
    return this.warehouses.shelfLabel(tenantSlug, access, shelfId);
  }
}
