import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MaintenanceWorkOrderStatus } from '@prisma/client';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentAccess } from '../iam/current-access.decorator';
import type { AccessContext } from '../iam/access-context.types';
import { FLEET_READ_ROLES, FLEET_WRITE_ROLES } from '../iam/role-sets';
import { TenantId } from '../fleet/tenant-id.decorator';
import { WorkOrdersService } from './work-orders.service';

function parseStatus(raw?: string): MaintenanceWorkOrderStatus | undefined {
  if (!raw?.trim()) return undefined;
  const v = raw.trim() as MaintenanceWorkOrderStatus;
  if (
    v === 'draft' ||
    v === 'sent' ||
    v === 'in_progress' ||
    v === 'waiting_parts' ||
    v === 'done' ||
    v === 'cancelled'
  ) {
    return v;
  }
  throw new BadRequestException('Invalid status');
}

@Controller('work-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkOrdersController {
  constructor(private readonly workOrders: WorkOrdersService) {}

  @Get()
  @Roles(...FLEET_READ_ROLES)
  list(
    @TenantId() tenantSlug: string,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('supplierId') supplierId?: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('clientId') clientId?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(pageSizeStr ?? '50', 10) || 50), 200);
    return this.workOrders.listPaged(tenantSlug, {
      page,
      pageSize,
      q: q?.trim(),
      status: parseStatus(status),
      supplierId: supplierId?.trim(),
      vehicleId: vehicleId?.trim(),
      clientId: clientId?.trim(),
    });
  }

  @Get('stats')
  @Roles(...FLEET_READ_ROLES)
  stats(@TenantId() tenantSlug: string, @Query('clientId') clientId?: string) {
    return this.workOrders.getStats(tenantSlug, clientId?.trim());
  }

  @Get(':id')
  @Roles(...FLEET_READ_ROLES)
  get(@TenantId() tenantSlug: string, @Param('id') id: string) {
    return this.workOrders.getById(tenantSlug, id);
  }

  @Patch(':id')
  @Roles(...FLEET_WRITE_ROLES)
  patch(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: { serviceOrderType?: 'M' | 'E' | 'D' | 'TV' },
    @CurrentUserId() actorUserId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.workOrders.patch(tenantSlug, id, body, actorUserId, access);
  }

  @Post(':id/mark-ready')
  @Roles(...FLEET_WRITE_ROLES)
  markReady(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @CurrentUserId() actorUserId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.workOrders.markReady(tenantSlug, id, actorUserId, access);
  }

  @Patch(':id/service-times')
  @Roles(...FLEET_WRITE_ROLES)
  recordServiceTimes(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body()
    body: {
      inServiceAt?: string | null;
      outServiceAt?: string | null;
      odometerKmIn?: number | null;
      odometerKmOut?: number | null;
    },
    @CurrentUserId() actorUserId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.workOrders.recordServiceTimes(tenantSlug, id, body, actorUserId, access);
  }

  @Post(':id/complete')
  @Roles(...FLEET_WRITE_ROLES)
  complete(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @CurrentUserId() actorUserId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.workOrders.complete(tenantSlug, id, actorUserId, access);
  }
}
