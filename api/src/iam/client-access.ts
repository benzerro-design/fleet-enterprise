import {
  ClientRole,
  CrmTicketRoutingLevel,
  MembershipRole,
  type Prisma,
} from '@prisma/client';
import type { AccessContext, ClientMembershipContext } from './access-context.types';

export function isTenantWideAccess(ctx: AccessContext): boolean {
  if (ctx.membershipRole === MembershipRole.tenant_admin) return true;
  if (ctx.membershipRole === MembershipRole.tenant_viewer && ctx.clientMemberships.length === 0) {
    return true;
  }
  return false;
}

export function clientIdsFilter(ctx: AccessContext): Prisma.ClientWhereInput {
  if (isTenantWideAccess(ctx)) return {};
  if (ctx.allowedClientIds.length === 0) return { id: { in: [] } };
  return { id: { in: ctx.allowedClientIds } };
}

export function vehicleClientScope(ctx: AccessContext): Prisma.VehicleWhereInput {
  if (isTenantWideAccess(ctx)) return {};
  if (ctx.allowedClientIds.length === 0) return { clientId: { in: [] } };
  return { clientId: { in: ctx.allowedClientIds } };
}

export function ticketListScope(ctx: AccessContext): Prisma.CrmTicketWhereInput {
  if (isTenantWideAccess(ctx)) return {};

  if (ctx.clientMemberships.length === 0) {
    return { id: { in: [] } };
  }

  const orClauses: Prisma.CrmTicketWhereInput[] = [];
  for (const m of ctx.clientMemberships) {
    if (m.role === ClientRole.driver) {
      const driverParts: Prisma.CrmTicketWhereInput[] = [{ createdByUserId: ctx.userId }];
      if (m.driverId) {
        driverParts.push({ driverId: m.driverId });
      }
      orClauses.push({
        clientId: m.clientId,
        OR: driverParts,
      });
    } else {
      orClauses.push({ clientId: m.clientId });
    }
  }

  return { OR: orClauses };
}

export function membershipForClient(
  ctx: AccessContext,
  clientId: string,
): ClientMembershipContext | undefined {
  return ctx.clientMemberships.find((m) => m.clientId === clientId);
}

export function canReadTicket(
  ctx: AccessContext,
  ticket: { clientId: string; createdByUserId: string | null; driverId: string | null },
): boolean {
  if (isTenantWideAccess(ctx)) return true;

  const membership = membershipForClient(ctx, ticket.clientId);
  if (!membership) return false;

  if (membership.role === ClientRole.driver) {
    if (ticket.createdByUserId === ctx.userId) return true;
    if (membership.driverId && ticket.driverId === membership.driverId) return true;
    return false;
  }

  return true;
}

export type CrmTicketAction =
  | 'create'
  | 'comment'
  | 'claim'
  | 'resolve'
  | 'route'
  | 'return'
  | 'patch'
  | 'transform'
  | 'delete';

export function canPerformTicketAction(
  ctx: AccessContext,
  action: CrmTicketAction,
  ticket?: { clientId: string; createdByUserId: string | null; driverId: string | null },
): boolean {
  if (ctx.membershipRole === MembershipRole.tenant_admin) return true;

  if (action === 'delete' || action === 'transform' || action === 'return') {
    return false;
  }

  if (action === 'create') {
    if (ctx.membershipRole !== MembershipRole.client_user) return false;
    return ctx.clientMemberships.some((m) => m.role !== ClientRole.client_viewer);
  }

  if (!ticket) return false;
  if (!canReadTicket(ctx, ticket)) return false;

  const membership = membershipForClient(ctx, ticket.clientId);
  if (!membership) return false;

  switch (action) {
    case 'comment':
      if (membership.role === ClientRole.client_viewer) return false;
      if (membership.role === ClientRole.driver) return canReadTicket(ctx, ticket);
      return true;
    case 'claim':
    case 'resolve':
    case 'route':
    case 'patch':
      return (
        membership.role === ClientRole.client_admin ||
        membership.role === ClientRole.client_dispatcher
      );
    default:
      return false;
  }
}

export function actorRoutingLevel(ctx: AccessContext, clientId?: string): CrmTicketRoutingLevel {
  if (ctx.membershipRole === MembershipRole.tenant_admin) {
    return CrmTicketRoutingLevel.L_STAR;
  }

  if (clientId) {
    const membership = membershipForClient(ctx, clientId);
    if (membership) {
      if (
        membership.role === ClientRole.client_admin ||
        membership.role === ClientRole.client_dispatcher
      ) {
        return CrmTicketRoutingLevel.L1;
      }
      if (membership.role === ClientRole.driver) {
        return CrmTicketRoutingLevel.L0;
      }
    }
  }

  const roles = ctx.clientMemberships.map((m) => m.role);
  if (roles.includes(ClientRole.client_admin) || roles.includes(ClientRole.client_dispatcher)) {
    return CrmTicketRoutingLevel.L1;
  }
  if (roles.includes(ClientRole.driver)) {
    return CrmTicketRoutingLevel.L0;
  }

  return CrmTicketRoutingLevel.L1;
}

export function routingLevelLabel(level: CrmTicketRoutingLevel): string {
  switch (level) {
    case CrmTicketRoutingLevel.L0:
      return 'L0';
    case CrmTicketRoutingLevel.L1:
      return 'L1';
    case CrmTicketRoutingLevel.L1N:
      return 'L1+N';
    case CrmTicketRoutingLevel.L_STAR:
      return 'L★';
    default:
      return level;
  }
}

export function assertClientAccess(ctx: AccessContext, clientId: string): void {
  if (isTenantWideAccess(ctx)) return;
  if (!ctx.allowedClientIds.includes(clientId)) {
    throw new Error('CLIENT_ACCESS_DENIED');
  }
}
