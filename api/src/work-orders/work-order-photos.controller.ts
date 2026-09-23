import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TenantId } from '../fleet/tenant-id.decorator';
import { CurrentAccess } from '../iam/current-access.decorator';
import type { AccessContext } from '../iam/access-context.types';
import { FLEET_READ_ROLES, FLEET_WRITE_ROLES } from '../iam/role-sets';
import { WorkOrderPhotosService } from './work-order-photos.service';

@Controller('work-orders/:workOrderId/photos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkOrderPhotosController {
  constructor(private readonly photos: WorkOrderPhotosService) {}

  @Get()
  @Roles(...FLEET_READ_ROLES)
  list(
    @TenantId() tenantSlug: string,
    @Param('workOrderId') workOrderId: string,
    @CurrentAccess() access: AccessContext,
    @Query('visitIndex') visitIndexStr?: string,
    @Query('phase') phase?: string,
    @Query('quoteId') quoteId?: string,
    @Query('kind') kind?: string,
  ) {
    const visitIndex = visitIndexStr != null ? parseInt(visitIndexStr, 10) : undefined;
    return this.photos.list(tenantSlug, workOrderId, access, {
      visitIndex: Number.isFinite(visitIndex) ? visitIndex : undefined,
      phase,
      quoteId,
      kind,
    });
  }

  @Post()
  @Roles(...FLEET_WRITE_ROLES)
  create(
    @TenantId() tenantSlug: string,
    @Param('workOrderId') workOrderId: string,
    @Body()
    body: {
      kind?: string;
      phase?: string;
      url?: string;
      caption?: string | null;
      visitIndex?: number;
      quoteId?: string | null;
    },
    @CurrentUserId() actorUserId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.photos.create(tenantSlug, workOrderId, body, actorUserId, access);
  }
}
