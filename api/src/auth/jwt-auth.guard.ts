import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MembershipRole } from '@prisma/client';
import type { Request } from 'express';
import type { JwtPayload } from './auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    if (process.env.ALLOW_HEADER_TENANT === 'true') {
      const raw = req.headers['x-tenant-id'];
      const v = Array.isArray(raw) ? raw[0] : raw;
      if (typeof v === 'string' && v.trim().length > 0) {
        req.user = {
          tenantSlug: v.trim(),
          role: MembershipRole.tenant_admin,
        };
        return true;
      }
      throw new UnauthorizedException('Missing X-Tenant-Id (e2e mode)');
    }

    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = auth.slice('Bearer '.length).trim();
    try {
      const payload = this.jwt.verify<JwtPayload>(token);
      if (!payload?.tenantSlug?.trim()) {
        throw new UnauthorizedException('Invalid token payload');
      }
      req.user = {
        sub: payload.sub,
        tenantSlug: payload.tenantSlug.trim(),
        role: payload.role ?? MembershipRole.tenant_admin,
        ...(payload.email ? { email: payload.email } : {}),
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
