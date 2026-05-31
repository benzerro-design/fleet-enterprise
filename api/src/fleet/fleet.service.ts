import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type VehicleStatus as PrismaVehicleStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { CreateVehicleDocumentDto } from './dto/create-vehicle-document.dto';
import type { CreateVehicleDto } from './dto/create-vehicle.dto';
import type { PatchVehicleDto } from './dto/patch-vehicle.dto';
import type { PatchVehicleCivDto, RecordOdometerDto } from './dto/patch-vehicle-civ.dto';
import type { VehicleDocument, VehicleRecord, VehicleStatus } from './fleet.types';
import type { CivImportSource, OdometerReadingRecord, VehicleCivPayload } from './vehicle-civ.types';
import {
  CIV_PROFILE_FIELDS,
  normalizeCivProfile,
  civProfileFilledCount,
} from './vehicle-civ-fields';
import { PrismaService } from '../prisma/prisma.service';

const vehicleInclude = {
  documents: true,
  tenant: { select: { slug: true } },
  createdBy: { select: { email: true } },
  updatedBy: { select: { email: true } },
} as const;

type VehicleRow = Prisma.VehicleGetPayload<{ include: typeof vehicleInclude }>;

function normalizeVinForCompare(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function itpToDay(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function dtoItpToDay(s: string | null): string | null {
  if (s === null) return null;
  const t = new Date(s);
  if (Number.isNaN(t.getTime())) return null;
  return t.toISOString().slice(0, 10);
}

/**
 * Răspunsul formularului poate include toate câmpurile; comparăm cu starea din DB
 * ca în jurnal să apară doar câmpurile care s-au schimbat cu adevărat.
 */
function changedVehicleFieldKeys(
  before: {
    clientId: string;
    registrationNumber: string;
    type: string;
    status: string;
    odometerKm: number;
    vin: string | null;
    itpExpiresOn: Date | null;
    itpStationName: string | null;
  },
  dto: PatchVehicleDto,
): string[] {
  const keys: string[] = [];
  if (dto.clientId !== undefined && dto.clientId !== before.clientId) {
    keys.push('clientId');
  }
  if (dto.registrationNumber !== undefined && dto.registrationNumber !== before.registrationNumber) {
    keys.push('registrationNumber');
  }
  if (dto.type !== undefined && dto.type !== before.type) {
    keys.push('type');
  }
  if (dto.status !== undefined && dto.status !== before.status) {
    keys.push('status');
  }
  if (dto.odometerKm !== undefined && dto.odometerKm !== before.odometerKm) {
    keys.push('odometerKm');
  }
  if (dto.vin !== undefined) {
    const prev = normalizeVinForCompare(before.vin);
    const next = dto.vin === null ? null : normalizeVinForCompare(dto.vin);
    if (prev !== next) keys.push('vin');
  }
  if (dto.itpExpiresOn !== undefined) {
    const prev = itpToDay(before.itpExpiresOn);
    const next = dto.itpExpiresOn === null ? null : dtoItpToDay(dto.itpExpiresOn);
    if (prev !== next) keys.push('itpExpiresOn');
  }
  if (dto.itpStationName !== undefined) {
    const prev = before.itpStationName?.trim() || null;
    const next =
      dto.itpStationName === null ? null : dto.itpStationName.trim() || null;
    if (prev !== next) keys.push('itpStationName');
  }
  return keys;
}

export type VehicleBrowseFilters = {
  q?: string;
  status?: VehicleStatus;
};

export type ListVehiclesFilters = VehicleBrowseFilters & {
  page: number;
  pageSize: number;
};

const MAX_PAGE_SIZE = 200;
const MAX_EXPORT_ROWS = 5000;

function escapeCsvCell(v: string): string {
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

@Injectable()
export class FleetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listVehiclesPaged(
    tenantSlug: string,
    filters: ListVehiclesFilters,
  ): Promise<import('./fleet.types').VehicleListResponse> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });
    if (!tenant) {
      return { items: [], total: 0, page: filters.page, pageSize: filters.pageSize };
    }

    const pageSize = Math.min(Math.max(1, filters.pageSize), MAX_PAGE_SIZE);
    const page = Math.max(1, filters.page);
    const skip = (page - 1) * pageSize;

    const where = this.vehicleWhere(tenant.id, {
      q: filters.q,
      status: filters.status,
    });

    const [total, rows] = await Promise.all([
      this.prisma.vehicle.count({ where }),
      this.prisma.vehicle.findMany({
        where,
        include: vehicleInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map((r) => this.toRecord(r)),
      total,
      page,
      pageSize,
    };
  }

  async exportVehiclesCsv(tenantSlug: string, browse: VehicleBrowseFilters): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });
    if (!tenant) return '\uFEFFid,registrationNumber,clientId,status,type,odometerKm,createdAt\n';

    const where = this.vehicleWhere(tenant.id, browse);

    const rows = await this.prisma.vehicle.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: MAX_EXPORT_ROWS,
      select: {
        id: true,
        registrationNumber: true,
        clientId: true,
        status: true,
        type: true,
        odometerKm: true,
        createdAt: true,
      },
    });

    const header =
      'id,registrationNumber,clientId,status,type,odometerKm,createdAt';
    const lines = rows.map((r) =>
      [
        r.id,
        r.registrationNumber,
        r.clientId,
        r.status,
        r.type,
        String(r.odometerKm),
        r.createdAt.toISOString(),
      ]
        .map((c) => escapeCsvCell(c))
        .join(','),
    );
    return `\uFEFF${header}\n${lines.join('\n')}\n`;
  }

  async getVehicle(tenantSlug: string, vehicleId: string): Promise<VehicleRecord> {
    const row = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenant: { slug: tenantSlug } },
      include: vehicleInclude,
    });
    if (!row) throw new NotFoundException('Vehicle not found');
    return this.toRecord(row);
  }

  async createVehicle(
    tenantSlug: string,
    dto: CreateVehicleDto,
    actorUserId?: string,
  ): Promise<VehicleRecord> {
    const tenant = await this.ensureTenant(tenantSlug);

    try {
      const row = await this.prisma.vehicle.create({
        data: {
          tenantId: tenant.id,
          clientId: dto.clientId,
          registrationNumber: dto.registrationNumber,
          type: dto.type,
          vin: dto.vin ?? null,
          status: 'active',
          odometerKm: dto.odometerKm ?? 0,
          itpExpiresOn: dto.itpExpiresOn ? new Date(dto.itpExpiresOn) : null,
          itpStationName: dto.itpStationName ?? null,
          createdByUserId: actorUserId ?? null,
          updatedByUserId: actorUserId ?? null,
        },
        include: vehicleInclude,
      });

      await this.audit.logVehicle({
        tenantUuid: tenant.id,
        actorUserId: actorUserId ?? undefined,
        action: 'create',
        vehicleId: row.id,
        meta: {
          registrationNumber: row.registrationNumber,
          clientId: row.clientId,
        },
      });

      const initialKm = dto.odometerKm ?? 0;
      if (initialKm > 0) {
        await this.prisma.odometerReading.create({
          data: {
            vehicleId: row.id,
            odometerKm: initialKm,
            source: 'import',
            notes: 'Km inițial la crearea vehiculului',
            recordedByUserId: actorUserId ?? null,
          },
        });
      }

      return this.toRecord(row);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Registration number already exists for this tenant');
      }
      throw e;
    }
  }

  async patchVehicle(
    tenantSlug: string,
    vehicleId: string,
    dto: PatchVehicleDto,
    actorUserId?: string,
  ): Promise<VehicleRecord> {
    if (dto.odometerKm !== undefined) {
      throw new ConflictException(
        'Odometrul se actualizează doar din tab-ul Odometru al vehiculului.',
      );
    }
    const existing = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenant: { slug: tenantSlug } },
      include: { tenant: true },
    });
    if (!existing) throw new NotFoundException('Vehicle not found');

    try {
      await this.prisma.vehicle.update({
        where: { id: vehicleId },
        data: {
          clientId: dto.clientId,
          registrationNumber: dto.registrationNumber,
          type: dto.type,
          status: dto.status,
          vin:
            dto.vin === undefined ? undefined : dto.vin === null ? null : dto.vin,
          itpExpiresOn:
            dto.itpExpiresOn === undefined
              ? undefined
              : dto.itpExpiresOn === null
                ? null
                : new Date(dto.itpExpiresOn),
          itpStationName:
            dto.itpStationName === undefined
              ? undefined
              : dto.itpStationName === null
                ? null
                : dto.itpStationName,
          updatedByUserId: actorUserId ?? undefined,
        },
      });

      await this.audit.logVehicle({
        tenantUuid: existing.tenantId,
        actorUserId: actorUserId ?? undefined,
        action: 'update',
        vehicleId,
        meta: {
          fields: changedVehicleFieldKeys(existing, dto),
          registrationNumber: existing.registrationNumber,
        },
      });

      return this.getVehicle(tenantSlug, vehicleId);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Registration number already exists for this tenant');
      }
      throw e;
    }
  }

  async getVehicleCiv(tenantSlug: string, vehicleId: string): Promise<VehicleCivPayload> {
    const row = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenant: { slug: tenantSlug } },
    });
    if (!row) throw new NotFoundException('Vehicle not found');

    const profile = normalizeCivProfile(row.civProfile);
    return {
      civSeries: row.civSeries,
      civIssuedOn: row.civIssuedOn ? row.civIssuedOn.toISOString() : null,
      civRarOffice: row.civRarOffice,
      civMentions: row.civMentions,
      civProfile: profile,
      civImportedFromDocumentId: row.civImportedFromDocumentId,
      civFilledCount: civProfileFilledCount(profile),
      civTotalFields: CIV_PROFILE_FIELDS.length,
      importSource: await this.findCivImportSource(vehicleId),
    };
  }

  async patchVehicleCiv(
    tenantSlug: string,
    vehicleId: string,
    dto: PatchVehicleCivDto,
    actorUserId?: string,
  ): Promise<VehicleCivPayload> {
    const existing = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenant: { slug: tenantSlug } },
      include: { tenant: true },
    });
    if (!existing) throw new NotFoundException('Vehicle not found');

    if (dto.civImportedFromDocumentId) {
      const doc = await this.prisma.vehicleDocument.findFirst({
        where: {
          id: dto.civImportedFromDocumentId,
          vehicleId,
          documentTypeCode: 'civ',
        },
      });
      if (!doc) throw new NotFoundException('CIV document not found for this vehicle');
    }

    await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        civSeries:
          dto.civSeries === undefined
            ? undefined
            : dto.civSeries === null
              ? null
              : dto.civSeries.trim() || null,
        civIssuedOn:
          dto.civIssuedOn === undefined
            ? undefined
            : dto.civIssuedOn === null
              ? null
              : new Date(dto.civIssuedOn),
        civRarOffice:
          dto.civRarOffice === undefined
            ? undefined
            : dto.civRarOffice === null
              ? null
              : dto.civRarOffice.trim() || null,
        civMentions:
          dto.civMentions === undefined
            ? undefined
            : dto.civMentions === null
              ? null
              : dto.civMentions.trim() || null,
        civProfile:
          dto.civProfile === undefined
            ? undefined
            : dto.civProfile === null
              ? Prisma.DbNull
              : normalizeCivProfile(dto.civProfile),
        civImportedFromDocumentId:
          dto.civImportedFromDocumentId === undefined
            ? undefined
            : dto.civImportedFromDocumentId,
        updatedByUserId: actorUserId ?? undefined,
      },
    });

    await this.audit.logVehicle({
      tenantUuid: existing.tenantId,
      actorUserId: actorUserId ?? undefined,
      action: 'vehicle_civ_update',
      vehicleId,
      meta: { registrationNumber: existing.registrationNumber },
    });

    return this.getVehicleCiv(tenantSlug, vehicleId);
  }

  async listOdometerReadings(
    tenantSlug: string,
    vehicleId: string,
    limit = 50,
  ): Promise<{ items: OdometerReadingRecord[]; vehicleOdometerKm: number }> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenant: { slug: tenantSlug } },
      select: { id: true, odometerKm: true },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const take = Math.min(Math.max(1, limit), 100);
    const rows = await this.prisma.odometerReading.findMany({
      where: { vehicleId },
      orderBy: { recordedAt: 'desc' },
      take,
      include: { recordedBy: { select: { email: true } } },
    });

    return {
      vehicleOdometerKm: vehicle.odometerKm,
      items: rows.map((r) => ({
        id: r.id,
        vehicleId: r.vehicleId,
        odometerKm: r.odometerKm,
        source: r.source as OdometerReadingRecord['source'],
        sourceRef: r.sourceRef,
        notes: r.notes,
        recordedAt: r.recordedAt.toISOString(),
        recordedByEmail: r.recordedBy?.email ?? null,
      })),
    };
  }

  async recordOdometerReading(
    tenantSlug: string,
    vehicleId: string,
    dto: RecordOdometerDto,
    actorUserId?: string,
  ): Promise<{ reading: OdometerReadingRecord; vehicle: VehicleRecord }> {
    const existing = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenant: { slug: tenantSlug } },
      include: { tenant: true },
    });
    if (!existing) throw new NotFoundException('Vehicle not found');

    if (!Number.isFinite(dto.odometerKm) || dto.odometerKm < 0) {
      throw new ConflictException('odometerKm must be a non-negative integer');
    }

    const source = dto.source ?? 'manual';
    if (source === 'tracking' && dto.odometerKm < existing.odometerKm) {
      throw new ConflictException(
        'Citirea din tracking nu poate fi sub km-ul curent al vehiculului. Verificați sincronizarea.',
      );
    }

    const reading = await this.prisma.odometerReading.create({
      data: {
        vehicleId,
        odometerKm: Math.round(dto.odometerKm),
        source,
        sourceRef: dto.sourceRef?.trim() || null,
        notes: dto.notes?.trim() || null,
        recordedByUserId: actorUserId ?? null,
      },
      include: { recordedBy: { select: { email: true } } },
    });

    if (dto.odometerKm >= existing.odometerKm) {
      await this.prisma.vehicle.update({
        where: { id: vehicleId },
        data: {
          odometerKm: Math.round(dto.odometerKm),
          updatedByUserId: actorUserId ?? undefined,
        },
      });
    }

    await this.audit.logVehicle({
      tenantUuid: existing.tenantId,
      actorUserId: actorUserId ?? undefined,
      action: 'odometer_update',
      vehicleId,
      meta: {
        registrationNumber: existing.registrationNumber,
        odometerKm: Math.round(dto.odometerKm),
        source,
        previousKm: existing.odometerKm,
      },
    });

    const vehicle = await this.getVehicle(tenantSlug, vehicleId);
    return {
      reading: {
        id: reading.id,
        vehicleId: reading.vehicleId,
        odometerKm: reading.odometerKm,
        source: reading.source as OdometerReadingRecord['source'],
        sourceRef: reading.sourceRef,
        notes: reading.notes,
        recordedAt: reading.recordedAt.toISOString(),
        recordedByEmail: reading.recordedBy?.email ?? null,
      },
      vehicle,
    };
  }

  async addVehicleDocument(
    tenantSlug: string,
    vehicleId: string,
    dto: CreateVehicleDocumentDto,
    actorUserId?: string,
  ): Promise<VehicleDocument> {
    const existing = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenant: { slug: tenantSlug } },
      select: { tenantId: true, registrationNumber: true },
    });
    if (!existing) throw new NotFoundException('Vehicle not found');

    const doc = await this.prisma.vehicleDocument.create({
      data: {
        vehicleId,
        documentTypeCode: dto.documentTypeCode,
        title: dto.title,
        expiresOn:
          dto.expiresOn === undefined ? null : dto.expiresOn ? new Date(dto.expiresOn) : null,
        fileUrl: dto.fileUrl === undefined ? null : dto.fileUrl,
      },
    });

    await this.audit.logVehicle({
      tenantUuid: existing.tenantId,
      actorUserId: actorUserId ?? undefined,
      action: 'document_add',
      vehicleId,
      meta: {
        documentId: doc.id,
        documentTypeCode: dto.documentTypeCode,
        title: dto.title,
        registrationNumber: existing.registrationNumber,
      },
    });

    return this.toDocument(doc);
  }

  async deleteVehicle(
    tenantSlug: string,
    vehicleId: string,
    actorUserId?: string,
  ): Promise<void> {
    const existing = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenant: { slug: tenantSlug } },
      select: {
        tenantId: true,
        registrationNumber: true,
      },
    });
    if (!existing) throw new NotFoundException('Vehicle not found');

    await this.audit.logVehicle({
      tenantUuid: existing.tenantId,
      actorUserId: actorUserId ?? undefined,
      action: 'delete',
      vehicleId,
      meta: { registrationNumber: existing.registrationNumber },
    });

    await this.prisma.vehicle.delete({
      where: { id: vehicleId },
    });
  }

  private vehicleWhere(tenantUuid: string, browse: VehicleBrowseFilters): Prisma.VehicleWhereInput {
    const q = browse.q?.trim();
    const statusOk =
      browse.status &&
      ['active', 'inactive', 'in_maintenance', 'decommissioned'].includes(browse.status);

    const parts: Prisma.VehicleWhereInput[] = [{ tenantId: tenantUuid }];

    if (q && q.length > 0) {
      parts.push({
        OR: [
          { registrationNumber: { contains: q, mode: 'insensitive' } },
          { clientId: { contains: q, mode: 'insensitive' } },
          { vin: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    if (statusOk) {
      parts.push({ status: browse.status as PrismaVehicleStatus });
    }

    return { AND: parts };
  }

  private async ensureTenant(slug: string) {
    return this.prisma.tenant.upsert({
      where: { slug },
      create: { slug, name: slug },
      update: { name: slug },
    });
  }

  private async findCivImportSource(vehicleId: string): Promise<CivImportSource> {
    const doc = await this.prisma.vehicleDocument.findFirst({
      where: {
        vehicleId,
        documentTypeCode: 'civ',
        fileUrl: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!doc?.fileUrl) return null;
    return {
      documentId: doc.id,
      title: doc.title,
      fileUrl: doc.fileUrl,
      fileName: doc.fileName,
      expiresOn: doc.expiresOn ? doc.expiresOn.toISOString() : null,
      uploadedAt: doc.createdAt.toISOString(),
    };
  }

  private toRecord(row: VehicleRow): VehicleRecord {
    return {
      id: row.id,
      tenantId: row.tenant.slug,
      clientId: row.clientId,
      registrationNumber: row.registrationNumber,
      type: row.type as VehicleRecord['type'],
      vin: row.vin,
      status: row.status as VehicleStatus,
      odometerKm: row.odometerKm,
      itpExpiresOn: row.itpExpiresOn ? row.itpExpiresOn.toISOString() : null,
      itpStationName: row.itpStationName,
      civSeries: row.civSeries,
      civIssuedOn: row.civIssuedOn ? row.civIssuedOn.toISOString() : null,
      civRarOffice: row.civRarOffice,
      civMentions: row.civMentions,
      civProfile: normalizeCivProfile(row.civProfile),
      civImportedFromDocumentId: row.civImportedFromDocumentId,
      documents: row.documents.map((d) => this.toDocument(d)),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      createdByUserId: row.createdByUserId,
      updatedByUserId: row.updatedByUserId,
      createdByEmail: row.createdBy?.email ?? null,
      updatedByEmail: row.updatedBy?.email ?? null,
    };
  }

  private toDocument(d: {
    id: string;
    documentTypeCode: string;
    title: string;
    expiresOn: Date | null;
    fileUrl: string | null;
    createdAt: Date;
  }): VehicleDocument {
    return {
      id: d.id,
      documentTypeCode: d.documentTypeCode,
      title: d.title,
      expiresOn: d.expiresOn ? d.expiresOn.toISOString() : null,
      fileUrl: d.fileUrl,
      createdAt: d.createdAt.toISOString(),
    };
  }
}
