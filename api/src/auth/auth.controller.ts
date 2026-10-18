import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request) {
    const u = req.user;
    if (!u?.tenantSlug) {
      throw new UnauthorizedException();
    }
    const access = req.accessContext;
    return {
      userId: u.sub,
      email: u.email,
      tenantSlug: u.tenantSlug,
      role: u.role,
      clientPortal: u.clientPortal,
      access: access
        ? {
            isTenantWide: access.isTenantWide,
            assignedVehicleIds: access.assignedVehicleIds,
            clientMemberships: access.clientMemberships.map((m) => ({
              clientId: m.clientId,
              clientCode: m.clientCode,
              role: m.role,
              driverId: m.driverId,
              functionalProfile: m.functionalProfile,
              iamSettings: m.iamSettings,
            })),
            tenantFunctionalProfile: access.tenantFunctionalProfile,
            supplierMemberships: access.supplierMemberships.map((m) => ({
              supplierId: m.supplierId,
              supplierCode: m.supplierCode,
              supplierLegalName: m.supplierLegalName,
              role: m.role,
            })),
          }
        : undefined,
      partnerPortal: u.partnerPortal,
    };
  }

  /** PARTNER-018 — abonați disponibili pentru userul curent. */
  @Get('tenants')
  @UseGuards(JwtAuthGuard)
  listTenants(@CurrentUserId() userId: string | undefined) {
    if (!userId) throw new UnauthorizedException();
    return this.auth.listTenantsForUser(userId);
  }

  /** PARTNER-018 — schimbă abonatul fără re-login. */
  @Post('switch-tenant')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  switchTenant(
    @CurrentUserId() userId: string | undefined,
    @Body() body: { tenantSlug?: string },
  ) {
    if (!userId) throw new UnauthorizedException();
    return this.auth.switchTenant(userId, body?.tenantSlug ?? '');
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body()
    body: {
      email?: string;
      password?: string;
      tenantSlug?: string;
    },
  ) {
    return this.auth.login(body.email ?? '', body.password ?? '', body.tenantSlug);
  }
}
