import {
  ClientRole,
  CrmTicketRoutingLevel,
  MembershipRole,
  type Prisma,
} from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';
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
  if (isDriverOnlyClientUser(ctx)) {
    const ids = ctx.assignedVehicleIds ?? [];
    if (ids.length === 0) return { id: { in: [] } };
    return { id: { in: ids } };
  }
  if (ctx.allowedClientIds.length === 0) return { clientId: { in: [] } };
  return { clientId: { in: ctx.allowedClientIds } };
}

/** Filtru pe entități legate de vehicul (remindere, costuri, curse…). */
export function vehicleLinkedClientScope(ctx: AccessContext): { vehicle: Prisma.VehicleWhereInput } {
  return { vehicle: vehicleClientScope(ctx) };
}

export function isDriverOnlyClientUser(ctx: AccessContext): boolean {
  if (isTenantWideAccess(ctx)) return false;
  if (ctx.clientMemberships.length === 0) return false;
  return ctx.clientMemberships.every((m) => m.role === ClientRole.driver);
}

/** Manager / dispecer / viewer client — acces modul flotă scoped (nu doar tichete). */
export function canAccessClientFleet(ctx: AccessContext): boolean {
  if (isTenantWideAccess(ctx)) return true;
  return ctx.clientMemberships.some(
    (m) =>
      m.role === ClientRole.client_admin ||
      m.role === ClientRole.client_dispatcher ||
      m.role === ClientRole.client_viewer,
  );
}

export function assertClientFleetAccess(ctx: AccessContext): void {
  if (!canAccessClientFleet(ctx)) {
    throw new Error('CLIENT_FLEET_ACCESS_DENIED');
  }
}

export function driverClientScope(ctx: AccessContext): Prisma.DriverWhereInput {
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
      const vehicleIds = ctx.assignedVehicleIds ?? [];
      if (vehicleIds.length > 0) {
        driverParts.push({ vehicleId: { in: vehicleIds } });
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
  ticket: {
    clientId: string;
    createdByUserId: string | null;
    driverId: string | null;
    vehicleId?: string | null;
  },
): boolean {
  if (isTenantWideAccess(ctx)) return true;

  const membership = membershipForClient(ctx, ticket.clientId);
  if (!membership) return false;

  if (membership.role === ClientRole.driver) {
    if (ticket.createdByUserId === ctx.userId) return true;
    if (membership.driverId && ticket.driverId === membership.driverId) return true;
    if (ticket.vehicleId && ctx.assignedVehicleIds?.includes(ticket.vehicleId)) return true;
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

  if (action === 'delete' || action === 'return') {
    return false;
  }

  if (action === 'transform') {
    if (!ticket) return false;
    if (!canReadTicket(ctx, ticket)) return false;
    const membership = membershipForClient(ctx, ticket.clientId);
    if (!membership) return false;
    return (
      membership.role === ClientRole.driver ||
      membership.role === ClientRole.client_admin ||
      membership.role === ClientRole.client_dispatcher
    );
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

/** Scriere operațională (vehicule, curse, costuri…) — nu creare organizație client. */
export function canWriteClientFleet(ctx: AccessContext): boolean {
  if (isTenantWideAccess(ctx)) {
    return ctx.membershipRole === MembershipRole.tenant_admin;
  }
  return ctx.clientMemberships.some(
    (m) => m.role === ClientRole.client_admin || m.role === ClientRole.client_dispatcher,
  );
}

export function assertClientFleetWrite(ctx: AccessContext, clientId: string): void {
  if (ctx.membershipRole === MembershipRole.tenant_admin) return;
  if (!canWriteClientFleet(ctx)) {
    throw new ForbiddenException('Insufficient permissions for fleet write');
  }
  assertClientAccess(ctx, clientId);
}

/** Dosar lucrare / programator / devize — manager client sau tenant_admin. */
export function canOperateServiceCase(ctx: AccessContext, clientId: string): boolean {
  if (ctx.membershipRole === MembershipRole.tenant_admin) return true;
  if (!canWriteClientFleet(ctx)) return false;
  return !!membershipForClient(ctx, clientId);
}

export function assertServiceCaseWrite(ctx: AccessContext, clientId: string): void {
  if (ctx.membershipRole === MembershipRole.tenant_admin) return;
  if (!canOperateServiceCase(ctx, clientId)) {
    throw new ForbiddenException('Cannot operate service case');
  }
  assertClientAccess(ctx, clientId);
}

/** Aprobare deviz — manager client (client_admin) sau tenant_admin. */
export function canApproveServiceQuote(ctx: AccessContext, clientId: string): boolean {
  if (ctx.membershipRole === MembershipRole.tenant_admin) return true;
  const m = membershipForClient(ctx, clientId);
  return !!m && m.role === ClientRole.client_admin;
}

export function assertApproveServiceQuote(ctx: AccessContext, clientId: string): void {
  if (ctx.membershipRole === MembershipRole.tenant_admin) return;
  if (!canApproveServiceQuote(ctx, clientId)) {
    throw new ForbiddenException('Cannot approve quote');
  }
  assertClientAccess(ctx, clientId);
}

/** Confirmare programare — manager sau șofer scoped. */
export function canConfirmAppointment(ctx: AccessContext, clientId: string): boolean {
  if (ctx.membershipRole === MembershipRole.tenant_admin) return true;
  const m = membershipForClient(ctx, clientId);
  if (!m) return false;
  if (m.role === ClientRole.client_admin || m.role === ClientRole.client_dispatcher) return true;
  if (m.role === ClientRole.driver) return true;
  return false;
}

export function canAckAppointmentAsDriver(ctx: AccessContext, clientId: string): boolean {
  if (ctx.membershipRole === MembershipRole.tenant_admin) return true;
  const m = membershipForClient(ctx, clientId);
  return !!m && m.role === ClientRole.driver;
}
