import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MembershipRole, SupplierRole } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TenantId } from '../fleet/tenant-id.decorator';
import { CurrentAccess } from '../iam/current-access.decorator';
import type { AccessContext } from '../iam/access-context.types';
import { SupplierInvitesService } from '../suppliers/supplier-invites.service';

@Controller('partner-invites')
export class PartnerInvitesPublicController {
  constructor(
    private readonly invites: SupplierInvitesService,
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
      'Autentificare necesară sau completați parola pentru a crea contul partener',
    );
  }
}

@Controller('suppliers/:supplierId/invites')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupplierInvitesController {
  constructor(private readonly invites: SupplierInvitesService) {}

  @Get()
  @Roles(MembershipRole.tenant_admin, MembershipRole.supplier_user)
  list(
    @TenantId() tenantSlug: string,
    @Param('supplierId') supplierId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.invites.listForSupplier(tenantSlug, supplierId, access);
  }

  @Post()
  @Roles(MembershipRole.tenant_admin, MembershipRole.supplier_user)
  create(
    @TenantId() tenantSlug: string,
    @Param('supplierId') supplierId: string,
    @Body() body: { email?: string; role?: SupplierRole },
    @CurrentUserId() actorUserId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    const email = body.email?.trim();
    if (!email) throw new BadRequestException('email is required');
    return this.invites.create(
      tenantSlug,
      supplierId,
      { email, role: body.role },
      actorUserId,
      access,
    );
  }
}

