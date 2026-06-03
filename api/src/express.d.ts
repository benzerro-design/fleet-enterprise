import type { MembershipRole } from '@prisma/client';
import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Request {
    user?: { sub?: string; tenantSlug: string; email?: string; role?: MembershipRole };
  }
}

export {};
