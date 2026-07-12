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
import { MaintenanceWorkOrderStatus, ServiceCaseStage, ServiceOrderType } from '@prisma/client';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentAccess } from '../iam/current-access.decorator';
import type { AccessContext } from '../iam/access-context.types';
import { FLEET_READ_ROLES, FLEET_WRITE_ROLES } from '../iam/role-sets';
import { resolvePartnerSupplierIdsFilter } from '../iam/partner-access';
import { TenantId } from '../fleet/tenant-id.decorator';
import { WorkOrdersService, type WorkOrderInbox } from './work-orders.service';

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

function parseInbox(raw?: string): WorkOrderInbox | undefined {
  if (!raw?.trim()) return undefined;
  const v = raw.trim();
  if (
    v === 'open' ||
    v === 'pending_approval' ||
    v === 'in_service' ||
    v === 'ready' ||
    v === 'invoiced'
  ) {
    return v;
  }
  throw new BadRequestException('Invalid inbox');
}

function parseServiceCaseStage(raw?: string): ServiceCaseStage | undefined {
  if (!raw?.trim()) return undefined;
  const v = raw.trim() as ServiceCaseStage;
  if (
    v === 'intake' ||
    v === 'scheduled' ||
    v === 'work_order' ||
    v === 'in_service' ||
    v === 'out_service' ||
    v === 'quote' ||
    v === 'approval' ||
    v === 'cost' ||
    v === 'invoiced' ||
    v === 'closed'
  ) {
    return v;
  }
  throw new BadRequestException('Invalid service case stage');
}

function parseServiceOrderType(raw?: string): ServiceOrderType | undefined {
  if (!raw?.trim()) return undefined;
  const v = raw.trim() as ServiceOrderType;
  if (v === 'M' || v === 'E' || v === 'D' || v === 'TV') return v;
  throw new BadRequestException('Invalid service order type');
}

@Controller('work-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkOrdersController {
  constructor(private readonly workOrders: WorkOrdersService) {}

  @Get()
  @Roles(...FLEET_READ_ROLES)
  list(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('supplierId') supplierId?: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('clientId') clientId?: string,
    @Query('inbox') inbox?: string,
    @Query('serviceCaseStage') serviceCaseStage?: string,
    @Query('serviceOrderType') serviceOrderType?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(pageSizeStr ?? '50', 10) || 50), 200);
    const supplierIds = resolvePartnerSupplierIdsFilter(
      access,
      supplierId?.trim() ? [supplierId.trim()] : undefined,
    );
    return this.workOrders.listPaged(tenantSlug, {
      page,
      pageSize,
      q: q?.trim(),
      status: parseStatus(status),
      supplierIds,
      vehicleId: vehicleId?.trim(),
      clientId: clientId?.trim(),
      inbox: parseInbox(inbox),
      serviceCaseStage: parseServiceCaseStage(serviceCaseStage),
      serviceOrderType: parseServiceOrderType(serviceOrderType),
    });
  }

  @Get('stats')
  @Roles(...FLEET_READ_ROLES)
  stats(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Query('clientId') clientId?: string,
  ) {
    const supplierIds = resolvePartnerSupplierIdsFilter(access);
    const supplierId = supplierIds?.length === 1 ? supplierIds[0] : undefined;
    return this.workOrders.getStats(tenantSlug, clientId?.trim(), supplierId);
  }

  @Get(':id')
  @Roles(...FLEET_READ_ROLES)
  get(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.workOrders.getById(tenantSlug, id, access);
  }

  @Patch(':id')
  @Roles(...FLEET_WRITE_ROLES)
  patch(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: { serviceOrderType?: 'M' | 'E' | 'D' | 'TV'; estimatedRepairAt?: string | null },
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
