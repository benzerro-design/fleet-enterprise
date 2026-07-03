import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MembershipRole, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { cloneDefaultIamStrategyNodes } from './iam-strategy-default';
import type { IamStrategyPayload } from './iam-strategy.types';
import { parseIamStrategyPayload, parseStoredIamStrategy } from './iam-strategy.validate';

@Injectable()
export class TenantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listMembers(tenantSlug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      include: {
        memberships: {
          include: { user: { select: { id: true, email: true, displayName: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!tenant) return { members: [] as const };

    return {
      members: tenant.memberships.map((m) => ({
        userId: m.userId,
        email: m.user.email,
        displayName: m.user.displayName,
        role: m.role,
        joinedAt: m.createdAt.toISOString(),
      })),
    };
  }

  async setMemberRole(
    tenantSlug: string,
    targetUserId: string,
    role: MembershipRole,
    actorUserId: string,
  ) {
    if (targetUserId === actorUserId) {
      throw new BadRequestException('Nu poți modifica propriul rol din acest endpoint (MVP).');
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const mem = await this.prisma.tenantMembership.findUnique({
      where: {
        userId_tenantId: { userId: targetUserId, tenantId: tenant.id },
      },
    });
    if (!mem) throw new NotFoundException('Membership not found');

    await this.prisma.tenantMembership.update({
      where: { id: mem.id },
      data: { role },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: tenant.id,
        actorUserId,
        action: 'membership_role_update',
        entityType: 'membership',
        entityId: mem.id,
        meta: { targetUserId, newRole: role } as Prisma.InputJsonValue,
      },
    });
  }

  async listAuditLog(
    tenantSlug: string,
    page: number,
    pageSize: number,
    entityType?: string,
    action?: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return { total: 0, items: [] as const, page, pageSize };
    }
    const take = Math.min(Math.max(1, pageSize), 200);
    const skip = (Math.max(1, page) - 1) * take;
    const r = await this.audit.listForTenant({
      tenantUuid: tenant.id,
      skip,
      take,
      entityType: entityType?.trim() || undefined,
      action: action?.trim() || undefined,
    });
    return {
      ...r,
      page: Math.max(1, page),
      pageSize: take,
    };
  }

  async getIamStrategy(tenantSlug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, iamStrategyMap: true, updatedAt: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const stored = parseStoredIamStrategy(tenant.iamStrategyMap);
    const isDefault = stored == null;
    const nodes = stored ?? cloneDefaultIamStrategyNodes();

    return {
      version: 1 as const,
      nodes,
      isDefault,
      updatedAt: isDefault ? null : tenant.updatedAt.toISOString(),
    };
  }

  async setIamStrategy(tenantSlug: string, body: unknown, actorUserId: string) {
    const payload: IamStrategyPayload = parseIamStrategyPayload(body);
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const toStore = { version: 1, nodes: payload.nodes };
    await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: { iamStrategyMap: toStore as Prisma.InputJsonValue },
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'iam_strategy_update',
      entityType: 'tenant',
      entityId: tenant.id,
      meta: { nodeCount: countIamNodes(payload.nodes) },
    });

    return this.getIamStrategy(tenantSlug);
  }

  async resetIamStrategy(tenantSlug: string, actorUserId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: { iamStrategyMap: Prisma.DbNull },
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'iam_strategy_reset',
      entityType: 'tenant',
      entityId: tenant.id,
    });

    return this.getIamStrategy(tenantSlug);
  }
}

function countIamNodes(nodes: IamStrategyPayload['nodes']): number {
  let n = 0;
  function walk(list: IamStrategyPayload['nodes']) {
    for (const node of list) {
      n += 1;
      if (node.children?.length) walk(node.children);
    }
  }
  walk(nodes);
  return n;
}
