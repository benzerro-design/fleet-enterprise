import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnauthorizedException,
} from '@nestjs/common';
import { MembershipRole } from '@prisma/client';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { AccessContextService } from './access-context.service';

@Injectable()
export class AccessScopeInterceptor implements NestInterceptor {
  constructor(private readonly access: AccessContextService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const req = context.switchToHttp().getRequest<Request>();

    if (process.env.ALLOW_HEADER_TENANT === 'true') {
      req.accessContext = {
        userId: 'e2e-header-tenant',
        tenantId: 'e2e',
        tenantSlug: req.user?.tenantSlug ?? 'demo',
        email: 'e2e@local',
        displayName: 'E2E',
        membershipRole: MembershipRole.tenant_admin,
        isTenantWide: true,
        clientMemberships: [],
        supplierMemberships: [],
        allowedClientIds: [],
        allowedSupplierIds: [],
      };
      return next.handle();
    }

    const sub = req.user?.sub;
    const tenantSlug = req.user?.tenantSlug;
    if (sub && tenantSlug) {
      try {
        req.accessContext = await this.access.resolve(sub, tenantSlug);
      } catch (e) {
        if (e instanceof UnauthorizedException) throw e;
        throw new UnauthorizedException('Failed to resolve access scope');
      }
    }

    return next.handle();
  }
}
