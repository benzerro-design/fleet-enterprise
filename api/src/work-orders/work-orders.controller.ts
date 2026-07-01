import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MaintenanceWorkOrderStatus, MembershipRole } from '@prisma/client';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
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
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer, MembershipRole.client_user)
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
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer, MembershipRole.client_user)
  stats(@TenantId() tenantSlug: string, @Query('clientId') clientId?: string) {
    return this.workOrders.getStats(tenantSlug, clientId?.trim());
  }

  @Get(':id')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer, MembershipRole.client_user)
  get(@TenantId() tenantSlug: string, @Param('id') id: string) {
    return this.workOrders.getById(tenantSlug, id);
  }

  @Post(':id/complete')
  @Roles(MembershipRole.tenant_admin)
  complete(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @CurrentUserId() actorUserId: string,
  ) {
    return this.workOrders.complete(tenantSlug, id, actorUserId);
  }
}
