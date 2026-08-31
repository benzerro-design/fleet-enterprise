import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MembershipRole } from '@prisma/client';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { TenantId } from '../fleet/tenant-id.decorator';
import { CurrentAccess } from './current-access.decorator';
import type { AccessContext } from './access-context.types';
import { UserInvitesService } from './user-invites.service';

@Controller('user-invites')
export class UserInvitesPublicController {
  constructor(
    private readonly invites: UserInvitesService,
    private readonly jwt: JwtService,
  ) {}

  @Get(':token')
  preview(@Param('token') token: string) {
    return this.invites.preview(token);
  }

  @Post(':token/accept')
  accept(
    @Param('token') token: string,
    @Body() body: { password?: string; displayName?: string },
    @Req() req: Request,
  ) {
    const password = body.password?.trim();
    if (password) {
      return this.invites.acceptWithPassword(token, password, body.displayName);
    }

    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      try {
        const payload = this.jwt.verify<JwtPayload>(auth.slice('Bearer '.length).trim());
        if (!payload?.sub) throw new UnauthorizedException('Invalid token');
        return this.invites.acceptWithAuth(token, payload.sub);
      } catch (e) {
        if (e instanceof UnauthorizedException || e instanceof BadRequestException) throw e;
        throw new UnauthorizedException('Invalid or expired session');
      }
    }

    throw new UnauthorizedException(
      'Autentificare necesară sau completați parola pentru a crea contul',
    );
  }
}

@Controller('tenant/invites')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantInvitesController {
  constructor(private readonly invites: UserInvitesService) {}

  @Get()
  @Roles(MembershipRole.tenant_admin)
  list(@TenantId() tenantSlug: string) {
    return this.invites.listTenantInvites(tenantSlug);
  }

  @Post()
  @Roles(MembershipRole.tenant_admin)
  create(
    @TenantId() tenantSlug: string,
    @Body() body: { email?: string; targetRole?: string },
    @CurrentUserId() actorUserId: string,
  ) {
    return this.invites.createTenantInvite(
      tenantSlug,
      { email: body.email ?? '', targetRole: body.targetRole },
      actorUserId,
    );
  }
}

@Controller('clients/:clientId/invites')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientInvitesController {
  constructor(private readonly invites: UserInvitesService) {}

  @Get()
  @Roles(MembershipRole.tenant_admin, MembershipRole.client_user)
  list(
    @TenantId() tenantSlug: string,
    @Param('clientId') clientId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.invites.listClientInvites(tenantSlug, clientId, access);
  }

  @Post()
  @Roles(MembershipRole.tenant_admin, MembershipRole.client_user)
  create(
    @TenantId() tenantSlug: string,
    @Param('clientId') clientId: string,
    @Body() body: { email?: string; role?: string; driverId?: string | null },
    @CurrentAccess() access: AccessContext,
    @CurrentUserId() actorUserId: string,
  ) {
    return this.invites.createClientInvite(
      tenantSlug,
      clientId,
      { email: body.email ?? '', role: body.role, driverId: body.driverId },
      access,
      actorUserId,
    );
  }
}
