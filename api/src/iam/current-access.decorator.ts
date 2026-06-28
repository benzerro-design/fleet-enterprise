import { createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { AccessContext } from './access-context.types';

export const CurrentAccess = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccessContext => {
    const req = ctx.switchToHttp().getRequest<{ accessContext?: AccessContext }>();
    if (!req.accessContext) {
      throw new ForbiddenException('Access context unavailable');
    }
    return req.accessContext;
  },
);
