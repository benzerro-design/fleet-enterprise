import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, VehicleTireSeason } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TireDomainService } from './tire-domain.service';
import { tireSetQrPayload } from './tire-domain.types';
import {
  computeStorageStayFeeCents,
  dominantRimInchFromSizes,
  mergeTireStorageFeeCatalog,
  resolveTireStorageFeeCents,
  type TireStorageFeeCatalog,
} from './tire-storage-fee';
import { resolveStayLocationInput, parseStayLocation } from './tire-stay-location';
import { parseTireSettings } from '../../tenant/tire-settings';

export { tireSetQrPayload };

export type TireHotelReleaseKind = 'at_client' | 'in_transit' | 'scrap' | 'quarantine';

export type TireHotelCheckInParams = {
  tenantId: string;
  supplierId: string;
  setId: string;
  locationCode?: string | null;
  bayCode?: string | null;
  binCode?: string | null;
  intakePhotos?: Prisma.InputJsonValue;
  intakeTreadNotes?: string | null;
  feeCents?: number | null;
  contractRef?: string | null;
  actorUserId?: string | null;
  workOrderId?: string | null;
  vehicleIdForEvent?: string | null;
  sourceSystem?: string | null;
  externalId?: string | null;
};

export type TireHotelCheckOutParams = {
  tenantId: string;
  supplierId: string;
  stayId: string;
  actorUserId?: string | null;
  /** Default at_client. */
  releaseKind?: TireHotelReleaseKind;
};

export type TireHotelRelocateParams = {
  tenantId: string;
  supplierId: string;
  stayId: string;
  locationCode?: string | null;
  bayCode?: string | null;
  binCode?: string | null;
  actorUserId?: string | null;
};

@Injectable()
export class TireHotelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tires: TireDomainService,
  ) {}

  async checkIn(params: TireHotelCheckInParams) {
    return this.prisma.$transaction(async (tx) => this.checkInTx(tx, params));
  }

  async checkInTx(tx: Prisma.TransactionClient, params: TireHotelCheckInParams) {
    const loc = resolveStayLocationInput({
      locationCode: params.locationCode,
      bayCode: params.bayCode,
      binCode: params.binCode,
    });
    const locationCode = loc.locationCode;
    if (!locationCode) {
      throw new BadRequestException('locationCode or bayCode is required');
    }

    const set = await tx.tireSet.findFirst({
      where: { id: params.setId, tenantId: params.tenantId, archivedAt: null },
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
    });
    if (!set) throw new NotFoundException('Tire set not found');
    if (set.items.length === 0) {
      throw new BadRequestException('Tire set has no assets');
    }

    const openStay = await tx.tireStorageStay.findFirst({
      where: {
        tenantId: params.tenantId,
        setId: params.setId,
        checkOutAt: null,
      },
      include: { supplier: { select: { legalName: true } } },
    });
    if (openStay) {
      const hotelName = openStay.supplier.legalName?.trim() || openStay.supplierId;
      throw new BadRequestException(
        openStay.supplierId === params.supplierId
          ? `Tire set is already checked in at this hotel (${hotelName})`
          : `Tire set is already in storage at ${hotelName}`,
      );
    }

    const foreignHotelPlacement = await tx.tirePlacement.findFirst({
      where: {
        tenantId: params.tenantId,
        setId: params.setId,
        kind: 'at_supplier_hotel',
        validTo: null,
        supplierId: { not: params.supplierId },
      },
      include: { supplier: { select: { legalName: true } } },
    });
    if (foreignHotelPlacement?.supplierId) {
      const hotelName =
        foreignHotelPlacement.supplier?.legalName?.trim() || foreignHotelPlacement.supplierId;
      throw new BadRequestException(`Tire set is already in storage at ${hotelName}`);
    }

    const setAssetIds = set.items.map((item) => item.assetId);
    const mountedOnVehicle = await tx.tirePlacement.findFirst({
      where: {
        tenantId: params.tenantId,
        assetId: { in: setAssetIds },
        kind: 'on_vehicle',
        validTo: null,
      },
      select: { id: true },
    });
    if (mountedOnVehicle) {
      throw new BadRequestException(
        'Setul este montat pe vehicul; faceți demont/WO R înainte de check-in hotel',
      );
    }

    const atClientPlacement = await tx.tirePlacement.findFirst({
      where: {
        tenantId: params.tenantId,
        setId: params.setId,
        kind: 'at_client',
        validTo: null,
      },
      select: { id: true },
    });
    if (!atClientPlacement) {
      throw new BadRequestException(
        'Check-in hotel doar pentru seturi în depozit (la client), nu montate/hotel/neplasate',
      );
    }

    const now = new Date();

    let feeCents = params.feeCents;
    if (feeCents === undefined) {
      const unitMonthly = await this.resolveFeeCentsForSetTx(tx, {
        tenantId: params.tenantId,
        supplierId: params.supplierId,
        clientId: set.vehicle.clientId,
        mountedAs: set.mountedAs,
        sizes: set.items.map((i) => i.asset.size),
      });
      const minMonths = await this.resolveHotelMinMonthsTx(tx, params.tenantId);
      // Open stay: bill min N calendar months × pieces (unit = /bucată/lună).
      feeCents =
        computeStorageStayFeeCents({
          unitMonthlyPerPieceCents: unitMonthly,
          pieceCount: set.items.length,
          checkInAt: now,
          billThroughAt: null,
          minMonths,
        })?.feeCents ?? null;
    }

    const stay = await tx.tireStorageStay.create({
      data: {
        tenantId: params.tenantId,
        setId: params.setId,
        supplierId: params.supplierId,
        locationCode,
        checkInAt: now,
        intakePhotos: params.intakePhotos ?? undefined,
        intakeTreadNotes: params.intakeTreadNotes?.trim() || undefined,
        feeCents: feeCents ?? undefined,
        contractRef: params.contractRef?.trim() || undefined,
        externalId: params.externalId?.trim() || undefined,
        sourceSystem: params.sourceSystem?.trim() || undefined,
      },
    });

    const vehicleIdForEvent = params.vehicleIdForEvent ?? set.vehicleId;
    for (const item of set.items) {
      await this.tires.placeAssetTx(tx, {
        tenantId: params.tenantId,
        assetId: item.assetId,
        kind: 'at_supplier_hotel',
        supplierId: params.supplierId,
        locationCode,
        setId: params.setId,
        eventType: 'store',
        vehicleIdForEvent,
        workOrderId: params.workOrderId ?? undefined,
        actorUserId: params.actorUserId ?? undefined,
        payload: {
          source: 'tire_hotel_check_in',
          storageStayId: stay.id,
          locationCode,
        },
      });
    }

    if (vehicleIdForEvent) {
      await this.tires.syncFitmentProjectionTx(tx, params.tenantId, vehicleIdForEvent);
    }

    return this.stayToDto(stay, set);
  }

  /** Placements already at hotel — create stay row only (e.g. WO seasonal close). */
  async recordStayAfterStoreTx(
    tx: Prisma.TransactionClient,
    params: {
      tenantId: string;
      supplierId: string;
      setId: string;
      locationCode?: string | null;
      workOrderId?: string | null;
      sourceSystem?: string | null;
      /** Profiluri demontate din tyre-close (text pentru partener hotel). */
      intakeTreadNotes?: string | null;
      feeCents?: number | null;
    },
  ): Promise<void> {
    const locationCode = params.locationCode?.trim() || undefined;
    const intakeTreadNotes = params.intakeTreadNotes?.trim() || undefined;

    const openStay = await tx.tireStorageStay.findFirst({
      where: {
        tenantId: params.tenantId,
        setId: params.setId,
        checkOutAt: null,
      },
      select: {
        id: true,
        supplierId: true,
        locationCode: true,
        intakeTreadNotes: true,
        feeCents: true,
        supplier: { select: { legalName: true } },
      },
    });
    if (openStay) {
      if (openStay.supplierId !== params.supplierId) {
        const hotelName = openStay.supplier.legalName?.trim() || openStay.supplierId;
        throw new BadRequestException(`Tire set is already in storage at ${hotelName}`);
      }
      const patch: { locationCode?: string; intakeTreadNotes?: string; feeCents?: number } = {};
      if (locationCode && openStay.locationCode !== locationCode) {
        patch.locationCode = locationCode;
      }
      if (intakeTreadNotes && !openStay.intakeTreadNotes?.trim()) {
        patch.intakeTreadNotes = intakeTreadNotes;
      }
      if (params.feeCents != null && openStay.feeCents == null) {
        patch.feeCents = params.feeCents;
      }
      if (Object.keys(patch).length > 0) {
        await tx.tireStorageStay.update({
          where: { id: openStay.id },
          data: patch,
        });
      }
      return;
    }

    let feeCents = params.feeCents;
    if (feeCents === undefined) {
      const set = await tx.tireSet.findFirst({
        where: { id: params.setId, tenantId: params.tenantId },
        select: {
          mountedAs: true,
          vehicle: { select: { clientId: true } },
          items: { select: { asset: { select: { size: true } } } },
        },
      });
      if (set) {
        const unitMonthly = await this.resolveFeeCentsForSetTx(tx, {
          tenantId: params.tenantId,
          supplierId: params.supplierId,
          clientId: set.vehicle.clientId,
          mountedAs: set.mountedAs,
          sizes: set.items.map((i) => i.asset.size),
        });
        const now = new Date();
        const minMonths = await this.resolveHotelMinMonthsTx(tx, params.tenantId);
        feeCents =
          computeStorageStayFeeCents({
            unitMonthlyPerPieceCents: unitMonthly,
            pieceCount: set.items.length,
            checkInAt: now,
            billThroughAt: null,
            minMonths,
          })?.feeCents ?? null;
      }
    }

    await tx.tireStorageStay.create({
      data: {
        tenantId: params.tenantId,
        setId: params.setId,
        supplierId: params.supplierId,
        locationCode,
        intakeTreadNotes,
        feeCents: feeCents ?? undefined,
        sourceSystem: params.sourceSystem?.trim() || 'tyre_close_seasonal',
        checkInAt: new Date(),
      },
    });
  }

  private async resolveHotelMinMonthsTx(
    tx: { tenant: Prisma.TransactionClient['tenant'] },
    tenantId: string,
  ): Promise<number> {
    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { tireSettings: true },
    });
    return parseTireSettings(tenant?.tireSettings).hotelMinBillableMonths;
  }

  private async resolveFeeCentsForSetTx(
    tx: {
      supplier: Prisma.TransactionClient['supplier'];
      clientSupplierAllocation: Prisma.TransactionClient['clientSupplierAllocation'];
    },
    params: {
      tenantId: string;
      supplierId: string;
      clientId?: string | null;
      mountedAs: string | null;
      sizes: Array<string | null | undefined>;
    },
  ): Promise<number | null> {
    const supplier = await tx.supplier.findFirst({
      where: { id: params.supplierId, tenantId: params.tenantId },
      select: {
        tireStorageFeeTyreOnlyCents: true,
        tireStorageFeeOnRimCents: true,
        tireStorageFeeBands: true,
      },
    });
    if (!supplier) return null;
    let catalog: TireStorageFeeCatalog = {
      tireStorageFeeTyreOnlyCents: supplier.tireStorageFeeTyreOnlyCents,
      tireStorageFeeOnRimCents: supplier.tireStorageFeeOnRimCents,
      tireStorageFeeBands: supplier.tireStorageFeeBands,
    };
    if (params.clientId) {
      const alloc = await tx.clientSupplierAllocation.findFirst({
        where: {
          tenantId: params.tenantId,
          clientId: params.clientId,
          supplierId: params.supplierId,
        },
        select: {
          tireStorageFeeTyreOnlyCents: true,
          tireStorageFeeOnRimCents: true,
          tireStorageFeeBands: true,
        },
      });
      if (alloc) {
        catalog = mergeTireStorageFeeCatalog(catalog, {
          tireStorageFeeTyreOnlyCents: alloc.tireStorageFeeTyreOnlyCents,
          tireStorageFeeOnRimCents: alloc.tireStorageFeeOnRimCents,
          tireStorageFeeBands: alloc.tireStorageFeeBands,
        });
      }
    }
    return resolveTireStorageFeeCents({
      catalog,
      mountedAs: params.mountedAs,
      rimInch: dominantRimInchFromSizes(params.sizes),
    });
  }

  /** Quote storage fee for a set at a hotel supplier (preview before check-in). */
  async quoteFeeForSet(params: {
    tenantId: string;
    supplierId: string;
    setId: string;
    billThroughAt?: Date | null;
  }): Promise<{
    setId: string;
    supplierId: string;
    /** Total for period (pieces × unit × months). */
    feeCents: number | null;
    unitMonthlyPerPieceCents: number | null;
    pieceCount: number;
    calendarMonths: number;
    billingUnit: 'piece';
    billingPeriod: 'calendar_month';
    rimInch: number | null;
    mountedAs: string | null;
    dominantSize: string | null;
  }> {
    const set = await this.prisma.tireSet.findFirst({
      where: { id: params.setId, tenantId: params.tenantId, archivedAt: null },
      select: {
        id: true,
        mountedAs: true,
        vehicle: { select: { clientId: true } },
        items: { select: { asset: { select: { size: true } } } },
      },
    });
    if (!set) throw new NotFoundException('Tire set not found');
    const sizes = set.items.map((i) => i.asset.size);
    const rimInch = dominantRimInchFromSizes(sizes);
    const unitMonthlyPerPieceCents = await this.resolveFeeCentsForSetTx(this.prisma, {
      tenantId: params.tenantId,
      supplierId: params.supplierId,
      clientId: set.vehicle.clientId,
      mountedAs: set.mountedAs,
      sizes,
    });
    const now = new Date();
    const minMonths = await this.resolveHotelMinMonthsTx(this.prisma, params.tenantId);
    const breakdown = computeStorageStayFeeCents({
      unitMonthlyPerPieceCents,
      pieceCount: set.items.length,
      checkInAt: now,
      billThroughAt: params.billThroughAt ?? null,
      minMonths,
    });
    const sizeCounts = new Map<string, number>();
    for (const size of sizes) {
      const key = size?.trim();
      if (!key) continue;
      sizeCounts.set(key, (sizeCounts.get(key) ?? 0) + 1);
    }
    let dominantSize: string | null = null;
    let best = -1;
    for (const [size, count] of sizeCounts) {
      if (count > best) {
        dominantSize = size;
        best = count;
      }
    }
    return {
      setId: set.id,
      supplierId: params.supplierId,
      feeCents: breakdown?.feeCents ?? null,
      unitMonthlyPerPieceCents,
      pieceCount: set.items.length,
      calendarMonths: breakdown?.calendarMonths ?? 1,
      billingUnit: 'piece',
      billingPeriod: 'calendar_month',
      rimInch,
      mountedAs: set.mountedAs,
      dominantSize,
    };
  }

  async relocate(params: TireHotelRelocateParams) {
    return this.prisma.$transaction(async (tx) => this.relocateTx(tx, params));
  }

  async relocateTx(tx: Prisma.TransactionClient, params: TireHotelRelocateParams) {
    const loc = resolveStayLocationInput({
      locationCode: params.locationCode,
      bayCode: params.bayCode,
      binCode: params.binCode,
    });
    if (!loc.locationCode) {
      throw new BadRequestException('locationCode or bayCode is required');
    }

    const stay = await tx.tireStorageStay.findFirst({
      where: {
        id: params.stayId,
        tenantId: params.tenantId,
        supplierId: params.supplierId,
        checkOutAt: null,
      },
      include: {
        set: {
          include: {
            vehicle: { select: { id: true, registrationNumber: true } },
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
    });
    if (!stay) throw new NotFoundException('Active storage stay not found');

    const fromCode = stay.locationCode;
    const updated = await tx.tireStorageStay.update({
      where: { id: stay.id },
      data: { locationCode: loc.locationCode },
    });

    for (const item of stay.set.items) {
      await this.tires.placeAssetTx(tx, {
        tenantId: params.tenantId,
        assetId: item.assetId,
        kind: 'at_supplier_hotel',
        supplierId: params.supplierId,
        locationCode: loc.locationCode,
        setId: stay.setId,
        eventType: 'transfer',
        vehicleIdForEvent: stay.set.vehicleId,
        actorUserId: params.actorUserId ?? undefined,
        payload: {
          source: 'tire_hotel_relocate',
          storageStayId: stay.id,
          fromLocationCode: fromCode,
          toLocationCode: loc.locationCode,
        },
      });
    }

    return this.stayToDto(updated, stay.set);
  }

  async checkOut(params: TireHotelCheckOutParams) {
    return this.prisma.$transaction(async (tx) => this.checkOutTx(tx, params));
  }

  async checkOutTx(tx: Prisma.TransactionClient, params: TireHotelCheckOutParams) {
    const releaseKind: TireHotelReleaseKind = params.releaseKind ?? 'at_client';
    if (!['at_client', 'in_transit', 'scrap', 'quarantine'].includes(releaseKind)) {
      throw new BadRequestException('releaseKind invalid');
    }

    const stay = await tx.tireStorageStay.findFirst({
      where: {
        id: params.stayId,
        tenantId: params.tenantId,
        supplierId: params.supplierId,
        checkOutAt: null,
      },
      include: {
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
    });
    if (!stay) throw new NotFoundException('Active storage stay not found');

    const now = new Date();
    const vehicleId = stay.set.vehicleId;
    const eventType =
      releaseKind === 'scrap' ? ('scrap' as const) : ('release' as const);

    for (const item of stay.set.items) {
      await this.tires.placeAssetTx(tx, {
        tenantId: params.tenantId,
        assetId: item.assetId,
        kind: releaseKind,
        setId: stay.setId,
        eventType,
        vehicleIdForEvent: vehicleId,
        actorUserId: params.actorUserId ?? undefined,
        payload: {
          source: 'tire_hotel_check_out',
          storageStayId: stay.id,
          releaseKind,
        },
      });
    }

    // Recalculate stay total: unit(/buc/lună) × pieces × luni calendaristice inclusive.
    let feeCents = stay.feeCents;
    const unitMonthly = await this.resolveFeeCentsForSetTx(tx, {
      tenantId: params.tenantId,
      supplierId: params.supplierId,
      clientId: stay.set.vehicle.clientId,
      mountedAs: stay.set.mountedAs ?? null,
      sizes: stay.set.items.map((i) => i.asset.size),
    });
    const minMonths = await this.resolveHotelMinMonthsTx(tx, params.tenantId);
    const breakdown = computeStorageStayFeeCents({
      unitMonthlyPerPieceCents: unitMonthly,
      pieceCount: stay.set.items.length,
      checkInAt: stay.checkInAt,
      billThroughAt: now,
      minMonths,
    });
    if (breakdown) feeCents = breakdown.feeCents;

    const updated = await tx.tireStorageStay.update({
      where: { id: stay.id },
      data: { checkOutAt: now, feeCents: feeCents ?? undefined },
    });

    if (vehicleId) {
      await this.tires.syncFitmentProjectionTx(tx, params.tenantId, vehicleId);
    }

    return this.stayToDto(updated, stay.set);
  }

  stayToDto(
    stay: {
      id: string;
      setId: string;
      supplierId: string;
      locationCode: string | null;
      checkInAt: Date;
      checkOutAt: Date | null;
      intakePhotos?: Prisma.JsonValue | null;
      intakeTreadNotes: string | null;
      feeCents: number | null;
      contractRef: string | null;
    },
    set: {
      season: VehicleTireSeason;
      name: string | null;
      mountedAs?: string | null;
      vehicle: { id: string; registrationNumber: string };
      items?: Array<{
        asset: {
          id: string;
          brand: string | null;
          model: string | null;
          size: string | null;
          dot: string | null;
          treadMm: number | null;
          serialOrQr: string | null;
        };
      }>;
    },
  ) {
    const items = (set.items ?? []).map((i) => ({
      assetId: i.asset.id,
      brand: i.asset.brand,
      model: i.asset.model,
      size: i.asset.size,
      dot: i.asset.dot,
      treadMm: i.asset.treadMm,
      serialOrQr: i.asset.serialOrQr,
    }));
    const loc = parseStayLocation(stay.locationCode);
    return {
      id: stay.id,
      setId: stay.setId,
      supplierId: stay.supplierId,
      locationCode: stay.locationCode,
      bayCode: loc.bayCode,
      binCode: loc.binCode,
      checkInAt: stay.checkInAt.toISOString(),
      checkOutAt: stay.checkOutAt ? stay.checkOutAt.toISOString() : null,
      intakePhotos: normalizeIntakePhotoUrls(stay.intakePhotos),
      intakeTreadNotes: stay.intakeTreadNotes,
      feeCents: stay.feeCents,
      contractRef: stay.contractRef,
      plate: set.vehicle.registrationNumber,
      vehicleId: set.vehicle.id,
      season: set.season,
      setName: set.name,
      mountedAs: set.mountedAs ?? null,
      itemCount: items.length,
      items,
      qrPayload: tireSetQrPayload(stay.setId),
    };
  }
}

function normalizeIntakePhotoUrls(value: Prisma.JsonValue | null | undefined): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((url) => url.trim())
      .filter(Boolean);
  }
  return [];
}
