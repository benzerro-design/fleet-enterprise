import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { AccessContext } from '../iam/access-context.types';
import { assertPartnerWrite, resolvePartnerSupplierIdsFilter } from '../iam/partner-access';
import { tireLocationQrPayload } from '../fleet/tires/tire-domain.types';
import { PrismaService } from '../prisma/prisma.service';
import { assertSupplierReadById } from '../suppliers/supplier-access';
import { assertSupplierTireStorage } from '../suppliers/supplier-tire-capability';

function normalizeCode(raw: unknown): string {
  const code = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  if (!code || code.length > 32) {
    throw new BadRequestException('code is required (max 32 characters)');
  }
  return code;
}

function optionalString(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  const s = typeof raw === 'string' ? raw.trim() : '';
  return s || undefined;
}

function mapPrismaUnique(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    const target = Array.isArray(e.meta?.target) ? (e.meta.target as string[]).join(', ') : 'code';
    throw new ConflictException(`Un cod de tip „${target}” există deja la acest nivel.`);
  }
  throw e;
}

@Injectable()
export class PartnerTireWarehouseService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveTenant(tenantSlug: string): Promise<{ tenantId: string }> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return { tenantId: tenant.id };
  }

  private async assertSupplierScope(
    tenantSlug: string,
    tenantId: string,
    supplierId: string,
    access: AccessContext,
  ): Promise<void> {
    await assertSupplierReadById(this.prisma, tenantSlug, supplierId, access);
    await assertSupplierTireStorage(this.prisma, tenantId, supplierId);
  }

  private async resolveSupplier(
    tenantSlug: string,
    access: AccessContext,
    supplierId?: string,
  ): Promise<{ tenantId: string; supplierId: string }> {
    const { tenantId } = await this.resolveTenant(tenantSlug);

    const ids = resolvePartnerSupplierIdsFilter(access, supplierId ? [supplierId] : undefined);
    const sid = ids?.length === 1 ? ids[0]! : supplierId?.trim();
    if (!sid) {
      throw new BadRequestException('supplierId is required');
    }
    await this.assertSupplierScope(tenantSlug, tenantId, sid, access);
    return { tenantId, supplierId: sid };
  }

  private async getWarehouseForAccess(
    tenantSlug: string,
    access: AccessContext,
    warehouseId: string,
  ) {
    const { tenantId } = await this.resolveTenant(tenantSlug);
    const row = await this.prisma.tireWarehouse.findFirst({
      where: { id: warehouseId.trim(), tenantId },
    });
    if (!row) throw new NotFoundException('Warehouse not found');
    await this.assertSupplierScope(tenantSlug, tenantId, row.supplierId, access);
    return row;
  }

  private async getZoneForAccess(tenantSlug: string, access: AccessContext, zoneId: string) {
    const { tenantId } = await this.resolveTenant(tenantSlug);
    const zone = await this.prisma.tireWarehouseZone.findFirst({
      where: { id: zoneId.trim(), tenantId },
      include: { warehouse: true },
    });
    if (!zone) throw new NotFoundException('Zone not found');
    await this.assertSupplierScope(tenantSlug, tenantId, zone.warehouse.supplierId, access);
    return zone;
  }

  private async getRowForAccess(tenantSlug: string, access: AccessContext, rowId: string) {
    const { tenantId } = await this.resolveTenant(tenantSlug);
    const row = await this.prisma.tireWarehouseRow.findFirst({
      where: { id: rowId.trim(), tenantId },
      include: { zone: { include: { warehouse: true } } },
    });
    if (!row) throw new NotFoundException('Row not found');
    await this.assertSupplierScope(tenantSlug, tenantId, row.zone.warehouse.supplierId, access);
    return row;
  }

  private async getLocationForAccess(tenantSlug: string, access: AccessContext, locationId: string) {
    const { tenantId } = await this.resolveTenant(tenantSlug);
    const location = await this.prisma.tireWarehouseLocation.findFirst({
      where: { id: locationId.trim(), tenantId },
      include: { row: { include: { zone: { include: { warehouse: true } } } } },
    });
    if (!location) throw new NotFoundException('Location not found');
    await this.assertSupplierScope(
      tenantSlug,
      tenantId,
      location.row.zone.warehouse.supplierId,
      access,
    );
    return location;
  }

  async listWarehouses(tenantSlug: string, access: AccessContext, supplierId?: string) {
    const { tenantId, supplierId: sid } = await this.resolveSupplier(tenantSlug, access, supplierId);
    return this.prisma.tireWarehouse.findMany({
      where: { tenantId, supplierId: sid },
      orderBy: [{ active: 'desc' }, { code: 'asc' }],
    });
  }

  async createWarehouse(tenantSlug: string, access: AccessContext, body: unknown) {
    assertPartnerWrite(access);
    const b = body as Record<string, unknown>;
    const supplierId = typeof b.supplierId === 'string' ? b.supplierId.trim() : '';
    if (!supplierId) throw new BadRequestException('supplierId is required');
    const { tenantId, supplierId: sid } = await this.resolveSupplier(tenantSlug, access, supplierId);
    const code = normalizeCode(b.code);
    const name = optionalString(b.name) ?? code;
    try {
      return await this.prisma.tireWarehouse.create({
        data: {
          tenantId,
          supplierId: sid,
          code,
          name,
          addressLine: optionalString(b.addressLine),
          city: optionalString(b.city),
        },
      });
    } catch (e) {
      mapPrismaUnique(e);
    }
  }

  async patchWarehouse(tenantSlug: string, access: AccessContext, warehouseId: string, body: unknown) {
    assertPartnerWrite(access);
    const b = body as Record<string, unknown>;
    const row = await this.getWarehouseForAccess(tenantSlug, access, warehouseId);
    return this.prisma.tireWarehouse.update({
      where: { id: row.id },
      data: {
        ...(b.name !== undefined ? { name: optionalString(b.name) ?? row.name } : {}),
        ...(b.addressLine !== undefined ? { addressLine: optionalString(b.addressLine) ?? null } : {}),
        ...(b.city !== undefined ? { city: optionalString(b.city) ?? null } : {}),
        ...(typeof b.active === 'boolean' ? { active: b.active } : {}),
      },
    });
  }

  async listZones(tenantSlug: string, access: AccessContext, warehouseId: string) {
    const wh = await this.getWarehouseForAccess(tenantSlug, access, warehouseId);
    return this.prisma.tireWarehouseZone.findMany({
      where: { tenantId: wh.tenantId, warehouseId: wh.id },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
  }

  async createZone(tenantSlug: string, access: AccessContext, warehouseId: string, body: unknown) {
    assertPartnerWrite(access);
    const b = body as Record<string, unknown>;
    const wh = await this.getWarehouseForAccess(tenantSlug, access, warehouseId);
    const code = normalizeCode(b.code);
    const sortOrder =
      typeof b.sortOrder === 'number' && Number.isFinite(b.sortOrder) ? Math.trunc(b.sortOrder) : 0;
    try {
      return await this.prisma.tireWarehouseZone.create({
        data: {
          tenantId: wh.tenantId,
          warehouseId: wh.id,
          code,
          name: optionalString(b.name),
          sortOrder,
        },
      });
    } catch (e) {
      mapPrismaUnique(e);
    }
  }

  async patchZone(tenantSlug: string, access: AccessContext, zoneId: string, body: unknown) {
    assertPartnerWrite(access);
    const b = body as Record<string, unknown>;
    const zone = await this.getZoneForAccess(tenantSlug, access, zoneId);
    const sortOrder =
      typeof b.sortOrder === 'number' && Number.isFinite(b.sortOrder) ? Math.trunc(b.sortOrder) : undefined;
    return this.prisma.tireWarehouseZone.update({
      where: { id: zone.id },
      data: {
        ...(b.name !== undefined ? { name: optionalString(b.name) ?? null } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        ...(typeof b.active === 'boolean' ? { active: b.active } : {}),
      },
    });
  }

  async listRows(tenantSlug: string, access: AccessContext, zoneId: string) {
    const zone = await this.getZoneForAccess(tenantSlug, access, zoneId);
    return this.prisma.tireWarehouseRow.findMany({
      where: { tenantId: zone.tenantId, zoneId: zone.id },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
  }

  async createRow(tenantSlug: string, access: AccessContext, zoneId: string, body: unknown) {
    assertPartnerWrite(access);
    const b = body as Record<string, unknown>;
    const zone = await this.getZoneForAccess(tenantSlug, access, zoneId);
    const code = normalizeCode(b.code);
    const sortOrder =
      typeof b.sortOrder === 'number' && Number.isFinite(b.sortOrder) ? Math.trunc(b.sortOrder) : 0;
    try {
      return await this.prisma.tireWarehouseRow.create({
        data: {
          tenantId: zone.tenantId,
          zoneId: zone.id,
          code,
          name: optionalString(b.name),
          sortOrder,
        },
      });
    } catch (e) {
      mapPrismaUnique(e);
    }
  }

  async patchRow(tenantSlug: string, access: AccessContext, rowId: string, body: unknown) {
    assertPartnerWrite(access);
    const b = body as Record<string, unknown>;
    const row = await this.getRowForAccess(tenantSlug, access, rowId);
    const sortOrder =
      typeof b.sortOrder === 'number' && Number.isFinite(b.sortOrder) ? Math.trunc(b.sortOrder) : undefined;
    return this.prisma.tireWarehouseRow.update({
      where: { id: row.id },
      data: {
        ...(b.name !== undefined ? { name: optionalString(b.name) ?? null } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        ...(typeof b.active === 'boolean' ? { active: b.active } : {}),
      },
    });
  }

  async listLocations(tenantSlug: string, access: AccessContext, rowId: string) {
    const row = await this.getRowForAccess(tenantSlug, access, rowId);
    return this.prisma.tireWarehouseLocation.findMany({
      where: { tenantId: row.tenantId, rowId: row.id },
      orderBy: [{ active: 'desc' }, { code: 'asc' }],
    });
  }

  async createLocation(tenantSlug: string, access: AccessContext, rowId: string, body: unknown) {
    assertPartnerWrite(access);
    const b = body as Record<string, unknown>;
    const row = await this.getRowForAccess(tenantSlug, access, rowId);
    const code = normalizeCode(b.code);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const placeholder = `pending:${randomUUID()}`;
        const created = await tx.tireWarehouseLocation.create({
          data: {
            tenantId: row.tenantId,
            rowId: row.id,
            code,
            name: optionalString(b.name),
            qrPayload: placeholder,
          },
        });
        return tx.tireWarehouseLocation.update({
          where: { id: created.id },
          data: { qrPayload: tireLocationQrPayload(created.id) },
        });
      });
    } catch (e) {
      mapPrismaUnique(e);
    }
  }

  async patchLocation(tenantSlug: string, access: AccessContext, locationId: string, body: unknown) {
    assertPartnerWrite(access);
    const b = body as Record<string, unknown>;
    const location = await this.getLocationForAccess(tenantSlug, access, locationId);
    return this.prisma.tireWarehouseLocation.update({
      where: { id: location.id },
      data: {
        ...(b.name !== undefined ? { name: optionalString(b.name) ?? null } : {}),
        ...(typeof b.active === 'boolean' ? { active: b.active } : {}),
      },
    });
  }

  async locationLabel(tenantSlug: string, access: AccessContext, locationId: string) {
    const location = await this.getLocationForAccess(tenantSlug, access, locationId);
    const wh = location.row.zone.warehouse;
    const labelText = [wh.name, location.row.zone.code, location.row.code, location.code]
      .filter(Boolean)
      .join(' · ');
    return {
      locationId: location.id,
      code: location.code,
      rowCode: location.row.code,
      zoneCode: location.row.zone.code,
      warehouseCode: wh.code,
      warehouseName: wh.name,
      qrPayload: location.qrPayload,
      labelText,
    };
  }
}
