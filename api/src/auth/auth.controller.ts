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
      email: u.email,
      tenantSlug: u.tenantSlug,
      role: u.role,
      access: access
        ? {
            isTenantWide: access.isTenantWide,
            clientMemberships: access.clientMemberships.map((m) => ({
              clientId: m.clientId,
              clientCode: m.clientCode,
              role: m.role,
            })),
          }
        : undefined,
    };
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
