import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ClientRole, MembershipRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { TenantId } from '../fleet/tenant-id.decorator';
import { ClientMembershipsService } from './client-memberships.service';

@Controller('tenant/client-memberships')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientMembershipsController {
  constructor(private readonly memberships: ClientMembershipsService) {}

  @Get()
  @Roles(MembershipRole.tenant_admin)
  list(@TenantId() tenantSlug: string) {
    return this.memberships.list(tenantSlug);
  }

  @Post()
  @Roles(MembershipRole.tenant_admin)
  @HttpCode(201)
  create(
    @TenantId() tenantSlug: string,
    @Body()
    body: {
      email?: string;
      displayName?: string | null;
      password?: string | null;
      clientId?: string;
      role?: ClientRole;
      driverId?: string | null;
    },
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.memberships.create(
      tenantSlug,
      {
        email: body.email ?? '',
        displayName: body.displayName,
        password: body.password,
        clientId: body.clientId ?? '',
        role: body.role ?? ClientRole.client_viewer,
        driverId: body.driverId,
      },
      actorUserId,
    );
  }

  @Delete(':id')
  @Roles(MembershipRole.tenant_admin)
  @HttpCode(204)
  async remove(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @CurrentUserId() actorUserId?: string,
  ) {
    await this.memberships.remove(tenantSlug, id, actorUserId);
  }
}
