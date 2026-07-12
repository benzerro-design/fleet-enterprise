import { Injectable, UnauthorizedException } from '@nestjs/common';
import { MembershipRole, ClientRole } from '@prisma/client';
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

    const supplierRows = await this.prisma.supplierMembership.findMany({
      where: { userId, tenantId: tenant.id },
      include: { supplier: { select: { code: true, legalName: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const clientMemberships = rows.map((r) => ({
      clientId: r.clientId,
      clientCode: r.client.code,
      role: r.role,
      driverId: r.driverId,
    }));

    const supplierMemberships = supplierRows.map((r) => ({
      supplierId: r.supplierId,
      supplierCode: r.supplier.code,
      supplierLegalName: r.supplier.legalName,
      role: r.role,
    }));

    const isTenantWide =
      (membership.role === MembershipRole.tenant_admin ||
        membership.role === MembershipRole.tenant_viewer) &&
      clientMemberships.length === 0 &&
      supplierMemberships.length === 0;

    const driverOnly =
      clientMemberships.length > 0 &&
      clientMemberships.every((m) => m.role === ClientRole.driver);

    let assignedVehicleIds: string[] | undefined;
    if (driverOnly) {
      const driverIds = clientMemberships
        .map((m) => m.driverId)
        .filter((id): id is string => Boolean(id));
      if (driverIds.length > 0) {
        const assignments = await this.prisma.driverVehicleAssignment.findMany({
          where: { driverId: { in: driverIds }, unassignedAt: null },
          select: { vehicleId: true },
        });
        assignedVehicleIds = [...new Set(assignments.map((a) => a.vehicleId))];
      } else {
        assignedVehicleIds = [];
      }
    }

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
      supplierMemberships,
      allowedSupplierIds: supplierMemberships.map((m) => m.supplierId),
      assignedVehicleIds,
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
