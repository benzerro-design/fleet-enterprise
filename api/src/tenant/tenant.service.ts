import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MembershipRole, type Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

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
}
