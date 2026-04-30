import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<Request>();
    const fromJwt = req.user?.tenantSlug;
    if (typeof fromJwt === 'string' && fromJwt.trim().length > 0) {
      return fromJwt.trim();
    }

    const raw = req.headers['x-tenant-id'];
    const headerValue = Array.isArray(raw) ? raw[0] : raw;
    if (typeof headerValue === 'string') {
      const trimmed = headerValue.trim();
      if (trimmed.length > 0) return trimmed;
    }
    return 'default';
  },
);
