import type { MembershipRole } from '@prisma/client';
import type { AccessContext } from './iam/access-context.types';
import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Request {
    user?: { sub?: string; tenantSlug: string; email?: string; role?: MembershipRole };
    accessContext?: AccessContext;
  }
}

export {};
