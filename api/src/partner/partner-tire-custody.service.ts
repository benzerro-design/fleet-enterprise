import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AccessContext } from '../iam/access-context.types';
import {
  assertPartnerOrTenantCustodyAccess,
  assertPartnerWrite,
  resolvePartnerSupplierIdsFilter,
} from '../iam/partner-access';
import { parseTireSetSearchInput } from '../fleet/tires/tire-domain.types';
import { coerceFiniteTreadMm } from '../fleet/tires/tire-intake-inspection';
import { TireLedgerService } from '../fleet/tires/tire-ledger.service';
import { TireHotelService } from '../fleet/tires/tire-hotel.service';
import { parseStayLocation } from '../fleet/tires/tire-stay-location';
import { PrismaService } from '../prisma/prisma.service';
import { assertSupplierReadById } from '../suppliers/supplier-access';
import { assertSupplierTireStorage } from '../suppliers/supplier-tire-capability';

const locationInclude = {
  row: {
    include: {
      zone: {
        include: {
          warehouse: { select: { code: true, name: true, supplierId: true } },
        },
      },
    },
  },
} satisfies Prisma.TireWarehouseLocationInclude;

type LocationRow = Prisma.TireWarehouseLocationGetPayload<{ include: typeof locationInclude }>;

function formatWarehouseLocationLabel(loc: LocationRow): string {
  const wh = loc.row.zone.warehouse;
  return [wh.name, loc.row.zone.code, loc.row.code, loc.code].filter(Boolean).join(' · ');
}

function formatWarehouseLocationPath(loc: LocationRow): string {
  const wh = loc.row.zone.warehouse;
  return [wh.code, loc.row.zone.code, loc.row.code, loc.code].join('/');
}

function mapLocationNested(loc: LocationRow) {
  return {
    id: loc.id,
    code: loc.code,
    row: {
      code: loc.row.code,
      zone: {
        code: loc.row.zone.code,
        warehouse: {
          code: loc.row.zone.warehouse.code,
          name: loc.row.zone.warehouse.name,
        },
      },
    },
  };
}

function mapAssetItem(asset: {
  id: string;
  brand: string | null;
  model: string | null;
  size: string | null;
  season: string;
  dot: string | null;
  treadMm: number | null;
  serialOrQr: string | null;
}) {
  return {
    assetId: asset.id,
    brand: asset.brand,
    model: asset.model,
    size: asset.size,
    season: asset.season,
    dot: asset.dot,
    treadMm: asset.treadMm,
    serialOrQr: asset.serialOrQr,
  };
}

@Injectable()
export class PartnerTireCustodyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tireLedger: TireLedgerService,
    private readonly hotel: TireHotelService,
  ) {}

  private async resolveSupplier(
    tenantSlug: string,
    access: AccessContext,
    supplierId?: string,
  ): Promise<{ tenantId: string; supplierId: string }> {
    assertPartnerOrTenantCustodyAccess(access);
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

  private async supplierLocationIndex(
    tenantId: string,
    supplierId: string,
  ): Promise<Map<string, LocationRow[]>> {
    const locations = await this.prisma.tireWarehouseLocation.findMany({
      where: {
        tenantId,
        active: true,
        row: {
          active: true,
          zone: {
            active: true,
            warehouse: { supplierId, active: true },
          },
        },
      },
      include: locationInclude,
    });
    const byKey = new Map<string, LocationRow[]>();
    for (const loc of locations) {
      const rowCode = loc.row.code.toUpperCase();
      const locCode = loc.code.toUpperCase();
      const key = `${rowCode}/${locCode}`;
      const list = byKey.get(key) ?? [];
      list.push(loc);
      byKey.set(key, list);
      const locOnly = byKey.get(locCode) ?? [];
      if (!locOnly.includes(loc)) {
        locOnly.push(loc);
        byKey.set(locCode, locOnly);
      }
    }
    return byKey;
  }

  private suggestLocation(
    stay: { warehouseLocationId: string | null; locationCode: string | null },
    index: Map<string, LocationRow[]>,
  ): { suggestedLocationId: string; suggestedLocationLabel: string } | null {
    if (stay.warehouseLocationId) return null;
    const raw = stay.locationCode?.trim();
    if (!raw) return null;

    const parts = raw.split('/').map((p) => p.trim().toUpperCase()).filter(Boolean);
    let rowCode: string | null = null;
    let locCode: string | null = null;
    if (parts.length >= 2) {
      rowCode = parts[parts.length - 2]!;
      locCode = parts[parts.length - 1]!;
    } else {
      const parsed = parseStayLocation(raw);
      rowCode = parsed.bayCode;
      locCode = parsed.binCode;
    }
    if (!locCode) return null;

    const candidates: LocationRow[] = [];
    if (rowCode) {
      const key = `${rowCode}/${locCode}`;
      const match = index.get(key);
      if (match?.length === 1) {
        return {
          suggestedLocationId: match[0]!.id,
          suggestedLocationLabel: formatWarehouseLocationLabel(match[0]!),
        };
      }
      if (match && match.length > 1) candidates.push(...match);
    }
    const solo = index.get(locCode);
    if (solo?.length === 1) {
      return {
        suggestedLocationId: solo[0]!.id,
        suggestedLocationLabel: formatWarehouseLocationLabel(solo[0]!),
      };
    }
    if (candidates.length === 1) {
      return {
        suggestedLocationId: candidates[0]!.id,
        suggestedLocationLabel: formatWarehouseLocationLabel(candidates[0]!),
      };
    }
    return null;
  }

  private displayLocation(
    stay: {
      locationCode: string | null;
      warehouseLocation: LocationRow | null;
    },
  ): string {
    if (stay.warehouseLocation) {
      return `${stay.warehouseLocation.row.code}/${stay.warehouseLocation.code}`;
    }
    return stay.locationCode?.trim() || 'nealocat';
  }

  async listStock(
    tenantSlug: string,
    access: AccessContext,
    opts: { supplierId?: string; q?: string },
  ) {
    const { tenantId, supplierId } = await this.resolveSupplier(tenantSlug, access, opts.supplierId);
    const qRaw = opts.q?.trim() ?? '';
    const parsed = qRaw ? parseTireSetSearchInput(qRaw) : null;

    const where: Prisma.TireStorageStayWhereInput = {
      tenantId,
      supplierId,
      checkOutAt: null,
    };

    if (parsed?.kind === 'setId') {
      where.setId = parsed.setId;
    } else if (parsed?.kind === 'plate' && parsed.plate) {
      const plate = parsed.plate.replace(/\s+/g, '');
      where.OR = [
        {
          set: {
            vehicle: {
              registrationNumber: { contains: plate, mode: 'insensitive' },
            },
          },
        },
        {
          set: {
            items: {
              some: {
                asset: {
                  OR: [
                    { serialOrQr: { contains: qRaw, mode: 'insensitive' } },
                    { serialOrQr: { contains: plate, mode: 'insensitive' } },
                  ],
                },
              },
            },
          },
        },
      ];
    } else if (qRaw) {
      where.OR = [
        {
          set: {
            vehicle: {
              registrationNumber: { contains: qRaw, mode: 'insensitive' },
            },
          },
        },
        {
          set: {
            items: {
              some: {
                asset: { serialOrQr: { contains: qRaw, mode: 'insensitive' } },
              },
            },
          },
        },
      ];
    }

    const [stays, locationIndex] = await Promise.all([
      this.prisma.tireStorageStay.findMany({
        where,
        orderBy: { checkInAt: 'desc' },
        take: 200,
        include: {
          warehouseLocation: { include: locationInclude },
          set: {
            include: {
              client: { select: { legalName: true } },
              vehicle: { select: { registrationNumber: true } },
              items: {
                orderBy: { sortOrder: 'asc' },
                include: {
                  asset: {
                    select: {
                      id: true,
                      brand: true,
                      model: true,
                      size: true,
                      season: true,
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
      this.supplierLocationIndex(tenantId, supplierId),
    ]);

    return {
      items: stays.map((s) => {
        const suggestion = this.suggestLocation(s, locationIndex);
        return {
          id: s.id,
          checkInAt: s.checkInAt.toISOString(),
          locationCode: s.locationCode,
          feeCents: s.feeCents,
          warehouseLocationId: s.warehouseLocationId,
          location: s.warehouseLocation ? mapLocationNested(s.warehouseLocation) : null,
          locationLabel: this.displayLocation(s),
          suggestedLocationId: suggestion?.suggestedLocationId ?? null,
          suggestedLocationLabel: suggestion?.suggestedLocationLabel ?? null,
          set: {
            id: s.set.id,
            name: s.set.name,
            season: s.set.season,
            mountedAs: s.set.mountedAs,
            itemCount: s.set.items.length,
            plate: s.set.vehicle.registrationNumber,
            clientName: s.set.client.legalName,
          },
          items: s.set.items.map((i) => mapAssetItem(i.asset)),
        };
      }),
    };
  }

  async assignLocation(
    tenantSlug: string,
    access: AccessContext,
    stayId: string,
    body: unknown,
  ) {
    assertPartnerOrTenantCustodyAccess(access);
    assertPartnerWrite(access);
    const o = body as Record<string, unknown>;
    const locationId = typeof o.locationId === 'string' ? o.locationId.trim() : '';
    if (!locationId) throw new BadRequestException('locationId is required');
    const supplierId =
      typeof o.supplierId === 'string' && o.supplierId.trim() ? o.supplierId.trim() : undefined;

    const { tenantId, supplierId: sid } = await this.resolveSupplier(tenantSlug, access, supplierId);
    const stay = await this.prisma.tireStorageStay.findFirst({
      where: { id: stayId.trim(), tenantId, supplierId: sid, checkOutAt: null },
    });
    if (!stay) throw new NotFoundException('Stay not found or closed');

    const location = await this.prisma.tireWarehouseLocation.findFirst({
      where: {
        id: locationId,
        tenantId,
        active: true,
        row: {
          active: true,
          zone: {
            active: true,
            warehouse: { supplierId: sid, active: true },
          },
        },
      },
      include: locationInclude,
    });
    if (!location) throw new NotFoundException('Location not found or inactive');

    const stayIdNorm = stayId.trim();
    const locationPath = formatWarehouseLocationPath(location);
    await this.prisma.$transaction(async (tx) => {
      await this.hotel.relocateTx(tx, {
        tenantId,
        supplierId: sid,
        stayId: stayIdNorm,
        warehouseLocationId: location.id,
        locationCode: locationPath,
      });
    });

    const updated = await this.prisma.tireStorageStay.findFirst({
      where: { id: stayIdNorm, tenantId, supplierId: sid },
      include: { warehouseLocation: { include: locationInclude } },
    });
    if (!updated) throw new NotFoundException('Stay not found or closed');

    return {
      id: updated.id,
      warehouseLocationId: updated.warehouseLocationId,
      location: updated.warehouseLocation ? mapLocationNested(updated.warehouseLocation) : null,
      locationLabel: updated.warehouseLocation
        ? formatWarehouseLocationPath(updated.warehouseLocation)
        : updated.locationCode,
    };
  }

  private async assertAssetPartnerScope(
    tenantId: string,
    supplierId: string,
    assetId: string,
  ): Promise<void> {
    const onOpenStay = await this.prisma.tireSetItem.findFirst({
      where: {
        assetId,
        set: {
          tenantId,
          storageStays: {
            some: { supplierId, checkOutAt: null },
          },
        },
      },
      select: { id: true },
    });
    if (onOpenStay) return;

    const atHotel = await this.prisma.tirePlacement.findFirst({
      where: {
        tenantId,
        assetId,
        kind: 'at_supplier_hotel',
        supplierId,
        validTo: null,
      },
      select: { id: true },
    });
    if (atHotel) return;

    throw new ForbiddenException('Asset is not in custody at this supplier');
  }

  async getAsset(
    tenantSlug: string,
    access: AccessContext,
    assetId: string,
    opts: { supplierId?: string },
  ) {
    const { tenantId, supplierId } = await this.resolveSupplier(tenantSlug, access, opts.supplierId);
    const id = assetId.trim();
    await this.assertAssetPartnerScope(tenantId, supplierId, id);

    const asset = await this.prisma.tireAsset.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        brand: true,
        model: true,
        size: true,
        season: true,
        dot: true,
        treadMm: true,
        serialOrQr: true,
        placements: {
          where: { validTo: null },
          take: 1,
          include: {
            supplier: { select: { legalName: true } },
            vehicle: { select: { registrationNumber: true } },
          },
        },
        setItems: {
          take: 1,
          select: {
            setId: true,
            set: {
              select: {
                id: true,
                mountedAs: true,
                vehicleId: true,
                storageStays: {
                  where: { supplierId, checkOutAt: null },
                  take: 1,
                  include: {
                    warehouseLocation: { include: locationInclude },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!asset) throw new NotFoundException('Asset not found');

    const placement = asset.placements[0] ?? null;
    const setLink = asset.setItems[0] ?? null;
    const openStay = setLink?.set.storageStays[0] ?? null;

    const ledger = await this.tireLedger.ledgerForAssetAtTenant(tenantSlug, id);

    return {
      asset: {
        assetId: asset.id,
        brand: asset.brand,
        model: asset.model,
        size: asset.size,
        season: asset.season,
        dot: asset.dot,
        treadMm: asset.treadMm,
        serialOrQr: asset.serialOrQr,
      },
      placement: placement
        ? {
            kind: placement.kind,
            locationCode: placement.locationCode,
            supplierName: placement.supplier?.legalName ?? null,
            plate: placement.vehicle?.registrationNumber ?? null,
          }
        : null,
      stayLocation: openStay
        ? {
            stayId: openStay.id,
            locationCode: openStay.locationCode,
            warehouseLocationId: openStay.warehouseLocationId,
            location: openStay.warehouseLocation
              ? mapLocationNested(openStay.warehouseLocation)
              : null,
            locationLabel: openStay.warehouseLocation
              ? formatWarehouseLocationPath(openStay.warehouseLocation)
              : openStay.locationCode,
          }
        : null,
      set:
        setLink?.set
          ? {
              id: setLink.set.id,
              mountedAs: setLink.set.mountedAs,
            }
          : null,
      movements: ledger.movements,
    };
  }

  async patchAssetTread(
    tenantSlug: string,
    access: AccessContext,
    assetId: string,
    body: unknown,
    opts: { supplierId?: string },
  ) {
    assertPartnerOrTenantCustodyAccess(access);
    assertPartnerWrite(access);
    const o = body as Record<string, unknown>;
    const supplierId =
      typeof o.supplierId === 'string' && o.supplierId.trim()
        ? o.supplierId.trim()
        : opts.supplierId;

    const { tenantId, supplierId: sid } = await this.resolveSupplier(tenantSlug, access, supplierId);
    const id = assetId.trim();
    await this.assertAssetPartnerScope(tenantId, sid, id);

    const treadMm = coerceFiniteTreadMm(o.treadMm);
    if (treadMm === null) {
      throw new BadRequestException('Profil (mm) invalid — introduceți un număr ≥ 0');
    }

    let note: string | undefined;
    if (o.note !== undefined && o.note !== null) {
      const n = String(o.note).trim();
      if (n.length > 500) {
        throw new BadRequestException('Nota este prea lungă (max. 500 caractere)');
      }
      note = n || undefined;
    }

    const asset = await this.prisma.tireAsset.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        setItems: {
          take: 1,
          select: {
            setId: true,
            set: {
              select: {
                id: true,
                vehicleId: true,
                storageStays: {
                  where: { supplierId: sid, checkOutAt: null },
                  take: 1,
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    });
    if (!asset) throw new NotFoundException('Anvelopă negăsită');

    const setLink = asset.setItems[0];
    const openStay = setLink?.set.storageStays[0];
    if (!openStay) {
      throw new ForbiddenException('Anvelopa nu are un sejur activ la acest furnizor');
    }

    const setId = setLink?.setId ?? setLink?.set.id ?? null;
    const vehicleId = setLink?.set.vehicleId ?? null;

    const payload = {
      source: 'partner_custody_fiche',
      treadMm,
      ...(note ? { note } : {}),
    } satisfies Record<string, string | number>;

    await this.prisma.$transaction(async (tx) => {
      await tx.tireAsset.update({
        where: { id },
        data: { treadMm },
      });
      await tx.tireEvent.create({
        data: {
          tenantId,
          type: 'inspect',
          assetId: id,
          setId: setId ?? undefined,
          vehicleId: vehicleId ?? undefined,
          actorUserId: access.userId,
          payload: payload as Prisma.InputJsonValue,
        },
      });
    });

    return this.getAsset(tenantSlug, access, id, { supplierId: sid });
  }
}
