import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ClientRole, MembershipRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { TenantId } from '../fleet/tenant-id.decorator';
import { CurrentAccess } from './current-access.decorator';
import type { AccessContext } from './access-context.types';
import { ClientMembershipsService } from './client-memberships.service';
import { parseFunctionalProfile } from './functional-profile';

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
  @Roles(MembershipRole.tenant_admin, MembershipRole.client_user)
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
      functionalProfile?: string | null;
    },
    @CurrentUserId() actorUserId?: string,
    @CurrentAccess() access?: AccessContext,
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
        functionalProfile: parseOptionalProfile(body.functionalProfile),
      },
      actorUserId,
      access,
    );
  }

  @Patch(':id')
  @Roles(MembershipRole.tenant_admin)
  async patch(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: { functionalProfile?: string | null },
    @CurrentUserId() actorUserId?: string,
  ) {
    if (!Object.prototype.hasOwnProperty.call(body, 'functionalProfile')) {
      throw new BadRequestException('functionalProfile is required');
    }
    await this.memberships.setFunctionalProfile(
      tenantSlug,
      id,
      parseOptionalProfile(body.functionalProfile),
      actorUserId,
    );
    return { ok: true };
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

@Controller('clients/:clientId/memberships')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientTeamMembershipsController {
  constructor(private readonly memberships: ClientMembershipsService) {}

  @Get()
  @Roles(MembershipRole.tenant_admin, MembershipRole.client_user)
  list(
    @TenantId() tenantSlug: string,
    @Param('clientId') clientId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.memberships.listForClient(tenantSlug, clientId, access);
  }
}

function parseOptionalProfile(raw: string | null | undefined) {
  if (raw == null || raw === '' || raw === 'legacy') return null;
  const p = parseFunctionalProfile(raw);
  if (p == null && raw != null && raw !== '') {
    throw new BadRequestException('functionalProfile must be F, T, G, full, or null');
  }
  return p;
}
