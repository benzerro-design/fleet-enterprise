import { Body, Controller, Get, Param, Post, UseGuards, BadRequestException } from '@nestjs/common';
import { WorkOrderMessageVisibility } from '@prisma/client';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TenantId } from '../fleet/tenant-id.decorator';
import { CurrentAccess } from '../iam/current-access.decorator';
import type { AccessContext } from '../iam/access-context.types';
import { FLEET_READ_ROLES, FLEET_WRITE_ROLES } from '../iam/role-sets';
import { WorkOrderMessagesService } from './work-order-messages.service';

@Controller('work-orders/:workOrderId/messages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkOrderMessagesController {
  constructor(private readonly messages: WorkOrderMessagesService) {}

  @Get()
  @Roles(...FLEET_READ_ROLES)
  list(
    @TenantId() tenantSlug: string,
    @Param('workOrderId') workOrderId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.messages.list(tenantSlug, workOrderId, access);
  }

  @Post()
  @Roles(...FLEET_WRITE_ROLES)
  create(
    @TenantId() tenantSlug: string,
    @Param('workOrderId') workOrderId: string,
    @Body() body: { body?: string; visibility?: WorkOrderMessageVisibility },
    @CurrentUserId() actorUserId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    const text = body.body?.trim();
    if (!text) throw new BadRequestException('body is required');
    return this.messages.create(
      tenantSlug,
      workOrderId,
      { body: text, visibility: body.visibility },
      actorUserId,
      access,
    );
  }
}
