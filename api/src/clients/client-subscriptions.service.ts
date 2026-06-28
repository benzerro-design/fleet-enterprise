import { Injectable, NotFoundException } from '@nestjs/common';
import type { BillingCycle, ClientPlanAssignmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type ClientSubscriptionRow = {
  assignmentId: string;
  status: ClientPlanAssignmentStatus;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
  plan: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    billingCycle: BillingCycle;
    priceCents: number;
    currency: string;
  };
};

@Injectable()
export class ClientSubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForClient(tenantSlug: string, clientId: string): Promise<ClientSubscriptionRow[]> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) return [];

    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId: tenant.id },
    });
    if (!client) throw new NotFoundException('Client not found');

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const rows = await this.prisma.clientPlanAssignment.findMany({
      where: {
        clientId,
        tenantId: tenant.id,
        status: { in: ['active', 'scheduled'] },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
      },
      include: {
        plan: {
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
            billingCycle: true,
            priceCents: true,
            currency: true,
            isActive: true,
          },
        },
      },
      orderBy: [{ status: 'asc' }, { effectiveFrom: 'desc' }],
    });

    return rows
      .filter((r) => r.plan.isActive)
      .map((r) => ({
        assignmentId: r.id,
        status: r.status,
        effectiveFrom: r.effectiveFrom.toISOString(),
        effectiveTo: r.effectiveTo ? r.effectiveTo.toISOString() : null,
        notes: r.notes,
        plan: {
          id: r.plan.id,
          code: r.plan.code,
          name: r.plan.name,
          description: r.plan.description,
          billingCycle: r.plan.billingCycle,
          priceCents: r.plan.priceCents,
          currency: r.plan.currency,
        },
      }));
  }
}
