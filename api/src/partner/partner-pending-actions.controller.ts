import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MembershipRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TenantId } from '../fleet/tenant-id.decorator';
import { CurrentAccess } from '../iam/current-access.decorator';
import type { AccessContext } from '../iam/access-context.types';
import { PartnerNotificationService } from './partner-notification.service';

const PARTNER_PENDING_ROLES = [
  MembershipRole.tenant_admin,
  MembershipRole.tenant_viewer,
  MembershipRole.supplier_user,
] as const;

@Controller('partner/pending-actions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PartnerPendingActionsController {
  constructor(private readonly notifications: PartnerNotificationService) {}

  @Get()
  @Roles(...PARTNER_PENDING_ROLES)
  list(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Query('supplierId') supplierId?: string,
  ) {
    return this.notifications.listPendingActions(tenantSlug, access, {
      supplierId: supplierId?.trim(),
    });
  }
}
