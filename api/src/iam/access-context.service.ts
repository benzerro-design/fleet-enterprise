import { Injectable, UnauthorizedException } from '@nestjs/common';
import { MembershipRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AccessContext, ActorContext } from './access-context.types';
import { actorRoutingLevel } from './client-access';

@Injectable()
export class AccessContextService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(userId: string, tenantSlug: string): Promise<AccessContext> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      throw new UnauthorizedException('Tenant not found');
    }

    const membership = await this.prisma.tenantMembership.findUnique({
      where: { userId_tenantId: { userId, tenantId: tenant.id } },
      include: { user: { select: { email: true, displayName: true } } },
    });
    if (!membership) {
      throw new UnauthorizedException('No tenant membership');
    }

    const rows = await this.prisma.clientMembership.findMany({
      where: { userId, tenantId: tenant.id },
      include: { client: { select: { code: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const clientMemberships = rows.map((r) => ({
      clientId: r.clientId,
      clientCode: r.client.code,
      role: r.role,
      driverId: r.driverId,
    }));

    const isTenantWide =
      membership.role === MembershipRole.tenant_admin ||
      (membership.role === MembershipRole.tenant_viewer && clientMemberships.length === 0);

    return {
      userId,
      tenantId: tenant.id,
      tenantSlug,
      email: membership.user.email,
      displayName: membership.user.displayName?.trim() || membership.user.email,
      membershipRole: membership.role,
      isTenantWide,
      clientMemberships,
      allowedClientIds: clientMemberships.map((m) => m.clientId),
    };
  }

  toActor(ctx: AccessContext, clientId?: string): ActorContext {
    return {
      userId: ctx.userId,
      displayName: ctx.displayName,
      routingLevel: actorRoutingLevel(ctx, clientId),
    };
  }
}
