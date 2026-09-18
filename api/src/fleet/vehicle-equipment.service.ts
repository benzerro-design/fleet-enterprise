import { Injectable, NotFoundException } from '@nestjs/common';
import type { AccessContext } from '../iam/access-context.types';
import { assertVehicleOpsRead, assertVehicleOpsWrite } from '../ops/ops-write-access';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateVehicleEquipmentDto,
  PatchVehicleEquipmentDto,
  VehicleEquipmentKind,
} from './dto/vehicle-equipment.dto';
import type {
  VehicleEquipmentPayload,
  VehicleEquipmentRecord,
} from './vehicle-equipment.types';

function toRecord(row: {
  id: string;
  vehicleId: string;
  kind: VehicleEquipmentKind;
  label: string;
  serialNumber: string | null;
  mountedOn: Date | null;
  removedOn: Date | null;
  notes: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): VehicleEquipmentRecord {
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    kind: row.kind,
    label: row.label,
    serialNumber: row.serialNumber,
    mountedOn: row.mountedOn ? row.mountedOn.toISOString() : null,
    removedOn: row.removedOn ? row.removedOn.toISOString() : null,
    notes: row.notes,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function parseOptionalDate(raw: string | null | undefined): Date | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw.trim() === '') return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

@Injectable()
export class VehicleEquipmentService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    tenantSlug: string,
    vehicleId: string,
    access?: AccessContext,
  ): Promise<VehicleEquipmentPayload> {
    await assertVehicleOpsRead(this.prisma, tenantSlug, vehicleId, access);
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenant: { slug: tenantSlug } },
      select: { id: true },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const rows = await this.prisma.vehicleEquipment.findMany({
      where: { vehicleId },
      orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return { items: rows.map(toRecord) };
  }

  async create(
    tenantSlug: string,
    vehicleId: string,
    dto: CreateVehicleEquipmentDto,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<VehicleEquipmentRecord> {
    await assertVehicleOpsWrite(this.prisma, tenantSlug, vehicleId, access);
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenant: { slug: tenantSlug } },
      select: { id: true, tenantId: true, registrationNumber: true },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const maxSort = await this.prisma.vehicleEquipment.aggregate({
      where: { vehicleId },
      _max: { sortOrder: true },
    });

    const row = await this.prisma.vehicleEquipment.create({
      data: {
        tenantId: vehicle.tenantId,
        vehicleId,
        kind: dto.kind ?? 'other',
        label: dto.label.trim(),
        serialNumber: dto.serialNumber?.trim() || null,
        mountedOn: parseOptionalDate(dto.mountedOn) ?? null,
        notes: dto.notes?.trim() || null,
        isActive: dto.isActive ?? true,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    });

    void actorUserId;
    return toRecord(row);
  }

  async patch(
    tenantSlug: string,
    vehicleId: string,
    itemId: string,
    dto: PatchVehicleEquipmentDto,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<VehicleEquipmentRecord> {
    await assertVehicleOpsWrite(this.prisma, tenantSlug, vehicleId, access);
    const existing = await this.prisma.vehicleEquipment.findFirst({
      where: { id: itemId, vehicleId, vehicle: { tenant: { slug: tenantSlug } } },
    });
    if (!existing) throw new NotFoundException('Equipment not found');

    const row = await this.prisma.vehicleEquipment.update({
      where: { id: itemId },
      data: {
        kind: dto.kind,
        label: dto.label === undefined ? undefined : dto.label.trim(),
        serialNumber:
          dto.serialNumber === undefined
            ? undefined
            : dto.serialNumber === null
              ? null
              : dto.serialNumber.trim() || null,
        mountedOn: parseOptionalDate(dto.mountedOn),
        removedOn: parseOptionalDate(dto.removedOn),
        notes:
          dto.notes === undefined
            ? undefined
            : dto.notes === null
              ? null
              : dto.notes.trim() || null,
        isActive: dto.isActive,
      },
    });

    void actorUserId;
    return toRecord(row);
  }

  async delete(
    tenantSlug: string,
    vehicleId: string,
    itemId: string,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<void> {
    await assertVehicleOpsWrite(this.prisma, tenantSlug, vehicleId, access);
    const existing = await this.prisma.vehicleEquipment.findFirst({
      where: { id: itemId, vehicleId, vehicle: { tenant: { slug: tenantSlug } } },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Equipment not found');
    await this.prisma.vehicleEquipment.delete({ where: { id: itemId } });
    void actorUserId;
  }
}
