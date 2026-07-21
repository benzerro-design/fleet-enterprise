import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentAccess } from '../iam/current-access.decorator';
import type { AccessContext } from '../iam/access-context.types';
import { FLEET_READ_ROLES, FLEET_WRITE_ROLES } from '../iam/role-sets';
import { TenantId } from '../fleet/tenant-id.decorator';
import {
  type PatchWarrantyInput,
  type SyncWarrantyInput,
  WorkOrderWarrantyService,
} from './work-order-warranty.service';

@Controller('work-orders/:workOrderId/warranty')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkOrderWarrantyController {
  constructor(private readonly warranty: WorkOrderWarrantyService) {}

  @Get()
  @Roles(...FLEET_READ_ROLES)
  get(
    @TenantId() tenantSlug: string,
    @Param('workOrderId') workOrderId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.warranty.get(tenantSlug, workOrderId, access);
  }

  @Post('sync-from-quote')
  @Roles(...FLEET_WRITE_ROLES)
  syncFromQuote(
    @TenantId() tenantSlug: string,
    @Param('workOrderId') workOrderId: string,
    @Body() body: SyncWarrantyInput,
    @CurrentUserId() actorUserId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.warranty.syncFromQuote(tenantSlug, workOrderId, body ?? {}, actorUserId, access);
  }

  @Patch()
  @Roles(...FLEET_WRITE_ROLES)
  patch(
    @TenantId() tenantSlug: string,
    @Param('workOrderId') workOrderId: string,
    @Body() body: PatchWarrantyInput,
    @CurrentUserId() actorUserId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.warranty.patch(tenantSlug, workOrderId, body ?? {}, actorUserId, access);
  }
}
