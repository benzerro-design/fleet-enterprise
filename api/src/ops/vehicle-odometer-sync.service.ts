import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { OpsOdometerEntity, VehicleOdometerSyncPayload } from './vehicle-odometer-sync.types';

export function resolveTripOdometerKmForSync(input: {
  odometerStartKm: number | null;
  odometerEndKm: number | null;
}): number | null {
  if (input.odometerEndKm != null && input.odometerEndKm >= 0) {
    return Math.round(input.odometerEndKm);
  }
  if (input.odometerStartKm != null && input.odometerStartKm >= 0) {
    return Math.round(input.odometerStartKm);
  }
  return null;
}

@Injectable()
export class VehicleOdometerSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async syncFromOps(input: {
    tenantId: string;
    vehicleId: string;
    registrationNumber: string;
    odometerKm: number | null | undefined;
    recordedAt: Date;
    entity: OpsOdometerEntity;
    entityId: string;
    entityLabel: string;
    actorUserId?: string;
  }): Promise<VehicleOdometerSyncPayload | null> {
    if (input.odometerKm == null || !Number.isFinite(input.odometerKm) || input.odometerKm < 0) {
      return null;
    }

    const km = Math.round(input.odometerKm);
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: input.vehicleId, tenantId: input.tenantId },
      select: { id: true, odometerKm: true, registrationNumber: true },
    });
    if (!vehicle) return null;

    const previousKm = vehicle.odometerKm;

    if (km < previousKm) {
      return {
        updated: false,
        previousKm,
        newKm: previousKm,
        message: `Km introdus (${km.toLocaleString('ro-RO')}) este sub km curent vehicul (${previousKm.toLocaleString('ro-RO')}). Km vehicul rămas neschimbat.`,
      };
    }

    if (km === previousKm) {
      return {
        updated: false,
        previousKm,
        newKm: previousKm,
        message: `Km introdus este egal cu km curent vehicul (${previousKm.toLocaleString('ro-RO')}). Nicio actualizare.`,
      };
    }

    await this.prisma.odometerReading.create({
      data: {
        vehicleId: input.vehicleId,
        odometerKm: km,
        source: 'ops',
        sourceRef: `${input.entity}:${input.entityId}`,
        notes: `Actualizare din ${input.entityLabel}`,
        recordedAt: input.recordedAt,
        recordedByUserId: input.actorUserId ?? null,
      },
    });

    await this.prisma.vehicle.update({
      where: { id: input.vehicleId },
      data: {
        odometerKm: km,
        updatedByUserId: input.actorUserId ?? undefined,
      },
    });

    await this.audit.logVehicle({
      tenantUuid: input.tenantId,
      actorUserId: input.actorUserId ?? undefined,
      action: 'odometer_update',
      vehicleId: input.vehicleId,
      meta: {
        registrationNumber: input.registrationNumber,
        odometerKm: km,
        source: 'ops',
        previousKm,
        opsEntity: input.entity,
        opsEntityId: input.entityId,
      },
    });

    return {
      updated: true,
      previousKm,
      newKm: km,
      message: `Km curent vehicul actualizat: ${previousKm.toLocaleString('ro-RO')} → ${km.toLocaleString('ro-RO')} (din ${input.entityLabel}).`,
    };
  }
}
