import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, VehicleTireSeason } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TireDomainService } from './tire-domain.service';
import { tireSetQrPayload } from './tire-domain.types';

export { tireSetQrPayload };

export type TireHotelCheckInParams = {
  tenantId: string;
  supplierId: string;
  setId: string;
  locationCode: string;
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
  /** Default at_client on the set's vehicle context. */
  releaseKind?: 'at_client';
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
    const locationCode = params.locationCode?.trim();
    if (!locationCode) {
      throw new BadRequestException('locationCode is required');
    }

    const set = await tx.tireSet.findFirst({
      where: { id: params.setId, tenantId: params.tenantId, archivedAt: null },
      include: { items: true, vehicle: { select: { id: true, registrationNumber: true } } },
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

    const now = new Date();

    const stay = await tx.tireStorageStay.create({
      data: {
        tenantId: params.tenantId,
        setId: params.setId,
        supplierId: params.supplierId,
        locationCode,
        checkInAt: now,
        intakePhotos: params.intakePhotos ?? undefined,
        intakeTreadNotes: params.intakeTreadNotes?.trim() || undefined,
        feeCents: params.feeCents ?? undefined,
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
    },
  ): Promise<void> {
    const locationCode = params.locationCode?.trim() || undefined;

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
        supplier: { select: { legalName: true } },
      },
    });
    if (openStay) {
      if (openStay.supplierId !== params.supplierId) {
        const hotelName = openStay.supplier.legalName?.trim() || openStay.supplierId;
        throw new BadRequestException(`Tire set is already in storage at ${hotelName}`);
      }
      if (locationCode && openStay.locationCode !== locationCode) {
        await tx.tireStorageStay.update({
          where: { id: openStay.id },
          data: { locationCode },
        });
      }
      return;
    }

    await tx.tireStorageStay.create({
      data: {
        tenantId: params.tenantId,
        setId: params.setId,
        supplierId: params.supplierId,
        locationCode,
        sourceSystem: params.sourceSystem?.trim() || 'tyre_close_seasonal',
        checkInAt: new Date(),
      },
    });
  }

  async checkOut(params: TireHotelCheckOutParams) {
    return this.prisma.$transaction(async (tx) => this.checkOutTx(tx, params));
  }

  async checkOutTx(tx: Prisma.TransactionClient, params: TireHotelCheckOutParams) {
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
            items: true,
            vehicle: { select: { id: true, registrationNumber: true } },
          },
        },
      },
    });
    if (!stay) throw new NotFoundException('Active storage stay not found');

    const now = new Date();
    const vehicleId = stay.set.vehicleId;

    for (const item of stay.set.items) {
      await this.tires.placeAssetTx(tx, {
        tenantId: params.tenantId,
        assetId: item.assetId,
        kind: 'at_client',
        setId: stay.setId,
        eventType: 'release',
        vehicleIdForEvent: vehicleId,
        actorUserId: params.actorUserId ?? undefined,
        payload: {
          source: 'tire_hotel_check_out',
          storageStayId: stay.id,
        },
      });
    }

    const updated = await tx.tireStorageStay.update({
      where: { id: stay.id },
      data: { checkOutAt: now },
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
      vehicle: { id: string; registrationNumber: string };
    },
  ) {
    return {
      id: stay.id,
      setId: stay.setId,
      supplierId: stay.supplierId,
      locationCode: stay.locationCode,
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
