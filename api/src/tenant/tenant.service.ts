import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MembershipRole, Prisma, SupplierServiceKind } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { cloneDefaultIamStrategyNodes } from './iam-strategy-default';
import type { IamStrategyPayload } from './iam-strategy.types';
import { parseIamStrategyPayload, parseStoredIamStrategy } from './iam-strategy.validate';
import {
  defaultTenantServiceTypeSeeds,
  isEnumServiceKind,
  mapTenantServiceTypeRow,
  parseServiceTypeCode,
  type TenantServiceTypeRow,
} from './tenant-service-types';
import {
  parseWorkOrderSettings,
  parseWorkOrderSettingsPatch,
  type WorkOrderSettings,
} from './work-order-settings';

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

  async getWorkOrderSettings(tenantSlug: string): Promise<WorkOrderSettings> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { workOrderSettings: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return parseWorkOrderSettings(tenant.workOrderSettings);
  }

  async setWorkOrderSettings(
    tenantSlug: string,
    body: unknown,
    actorUserId: string,
  ): Promise<WorkOrderSettings> {
    let patch: Partial<WorkOrderSettings>;
    try {
      patch = parseWorkOrderSettingsPatch(body);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Invalid settings');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, workOrderSettings: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const next: WorkOrderSettings = {
      ...parseWorkOrderSettings(tenant.workOrderSettings),
      ...patch,
    };

    await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: { workOrderSettings: next as Prisma.InputJsonValue },
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'work_order_settings_update',
      entityType: 'tenant',
      entityId: tenant.id,
      meta: next,
    });

    return next;
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

  private async resolveTenant(tenantSlug: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async ensureDefaultServiceTypes(tenantId: string) {
    const count = await this.prisma.tenantServiceType.count({ where: { tenantId } });
    if (count > 0) return;
    const seeds = defaultTenantServiceTypeSeeds();
    await this.prisma.tenantServiceType.createMany({
      data: seeds.map((s) => ({ tenantId, ...s })),
      skipDuplicates: true,
    });
  }

  private async usageForCodes(tenantId: string, rows: { id: string; code: string }[]) {
    if (rows.length === 0) return new Map<string, { suppliers: number; tickets: number }>();
    const counts = await this.prisma.supplierService.groupBy({
      by: ['serviceTypeId'],
      where: { tenantId, serviceTypeId: { in: rows.map((r) => r.id) } },
      _count: { serviceTypeId: true },
    });
    const ticketCounts = await this.prisma.crmTicket.groupBy({
      by: ['serviceTypeId'],
      where: { tenantId, serviceTypeId: { in: rows.map((r) => r.id) } },
      _count: { serviceTypeId: true },
    });
    const idToCode = new Map(rows.map((r) => [r.id, r.code]));
    const map = new Map<string, { suppliers: number; tickets: number }>();
    for (const row of rows) {
      map.set(row.code, { suppliers: 0, tickets: 0 });
    }
    for (const c of counts) {
      const code = idToCode.get(c.serviceTypeId);
      if (code) {
        const cur = map.get(code) ?? { suppliers: 0, tickets: 0 };
        map.set(code, { ...cur, suppliers: c._count.serviceTypeId });
      }
    }
    for (const c of ticketCounts) {
      if (!c.serviceTypeId) continue;
      const code = idToCode.get(c.serviceTypeId);
      if (code) {
        const cur = map.get(code) ?? { suppliers: 0, tickets: 0 };
        map.set(code, { ...cur, tickets: c._count.serviceTypeId });
      }
    }
    return map;
  }

  async listActiveServiceTypes(tenantSlug: string) {
    const tenant = await this.resolveTenant(tenantSlug);
    await this.ensureDefaultServiceTypes(tenant.id);
    const rows = await this.prisma.tenantServiceType.findMany({
      where: { tenantId: tenant.id, active: true },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      select: {
        id: true,
        code: true,
        label: true,
        clientDescription: true,
        sortOrder: true,
      },
    });
    return { items: rows };
  }

  async listServiceTypes(tenantSlug: string): Promise<{ items: TenantServiceTypeRow[] }> {
    const tenant = await this.resolveTenant(tenantSlug);
    await this.ensureDefaultServiceTypes(tenant.id);

    const rows = await this.prisma.tenantServiceType.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
    const usage = await this.usageForCodes(
      tenant.id,
      rows.map((r) => ({ id: r.id, code: r.code })),
    );

    return {
      items: rows.map((row) =>
        mapTenantServiceTypeRow(row, {
          suppliers: usage.get(row.code)?.suppliers ?? 0,
          tickets: usage.get(row.code)?.tickets ?? 0,
        }),
      ),
    };
  }

  async createServiceType(
    tenantSlug: string,
    body: unknown,
    actorUserId: string,
  ): Promise<TenantServiceTypeRow> {
    const tenant = await this.resolveTenant(tenantSlug);
    await this.ensureDefaultServiceTypes(tenant.id);

    const b = body as Record<string, unknown>;
    let code: string;
    try {
      code = parseServiceTypeCode(b.code);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Invalid code');
    }
    const label = typeof b.label === 'string' ? b.label.trim() : '';
    if (!label) throw new BadRequestException('label is required');
    const clientDescription =
      typeof b.clientDescription === 'string' ? b.clientDescription.trim() : label;

    const existing = await this.prisma.tenantServiceType.findUnique({
      where: { tenantId_code: { tenantId: tenant.id, code } },
    });
    if (existing) throw new BadRequestException('A service type with this code already exists');

    const maxSort = await this.prisma.tenantServiceType.aggregate({
      where: { tenantId: tenant.id },
      _max: { sortOrder: true },
    });

    const row = await this.prisma.tenantServiceType.create({
      data: {
        tenantId: tenant.id,
        code,
        label,
        clientDescription,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        active: true,
        system: false,
      },
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'tenant.service_type.create',
      entityType: 'tenant_service_type',
      entityId: row.id,
      meta: { code, label },
    });

    return mapTenantServiceTypeRow(row, { suppliers: 0, tickets: 0 });
  }

  async patchServiceType(
    tenantSlug: string,
    id: string,
    body: unknown,
    actorUserId: string,
  ): Promise<TenantServiceTypeRow> {
    const tenant = await this.resolveTenant(tenantSlug);
    const row = await this.prisma.tenantServiceType.findFirst({
      where: { id, tenantId: tenant.id },
    });
    if (!row) throw new NotFoundException('Service type not found');

    const b = body as Record<string, unknown>;
    const data: Prisma.TenantServiceTypeUpdateInput = {};

    if (b.label !== undefined) {
      const label = typeof b.label === 'string' ? b.label.trim() : '';
      if (!label) throw new BadRequestException('label cannot be empty');
      data.label = label;
    }
    if (b.clientDescription !== undefined) {
      data.clientDescription =
        typeof b.clientDescription === 'string' ? b.clientDescription.trim() : '';
    }
    if (b.active !== undefined) {
      if (typeof b.active !== 'boolean') throw new BadRequestException('active must be boolean');
      data.active = b.active;
    }
    if (b.sortOrder !== undefined) {
      const sortOrder = typeof b.sortOrder === 'number' ? b.sortOrder : parseInt(String(b.sortOrder), 10);
      if (!Number.isFinite(sortOrder)) throw new BadRequestException('sortOrder must be a number');
      data.sortOrder = sortOrder;
    }

    const updated = await this.prisma.tenantServiceType.update({
      where: { id: row.id },
      data,
    });

    const usage = await this.usageForCodes(tenant.id, [{ id: updated.id, code: updated.code }]);

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'tenant.service_type.update',
      entityType: 'tenant_service_type',
      entityId: updated.id,
      meta: { code: updated.code },
    });

    const usageRow = usage.get(updated.code);
    return mapTenantServiceTypeRow(updated, {
      suppliers: usageRow?.suppliers ?? 0,
      tickets: usageRow?.tickets ?? 0,
    });
  }

  async deleteServiceType(tenantSlug: string, id: string, actorUserId: string) {
    const tenant = await this.resolveTenant(tenantSlug);
    const row = await this.prisma.tenantServiceType.findFirst({
      where: { id, tenantId: tenant.id },
    });
    if (!row) throw new NotFoundException('Service type not found');
    if (row.system) {
      throw new BadRequestException('System service types cannot be deleted — deactivate instead');
    }

    const usage = await this.usageForCodes(tenant.id, [{ id: row.id, code: row.code }]);
    const usageRow = usage.get(row.code);
    if ((usageRow?.suppliers ?? 0) > 0) {
      throw new BadRequestException('Service type is used by suppliers — deactivate instead');
    }

    await this.prisma.tenantServiceType.delete({ where: { id: row.id } });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'tenant.service_type.delete',
      entityType: 'tenant_service_type',
      entityId: row.id,
      meta: { code: row.code },
    });

    return { ok: true as const };
  }

  /** Catalog activ pentru furnizori — toate tipurile tenant active. */
  async activeSupplierServiceCatalog(tenantSlug: string) {
    const { items } = await this.listServiceTypes(tenantSlug);
    return items
      .filter((t) => t.active)
      .map((t) => ({
        id: t.id,
        code: t.code,
        kind: t.code,
        label: t.label,
        description: t.clientDescription,
      }));
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
