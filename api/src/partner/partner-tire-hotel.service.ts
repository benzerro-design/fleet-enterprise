import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, VehicleTireSeason } from '@prisma/client';
import {
  CrmTicketEventKind,
  CrmTicketPriority,
  CrmTicketRoutingLevel,
  CrmTicketStatus,
  CrmTicketType,
  TireCustodyProtocolKind,
  TireGestiuneOp,
} from '@prisma/client';
import type { AccessContext } from '../iam/access-context.types';
import {
  assertPartnerWrite,
  isPartnerUser,
  resolvePartnerSupplierIdsFilter,
} from '../iam/partner-access';
import { parseCsv, rowToObject } from '../imports/csv-parse';
import { TireCustodyProtocolService } from '../fleet/tires/tire-custody-protocol.service';
import { TireDomainService } from '../fleet/tires/tire-domain.service';
import { buildTireStayCostPrintableSummary } from '../fleet/tires/tire-hotel-stay-cost';
import { TireHotelService, tireSetQrPayload } from '../fleet/tires/tire-hotel.service';
import { escapeCsvCell } from '../ops/ops-csv';
import { parseIntakeInspectionBody } from '../fleet/tires/tire-intake-inspection';
import { parseTireSetSearchInput } from '../fleet/tires/tire-domain.types';
import { PrismaService } from '../prisma/prisma.service';
import { assertSupplierReadById } from '../suppliers/supplier-access';
import {
  assertSupplierTireStorage,
  ensureTireStorageServiceType,
  supplierHasTireStorage,
  TIRE_HOTEL_SERVICE_CODE_ALIASES,
} from '../suppliers/supplier-tire-capability';
import {
  defaultGestiuneSubject,
  displayTicketShortId,
  mapTireRequestKind,
  parseTireGestiuneOp,
  TIRE_REQUEST_SERVICE_CODES,
  tireRequestKindLabel,
} from './tire-gestiune-request';

function normalizePlate(raw: string | undefined): string | undefined {
  const p = raw?.trim().replace(/\s+/g, '').toUpperCase();
  return p || undefined;
}

@Injectable()
export class PartnerTireHotelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hotel: TireHotelService,
    private readonly custody: TireCustodyProtocolService,
    private readonly tireDomain: TireDomainService,
  ) {}

  async capability(tenantSlug: string, access: AccessContext, supplierId?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const supplierIds = resolvePartnerSupplierIdsFilter(
      access,
      supplierId ? [supplierId] : undefined,
    );
    const sid = supplierIds?.length === 1 ? supplierIds[0]! : supplierId?.trim();
    if (!sid) {
      return { hasTireStorage: false, supplierId: null as string | null, supplierName: null as string | null };
    }
    await assertSupplierReadById(this.prisma, tenantSlug, sid, access);
    const hasTireStorage = await supplierHasTireStorage(this.prisma, tenant.id, sid);
    if (hasTireStorage) {
      // Normalize: ensure canonical tire_storage offering for fee/UI consumers.
      const canonical = await ensureTireStorageServiceType(this.prisma, tenant.id);
      const linked = await this.prisma.supplierService.findFirst({
        where: { tenantId: tenant.id, supplierId: sid, serviceTypeId: canonical.id },
        select: { id: true },
      });
      if (!linked) {
        await this.prisma.supplierService.create({
          data: {
            tenantId: tenant.id,
            supplierId: sid,
            serviceTypeId: canonical.id,
          },
        });
      }
    }
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: sid, tenantId: tenant.id },
      select: { legalName: true },
    });
    const peerOfferings = await this.prisma.supplierService.findMany({
      where: {
        tenantId: tenant.id,
        supplierId: { not: sid },
        serviceType: {
          code: { in: [...TIRE_HOTEL_SERVICE_CODE_ALIASES] },
        },
      },
      select: {
        supplierId: true,
        supplier: { select: { id: true, legalName: true } },
      },
      distinct: ['supplierId'],
      take: 100,
    });
    const transferTargets = peerOfferings
      .map((o) => ({
        id: o.supplier.id,
        legalName: o.supplier.legalName?.trim() || o.supplierId,
      }))
      .sort((a, b) => a.legalName.localeCompare(b.legalName, 'ro'));
    return {
      hasTireStorage,
      supplierId: sid,
      supplierName: supplier?.legalName ?? null,
      transferTargets,
    };
  }

  private async resolveSupplier(
    tenantSlug: string,
    access: AccessContext,
    supplierId?: string,
  ): Promise<{ tenantId: string; supplierId: string }> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const ids = resolvePartnerSupplierIdsFilter(access, supplierId ? [supplierId] : undefined);
    const sid = ids?.length === 1 ? ids[0]! : supplierId?.trim();
    if (!sid) {
      throw new BadRequestException('supplierId is required');
    }
    await assertSupplierReadById(this.prisma, tenantSlug, sid, access);
    await assertSupplierTireStorage(this.prisma, tenant.id, sid);
    return { tenantId: tenant.id, supplierId: sid };
  }

  /**
   * Resolve one supplier (write) or many (admin/multi read).
   * Admin without filter → all tenant suppliers with tire_storage (null supplierIds = unrestricted).
   */
  private async resolveSupplierScope(
    tenantSlug: string,
    access: AccessContext,
    supplierId?: string,
    opts?: { allowTenantWide?: boolean; supplierIds?: string[] },
  ): Promise<{ tenantId: string; supplierIds: string[] | null }> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    const explicit =
      opts?.supplierIds?.length
        ? opts.supplierIds
        : supplierId?.trim()
          ? [supplierId.trim()]
          : undefined;
    const ids = resolvePartnerSupplierIdsFilter(access, explicit);
    if (ids && ids.length > 0) {
      for (const sid of ids) {
        await assertSupplierReadById(this.prisma, tenantSlug, sid, access);
      }
      return { tenantId: tenant.id, supplierIds: ids };
    }
    if (explicit?.length) {
      for (const sid of explicit) {
        await assertSupplierReadById(this.prisma, tenantSlug, sid, access);
      }
      return { tenantId: tenant.id, supplierIds: explicit };
    }
    if (opts?.allowTenantWide && !isPartnerUser(access)) {
      return { tenantId: tenant.id, supplierIds: null };
    }
    throw new BadRequestException('supplierId is required');
  }

  private async tireRequestScopeFilter(
    tenantId: string,
    supplierIds: string[] | null,
  ): Promise<{
    where: Prisma.CrmTicketWhereInput;
    allocByClient: Map<string, { supplierId: string; supplierName: string | null }>;
  }> {
    const allocRows = await this.prisma.clientSupplierAllocation.findMany({
      where: {
        tenantId,
        ...(supplierIds ? { supplierId: { in: supplierIds } } : {}),
      },
      select: {
        clientId: true,
        supplierId: true,
        supplier: { select: { legalName: true } },
      },
    });
    const allocByClient = new Map<string, { supplierId: string; supplierName: string | null }>();
    for (const a of allocRows) {
      if (!allocByClient.has(a.clientId)) {
        allocByClient.set(a.clientId, {
          supplierId: a.supplierId,
          supplierName: a.supplier.legalName ?? null,
        });
      }
    }
    const clientIds = [...allocByClient.keys()];

    const inboxShape: Prisma.CrmTicketWhereInput = {
      OR: [
        { gestiuneOp: { not: null } },
        { serviceType: { code: { in: [...TIRE_REQUEST_SERVICE_CODES] } } },
      ],
    };

    let scopeClause: Prisma.CrmTicketWhereInput;
    if (supplierIds) {
      scopeClause = {
        OR: [
          { assignedSupplierId: { in: supplierIds } },
          ...(clientIds.length
            ? [{ assignedSupplierId: null, clientId: { in: clientIds } }]
            : []),
        ],
      };
    } else {
      scopeClause = clientIds.length
        ? {
            OR: [
              { assignedSupplierId: { not: null } },
              { clientId: { in: clientIds } },
            ],
          }
        : { assignedSupplierId: { not: null } };
    }

    return {
      where: {
        tenantId,
        status: { in: [CrmTicketStatus.open, CrmTicketStatus.in_progress] },
        AND: [inboxShape, scopeClause],
      },
      allocByClient,
    };
  }

  private mapTireRequestRow(
    t: {
      id: string;
      subject: string;
      status: string;
      priority: string;
      createdAt: Date;
      description: string | null;
      clientId: string;
      vehicleId: string | null;
      gestiuneOp: TireGestiuneOp | null;
      assignedSupplierId: string | null;
      serviceType: { code: string; label: string } | null;
      vehicle: { id: string; registrationNumber: string } | null;
      client: { id: string; legalName: string } | null;
      assignedSupplier: { id: string; legalName: string } | null;
      links: Array<{ entityId: string }>;
    },
    allocByClient: Map<string, { supplierId: string; supplierName: string | null }>,
    fallbackSupplierId: string | null,
  ) {
    const kind = mapTireRequestKind({
      gestiuneOp: t.gestiuneOp,
      serviceCode: t.serviceType?.code ?? null,
    });
    const matchedSupplierId =
      t.assignedSupplierId ??
      allocByClient.get(t.clientId)?.supplierId ??
      fallbackSupplierId;
    const supplierName =
      t.assignedSupplier?.legalName ??
      allocByClient.get(t.clientId)?.supplierName ??
      null;
    return {
      id: t.id,
      displayId: displayTicketShortId(t.id),
      subject: t.subject,
      description: t.description,
      status: t.status,
      priority: t.priority,
      createdAt: t.createdAt.toISOString(),
      kind,
      kindLabel: tireRequestKindLabel(kind, t.serviceType?.label),
      gestiuneOp: t.gestiuneOp,
      serviceCode: t.serviceType?.code ?? null,
      serviceLabel: t.serviceType?.label ?? null,
      plate: t.vehicle?.registrationNumber ?? null,
      vehicleId: t.vehicleId,
      clientId: t.clientId,
      clientName: t.client?.legalName ?? null,
      supplierId: matchedSupplierId,
      supplierName,
      stayIds: t.links.map((l) => l.entityId),
      hrefHotel: buildPartnerHotelCheckInHref({
        supplierId: matchedSupplierId,
        plate: t.vehicle?.registrationNumber ?? null,
        ticketId: t.id,
      }),
      hrefTicket: buildPartnerTireRequestHref({
        ticketId: t.id,
        supplierId: matchedSupplierId,
      }),
      hrefWorkOrders: matchedSupplierId
        ? `/fleet/partner/work-orders?supplierId=${encodeURIComponent(matchedSupplierId)}`
        : '/fleet/partner/work-orders',
    };
  }

  private tireRequestSelect() {
    return {
      id: true,
      subject: true,
      description: true,
      status: true,
      priority: true,
      createdAt: true,
      clientId: true,
      vehicleId: true,
      gestiuneOp: true,
      assignedSupplierId: true,
      serviceType: { select: { code: true, label: true } },
      vehicle: { select: { id: true, registrationNumber: true } },
      client: { select: { id: true, legalName: true } },
      assignedSupplier: { select: { id: true, legalName: true } },
      links: {
        where: { entityType: 'tire_storage_stay' as const },
        select: { entityId: true },
        take: 3,
      },
    } satisfies Prisma.CrmTicketSelect;
  }

  async listActiveStays(
    tenantSlug: string,
    access: AccessContext,
    opts: {
      supplierId?: string;
      plate?: string;
      /** active (default) | closed | all */
      status?: string;
      take?: number;
      skip?: number;
      /** When true and multiple suppliers in scope, allow aggregated read. */
      overview?: boolean;
    },
  ) {
    const searchRaw = opts.plate?.trim() ?? '';
    const parsed = searchRaw ? parseTireSetSearchInput(searchRaw) : null;
    const plate = parsed?.kind === 'plate' ? normalizePlate(parsed.plate) : undefined;
    const setId = parsed?.kind === 'setId' ? parsed.setId : undefined;
    const status = (opts.status ?? 'active').trim().toLowerCase();
    const checkOutFilter =
      status === 'closed'
        ? { checkOutAt: { not: null } }
        : status === 'all'
          ? {}
          : { checkOutAt: null };
    const take = Math.min(Math.max(opts.take ?? (status === 'active' ? 50 : 100), 1), 500);
    const skip = Math.max(opts.skip ?? 0, 0);

    let tenantId: string;
    let supplierFilter: string | { in: string[] } | undefined;
    let isOverview = false;

    if (opts.overview) {
      const scope = await this.resolveSupplierScope(tenantSlug, access, opts.supplierId, {
        allowTenantWide: true,
      });
      tenantId = scope.tenantId;
      isOverview = true;
      if (scope.supplierIds == null) {
        supplierFilter = undefined;
      } else if (scope.supplierIds.length === 1) {
        supplierFilter = scope.supplierIds[0];
      } else {
        supplierFilter = { in: scope.supplierIds };
      }
    } else {
      const single = await this.resolveSupplier(tenantSlug, access, opts.supplierId);
      tenantId = single.tenantId;
      supplierFilter = single.supplierId;
    }

    const where = {
      tenantId,
      ...(supplierFilter ? { supplierId: supplierFilter } : {}),
      ...checkOutFilter,
      ...(setId ? { setId } : {}),
      ...(plate && !setId
        ? {
            set: {
              vehicle: {
                registrationNumber: { contains: plate, mode: 'insensitive' as const },
              },
            },
          }
        : {}),
    };

    const [total, stays] = await Promise.all([
      this.prisma.tireStorageStay.count({ where }),
      this.prisma.tireStorageStay.findMany({
        where,
        orderBy: [{ checkInAt: 'desc' }],
        skip,
        take,
        include: {
        supplier: { select: { id: true, legalName: true } },
        set: {
          include: {
            vehicle: { select: { id: true, registrationNumber: true, clientId: true } },
            items: {
              orderBy: { sortOrder: 'asc' },
              include: {
                asset: {
                  select: {
                    id: true,
                    brand: true,
                    model: true,
                    size: true,
                    dot: true,
                    treadMm: true,
                    serialOrQr: true,
                  },
                },
              },
            },
          },
        },
      },
      }),
    ]);

    const protocolMap = await this.custody.summariesForStays(
      tenantId,
      stays.map((s) => s.id),
    );

    const costIds = await this.prisma.costEntry.findMany({
      where: {
        tenantId,
        tireStorageStayId: { in: stays.map((s) => s.id) },
      },
      select: { id: true, tireStorageStayId: true, amountCents: true },
    });
    const costByStay = new Map(
      costIds.map((c) => [c.tireStorageStayId!, { id: c.id, amountCents: c.amountCents }]),
    );

    return {
      status: status === 'closed' || status === 'all' ? status : 'active',
      overview: isOverview,
      skip,
      take,
      total,
      items: stays.map((s) => ({
        ...this.hotel.stayToDto(s, {
          season: s.set.season,
          name: s.set.name,
          mountedAs: s.set.mountedAs,
          warrantyCertificateUrl: s.set.warrantyCertificateUrl,
          purchaseDocs: s.set.purchaseDocs,
          vehicle: s.set.vehicle,
          items: s.set.items,
        }),
        supplierName: s.supplier.legalName,
        protocols: protocolMap.get(s.id) ?? [],
        costEntryId: costByStay.get(s.id)?.id ?? null,
        costAmountCents: costByStay.get(s.id)?.amountCents ?? null,
      })),
    };
  }

  async listTireRequests(
    tenantSlug: string,
    access: AccessContext,
    opts: { supplierId?: string; supplierIds?: string[]; take?: number },
  ) {
    const scope = await this.resolveSupplierScope(tenantSlug, access, opts.supplierId, {
      allowTenantWide: true,
      supplierIds: opts.supplierIds,
    });
    const take = Math.min(Math.max(opts.take ?? 50, 1), 200);
    const { where, allocByClient } = await this.tireRequestScopeFilter(
      scope.tenantId,
      scope.supplierIds,
    );
    const tickets = await this.prisma.crmTicket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      select: this.tireRequestSelect(),
    });
    const fallback = scope.supplierIds?.[0] ?? null;
    return {
      items: tickets.map((t) => this.mapTireRequestRow(t, allocByClient, fallback)),
    };
  }

  async getTireRequest(
    tenantSlug: string,
    access: AccessContext,
    ticketId: string,
    opts: { supplierId?: string; supplierIds?: string[] } = {},
  ) {
    const id = ticketId.trim();
    if (!id) throw new BadRequestException('ticketId is required');
    const scope = await this.resolveSupplierScope(tenantSlug, access, opts.supplierId, {
      allowTenantWide: true,
      supplierIds: opts.supplierIds,
    });
    const { where, allocByClient } = await this.tireRequestScopeFilter(
      scope.tenantId,
      scope.supplierIds,
    );
    const t = await this.prisma.crmTicket.findFirst({
      where: { ...where, id, status: undefined },
      select: this.tireRequestSelect(),
    });
    if (!t) throw new NotFoundException('Tire request not found for this partner scope');
    return {
      item: this.mapTireRequestRow(t, allocByClient, scope.supplierIds?.[0] ?? null),
    };
  }

  /** Clients + vehicles for creating a gestiune request in partner scope. */
  async listRequestCreateMeta(
    tenantSlug: string,
    access: AccessContext,
    opts: { supplierId?: string; supplierIds?: string[] } = {},
  ) {
    const scope = await this.resolveSupplierScope(tenantSlug, access, opts.supplierId, {
      allowTenantWide: true,
      supplierIds: opts.supplierIds,
    });
    const supplierIds = scope.supplierIds;
    const allocs = await this.prisma.clientSupplierAllocation.findMany({
      where: {
        tenantId: scope.tenantId,
        ...(supplierIds ? { supplierId: { in: supplierIds } } : {}),
      },
      select: {
        clientId: true,
        supplierId: true,
        client: { select: { id: true, legalName: true, code: true } },
        supplier: { select: { id: true, legalName: true } },
      },
      orderBy: { client: { legalName: 'asc' } },
      take: 300,
    });
    const clientIds = [...new Set(allocs.map((a) => a.clientId))];
    const vehicles =
      clientIds.length === 0
        ? []
        : await this.prisma.vehicle.findMany({
            where: {
              tenantId: scope.tenantId,
              clientId: { in: clientIds },
              status: 'active',
            },
            select: { id: true, clientId: true, registrationNumber: true },
            orderBy: { registrationNumber: 'asc' },
            take: 1000,
          });
    const vehiclesByClient = new Map<string, Array<{ id: string; plate: string }>>();
    for (const v of vehicles) {
      const list = vehiclesByClient.get(v.clientId) ?? [];
      list.push({ id: v.id, plate: v.registrationNumber });
      vehiclesByClient.set(v.clientId, list);
    }
    const clientsMap = new Map<
      string,
      {
        id: string;
        legalName: string;
        code: string;
        supplierId: string;
        supplierName: string;
        vehicles: Array<{ id: string; plate: string }>;
      }
    >();
    for (const a of allocs) {
      if (clientsMap.has(a.clientId)) continue;
      clientsMap.set(a.clientId, {
        id: a.client.id,
        legalName: a.client.legalName,
        code: a.client.code,
        supplierId: a.supplierId,
        supplierName: a.supplier.legalName,
        vehicles: vehiclesByClient.get(a.clientId) ?? [],
      });
    }
    return {
      clients: [...clientsMap.values()],
      gestiuneOps: [
        { code: TireGestiuneOp.cazare, label: 'Cazare' },
        { code: TireGestiuneOp.eliberare, label: 'Eliberare' },
        { code: TireGestiuneOp.transfer, label: 'Transfer' },
        { code: TireGestiuneOp.casare, label: 'Casare' },
      ],
    };
  }

  async createTireRequest(
    tenantSlug: string,
    access: AccessContext,
    body: unknown,
    actorUserId?: string,
  ) {
    assertPartnerWrite(access);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException('Body must be an object');
    }
    const o = body as Record<string, unknown>;
    const gestiuneOp = parseTireGestiuneOp(o.gestiuneOp ?? o.op);
    if (!gestiuneOp) {
      throw new BadRequestException('gestiuneOp must be cazare|eliberare|transfer|casare');
    }
    const clientId = typeof o.clientId === 'string' ? o.clientId.trim() : '';
    if (!clientId) throw new BadRequestException('clientId is required');
    const notes =
      typeof o.notes === 'string'
        ? o.notes.trim()
        : typeof o.description === 'string'
          ? o.description.trim()
          : '';
    const walkIn = o.walkIn === true || o.unconfirmed === true;
    const setId = typeof o.setId === 'string' ? o.setId.trim() : '';

    const scope = await this.resolveSupplier(
      tenantSlug,
      access,
      typeof o.supplierId === 'string' ? o.supplierId : undefined,
    );

    const alloc = await this.prisma.clientSupplierAllocation.findFirst({
      where: {
        tenantId: scope.tenantId,
        clientId,
        supplierId: scope.supplierId,
      },
      select: { id: true },
    });
    if (!alloc) {
      throw new ForbiddenException('Client is not allocated to this supplier');
    }

    let vehicleId: string | null =
      typeof o.vehicleId === 'string' && o.vehicleId.trim() ? o.vehicleId.trim() : null;
    const plateHint = normalizePlate(
      typeof o.plate === 'string' ? o.plate : typeof o.registrationNumber === 'string' ? o.registrationNumber : undefined,
    );
    if (vehicleId) {
      const vehicle = await this.prisma.vehicle.findFirst({
        where: { id: vehicleId, tenantId: scope.tenantId, clientId },
        select: { id: true, registrationNumber: true },
      });
      if (!vehicle) throw new BadRequestException('vehicleId not found for client');
    } else if (plateHint) {
      const vehicle = await this.prisma.vehicle.findFirst({
        where: {
          tenantId: scope.tenantId,
          clientId,
          registrationNumber: { equals: plateHint, mode: 'insensitive' },
        },
        select: { id: true, registrationNumber: true },
      });
      vehicleId = vehicle?.id ?? null;
    }

    let plate: string | null = plateHint ?? null;
    if (vehicleId) {
      const v = await this.prisma.vehicle.findFirst({
        where: { id: vehicleId },
        select: { registrationNumber: true },
      });
      plate = v?.registrationNumber ?? plate;
    }

    if (setId) {
      const set = await this.prisma.tireSet.findFirst({
        where: { id: setId, tenantId: scope.tenantId, clientId },
        select: { id: true },
      });
      if (!set) throw new BadRequestException('setId not found for client');
    }

    const serviceType = await ensureTireStorageServiceType(this.prisma, scope.tenantId);
    const subject =
      (typeof o.subject === 'string' && o.subject.trim()) ||
      defaultGestiuneSubject(gestiuneOp, plate);

    const row = await this.prisma.crmTicket.create({
      data: {
        tenantId: scope.tenantId,
        clientId,
        ticketType: CrmTicketType.maintenance,
        serviceTypeId: serviceType.id,
        subject,
        description: notes || null,
        status: CrmTicketStatus.open,
        priority: CrmTicketPriority.normal,
        routingLevel: CrmTicketRoutingLevel.L1,
        assignedQueue: `client:${clientId}`,
        vehicleId,
        assignedSupplierId: scope.supplierId,
        gestiuneOp,
        createdByUserId: actorUserId ?? null,
        ownerUserId: actorUserId ?? null,
      },
      select: this.tireRequestSelect(),
    });

    await this.prisma.crmTicketEvent.create({
      data: {
        tenantId: scope.tenantId,
        ticketId: row.id,
        kind: CrmTicketEventKind.status,
        body: walkIn
          ? 'Solicitare gestiune creată de partener (client neanunțat — de confirmat la PV)'
          : 'Solicitare gestiune creată',
        actorUserId: actorUserId ?? null,
        payload: {
          status: 'open',
          gestiuneOp,
          assignedSupplierId: scope.supplierId,
          walkIn,
          custodyUnconfirmed: walkIn,
          setId: setId || null,
          source: 'partner_tire_request',
        },
      },
    });

    const { allocByClient } = await this.tireRequestScopeFilter(scope.tenantId, [
      scope.supplierId,
    ]);
    return {
      item: this.mapTireRequestRow(row, allocByClient, scope.supplierId),
    };
  }

  async dashboardStats(
    tenantSlug: string,
    access: AccessContext,
    opts: { supplierId?: string },
  ) {
    const scope = await this.resolveSupplierScope(tenantSlug, access, opts.supplierId, {
      allowTenantWide: true,
    });
    const supplierIds = scope.supplierIds;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const supplierWhere = supplierIds ? { supplierId: { in: supplierIds } } : {};

    const [activeStays, draftProtocols, checkInsThisWeek, openRequests] = await Promise.all([
      this.prisma.tireStorageStay.count({
        where: { tenantId: scope.tenantId, ...supplierWhere, checkOutAt: null },
      }),
      this.prisma.tireCustodyProtocol.count({
        where: {
          tenantId: scope.tenantId,
          ...supplierWhere,
          status: 'draft',
        },
      }),
      this.prisma.tireStorageStay.count({
        where: {
          tenantId: scope.tenantId,
          ...supplierWhere,
          checkInAt: { gte: weekAgo },
        },
      }),
      this.tireRequestScopeFilter(scope.tenantId, supplierIds).then(({ where }) =>
        this.prisma.crmTicket.count({ where }),
      ),
    ]);

    return {
      activeStays,
      draftProtocols,
      checkInsThisWeek,
      openRequests,
      supplierIds,
    };
  }

  async relocate(
    tenantSlug: string,
    access: AccessContext,
    body: unknown,
    actorUserId?: string,
  ) {
    assertPartnerWrite(access);
    const dto = assertRelocateBody(body);
    const { tenantId, supplierId } = await this.resolveSupplier(
      tenantSlug,
      access,
      dto.supplierId,
    );
    const stay = await this.hotel.relocate({
      tenantId,
      supplierId,
      stayId: dto.stayId,
      locationCode: dto.locationCode,
      bayCode: dto.bayCode,
      binCode: dto.binCode,
      actorUserId: actorUserId ?? null,
    });
    return { stay };
  }

  async searchSetsForCheckIn(
    tenantSlug: string,
    access: AccessContext,
    opts: { supplierId?: string; plate: string },
  ) {
    const { tenantId, supplierId } = await this.resolveSupplier(
      tenantSlug,
      access,
      opts.supplierId,
    );
    const parsed = parseTireSetSearchInput(opts.plate);
    if (parsed.kind === 'setId') {
      return this.searchSetsBySetId(tenantId, supplierId, parsed.setId);
    }

    const plate = normalizePlate(parsed.plate);
    if (!plate) throw new BadRequestException('plate is required');

    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        tenantId,
        registrationNumber: { contains: plate, mode: 'insensitive' },
      },
      select: { id: true, registrationNumber: true },
      take: 20,
    });
    if (vehicles.length === 0) {
      return { vehicles: [] as { id: string; registrationNumber: string; sets: unknown[] }[] };
    }

    const vehicleIds = vehicles.map((v) => v.id);
    const sets = await this.prisma.tireSet.findMany({
      where: { tenantId, vehicleId: { in: vehicleIds }, archivedAt: null },
      include: {
        _count: { select: { items: true } },
        storageStays: {
          where: { supplierId, checkOutAt: null },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    const mapped: Array<{
      vehicleId: string;
      set: {
        id: string;
        season: (typeof sets)[number]['season'];
        name: string | null;
        itemCount: number;
        qrPayload: string;
        hasActiveStayHere: boolean;
        mountedAs: string | null;
        suggestedFeeCents: number | null;
        rimInch: number | null;
        dominantSize: string | null;
      };
    }> = [];
    for (const s of sets) {
      const quote = await this.hotel.quoteFeeForSet({
        tenantId,
        supplierId,
        setId: s.id,
      });
      mapped.push({
        vehicleId: s.vehicleId,
        set: {
          id: s.id,
          season: s.season,
          name: s.name,
          itemCount: s._count.items,
          qrPayload: tireSetQrPayload(s.id),
          hasActiveStayHere: s.storageStays.length > 0,
          mountedAs: quote.mountedAs,
          suggestedFeeCents: quote.feeCents,
          rimInch: quote.rimInch,
          dominantSize: quote.dominantSize,
        },
      });
    }
    const setsByVehicle = new Map<string, (typeof mapped)[number]['set'][]>();
    for (const row of mapped) {
      const list = setsByVehicle.get(row.vehicleId) ?? [];
      list.push(row.set);
      setsByVehicle.set(row.vehicleId, list);
    }

    return {
      vehicles: vehicles.map((v) => ({
        id: v.id,
        registrationNumber: v.registrationNumber,
        sets: setsByVehicle.get(v.id) ?? [],
      })),
    };
  }

  async quoteFee(
    tenantSlug: string,
    access: AccessContext,
    opts: { supplierId?: string; setId: string },
  ) {
    const { tenantId, supplierId } = await this.resolveSupplier(
      tenantSlug,
      access,
      opts.supplierId,
    );
    const setId = opts.setId?.trim();
    if (!setId) throw new BadRequestException('setId is required');
    return this.hotel.quoteFeeForSet({ tenantId, supplierId, setId });
  }

  async checkIn(
    tenantSlug: string,
    access: AccessContext,
    body: unknown,
    actorUserId?: string,
  ) {
    assertPartnerWrite(access);
    const dto = assertCheckInBody(body);
    const { tenantId, supplierId } = await this.resolveSupplier(
      tenantSlug,
      access,
      dto.supplierId,
    );

    if (dto.vehicleId) {
      const set = await this.prisma.tireSet.findFirst({
        where: { id: dto.setId, tenantId, vehicleId: dto.vehicleId },
        select: { id: true },
      });
      if (!set) throw new BadRequestException('setId does not match vehicleId');
    }

    const stay = await this.hotel.checkIn({
      tenantId,
      supplierId,
      setId: dto.setId,
      locationCode: dto.locationCode,
      bayCode: dto.bayCode,
      binCode: dto.binCode,
      intakePhotos: dto.intakePhotos,
      intakeTreadNotes: dto.intakeTreadNotes,
      intakeInspection: dto.intakeInspection,
      feeCents: dto.feeCents,
      contractRef: dto.contractRef,
      actorUserId: actorUserId ?? null,
      vehicleIdForEvent: dto.vehicleId ?? null,
      sourceSystem:
        dto.sourceSystem?.trim() ||
        (isPartnerUser(access) ? 'partner_portal' : 'fleet_admin'),
      ticketId: dto.ticketId ?? null,
      externalId: dto.ticketId ?? null,
    });

    return { stay };
  }

  async transferStay(
    tenantSlug: string,
    access: AccessContext,
    body: unknown,
    actorUserId?: string,
  ) {
    return this.transfer(tenantSlug, access, body, actorUserId);
  }

  async transfer(
    tenantSlug: string,
    access: AccessContext,
    body: unknown,
    actorUserId?: string,
  ) {
    assertPartnerWrite(access);
    const dto = assertTransferBody(body);
    const { tenantId, supplierId: fromSupplierId } = await this.resolveSupplier(
      tenantSlug,
      access,
      dto.supplierId,
    );
    const toSupplierId = dto.toSupplierId.trim();
    await assertSupplierReadById(this.prisma, tenantSlug, toSupplierId, access);
    await assertSupplierTireStorage(this.prisma, tenantId, fromSupplierId);

    const protocol = await this.custody.getOrCreateForStay(
      tenantSlug,
      dto.stayId,
      TireCustodyProtocolKind.transfer,
      access,
      fromSupplierId,
      { actorUserId },
    );

    const result = await this.hotel.transferBetweenSuppliers({
      tenantId,
      fromSupplierId,
      toSupplierId,
      stayId: dto.stayId,
      locationCode: dto.locationCode,
      bayCode: dto.bayCode,
      binCode: dto.binCode,
      handoffOnly: dto.handoffOnly,
      actorUserId: actorUserId ?? null,
    });

    return { ...result, protocol };
  }

  async transformStayToCost(
    tenantSlug: string,
    access: AccessContext,
    body: unknown,
  ) {
    assertPartnerWrite(access);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException('Body must be an object');
    }
    const o = body as Record<string, unknown>;
    const stayId = typeof o.stayId === 'string' ? o.stayId.trim() : '';
    if (!stayId) throw new BadRequestException('stayId is required');
    const supplierId =
      typeof o.supplierId === 'string' ? o.supplierId.trim() : undefined;
    const invoiceNumber =
      o.invoiceNumber === undefined || o.invoiceNumber === null
        ? undefined
        : String(o.invoiceNumber).trim() || null;
    const invoiceAttachmentUrl =
      o.invoiceAttachmentUrl === undefined || o.invoiceAttachmentUrl === null
        ? undefined
        : String(o.invoiceAttachmentUrl).trim() || null;
    let invoiceDate: Date | null | undefined = undefined;
    if (o.invoiceDate !== undefined) {
      if (o.invoiceDate === null || o.invoiceDate === '') invoiceDate = null;
      else {
        const d = new Date(String(o.invoiceDate));
        if (Number.isNaN(d.getTime())) {
          throw new BadRequestException('invoiceDate invalid');
        }
        invoiceDate = d;
      }
    }
    return this.transformStayToCostById(tenantSlug, access, stayId, supplierId, {
      invoiceNumber,
      invoiceDate,
      invoiceAttachmentUrl,
    });
  }

  async transformStayToCostById(
    tenantSlug: string,
    access: AccessContext,
    stayId: string,
    supplierId?: string,
    invoice?: {
      invoiceNumber?: string | null;
      invoiceDate?: Date | null;
      invoiceAttachmentUrl?: string | null;
    },
  ) {
    assertPartnerWrite(access);
    const { tenantId, supplierId: sid } = await this.resolveSupplier(
      tenantSlug,
      access,
      supplierId,
    );
    const out = await this.prisma.$transaction((tx) =>
      this.hotel.transformStayToCostTx(tx, {
        tenantId,
        supplierId: sid,
        stayId,
        invoiceNumber: invoice?.invoiceNumber,
        invoiceDate: invoice?.invoiceDate,
        invoiceAttachmentUrl: invoice?.invoiceAttachmentUrl,
      }),
    );
    const summary =
      out.costEntryId != null
        ? await this.stayCostSummary(tenantSlug, access, stayId, supplierId)
        : null;
    return { ...out, summary };
  }

  async importSetsDryRun(
    tenantSlug: string,
    access: AccessContext,
    body: unknown,
  ): Promise<{
    ok: boolean;
    dryRun: true;
    rows: number;
    validRows: number;
    errors: string[];
  }> {
    assertPartnerWrite(access);
    const supplierId =
      body && typeof body === 'object' && !Array.isArray(body)
        ? typeof (body as { supplierId?: unknown }).supplierId === 'string'
          ? (body as { supplierId: string }).supplierId.trim()
          : undefined
        : undefined;
    const { tenantId, supplierId: sid } = await this.resolveSupplier(
      tenantSlug,
      access,
      supplierId,
    );
    const parsed = await this.parseImportSetsCsv(tenantId, extractImportCsv(body), {
      requireHotelBay: false,
      supplierId: sid,
    });
    return {
      ok: parsed.errors.length === 0,
      dryRun: true,
      rows: parsed.rows.length,
      validRows: parsed.valid.length,
      errors: parsed.errors,
    };
  }

  /**
   * Apply CSV import: plate,season,mountedAs,brand,model,size,location(at_client|hotel),bay?
   * Partner-only write; hotel rows require supplier scope. Skips bad rows (no invented vehicles).
   */
  async importSets(
    tenantSlug: string,
    access: AccessContext,
    body: unknown,
    actorUserId?: string,
  ): Promise<{
    ok: boolean;
    dryRun: false;
    rows: number;
    created: number;
    updated: number;
    checkedIn: number;
    skipped: number;
    errors: string[];
  }> {
    assertPartnerWrite(access);
    const supplierId =
      body && typeof body === 'object' && !Array.isArray(body)
        ? typeof (body as { supplierId?: unknown }).supplierId === 'string'
          ? (body as { supplierId: string }).supplierId.trim()
          : undefined
        : undefined;
    const { tenantId, supplierId: sid } = await this.resolveSupplier(
      tenantSlug,
      access,
      supplierId,
    );
    const parsed = await this.parseImportSetsCsv(tenantId, extractImportCsv(body), {
      requireHotelBay: true,
      supplierId: sid,
    });
    let created = 0;
    let updated = 0;
    let checkedIn = 0;
    const errors = [...parsed.errors];

    for (const row of parsed.valid) {
      try {
        const result = await this.applyImportSetRow({
          tenantId,
          supplierId: sid,
          row,
          actorUserId,
        });
        if (result.created) created += 1;
        else updated += 1;
        if (result.checkedIn) checkedIn += 1;
      } catch (e) {
        errors.push(
          `Linia ${row.line}: ${e instanceof Error ? e.message : 'aplicare eșuată'}`,
        );
      }
    }

    const skipped = parsed.rows.length - created - updated;
    return {
      ok: errors.length === 0,
      dryRun: false,
      rows: parsed.rows.length,
      created,
      updated,
      checkedIn,
      skipped: Math.max(0, skipped),
      errors,
    };
  }

  private async parseImportSetsCsv(
    tenantId: string,
    csv: string,
    opts: { requireHotelBay: boolean; supplierId: string },
  ): Promise<{
    rows: number[];
    valid: ImportSetRow[];
    errors: string[];
  }> {
    void opts.supplierId;
    const { headers, rows } = parseCsv(csv);
    const errors: string[] = [];
    if (headers.length === 0 || rows.length === 0) {
      errors.push('CSV needs header + at least one data row');
      return { rows: [], valid: [], errors };
    }
    const headerKeys = headers.map((h) => h.trim().toLowerCase());
    const hasPlate =
      headerKeys.includes('plate') ||
      headerKeys.includes('vehicle') ||
      headerKeys.includes('nr') ||
      headerKeys.includes('registration');
    if (!hasPlate) {
      errors.push('Header must include plate (or vehicle)');
    }
    if (!headerKeys.includes('season')) {
      errors.push('Header must include season');
    }
    if (!headerKeys.includes('location')) {
      errors.push('Header must include location (at_client|hotel)');
    }

    const plates = new Set<string>();
    const draft: Array<{
      line: number;
      plate: string;
      season: VehicleTireSeason;
      mountedAs: 'on_rim' | 'tyre_only';
      brand?: string;
      model?: string;
      size?: string;
      location: 'at_client' | 'hotel';
      bay?: string;
    }> = [];
    rows.forEach((cells, idx) => {
      const line = idx + 2;
      const obj = rowToObject(headers, cells);
      const lower: Record<string, string> = {};
      for (const [k, v] of Object.entries(obj)) lower[k.trim().toLowerCase()] = v;
      const plateRaw =
        lower.plate || lower.vehicle || lower.nr || lower.registration || '';
      const plate = normalizePlate(plateRaw);
      const seasonRaw = (lower.season || '').trim().toLowerCase();
      const season = normalizeImportSeason(seasonRaw);
      const mountedAs = normalizeImportMountedAs(
        (lower.mountedas || lower.mounted_as || lower['mounted as'] || 'on_rim').trim(),
      );
      const location = normalizeImportLocation((lower.location || '').trim());
      const bay = (lower.bay || lower.baycode || lower.bay_code || '').trim().toUpperCase() || undefined;
      const brand = (lower.brand || '').trim() || undefined;
      const model = (lower.model || '').trim() || undefined;
      const size = (lower.size || '').trim() || undefined;

      if (!plate) {
        errors.push(`Linia ${line}: lipsă plate`);
        return;
      }
      if (!season) {
        errors.push(`Linia ${line}: season invalid (${seasonRaw || '—'})`);
        return;
      }
      if (!mountedAs) {
        errors.push(`Linia ${line}: mountedAs invalid`);
        return;
      }
      if (!location) {
        errors.push(`Linia ${line}: location must be at_client or hotel`);
        return;
      }
      if (location === 'hotel' && opts.requireHotelBay && !bay) {
        errors.push(`Linia ${line}: bay required for location=hotel`);
        return;
      }
      plates.add(plate);
      draft.push({
        line,
        plate,
        season,
        mountedAs,
        brand,
        model,
        size,
        location,
        bay,
      });
    });

    const vehicles =
      plates.size === 0
        ? []
        : await this.prisma.vehicle.findMany({
            where: {
              tenantId,
              OR: [...plates].map((p) => ({
                registrationNumber: { equals: p, mode: 'insensitive' as const },
              })),
            },
            select: {
              id: true,
              clientId: true,
              registrationNumber: true,
            },
          });
    const byPlate = new Map<string, (typeof vehicles)[number]>();
    for (const v of vehicles) {
      const key = normalizePlate(v.registrationNumber);
      if (key) byPlate.set(key, v);
    }

    const valid: ImportSetRow[] = [];
    for (const row of draft) {
      const vehicle = byPlate.get(row.plate);
      if (!vehicle) {
        errors.push(`Linia ${row.line}: vehicul inexistent pentru plate ${row.plate}`);
        continue;
      }
      valid.push({
        line: row.line,
        plate: row.plate,
        season: row.season,
        mountedAs: row.mountedAs,
        brand: row.brand,
        model: row.model,
        size: row.size,
        location: row.location,
        bay: row.bay,
        vehicleId: vehicle.id,
        clientId: vehicle.clientId,
      });
    }

    return { rows: rows.map((_, i) => i), valid, errors };
  }

  private async applyImportSetRow(params: {
    tenantId: string;
    supplierId: string;
    row: ImportSetRow;
    actorUserId?: string;
  }): Promise<{ created: boolean; checkedIn: boolean }> {
    const { tenantId, row, supplierId, actorUserId } = params;
    let set = await this.prisma.tireSet.findFirst({
      where: {
        tenantId,
        vehicleId: row.vehicleId,
        season: row.season,
        archivedAt: null,
      },
      include: {
        items: { select: { assetId: true }, orderBy: { sortOrder: 'asc' }, take: 1 },
      },
      orderBy: { createdAt: 'asc' },
    });

    let created = false;
    if (!set) {
      set = await this.prisma.tireSet.create({
        data: {
          tenantId,
          clientId: row.clientId,
          vehicleId: row.vehicleId,
          season: row.season,
          mountedAs: row.mountedAs,
        },
        include: {
          items: { select: { assetId: true }, orderBy: { sortOrder: 'asc' }, take: 1 },
        },
      });
      created = true;
      await this.prisma.tireEvent.create({
        data: {
          tenantId,
          type: 'store',
          setId: set.id,
          vehicleId: row.vehicleId,
          payload: { source: 'partner_csv_import', season: row.season },
        },
      });
    } else if (set.mountedAs !== row.mountedAs) {
      set = await this.prisma.tireSet.update({
        where: { id: set.id },
        data: { mountedAs: row.mountedAs },
        include: {
          items: { select: { assetId: true }, orderBy: { sortOrder: 'asc' }, take: 1 },
        },
      });
    }

    if (set.items.length === 0) {
      const asset = await this.prisma.tireAsset.create({
        data: {
          tenantId,
          clientId: row.clientId,
          ownerClientId: row.clientId,
          ownershipType: 'client',
          provenance: 'inferred',
          brand: row.brand ?? null,
          model: row.model ?? null,
          size: row.size ?? null,
          season: row.season,
        },
      });
      await this.prisma.tireSetItem.create({
        data: { setId: set.id, assetId: asset.id, sortOrder: 0 },
      });
      await this.tireDomain.placeAsset({
        tenantId,
        assetId: asset.id,
        kind: 'at_client',
        vehicleId: row.vehicleId,
        setId: set.id,
        eventType: 'store',
        vehicleIdForEvent: row.vehicleId,
        payload: { source: 'partner_csv_import' },
      });
    } else if (row.brand || row.model || row.size) {
      const assetId = set.items[0]!.assetId;
      await this.prisma.tireAsset.update({
        where: { id: assetId },
        data: {
          ...(row.brand !== undefined ? { brand: row.brand } : {}),
          ...(row.model !== undefined ? { model: row.model } : {}),
          ...(row.size !== undefined ? { size: row.size } : {}),
        },
      });
    }

    let checkedIn = false;
    if (row.location === 'hotel') {
      const open = await this.prisma.tireStorageStay.findFirst({
        where: { tenantId, setId: set.id, checkOutAt: null },
        select: { id: true, supplierId: true },
      });
      if (!open) {
        await this.hotel.checkIn({
          tenantId,
          supplierId,
          setId: set.id,
          bayCode: row.bay,
          actorUserId: actorUserId ?? null,
        });
        checkedIn = true;
      } else if (open.supplierId !== supplierId) {
        throw new BadRequestException(
          `set deja la alt hotel (${open.supplierId})`,
        );
      }
    }

    return { created, checkedIn };
  }

  private async searchSetsBySetId(tenantId: string, supplierId: string, setId: string) {
    const set = await this.prisma.tireSet.findFirst({
      where: { id: setId, tenantId, archivedAt: null },
      include: {
        vehicle: { select: { id: true, registrationNumber: true } },
        _count: { select: { items: true } },
        storageStays: {
          where: { supplierId, checkOutAt: null },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!set) {
      return { vehicles: [] as { id: string; registrationNumber: string; sets: unknown[] }[] };
    }
    const quote = await this.hotel.quoteFeeForSet({
      tenantId,
      supplierId,
      setId: set.id,
    });
    return {
      vehicles: [
        {
          id: set.vehicle.id,
          registrationNumber: set.vehicle.registrationNumber,
          sets: [
            {
              id: set.id,
              season: set.season,
              name: set.name,
              itemCount: set._count.items,
              qrPayload: tireSetQrPayload(set.id),
              hasActiveStayHere: set.storageStays.length > 0,
              mountedAs: quote.mountedAs,
              suggestedFeeCents: quote.feeCents,
              rimInch: quote.rimInch,
              dominantSize: quote.dominantSize,
            },
          ],
        },
      ],
    };
  }

  async checkOut(
    tenantSlug: string,
    access: AccessContext,
    body: unknown,
    actorUserId?: string,
  ) {
    assertPartnerWrite(access);
    const dto = assertCheckOutBody(body);
    const { tenantId, supplierId } = await this.resolveSupplier(
      tenantSlug,
      access,
      dto.supplierId,
    );

    await this.custody.assertSignedCheckOutProtocol(tenantId, dto.stayId);

    const stay = await this.hotel.checkOut({
      tenantId,
      supplierId,
      stayId: dto.stayId,
      actorUserId: actorUserId ?? null,
      releaseKind: dto.releaseKind,
      accountingNote: dto.accountingNote,
    });

    return { stay };
  }

  async stayCostSummary(
    tenantSlug: string,
    access: AccessContext,
    stayId: string,
    supplierId?: string,
  ) {
    const { tenantId, supplierId: sid } = await this.resolveSupplier(
      tenantSlug,
      access,
      supplierId,
    );
    const stay = await this.prisma.tireStorageStay.findFirst({
      where: { id: stayId, tenantId, supplierId: sid },
      include: {
        set: { select: { vehicle: { select: { registrationNumber: true } } } },
        supplier: { select: { legalName: true } },
      },
    });
    if (!stay) throw new NotFoundException('Stay not found');
    const cost = await this.prisma.costEntry.findFirst({
      where: { tenantId, tireStorageStayId: stayId },
      orderBy: { incurredOn: 'desc' },
    });
    if (!cost) {
      return { costEntryId: null as string | null, printable: null };
    }
    const printable = buildTireStayCostPrintableSummary({
      costEntryId: cost.id,
      amountCents: cost.amountCents,
      category: cost.category,
      provider: cost.provider ?? stay.supplier.legalName,
      incurredOn: cost.incurredOn,
      plate: stay.set.vehicle.registrationNumber,
      stayId: stay.id,
      checkInAt: stay.checkInAt,
      checkOutAt: stay.checkOutAt,
      feeCents: stay.feeCents,
    });
    return { costEntryId: cost.id, printable };
  }

  async exportStaysCsv(
    tenantSlug: string,
    access: AccessContext,
    opts: { supplierId?: string; status?: string; plate?: string },
  ): Promise<string> {
    const data = await this.listActiveStays(tenantSlug, access, {
      supplierId: opts.supplierId,
      plate: opts.plate,
      status: opts.status ?? 'active',
      take: 500,
      skip: 0,
    });
    const header = [
      'stayId',
      'plate',
      'setId',
      'supplierId',
      'locationCode',
      'checkInAt',
      'checkOutAt',
      'feeCents',
      'costEntryId',
    ].join(',');
    const lines = data.items.map((s) =>
      [
        s.id,
        s.plate,
        s.setId,
        s.supplierId,
        s.locationCode ?? '',
        s.checkInAt,
        s.checkOutAt ?? '',
        s.feeCents ?? '',
        (s as { costEntryId?: string | null }).costEntryId ?? '',
      ]
        .map((c) => escapeCsvCell(String(c)))
        .join(','),
    );
    return [header, ...lines].join('\r\n');
  }

  async importSetsAssetsDryRun(body: unknown) {
    const csv = extractImportCsv(body);
    const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) {
      throw new BadRequestException('CSV is empty');
    }
    const header = lines[0]!.split(',').map((h) => h.trim().toLowerCase());
    const errors: string[] = [];
    const okSets = header.includes('setid') || header.includes('plate');
    const okAssets = header.includes('assetid');
    if (!okSets && !okAssets) {
      errors.push('Missing set columns (setId or plate) and asset columns (assetId)');
    }
    const rowCount = Math.max(0, lines.length - 1);
    return {
      dryRun: true,
      rowCount,
      headers: header,
      valid: errors.length === 0,
      errors,
      hint: 'Import aplicare — stub; folosiți dry-run pentru validare structură.',
    };
  }

  async patchTireAssetDocs(
    tenantSlug: string,
    access: AccessContext,
    assetId: string,
    body: unknown,
  ) {
    assertPartnerWrite(access);
    const o = assertDocPatchBody(body);
    return this.tireDomain.patchTireAssetDocs(tenantSlug, assetId, o, access);
  }

  async patchTireSetDocs(
    tenantSlug: string,
    access: AccessContext,
    setId: string,
    body: unknown,
  ) {
    assertPartnerWrite(access);
    const o = assertDocPatchBody(body);
    return this.tireDomain.patchTireSetDocs(tenantSlug, setId, o, access);
  }
}

function assertCheckInBody(body: unknown): {
  supplierId?: string;
  setId: string;
  vehicleId?: string;
  locationCode?: string;
  bayCode?: string;
  binCode?: string;
  intakePhotos?: Prisma.InputJsonValue;
  intakeTreadNotes?: string;
  intakeInspection?: ReturnType<typeof parseIntakeInspectionBody>;
  feeCents?: number;
  contractRef?: string;
  ticketId?: string;
  sourceSystem?: string;
} {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('Body must be an object');
  }
  const o = body as Record<string, unknown>;
  const setId = typeof o.setId === 'string' ? o.setId.trim() : '';
  if (!setId) throw new BadRequestException('setId is required');
  const locationCode =
    o.locationCode === undefined || o.locationCode === null
      ? undefined
      : typeof o.locationCode === 'string'
        ? o.locationCode.trim()
        : undefined;
  const bayCode =
    o.bayCode === undefined || o.bayCode === null
      ? undefined
      : typeof o.bayCode === 'string'
        ? o.bayCode.trim()
        : undefined;
  const binCode =
    o.binCode === undefined || o.binCode === null
      ? undefined
      : typeof o.binCode === 'string'
        ? o.binCode.trim()
        : undefined;
  if (!locationCode && !bayCode) {
    throw new BadRequestException('locationCode or bayCode is required');
  }

  const vehicleId =
    o.vehicleId === undefined || o.vehicleId === null
      ? undefined
      : typeof o.vehicleId === 'string'
        ? o.vehicleId.trim()
        : (() => {
            throw new BadRequestException('vehicleId invalid');
          })();

  const supplierId =
    o.supplierId === undefined || o.supplierId === null
      ? undefined
      : typeof o.supplierId === 'string'
        ? o.supplierId.trim()
        : undefined;

  let feeCents: number | undefined;
  if (o.feeCents !== undefined && o.feeCents !== null) {
    if (!Number.isFinite(Number(o.feeCents))) throw new BadRequestException('feeCents invalid');
    feeCents = Math.round(Number(o.feeCents));
  }

  const intakePhotos = normalizeIntakePhotosBody(o.intakePhotos);

  const ticketId =
    o.ticketId === undefined || o.ticketId === null
      ? undefined
      : typeof o.ticketId === 'string'
        ? o.ticketId.trim()
        : undefined;

  const intakeInspection = parseIntakeInspectionBody(o.intakeInspection);
  const sourceSystem =
    o.sourceSystem === undefined || o.sourceSystem === null
      ? undefined
      : typeof o.sourceSystem === 'string'
        ? o.sourceSystem.trim() || undefined
        : undefined;

  return {
    supplierId,
    setId,
    vehicleId,
    locationCode,
    bayCode,
    binCode,
    intakePhotos,
    intakeTreadNotes:
      o.intakeTreadNotes === undefined || o.intakeTreadNotes === null
        ? undefined
        : String(o.intakeTreadNotes),
    intakeInspection,
    feeCents,
    contractRef:
      o.contractRef === undefined || o.contractRef === null ? undefined : String(o.contractRef),
    ticketId,
    sourceSystem,
  };
}

function assertCheckOutBody(body: unknown): {
  supplierId?: string;
  stayId: string;
  releaseKind?: 'at_client' | 'in_transit' | 'scrap' | 'quarantine';
  accountingNote?: string;
} {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('Body must be an object');
  }
  const o = body as Record<string, unknown>;
  const stayId = typeof o.stayId === 'string' ? o.stayId.trim() : '';
  if (!stayId) throw new BadRequestException('stayId is required');
  const supplierId =
    o.supplierId === undefined || o.supplierId === null
      ? undefined
      : typeof o.supplierId === 'string'
        ? o.supplierId.trim()
        : undefined;
  let releaseKind: 'at_client' | 'in_transit' | 'scrap' | 'quarantine' | undefined;
  if (o.releaseKind !== undefined && o.releaseKind !== null) {
    const raw = String(o.releaseKind).trim();
    if (!['at_client', 'in_transit', 'scrap', 'quarantine'].includes(raw)) {
      throw new BadRequestException('releaseKind invalid');
    }
    releaseKind = raw as 'at_client' | 'in_transit' | 'scrap' | 'quarantine';
  }
  const accountingNote =
    o.accountingNote === undefined || o.accountingNote === null
      ? undefined
      : String(o.accountingNote).trim() || undefined;
  return { supplierId, stayId, releaseKind, accountingNote };
}

function assertTransferBody(body: unknown): {
  supplierId?: string;
  stayId: string;
  toSupplierId: string;
  locationCode?: string;
  bayCode?: string;
  binCode?: string;
  handoffOnly?: boolean;
} {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('Body must be an object');
  }
  const o = body as Record<string, unknown>;
  const stayId = typeof o.stayId === 'string' ? o.stayId.trim() : '';
  if (!stayId) throw new BadRequestException('stayId is required');
  const toSupplierId = typeof o.toSupplierId === 'string' ? o.toSupplierId.trim() : '';
  if (!toSupplierId) throw new BadRequestException('toSupplierId is required');
  const supplierId =
    o.supplierId === undefined || o.supplierId === null
      ? undefined
      : typeof o.supplierId === 'string'
        ? o.supplierId.trim()
        : undefined;
  const handoffOnly = o.handoffOnly === true || o.handoffOnly === 'true' || o.handoffOnly === 1;
  const locationCode =
    o.locationCode === undefined || o.locationCode === null
      ? undefined
      : typeof o.locationCode === 'string'
        ? o.locationCode.trim()
        : undefined;
  const bayCode =
    o.bayCode === undefined || o.bayCode === null
      ? undefined
      : typeof o.bayCode === 'string'
        ? o.bayCode.trim()
        : undefined;
  const binCode =
    o.binCode === undefined || o.binCode === null
      ? undefined
      : typeof o.binCode === 'string'
        ? o.binCode.trim()
        : undefined;
  return { supplierId, stayId, toSupplierId, locationCode, bayCode, binCode, handoffOnly };
}

function assertDocPatchBody(body: unknown): {
  warrantyCertificateUrl?: string | null;
  purchaseDocs?: Prisma.InputJsonValue | null;
} {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('Body must be an object');
  }
  const o = body as Record<string, unknown>;
  const out: {
    warrantyCertificateUrl?: string | null;
    purchaseDocs?: Prisma.InputJsonValue | null;
  } = {};
  if ('warrantyCertificateUrl' in o) {
    out.warrantyCertificateUrl =
      o.warrantyCertificateUrl === null
        ? null
        : typeof o.warrantyCertificateUrl === 'string'
          ? o.warrantyCertificateUrl.trim() || null
          : (() => {
              throw new BadRequestException('warrantyCertificateUrl invalid');
            })();
  }
  if ('purchaseDocs' in o) {
    out.purchaseDocs =
      o.purchaseDocs === null || o.purchaseDocs === undefined
        ? null
        : (o.purchaseDocs as Prisma.InputJsonValue);
  }
  if (!('warrantyCertificateUrl' in out) && !('purchaseDocs' in out)) {
    throw new BadRequestException('warrantyCertificateUrl or purchaseDocs required');
  }
  return out;
}

function extractImportCsv(body: unknown): string {
  if (typeof body === 'string') return body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('Body must include csv text');
  }
  const o = body as Record<string, unknown>;
  if (typeof o.csv === 'string') return o.csv;
  if (typeof o.content === 'string') return o.content;
  throw new BadRequestException('csv or content string required');
}

type ImportSetRow = {
  line: number;
  plate: string;
  season: VehicleTireSeason;
  mountedAs: 'on_rim' | 'tyre_only';
  brand?: string;
  model?: string;
  size?: string;
  location: 'at_client' | 'hotel';
  bay?: string;
  vehicleId: string;
  clientId: string;
};

function normalizeImportSeason(raw: string): VehicleTireSeason | null {
  const s = raw.trim().toLowerCase();
  if (s === 'summer' || s === 'vara' || s === 'vară') return 'summer';
  if (s === 'winter' || s === 'iarna' || s === 'iarnă') return 'winter';
  if (s === 'all_season' || s === 'all-season' || s === 'allseason' || s === 'all season') {
    return 'all_season';
  }
  return null;
}

function normalizeImportMountedAs(raw: string): 'on_rim' | 'tyre_only' | null {
  const s = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!s || s === 'on_rim' || s === 'onrim' || s === 'rim') return 'on_rim';
  if (s === 'tyre_only' || s === 'tire_only' || s === 'tyreonly' || s === 'tireonly') {
    return 'tyre_only';
  }
  return null;
}

function normalizeImportLocation(raw: string): 'at_client' | 'hotel' | null {
  const s = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (s === 'at_client' || s === 'client' || s === 'la_client') return 'at_client';
  if (s === 'hotel' || s === 'at_hotel' || s === 'at_supplier_hotel') return 'hotel';
  return null;
}

function buildPartnerTireRequestHref(opts: {
  ticketId: string;
  supplierId?: string | null;
}): string {
  const p = new URLSearchParams();
  if (opts.supplierId) p.set('supplierId', opts.supplierId);
  const qs = p.toString();
  return `/fleet/partner/tire-requests/${encodeURIComponent(opts.ticketId)}${qs ? `?${qs}` : ''}`;
}

function buildPartnerHotelCheckInHref(opts: {
  supplierId?: string | null;
  plate?: string | null;
  ticketId: string;
}): string {
  const p = new URLSearchParams();
  if (opts.supplierId) p.set('supplierId', opts.supplierId);
  if (opts.ticketId) p.set('ticketId', opts.ticketId);
  if (opts.plate?.trim()) p.set('plate', opts.plate.trim());
  const qs = p.toString();
  return `/fleet/partner/tire-hotel/check-in${qs ? `?${qs}` : ''}`;
}

function assertRelocateBody(body: unknown): {
  supplierId?: string;
  stayId: string;
  locationCode?: string;
  bayCode?: string;
  binCode?: string;
} {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('Body must be an object');
  }
  const o = body as Record<string, unknown>;
  const stayId = typeof o.stayId === 'string' ? o.stayId.trim() : '';
  if (!stayId) throw new BadRequestException('stayId is required');
  const supplierId =
    o.supplierId === undefined || o.supplierId === null
      ? undefined
      : typeof o.supplierId === 'string'
        ? o.supplierId.trim()
        : undefined;
  const locationCode =
    o.locationCode === undefined || o.locationCode === null
      ? undefined
      : typeof o.locationCode === 'string'
        ? o.locationCode.trim()
        : undefined;
  const bayCode =
    o.bayCode === undefined || o.bayCode === null
      ? undefined
      : typeof o.bayCode === 'string'
        ? o.bayCode.trim()
        : undefined;
  const binCode =
    o.binCode === undefined || o.binCode === null
      ? undefined
      : typeof o.binCode === 'string'
        ? o.binCode.trim()
        : undefined;
  if (!locationCode && !bayCode) {
    throw new BadRequestException('locationCode or bayCode is required');
  }
  return { supplierId, stayId, locationCode, bayCode, binCode };
}

function normalizeIntakePhotosBody(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') {
    const urls = value
      .split(/[\n,]+/)
      .map((part) => part.trim())
      .filter(Boolean);
    return urls.length ? urls : undefined;
  }
  if (Array.isArray(value)) {
    const urls = value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((url) => url.trim())
      .filter(Boolean);
    return urls.length ? urls : undefined;
  }
  throw new BadRequestException('intakePhotos must be a string or array of URLs');
}
