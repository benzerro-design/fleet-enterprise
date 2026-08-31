import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClientStatus, Prisma, VehicleStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { normalizeReminderOffsets } from '../ops/document-reminders';
import {
  computeReminderActionSummary,
  matchesActionReminderFilter,
  normalizeReminderOffsetsKm,
} from '../ops/reminder-status';
import { PrismaService } from '../prisma/prisma.service';
import { resolveClientInTenant } from './client-resolve';
import {
  ClientSubscriptionsService,
  type ClientSubscriptionRow,
} from './client-subscriptions.service';
import { DriversService, type DriverRecord } from '../drivers/drivers.service';
import type { AccessContext } from '../iam/access-context.types';
import { clientIdsFilter } from '../iam/client-access';
import {
  parseClientMailSettings,
  parseClientMailSettingsPatch,
  type ClientMailSettings,
} from './client-mail-settings';
import {
  parseClientPricingSettings,
  parseClientPricingSettingsPatch,
  type ClientPricingSettings,
} from './client-pricing-settings';

export type { ClientSubscriptionRow, DriverRecord, ClientMailSettings, ClientPricingSettings };

const MAX_PAGE_SIZE = 200;
const REMINDER_SCAN_LIMIT = 500;
const RECENT_ACTIVITY_LIMIT = 8;

export type ClientRecord = {
  id: string;
  code: string;
  legalName: string;
  taxId: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  addressLine: string | null;
  tradeRegister: string | null;
  billingNotes: string | null;
  status: ClientStatus;
  notes: string | null;
  vehicleCount: number;
  remindersActionCount?: number;
  itpWithin30Days?: number;
  healthLabel?: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateClientInput = {
  code: string;
  legalName: string;
  taxId?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  addressLine?: string | null;
  tradeRegister?: string | null;
  billingNotes?: string | null;
  status?: ClientStatus;
  notes?: string | null;
};

export type PatchClientInput = Partial<CreateClientInput>;

export type ClientListParams = {
  page: number;
  pageSize: number;
  q?: string;
  status?: ClientStatus;
};

export type ClientSummaryVehicleRow = {
  id: string;
  registrationNumber: string;
  brand: string | null;
  model: string | null;
  status: VehicleStatus;
  odometerKm: number | null;
};

export type ClientSummaryActivityRow = {
  at: string;
  kind: 'trip' | 'cost' | 'maintenance';
  label: string;
  vehicleId: string;
  registrationNumber: string;
};

export type ClientSummaryPayload = {
  client: ClientRecord;
  kpis: {
    vehiclesActive: number;
    vehiclesTotal: number;
    remindersActionCount: number;
    costsMonthCents: number;
    tripsMonthCount: number;
    itpWithin30Days: number;
  };
  vehicles: ClientSummaryVehicleRow[];
  recentActivity: ClientSummaryActivityRow[];
  subscriptions: ClientSubscriptionRow[];
  drivers: DriverRecord[];
};

function normalizeCode(code: string): string {
  const t = code.trim();
  if (!t) throw new BadRequestException('code is required');
  if (t.length > 64) throw new BadRequestException('code too long');
  return t;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function healthLabel(remindersActionCount: number, itpWithin30Days: number): string {
  if (remindersActionCount > 0) return `${remindersActionCount} acțiuni`;
  if (itpWithin30Days > 0) return 'ITP';
  return 'OK';
}

const reminderInclude = {
  vehicle: { select: { odometerKm: true, clientId: true } },
} as const;

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly subscriptions: ClientSubscriptionsService,
    private readonly drivers: DriversService,
  ) {}

  async listPaged(tenantSlug: string, params: ClientListParams, access?: AccessContext) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return { items: [], total: 0, page: params.page, pageSize: params.pageSize };
    }

    const pageSize = Math.min(Math.max(1, params.pageSize), MAX_PAGE_SIZE);
    const page = Math.max(1, params.page);
    const skip = (page - 1) * pageSize;

    const where = this.listWhere(tenant.id, params, access);

    const [total, rows] = await Promise.all([
      this.prisma.client.count({ where }),
      this.prisma.client.findMany({
        where,
        orderBy: [{ status: 'asc' }, { code: 'asc' }],
        skip,
        take: pageSize,
        include: { _count: { select: { vehicles: true } } },
      }),
    ]);

    const clientIds = rows.map((r) => r.id);
    const health = await this.computeHealthForClients(tenant.id, clientIds);

    return {
      items: rows.map((r) =>
        this.toRecord(r, r._count.vehicles, {
          remindersActionCount: health.remindersByClient.get(r.id) ?? 0,
          itpWithin30Days: health.itpByClient.get(r.id) ?? 0,
        }),
      ),
      total,
      page,
      pageSize,
    };
  }

  async getById(tenantSlug: string, id: string, access?: AccessContext): Promise<ClientRecord> {
    const row = await this.findRow(tenantSlug, id);
    if (access && !access.isTenantWide && !access.allowedClientIds.includes(row.id)) {
      throw new NotFoundException('Client not found');
    }
    const count = await this.prisma.vehicle.count({
      where: { clientId: row.id, tenant: { slug: tenantSlug } },
    });
    const health = await this.computeHealthForClients(row.tenantId, [row.id]);
    return this.toRecord(row, count, {
      remindersActionCount: health.remindersByClient.get(row.id) ?? 0,
      itpWithin30Days: health.itpByClient.get(row.id) ?? 0,
    });
  }

  async getSummary(tenantSlug: string, id: string, access?: AccessContext): Promise<ClientSummaryPayload> {
    const row = await this.findRow(tenantSlug, id);
    const client = await this.getById(tenantSlug, id, access);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in30 = addDays(today, 30);
    const month = { start: startOfMonth(today), end: endOfMonth(today) };

    const vehicleBase: Prisma.VehicleWhereInput = {
      tenantId: row.tenantId,
      clientId: id,
    };

    const vehicleIds = (
      await this.prisma.vehicle.findMany({
        where: vehicleBase,
        select: { id: true },
      })
    ).map((v) => v.id);

    const [
      vehiclesActive,
      vehiclesTotal,
      itpWithin30Days,
      costsAgg,
      tripsMonthCount,
      vehicleRows,
      costRows,
      tripRows,
      maintenanceRows,
    ] = await Promise.all([
      this.prisma.vehicle.count({
        where: { ...vehicleBase, status: VehicleStatus.active },
      }),
      this.prisma.vehicle.count({ where: vehicleBase }),
      this.prisma.vehicle.count({
        where: {
          ...vehicleBase,
          status: VehicleStatus.active,
          itpExpiresOn: { gte: today, lte: in30 },
        },
      }),
      vehicleIds.length === 0
        ? Promise.resolve({ _sum: { amountCents: null as number | null } })
        : this.prisma.costEntry.aggregate({
            where: {
              tenantId: row.tenantId,
              vehicleId: { in: vehicleIds },
              incurredOn: { gte: month.start, lte: month.end },
            },
            _sum: { amountCents: true },
          }),
      vehicleIds.length === 0
        ? Promise.resolve(0)
        : this.prisma.trip.count({
            where: {
              tenantId: row.tenantId,
              vehicleId: { in: vehicleIds },
              startedAt: { gte: month.start, lte: month.end },
            },
          }),
      this.prisma.vehicle.findMany({
        where: vehicleBase,
        select: {
          id: true,
          registrationNumber: true,
          brand: true,
          model: true,
          status: true,
          odometerKm: true,
        },
        orderBy: { registrationNumber: 'asc' },
        take: 50,
      }),
      vehicleIds.length === 0
        ? Promise.resolve([])
        : this.prisma.costEntry.findMany({
            where: { tenantId: row.tenantId, vehicleId: { in: vehicleIds } },
            select: {
              incurredOn: true,
              category: true,
              notes: true,
              vehicleId: true,
              vehicle: { select: { registrationNumber: true } },
            },
            orderBy: { incurredOn: 'desc' },
            take: RECENT_ACTIVITY_LIMIT,
          }),
      vehicleIds.length === 0
        ? Promise.resolve([])
        : this.prisma.trip.findMany({
            where: { tenantId: row.tenantId, vehicleId: { in: vehicleIds } },
            select: {
              startedAt: true,
              purpose: true,
              vehicleId: true,
              vehicle: { select: { registrationNumber: true } },
            },
            orderBy: { startedAt: 'desc' },
            take: RECENT_ACTIVITY_LIMIT,
          }),
      vehicleIds.length === 0
        ? Promise.resolve([])
        : this.prisma.maintenanceEntry.findMany({
            where: { tenantId: row.tenantId, vehicleId: { in: vehicleIds } },
            select: {
              performedAt: true,
              title: true,
              vehicleId: true,
              vehicle: { select: { registrationNumber: true } },
            },
            orderBy: { performedAt: 'desc' },
            take: RECENT_ACTIVITY_LIMIT,
          }),
    ]);

    const remindersActionCount = await this.countReminderActionsForClient(row.tenantId, id);

    const recentActivity: ClientSummaryActivityRow[] = [
      ...tripRows.map((r) => ({
        at: r.startedAt.toISOString(),
        kind: 'trip' as const,
        label: r.purpose ? String(r.purpose) : 'Cursă',
        vehicleId: r.vehicleId,
        registrationNumber: r.vehicle.registrationNumber,
      })),
      ...costRows.map((r) => ({
        at: r.incurredOn.toISOString(),
        kind: 'cost' as const,
        label: r.notes?.trim() || r.category || 'Cost',
        vehicleId: r.vehicleId,
        registrationNumber: r.vehicle.registrationNumber,
      })),
      ...maintenanceRows.map((r) => ({
        at: (r.performedAt ?? new Date(0)).toISOString(),
        kind: 'maintenance' as const,
        label: r.title?.trim() || 'Mentenanță',
        vehicleId: r.vehicleId,
        registrationNumber: r.vehicle.registrationNumber,
      })),
    ]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, RECENT_ACTIVITY_LIMIT);

    const subscriptions = await this.subscriptions.listForClient(tenantSlug, id);
    const drivers = await this.drivers.listForClient(tenantSlug, id);

    return {
      client,
      kpis: {
        vehiclesActive,
        vehiclesTotal,
        remindersActionCount,
        costsMonthCents: costsAgg._sum.amountCents ?? 0,
        tripsMonthCount,
        itpWithin30Days,
      },
      vehicles: vehicleRows,
      recentActivity,
      subscriptions,
      drivers,
    };
  }

  async exportCsv(
    tenantSlug: string,
    params: { q?: string; status?: ClientStatus },
  ): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) return 'code,legalName,taxId,contactEmail,contactPhone,addressLine,tradeRegister,status,vehicleCount,notes';

    const where = this.listWhere(tenant.id, {
      page: 1,
      pageSize: MAX_PAGE_SIZE,
      q: params.q,
      status: params.status,
    });

    const rows = await this.prisma.client.findMany({
      where,
      orderBy: [{ code: 'asc' }],
      include: { _count: { select: { vehicles: true } } },
    });

    const header =
      'code,legalName,taxId,contactEmail,contactPhone,addressLine,tradeRegister,status,vehicleCount,notes';
    const lines = rows.map((r) =>
      [
        r.code,
        r.legalName,
        r.taxId ?? '',
        r.contactEmail ?? '',
        r.contactPhone ?? '',
        r.addressLine ?? '',
        r.tradeRegister ?? '',
        r.status,
        String(r._count.vehicles),
        (r.notes ?? '').replace(/"/g, '""'),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
    return [header, ...lines].join('\n');
  }

  async create(
    tenantSlug: string,
    input: CreateClientInput,
    actorUserId?: string,
  ): Promise<ClientRecord> {
    const tenant = await this.ensureTenant(tenantSlug);
    const code = normalizeCode(input.code);
    const legalName = input.legalName?.trim();
    if (!legalName) throw new BadRequestException('legalName is required');

    const existing = await this.prisma.client.findFirst({
      where: { tenantId: tenant.id, code: { equals: code, mode: 'insensitive' } },
    });
    if (existing) {
      throw new ConflictException(`Client code already exists: ${code}`);
    }

    const row = await this.prisma.client.create({
      data: {
        tenantId: tenant.id,
        code,
        legalName,
        taxId: input.taxId?.trim() || null,
        contactEmail: input.contactEmail?.trim() || null,
        contactPhone: input.contactPhone?.trim() || null,
        addressLine: input.addressLine?.trim() || null,
        tradeRegister: input.tradeRegister?.trim() || null,
        billingNotes: input.billingNotes?.trim() || null,
        status: input.status ?? ClientStatus.active,
        notes: input.notes?.trim() || null,
      },
      include: { _count: { select: { vehicles: true } } },
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'client.create',
      entityType: 'client',
      entityId: row.id,
      meta: { code: row.code },
    });

    return this.toRecord(row, row._count.vehicles);
  }

  async patch(
    tenantSlug: string,
    id: string,
    input: PatchClientInput,
    actorUserId?: string,
  ): Promise<ClientRecord> {
    const tenant = await this.ensureTenant(tenantSlug);
    const before = await this.findRow(tenantSlug, id);

    let code = before.code;
    if (input.code !== undefined) {
      code = normalizeCode(input.code);
      const dup = await this.prisma.client.findFirst({
        where: {
          tenantId: tenant.id,
          code: { equals: code, mode: 'insensitive' },
          NOT: { id },
        },
      });
      if (dup) throw new ConflictException(`Client code already exists: ${code}`);
    }

    const row = await this.prisma.client.update({
      where: { id },
      data: {
        ...(input.code !== undefined ? { code } : {}),
        ...(input.legalName !== undefined
          ? { legalName: input.legalName.trim() || before.legalName }
          : {}),
        ...(input.taxId !== undefined ? { taxId: input.taxId?.trim() || null } : {}),
        ...(input.contactEmail !== undefined
          ? { contactEmail: input.contactEmail?.trim() || null }
          : {}),
        ...(input.contactPhone !== undefined
          ? { contactPhone: input.contactPhone?.trim() || null }
          : {}),
        ...(input.addressLine !== undefined
          ? { addressLine: input.addressLine?.trim() || null }
          : {}),
        ...(input.tradeRegister !== undefined
          ? { tradeRegister: input.tradeRegister?.trim() || null }
          : {}),
        ...(input.billingNotes !== undefined
          ? { billingNotes: input.billingNotes?.trim() || null }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      },
      include: { _count: { select: { vehicles: true } } },
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'client.update',
      entityType: 'client',
      entityId: row.id,
      meta: { code: row.code },
    });

    return this.toRecord(row, row._count.vehicles);
  }

  async getMailSettings(
    tenantSlug: string,
    id: string,
    access?: AccessContext,
  ): Promise<ClientMailSettings & { members: Array<{
    userId: string;
    email: string;
    displayName: string | null;
    role: string;
  }> }> {
    const row = await this.findRow(tenantSlug, id);
    if (access && !access.isTenantWide && !access.allowedClientIds.includes(row.id)) {
      throw new NotFoundException('Client not found');
    }
    const memberships = await this.prisma.clientMembership.findMany({
      where: { clientId: row.id, tenantId: row.tenantId },
      include: { user: { select: { id: true, email: true, displayName: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return {
      ...parseClientMailSettings(row.mailSettings),
      members: memberships.map((m) => ({
        userId: m.userId,
        email: m.user.email,
        displayName: m.user.displayName,
        role: m.role,
      })),
    };
  }

  async patchMailSettings(
    tenantSlug: string,
    id: string,
    body: unknown,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<ClientMailSettings> {
    const row = await this.findRow(tenantSlug, id);
    if (access && !access.isTenantWide && !access.allowedClientIds.includes(row.id)) {
      throw new NotFoundException('Client not found');
    }
    let patch: Partial<ClientMailSettings>;
    try {
      patch = parseClientMailSettingsPatch(body);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Invalid body');
    }

    if (patch.ccMemberUserIds) {
      const memberships = await this.prisma.clientMembership.findMany({
        where: { clientId: row.id, tenantId: row.tenantId, userId: { in: patch.ccMemberUserIds } },
        select: { userId: true },
      });
      const ok = new Set(memberships.map((m) => m.userId));
      patch.ccMemberUserIds = patch.ccMemberUserIds.filter((uid) => ok.has(uid));
    }

    const next: ClientMailSettings = {
      ...parseClientMailSettings(row.mailSettings),
      ...patch,
    };

    await this.prisma.client.update({
      where: { id: row.id },
      data: { mailSettings: next as unknown as Prisma.InputJsonValue },
    });

    await this.audit.log({
      tenantId: row.tenantId,
      actorUserId,
      action: 'client.mail_settings_update',
      entityType: 'client',
      entityId: row.id,
      meta: {
        ccMemberCount: next.ccMemberUserIds.length,
        ccEmailCount: next.ccEmails.length,
      },
    });

    return next;
  }

  async getPricingSettings(
    tenantSlug: string,
    id: string,
    access?: AccessContext,
  ): Promise<ClientPricingSettings> {
    const row = await this.findRow(tenantSlug, id);
    if (access && !access.isTenantWide && !access.allowedClientIds.includes(row.id)) {
      throw new NotFoundException('Client not found');
    }
    return parseClientPricingSettings(row.pricingSettings);
  }

  async patchPricingSettings(
    tenantSlug: string,
    id: string,
    body: unknown,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<ClientPricingSettings> {
    const row = await this.findRow(tenantSlug, id);
    if (access && !access.isTenantWide && !access.allowedClientIds.includes(row.id)) {
      throw new NotFoundException('Client not found');
    }
    let patch: Partial<ClientPricingSettings>;
    try {
      patch = parseClientPricingSettingsPatch(body);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Invalid body');
    }

    const next: ClientPricingSettings = {
      ...parseClientPricingSettings(row.pricingSettings),
      ...patch,
    };

    await this.prisma.client.update({
      where: { id: row.id },
      data: { pricingSettings: next as unknown as Prisma.InputJsonValue },
    });

    await this.audit.log({
      tenantId: row.tenantId,
      actorUserId,
      action: 'client.pricing_settings_update',
      entityType: 'client',
      entityId: row.id,
      meta: { partsPriceSuspectPercent: next.partsPriceSuspectPercent },
    });

    return next;
  }

  async listSupplierAllocations(
    tenantSlug: string,
    clientId: string,
    access?: AccessContext,
  ): Promise<{
    items: Array<{
      supplierId: string;
      code: string;
      legalName: string;
      category: string;
      status: string;
    }>;
  }> {
    const row = await this.findRow(tenantSlug, clientId);
    if (access && !access.isTenantWide && !access.allowedClientIds.includes(row.id)) {
      throw new NotFoundException('Client not found');
    }
    const rows = await this.prisma.clientSupplierAllocation.findMany({
      where: { clientId: row.id },
      include: { supplier: true },
      orderBy: { supplier: { legalName: 'asc' } },
    });
    return {
      items: rows.map((a) => ({
        supplierId: a.supplierId,
        code: a.supplier.code,
        legalName: a.supplier.legalName,
        category: a.supplier.category,
        status: a.supplier.status,
      })),
    };
  }

  async replaceSupplierAllocations(
    tenantSlug: string,
    clientId: string,
    supplierIds: string[],
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<{
    items: Array<{
      supplierId: string;
      code: string;
      legalName: string;
      category: string;
      status: string;
    }>;
  }> {
    if (access && !access.isTenantWide) {
      throw new ForbiddenException('Only tenant admin can allocate suppliers');
    }
    const row = await this.findRow(tenantSlug, clientId);
    const unique = [...new Set(supplierIds.map((id) => id.trim()).filter(Boolean))];
    if (unique.length) {
      const found = await this.prisma.supplier.findMany({
        where: { id: { in: unique }, tenantId: row.tenantId },
        select: { id: true },
      });
      if (found.length !== unique.length) {
        throw new BadRequestException('One or more suppliers are invalid');
      }
    }

    const existing = await this.prisma.clientSupplierAllocation.findMany({
      where: { clientId: row.id },
      select: { supplierId: true },
    });
    const have = new Set(existing.map((e) => e.supplierId));
    const want = new Set(unique);
    const toRemove = [...have].filter((id) => !want.has(id));
    const toAdd = [...want].filter((id) => !have.has(id));

    await this.prisma.$transaction(async (tx) => {
      if (toRemove.length) {
        await tx.clientSupplierAllocation.deleteMany({
          where: { clientId: row.id, supplierId: { in: toRemove } },
        });
      }
      if (toAdd.length) {
        await tx.clientSupplierAllocation.createMany({
          data: toAdd.map((supplierId) => ({
            tenantId: row.tenantId,
            clientId: row.id,
            supplierId,
          })),
        });
      }
    });

    await this.audit.log({
      tenantId: row.tenantId,
      actorUserId,
      action: 'client.supplier_allocations_update',
      entityType: 'client',
      entityId: row.id,
      meta: { supplierIds: unique },
    });

    return this.listSupplierAllocations(tenantSlug, clientId, access);
  }

  async listClientAllocationsForSupplier(
    tenantSlug: string,
    supplierId: string,
    access?: AccessContext,
  ): Promise<{
    items: Array<{ clientId: string; code: string; legalName: string; status: string }>;
  }> {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, tenant: { slug: tenantSlug } },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    if (access && !access.isTenantWide) {
      throw new ForbiddenException('Only tenant team can list client allocations');
    }
    const rows = await this.prisma.clientSupplierAllocation.findMany({
      where: { supplierId: supplier.id },
      include: { client: true },
      orderBy: { client: { legalName: 'asc' } },
    });
    return {
      items: rows.map((a) => ({
        clientId: a.clientId,
        code: a.client.code,
        legalName: a.client.legalName,
        status: a.client.status,
      })),
    };
  }

  async replaceClientAllocationsForSupplier(
    tenantSlug: string,
    supplierId: string,
    clientIds: string[],
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<{
    items: Array<{ clientId: string; code: string; legalName: string; status: string }>;
  }> {
    if (access && !access.isTenantWide) {
      throw new ForbiddenException('Only tenant admin can allocate suppliers');
    }
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, tenant: { slug: tenantSlug } },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    const unique = [...new Set(clientIds.map((id) => id.trim()).filter(Boolean))];
    if (unique.length) {
      const found = await this.prisma.client.findMany({
        where: { id: { in: unique }, tenantId: supplier.tenantId },
        select: { id: true },
      });
      if (found.length !== unique.length) {
        throw new BadRequestException('One or more clients are invalid');
      }
    }

    const existing = await this.prisma.clientSupplierAllocation.findMany({
      where: { supplierId: supplier.id },
      select: { clientId: true },
    });
    const have = new Set(existing.map((e) => e.clientId));
    const want = new Set(unique);
    const toRemove = [...have].filter((id) => !want.has(id));
    const toAdd = [...want].filter((id) => !have.has(id));

    await this.prisma.$transaction(async (tx) => {
      if (toRemove.length) {
        await tx.clientSupplierAllocation.deleteMany({
          where: { supplierId: supplier.id, clientId: { in: toRemove } },
        });
      }
      if (toAdd.length) {
        await tx.clientSupplierAllocation.createMany({
          data: toAdd.map((clientId) => ({
            tenantId: supplier.tenantId,
            clientId,
            supplierId: supplier.id,
          })),
        });
      }
    });

    await this.audit.log({
      tenantId: supplier.tenantId,
      actorUserId,
      action: 'supplier.client_allocations_update',
      entityType: 'supplier',
      entityId: supplier.id,
      meta: { clientIds: unique },
    });

    return this.listClientAllocationsForSupplier(tenantSlug, supplierId, access);
  }

  async delete(tenantSlug: string, id: string, actorUserId?: string): Promise<void> {
    const tenant = await this.ensureTenant(tenantSlug);
    const row = await this.findRow(tenantSlug, id);
    const vehicles = await this.prisma.vehicle.count({ where: { clientId: id } });
    if (vehicles > 0) {
      throw new BadRequestException(
        `Client has ${vehicles} vehicle(s). Reassign vehicles before delete.`,
      );
    }

    await this.prisma.client.delete({ where: { id: row.id } });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'client.delete',
      entityType: 'client',
      entityId: row.id,
      meta: { code: row.code },
    });
  }

  /** For FleetService — resolve API clientId (code or id) to FK. */
  resolveForVehicle(tenantUuid: string, clientInput: string) {
    return resolveClientInTenant(this.prisma, tenantUuid, clientInput);
  }

  private listWhere(
    tenantUuid: string,
    params: ClientListParams,
    access?: AccessContext,
  ): Prisma.ClientWhereInput {
    const parts: Prisma.ClientWhereInput[] = [{ tenantId: tenantUuid }];
    if (access) {
      parts.push(clientIdsFilter(access));
    }
    if (params.status) {
      parts.push({ status: params.status });
    }
    const q = params.q?.trim();
    if (q) {
      parts.push({
        OR: [
          { code: { contains: q, mode: 'insensitive' } },
          { legalName: { contains: q, mode: 'insensitive' } },
          { taxId: { contains: q, mode: 'insensitive' } },
          { contactEmail: { contains: q, mode: 'insensitive' } },
        ],
      });
    }
    return { AND: parts };
  }

  private async findRow(tenantSlug: string, id: string) {
    const row = await this.prisma.client.findFirst({
      where: { id, tenant: { slug: tenantSlug } },
    });
    if (!row) throw new NotFoundException('Client not found');
    return row;
  }

  private async ensureTenant(slug: string) {
    return this.prisma.tenant.upsert({
      where: { slug },
      create: { slug, name: slug },
      update: { name: slug },
    });
  }

  private toRecord(
    row: {
      id: string;
      code: string;
      legalName: string;
      taxId: string | null;
      contactEmail?: string | null;
      contactPhone?: string | null;
      addressLine?: string | null;
      tradeRegister?: string | null;
      billingNotes?: string | null;
      status: ClientStatus;
      notes: string | null;
      createdAt: Date;
      updatedAt: Date;
    },
    vehicleCount: number,
    extras?: { remindersActionCount?: number; itpWithin30Days?: number },
  ): ClientRecord {
    const remindersActionCount = extras?.remindersActionCount ?? 0;
    const itpWithin30Days = extras?.itpWithin30Days ?? 0;
    return {
      id: row.id,
      code: row.code,
      legalName: row.legalName,
      taxId: row.taxId,
      contactEmail: row.contactEmail ?? null,
      contactPhone: row.contactPhone ?? null,
      addressLine: row.addressLine ?? null,
      tradeRegister: row.tradeRegister ?? null,
      billingNotes: row.billingNotes ?? null,
      status: row.status,
      notes: row.notes,
      vehicleCount,
      remindersActionCount,
      itpWithin30Days,
      healthLabel: healthLabel(remindersActionCount, itpWithin30Days),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async computeHealthForClients(
    tenantId: string,
    clientIds: string[],
  ): Promise<{
    remindersByClient: Map<string, number>;
    itpByClient: Map<string, number>;
  }> {
    const remindersByClient = new Map<string, number>();
    const itpByClient = new Map<string, number>();
    if (clientIds.length === 0) {
      return { remindersByClient, itpByClient };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in30 = addDays(today, 30);

    const [itpGroups, reminderCounts] = await Promise.all([
      this.prisma.vehicle.groupBy({
        by: ['clientId'],
        where: {
          tenantId,
          clientId: { in: clientIds },
          status: VehicleStatus.active,
          itpExpiresOn: { gte: today, lte: in30 },
        },
        _count: { _all: true },
      }),
      this.countReminderActionsByClients(tenantId, clientIds),
    ]);

    for (const g of itpGroups) {
      itpByClient.set(g.clientId, g._count._all);
    }
    for (const [clientId, count] of reminderCounts) {
      remindersByClient.set(clientId, count);
    }

    return { remindersByClient, itpByClient };
  }

  private async countReminderActionsForClient(
    tenantId: string,
    clientId: string,
  ): Promise<number> {
    const map = await this.countReminderActionsByClients(tenantId, [clientId]);
    return map.get(clientId) ?? 0;
  }

  private async countReminderActionsByClients(
    tenantId: string,
    clientIds: string[],
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    for (const id of clientIds) counts.set(id, 0);
    if (clientIds.length === 0) return counts;

    const vehicles = await this.prisma.vehicle.findMany({
      where: { tenantId, clientId: { in: clientIds } },
      select: { id: true, clientId: true, odometerKm: true },
    });
    if (vehicles.length === 0) return counts;

    const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
    const vehicleIds = vehicles.map((v) => v.id);

    const reminderRows = await this.prisma.reminderAction.findMany({
      where: { tenantId, isActive: true, vehicleId: { in: vehicleIds } },
      include: reminderInclude,
      take: REMINDER_SCAN_LIMIT,
    });

    for (const row of reminderRows) {
      const vehicle = vehicleById.get(row.vehicleId);
      if (!vehicle) continue;
      const summary = computeReminderActionSummary(
        {
          isActive: row.isActive,
          dueOn: row.dueOn,
          reminderOffsetsDays: normalizeReminderOffsets(row.reminderOffsetsDays),
          dueOdometerKm: row.dueOdometerKm,
          reminderOffsetsKm: normalizeReminderOffsetsKm(row.reminderOffsetsKm),
        },
        vehicle.odometerKm,
      );
      if (matchesActionReminderFilter(summary, 'action')) {
        counts.set(vehicle.clientId, (counts.get(vehicle.clientId) ?? 0) + 1);
      }
    }

    return counts;
  }
}
