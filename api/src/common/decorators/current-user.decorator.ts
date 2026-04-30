import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** `sub` din JWT (User.id); lipsește dacă utilizatorul nu e autentificat normal. */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const req = ctx.switchToHttp().getRequest<{ user?: { sub?: string } }>();
    const sub = req.user?.sub;
    return typeof sub === 'string' && sub.trim().length > 0 ? sub.trim() : undefined;
  },
);
