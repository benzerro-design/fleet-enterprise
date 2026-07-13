import { Body, Controller, Get, Param, Post, UseGuards, BadRequestException } from '@nestjs/common';
import { MembershipRole, SupplierRole } from '@prisma/client';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TenantId } from '../fleet/tenant-id.decorator';
import { SupplierInvitesService } from '../suppliers/supplier-invites.service';
import { CurrentAccess } from '../iam/current-access.decorator';
import type { AccessContext } from '../iam/access-context.types';

@Controller('partner-invites')
export class PartnerInvitesPublicController {
  constructor(private readonly invites: SupplierInvitesService) {}

  @Get(':token')
  preview(@Param('token') token: string) {
    return this.invites.preview(token);
  }

  @Post(':token/accept')
  @UseGuards(JwtAuthGuard, RolesGuard)
  accept(
    @Param('token') token: string,
    @CurrentUserId() userId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.invites.accept(token, userId, access.email);
  }
}

@Controller('suppliers/:supplierId/invites')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupplierInvitesController {
  constructor(private readonly invites: SupplierInvitesService) {}

  @Get()
  @Roles(MembershipRole.tenant_admin)
  list(@TenantId() tenantSlug: string, @Param('supplierId') supplierId: string) {
    return this.invites.listForSupplier(tenantSlug, supplierId);
  }

  @Post()
  @Roles(MembershipRole.tenant_admin)
  create(
    @TenantId() tenantSlug: string,
    @Param('supplierId') supplierId: string,
    @Body() body: { email?: string; role?: SupplierRole },
    @CurrentUserId() actorUserId: string,
  ) {
    const email = body.email?.trim();
    if (!email) throw new BadRequestException('email is required');
    return this.invites.create(tenantSlug, supplierId, { email, role: body.role }, actorUserId);
  }
}
