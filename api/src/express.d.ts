import type { MembershipRole } from '@prisma/client';
import type { ClientPortalMode } from './auth/auth.service';
import type { AccessContext } from './iam/access-context.types';
import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      sub?: string;
      tenantSlug: string;
      email?: string;
      role?: MembershipRole;
      clientPortal?: ClientPortalMode;
      partnerPortal?: boolean;
    };
    accessContext?: AccessContext;
  }
}

export {};
