import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AccessContext } from '../iam/access-context.types';
import {
  assertPartnerWrite,
  isPartnerUser,
  resolvePartnerSupplierIdsFilter,
} from '../iam/partner-access';
import { TireHotelService, tireSetQrPayload } from '../fleet/tires/tire-hotel.service';
import { parseTireSetSearchInput } from '../fleet/tires/tire-domain.types';
import { PrismaService } from '../prisma/prisma.service';
import { assertSupplierReadById } from '../suppliers/supplier-access';
import {
  assertSupplierTireStorage,
  supplierHasTireStorage,
} from '../suppliers/supplier-tire-capability';

function normalizePlate(raw: string | undefined): string | undefined {
  const p = raw?.trim().replace(/\s+/g, '').toUpperCase();
  return p || undefined;
}

@Injectable()
export class PartnerTireHotelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hotel: TireHotelService,
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
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: sid, tenantId: tenant.id },
      select: { legalName: true },
    });
    return { hasTireStorage, supplierId: sid, supplierName: supplier?.legalName ?? null };
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

  async listActiveStays(
    tenantSlug: string,
    access: AccessContext,
    opts: { supplierId?: string; plate?: string },
  ) {
    const { tenantId, supplierId } = await this.resolveSupplier(
      tenantSlug,
      access,
      opts.supplierId,
    );
    const searchRaw = opts.plate?.trim() ?? '';
    const parsed = searchRaw ? parseTireSetSearchInput(searchRaw) : null;
    const plate = parsed?.kind === 'plate' ? normalizePlate(parsed.plate) : undefined;
    const setId = parsed?.kind === 'setId' ? parsed.setId : undefined;

    const stays = await this.prisma.tireStorageStay.findMany({
      where: {
        tenantId,
        supplierId,
        checkOutAt: null,
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
      },
      orderBy: [{ checkInAt: 'desc' }],
      include: {
        set: {
          include: {
            vehicle: { select: { id: true, registrationNumber: true } },
          },
        },
      },
    });

    return {
      items: stays.map((s) =>
        this.hotel.stayToDto(s, {
          season: s.set.season,
          name: s.set.name,
          vehicle: s.set.vehicle,
        }),
      ),
    };
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

    const byVehicle = new Map<string, typeof sets>();
    for (const s of sets) {
      const list = byVehicle.get(s.vehicleId) ?? [];
      list.push(s);
      byVehicle.set(s.vehicleId, list);
    }

    return {
      vehicles: vehicles.map((v) => ({
        id: v.id,
        registrationNumber: v.registrationNumber,
        sets: (byVehicle.get(v.id) ?? []).map((s) => ({
          id: s.id,
          season: s.season,
          name: s.name,
          itemCount: s._count.items,
          qrPayload: tireSetQrPayload(s.id),
          hasActiveStayHere: s.storageStays.length > 0,
        })),
      })),
    };
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
      intakePhotos: dto.intakePhotos,
      intakeTreadNotes: dto.intakeTreadNotes,
      feeCents: dto.feeCents,
      contractRef: dto.contractRef,
      actorUserId: actorUserId ?? null,
      vehicleIdForEvent: dto.vehicleId ?? null,
      sourceSystem: isPartnerUser(access) ? 'partner_portal' : 'fleet_admin',
    });

    return { stay };
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

    const stay = await this.hotel.checkOut({
      tenantId,
      supplierId,
      stayId: dto.stayId,
      actorUserId: actorUserId ?? null,
    });

    return { stay };
  }
}

function assertCheckInBody(body: unknown): {
  supplierId?: string;
  setId: string;
  vehicleId?: string;
  locationCode: string;
  intakePhotos?: Prisma.InputJsonValue;
  intakeTreadNotes?: string;
  feeCents?: number;
  contractRef?: string;
} {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('Body must be an object');
  }
  const o = body as Record<string, unknown>;
  const setId = typeof o.setId === 'string' ? o.setId.trim() : '';
  const locationCode = typeof o.locationCode === 'string' ? o.locationCode.trim() : '';
  if (!setId) throw new BadRequestException('setId is required');
  if (!locationCode) throw new BadRequestException('locationCode is required');

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

  return {
    supplierId,
    setId,
    vehicleId,
    locationCode,
    intakePhotos,
    intakeTreadNotes:
      o.intakeTreadNotes === undefined || o.intakeTreadNotes === null
        ? undefined
        : String(o.intakeTreadNotes),
    feeCents,
    contractRef:
      o.contractRef === undefined || o.contractRef === null ? undefined : String(o.contractRef),
  };
}

function assertCheckOutBody(body: unknown): { supplierId?: string; stayId: string } {
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
  return { supplierId, stayId };
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
