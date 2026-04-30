import { SetMetadata } from '@nestjs/common';
import type { MembershipRole } from '@prisma/client';

export const ROLES_KEY = 'rbac_roles';

/** Listează rolurile Prisma care pot accesa ruta (OR logic). */
export const Roles = (...roles: MembershipRole[]) => SetMetadata(ROLES_KEY, roles);
