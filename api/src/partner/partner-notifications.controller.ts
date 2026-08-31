import { Controller, Get, HttpCode, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { MembershipRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TenantId } from '../fleet/tenant-id.decorator';
import { CurrentAccess } from '../iam/current-access.decorator';
import type { AccessContext } from '../iam/access-context.types';
import { PartnerNotificationService } from './partner-notification.service';

const PARTNER_NOTIF_ROLES = [
  MembershipRole.tenant_admin,
  MembershipRole.tenant_viewer,
  MembershipRole.supplier_user,
] as const;

@Controller('partner/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PartnerNotificationsController {
  constructor(private readonly notifications: PartnerNotificationService) {}

  @Get()
  @Roles(...PARTNER_NOTIF_ROLES)
  list(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Query('unread') unread?: string,
    @Query('supplierId') supplierId?: string,
    @Query('limit') limitStr?: string,
  ) {
    const limit = Math.max(1, parseInt(limitStr ?? '30', 10) || 30);
    return this.notifications.listForAccess(tenantSlug, access, {
      unreadOnly: unread === '1' || unread === 'true',
      supplierId: supplierId?.trim(),
      limit,
    });
  }

  @Patch('read-all')
  @Roles(...PARTNER_NOTIF_ROLES)
  @HttpCode(204)
  markAllRead(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Query('supplierId') supplierId?: string,
  ) {
    return this.notifications.markAllRead(tenantSlug, access, supplierId?.trim());
  }

  @Patch(':id/read')
  @Roles(...PARTNER_NOTIF_ROLES)
  @HttpCode(204)
  markRead(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.notifications.markRead(tenantSlug, id, access);
  }
}
