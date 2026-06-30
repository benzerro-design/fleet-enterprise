import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  analyzeOdometerTimeline,
  buildOdometerSyncPrimaryMessage,
  computeCurrentKmFromTimeline,
  validateNewOdometerEntry,
} from './vehicle-odometer-timeline';
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
    const sourceRef = `${input.entity}:${input.entityId}`;

    const existingRows = await this.prisma.odometerReading.findMany({
      where: { vehicleId: input.vehicleId },
      select: { odometerKm: true, recordedAt: true, sourceRef: true },
    });

    const existingForTimeline = existingRows
      .filter((r) => r.sourceRef !== sourceRef)
      .map((r) => ({ odometerKm: r.odometerKm, recordedAt: r.recordedAt }));

    const validation = validateNewOdometerEntry(
      existingForTimeline,
      { odometerKm: km, recordedAt: input.recordedAt },
      previousKm,
    );

    await this.prisma.odometerReading.deleteMany({
      where: { vehicleId: input.vehicleId, sourceRef },
    });

    await this.prisma.odometerReading.create({
      data: {
        vehicleId: input.vehicleId,
        odometerKm: km,
        source: 'ops',
        sourceRef,
        notes: `Actualizare din ${input.entityLabel}`,
        recordedAt: input.recordedAt,
        recordedByUserId: input.actorUserId ?? null,
      },
    });

    const newKm = validation.newCurrentKm;
    const updated = validation.willUpdateCurrentKm && newKm !== previousKm;

    if (updated) {
      await this.prisma.vehicle.update({
        where: { id: input.vehicleId },
        data: {
          odometerKm: newKm,
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
          odometerKm: newKm,
          source: 'ops',
          previousKm,
          opsEntity: input.entity,
          opsEntityId: input.entityId,
          timelineSeverity: validation.severity,
        },
      });
    }

    return {
      updated,
      previousKm,
      newKm,
      message: buildOdometerSyncPrimaryMessage(validation, previousKm),
      severity: validation.severity,
      messages: validation.messages,
      timelineConsistent: validation.timelineAnalysis.isConsistent,
      readingCreated: true,
    };
  }

  async reconcileVehicleOdometerKm(
    vehicleId: string,
    tenantId: string,
    actorUserId?: string,
  ): Promise<{ previousKm: number; newKm: number; reconciled: boolean }> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenantId },
      select: { id: true, odometerKm: true, registrationNumber: true },
    });
    if (!vehicle) {
      return { previousKm: 0, newKm: 0, reconciled: false };
    }

    const rows = await this.prisma.odometerReading.findMany({
      where: { vehicleId },
      select: { odometerKm: true, recordedAt: true },
    });

    const timelineKm = computeCurrentKmFromTimeline(rows);
    if (timelineKm == null || timelineKm === vehicle.odometerKm) {
      return { previousKm: vehicle.odometerKm, newKm: vehicle.odometerKm, reconciled: false };
    }

    await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        odometerKm: timelineKm,
        updatedByUserId: actorUserId ?? undefined,
      },
    });

    await this.audit.logVehicle({
      tenantUuid: tenantId,
      actorUserId: actorUserId ?? undefined,
      action: 'odometer_update',
      vehicleId,
      meta: {
        registrationNumber: vehicle.registrationNumber,
        odometerKm: timelineKm,
        source: 'reconcile',
        previousKm: vehicle.odometerKm,
      },
    });

    return { previousKm: vehicle.odometerKm, newKm: timelineKm, reconciled: true };
  }

  async analyzeVehicleTimeline(vehicleId: string) {
    const rows = await this.prisma.odometerReading.findMany({
      where: { vehicleId },
      select: { id: true, odometerKm: true, recordedAt: true },
      orderBy: { recordedAt: 'asc' },
    });
    return analyzeOdometerTimeline(rows);
  }
}
