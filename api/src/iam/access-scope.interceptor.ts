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
      const tenantSlug = req.user?.tenantSlug?.trim();
      if (!tenantSlug) {
        throw new UnauthorizedException('Tenant context required');
      }
      req.accessContext = {
        userId: 'e2e-header-tenant',
        tenantId: 'e2e',
        tenantSlug,
        email: 'e2e@local',
        displayName: 'E2E',
        membershipRole: MembershipRole.tenant_admin,
        tenantFunctionalProfile: null,
        tenantFunctionalProfileMatrix: null,
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
        // DB/schema errors must not look like a logged-out session (login loop).
        throw e;
      }
    }

    return next.handle();
  }
}
