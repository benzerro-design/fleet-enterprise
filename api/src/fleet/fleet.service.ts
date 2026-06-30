import {
  ConflictException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type VehicleStatus as PrismaVehicleStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { ClientsService } from '../clients/clients.service';
import { resolveOptionalClientVehicleFilter } from '../clients/client-resolve';
import { normalizeReminderOffsets, REMINDER_PRESETS } from '../ops/document-reminders';
import { RemindersService } from '../ops/reminders.service';
import { syncItpCertDocument } from '../ops/itp-sync';
import {
  reminderMenuSyncEnabledForCreate,
  reminderMenuSyncEnabledPatchValue,
} from '../ops/reminder-sync';
import type { CreateVehicleDocumentDto } from './dto/create-vehicle-document.dto';
import type { CreateVehicleDto } from './dto/create-vehicle.dto';
import type { PatchVehicleDto } from './dto/patch-vehicle.dto';
import type { PatchVehicleCivDto, RecordOdometerDto } from './dto/patch-vehicle-civ.dto';
import type { CreateVehiclePhotoDto, PatchVehicleAcquisitionDto } from './dto/patch-vehicle-acquisition.dto';
import type { VehicleDocument, VehicleRecord, VehicleStatus } from './fleet.types';
import type { CivImportSource, OdometerReadingRecord, VehicleCivPayload } from './vehicle-civ.types';
import type {
  VehicleAcquisitionPayload,
  VehiclePhotoRecord,
  VehiclePhotosPayload,
} from './vehicle-acquisition.types';
import { buildVehicleMobilityPayload } from './vehicle-mobility';
import type { VehicleMobilityPayload } from './vehicle-mobility.types';
import type { AccessContext } from '../iam/access-context.types';
import { vehicleClientScope } from '../iam/client-access';
import { tripOpsVehicleScope } from '../iam/driver-access';
import { assertClientCodeOpsWrite, assertDriverMediaWrite, assertVehicleOpsRead, assertVehicleOpsWrite } from '../ops/ops-write-access';
import {
  buildOdometerSyncPrimaryMessage,
  validateNewOdometerEntry,
} from '../ops/vehicle-odometer-timeline';
import { VehicleOdometerSyncService } from '../ops/vehicle-odometer-sync.service';
import type { OdometerTimelineAnalysis, OdometerPreviewPayload } from '../ops/vehicle-odometer-sync.types';
import {
  CIV_PROFILE_FIELDS,
  normalizeCivProfile,
  civProfileFilledCount,
} from './vehicle-civ-fields';
import { PrismaService } from '../prisma/prisma.service';

const ITP_PROFILE_DEFAULT_OFFSETS = [
  ...REMINDER_PRESETS.find((p) => p.id === 'itp_rca')!.offsets,
];

function itpReminderOffsetsForDb(
  offsets: number[] | null | undefined,
  hasItpDate: boolean,
): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (offsets === undefined) {
    return hasItpDate ? ITP_PROFILE_DEFAULT_OFFSETS : Prisma.DbNull;
  }
  if (offsets === null) return Prisma.DbNull;
  const n = normalizeReminderOffsets(offsets);
  return n ?? Prisma.DbNull;
}

const vehicleInclude = {
  documents: true,
  client: { select: { id: true, code: true, legalName: true } },
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
    brand: string | null;
    model: string | null;
    itpExpiresOn: Date | null;
    itpStationName: string | null;
  },
  dto: PatchVehicleDto,
): string[] {
  const keys: string[] = [];
  if (
    dto.clientId !== undefined &&
    dto.clientId.trim().toLowerCase() !== before.clientId.trim().toLowerCase()
  ) {
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
  if (dto.brand !== undefined) {
    const prev = before.brand?.trim() || null;
    const next = dto.brand === null ? null : dto.brand.trim() || null;
    if (prev !== next) keys.push('brand');
  }
  if (dto.model !== undefined) {
    const prev = before.model?.trim() || null;
    const next = dto.model === null ? null : dto.model.trim() || null;
    if (prev !== next) keys.push('model');
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
  /** Cod client sau id Client — filtrează vehiculele. */
  clientId?: string;
  /** L0 curse: include vehicule din istoricul șoferului. */
  vehicleScope?: 'trip_ops';
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
    private readonly reminders: RemindersService,
    private readonly clients: ClientsService,
    private readonly odometerSync: VehicleOdometerSyncService,
  ) {}

  async listVehiclesPaged(
    tenantSlug: string,
    filters: ListVehiclesFilters,
    access?: AccessContext,
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

    const where = await this.vehicleWhere(
      tenant.id,
      {
        q: filters.q,
        status: filters.status,
        clientId: filters.clientId,
      },
      access,
    );

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
    if (!tenant) {
      return '\uFEFFid,registrationNumber,clientCode,clientLegalName,status,type,odometerKm,createdAt\n';
    }

    const where = await this.vehicleWhere(tenant.id, browse);

    const rows = await this.prisma.vehicle.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: MAX_EXPORT_ROWS,
      select: {
        id: true,
        registrationNumber: true,
        status: true,
        type: true,
        odometerKm: true,
        createdAt: true,
        client: { select: { code: true, legalName: true } },
      },
    });

    const header =
      'id,registrationNumber,clientCode,clientLegalName,status,type,odometerKm,createdAt';
    const lines = rows.map((r) =>
      [
        r.id,
        r.registrationNumber,
        r.client.code,
        r.client.legalName,
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

  async getVehicle(
    tenantSlug: string,
    vehicleId: string,
    access?: AccessContext,
  ): Promise<VehicleRecord> {
    const row = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenant: { slug: tenantSlug } },
      include: vehicleInclude,
    });
    if (!row) throw new NotFoundException('Vehicle not found');
    if (access && !access.isTenantWide && !access.allowedClientIds.includes(row.clientId)) {
      throw new NotFoundException('Vehicle not found');
    }
    return this.toRecord(row);
  }

  async createVehicle(
    tenantSlug: string,
    dto: CreateVehicleDto,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<VehicleRecord & { reminderSyncFailed?: boolean }> {
    const tenant = await this.ensureTenant(tenantSlug);
    await assertClientCodeOpsWrite(this.prisma, tenant.id, dto.clientId, access);
    const hasItp = Boolean(dto.itpExpiresOn);
    const client = await this.clients.resolveForVehicle(tenant.id, dto.clientId);

    try {
      const row = await this.prisma.vehicle.create({
        data: {
          tenantId: tenant.id,
          clientId: client.id,
          registrationNumber: dto.registrationNumber,
          type: dto.type,
          vin: dto.vin ?? null,
          brand: dto.brand?.trim() || null,
          model: dto.model?.trim() || null,
          status: 'active',
          odometerKm: dto.odometerKm ?? 0,
          fuelType: dto.fuelType,
          itpExpiresOn: dto.itpExpiresOn ? new Date(dto.itpExpiresOn) : null,
          itpStationName: dto.itpStationName ?? null,
          itpReminderOffsetsDays: hasItp
            ? itpReminderOffsetsForDb(dto.itpReminderOffsetsDays, true)
            : Prisma.DbNull,
          itpReminderMenuSyncEnabled: reminderMenuSyncEnabledForCreate(dto.syncItpReminderAction),
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
          clientId: row.client.code,
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

      let reminderSyncFailed = false;
      reminderSyncFailed = await this.applyVehicleItpReminderSync(tenant.id, row);

      if (row.itpExpiresOn) {
        try {
          await syncItpCertDocument(this.prisma, row.id, row.itpExpiresOn);
        } catch (err) {
          console.error('syncItpCertDocument after vehicle create failed', err);
        }
      }

      return { ...this.toRecord(row), reminderSyncFailed };
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
    access?: AccessContext,
  ): Promise<VehicleRecord & { reminderSyncFailed?: boolean }> {
    if (dto.odometerKm !== undefined) {
      throw new ConflictException(
        'Odometrul se actualizează doar din tab-ul Odometru al vehiculului.',
      );
    }
    await assertVehicleOpsWrite(this.prisma, tenantSlug, vehicleId, access);
    if (dto.clientId !== undefined) {
      const tenant = await this.ensureTenant(tenantSlug);
      await assertClientCodeOpsWrite(this.prisma, tenant.id, dto.clientId, access);
    }
    const existing = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenant: { slug: tenantSlug } },
      include: { tenant: true, client: { select: { id: true, code: true } } },
    });
    if (!existing) throw new NotFoundException('Vehicle not found');

    let resolvedClientId: string | undefined;
    if (dto.clientId !== undefined) {
      const client = await this.clients.resolveForVehicle(existing.tenantId, dto.clientId);
      resolvedClientId = client.id;
    }

    try {
      const clearItp = dto.itpExpiresOn === null;
      await this.prisma.vehicle.update({
        where: { id: vehicleId },
        data: {
          ...(resolvedClientId !== undefined ? { clientId: resolvedClientId } : {}),
          registrationNumber: dto.registrationNumber,
          type: dto.type,
          status: dto.status,
          vin:
            dto.vin === undefined ? undefined : dto.vin === null ? null : dto.vin,
          brand:
            dto.brand === undefined
              ? undefined
              : dto.brand === null
                ? null
                : dto.brand.trim() || null,
          model:
            dto.model === undefined
              ? undefined
              : dto.model === null
                ? null
                : dto.model.trim() || null,
          fuelType:
            dto.fuelType === undefined
              ? undefined
              : dto.fuelType === null
                ? null
                : dto.fuelType,
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
          itpReminderOffsetsDays:
            clearItp
              ? Prisma.DbNull
              : dto.itpReminderOffsetsDays === undefined
                ? undefined
                : dto.itpReminderOffsetsDays === null
                  ? Prisma.DbNull
                  : itpReminderOffsetsForDb(dto.itpReminderOffsetsDays, true),
          itpReminderMenuSyncEnabled: reminderMenuSyncEnabledPatchValue(dto.syncItpReminderAction),
          updatedByUserId: actorUserId ?? undefined,
        },
      });

      await this.audit.logVehicle({
        tenantUuid: existing.tenantId,
        actorUserId: actorUserId ?? undefined,
        action: 'update',
        vehicleId,
        meta: {
          fields: changedVehicleFieldKeys(
            { ...existing, clientId: existing.client.code },
            dto,
          ),
          registrationNumber: existing.registrationNumber,
        },
      });

      const updated = await this.prisma.vehicle.findFirstOrThrow({
        where: { id: vehicleId },
        include: vehicleInclude,
      });

      const reminderSyncFailed = await this.applyVehicleItpReminderSync(existing.tenantId, updated);

      if (updated.itpExpiresOn) {
        try {
          await syncItpCertDocument(this.prisma, updated.id, updated.itpExpiresOn);
        } catch (err) {
          console.error('syncItpCertDocument after vehicle patch failed', err);
        }
      }

      return { ...this.toRecord(updated), reminderSyncFailed };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Registration number already exists for this tenant');
      }
      throw e;
    }
  }

  async getVehicleCiv(tenantSlug: string, vehicleId: string, access?: AccessContext): Promise<VehicleCivPayload> {
    await assertVehicleOpsRead(this.prisma, tenantSlug, vehicleId, access);
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

  async getVehicleAcquisition(
    tenantSlug: string,
    vehicleId: string,
    access?: AccessContext,
  ): Promise<VehicleAcquisitionPayload> {
    await assertVehicleOpsRead(this.prisma, tenantSlug, vehicleId, access);
    const row = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenant: { slug: tenantSlug } },
      select: {
        acquisitionType: true,
        acquiredOn: true,
        dealerName: true,
        financierName: true,
        purchasePriceCents: true,
        downPaymentCents: true,
        contractNumber: true,
        contractStartOn: true,
        contractEndOn: true,
        monthlyPaymentCents: true,
        residualValueCents: true,
        warrantyExpiresOn: true,
        warrantyKmLimit: true,
        warrantyProvider: true,
        acquisitionNotes: true,
      },
    });
    if (!row) throw new NotFoundException('Vehicle not found');
    return this.toAcquisitionPayload(row);
  }

  async patchVehicleAcquisition(
    tenantSlug: string,
    vehicleId: string,
    dto: PatchVehicleAcquisitionDto,
    actorUserId?: string,
  ): Promise<VehicleAcquisitionPayload> {
    const existing = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenant: { slug: tenantSlug } },
      select: { id: true, tenantId: true, registrationNumber: true },
    });
    if (!existing) throw new NotFoundException('Vehicle not found');

    await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        acquisitionType:
          dto.acquisitionType === undefined
            ? undefined
            : dto.acquisitionType === null
              ? null
              : dto.acquisitionType,
        acquiredOn:
          dto.acquiredOn === undefined
            ? undefined
            : dto.acquiredOn === null
              ? null
              : new Date(dto.acquiredOn),
        dealerName:
          dto.dealerName === undefined
            ? undefined
            : dto.dealerName === null
              ? null
              : dto.dealerName.trim() || null,
        financierName:
          dto.financierName === undefined
            ? undefined
            : dto.financierName === null
              ? null
              : dto.financierName.trim() || null,
        purchasePriceCents:
          dto.purchasePriceCents === undefined
            ? undefined
            : dto.purchasePriceCents === null
              ? null
              : Math.round(dto.purchasePriceCents),
        downPaymentCents:
          dto.downPaymentCents === undefined
            ? undefined
            : dto.downPaymentCents === null
              ? null
              : Math.round(dto.downPaymentCents),
        contractNumber:
          dto.contractNumber === undefined
            ? undefined
            : dto.contractNumber === null
              ? null
              : dto.contractNumber.trim() || null,
        contractStartOn:
          dto.contractStartOn === undefined
            ? undefined
            : dto.contractStartOn === null
              ? null
              : new Date(dto.contractStartOn),
        contractEndOn:
          dto.contractEndOn === undefined
            ? undefined
            : dto.contractEndOn === null
              ? null
              : new Date(dto.contractEndOn),
        monthlyPaymentCents:
          dto.monthlyPaymentCents === undefined
            ? undefined
            : dto.monthlyPaymentCents === null
              ? null
              : Math.round(dto.monthlyPaymentCents),
        residualValueCents:
          dto.residualValueCents === undefined
            ? undefined
            : dto.residualValueCents === null
              ? null
              : Math.round(dto.residualValueCents),
        warrantyExpiresOn:
          dto.warrantyExpiresOn === undefined
            ? undefined
            : dto.warrantyExpiresOn === null
              ? null
              : new Date(dto.warrantyExpiresOn),
        warrantyKmLimit:
          dto.warrantyKmLimit === undefined
            ? undefined
            : dto.warrantyKmLimit === null
              ? null
              : Math.round(dto.warrantyKmLimit),
        warrantyProvider:
          dto.warrantyProvider === undefined
            ? undefined
            : dto.warrantyProvider === null
              ? null
              : dto.warrantyProvider.trim() || null,
        acquisitionNotes:
          dto.acquisitionNotes === undefined
            ? undefined
            : dto.acquisitionNotes === null
              ? null
              : dto.acquisitionNotes.trim() || null,
        updatedByUserId: actorUserId ?? undefined,
      },
    });

    await this.audit.logVehicle({
      tenantUuid: existing.tenantId,
      actorUserId: actorUserId ?? undefined,
      action: 'vehicle_acquisition_update',
      vehicleId,
      meta: { registrationNumber: existing.registrationNumber },
    });

    return this.getVehicleAcquisition(tenantSlug, vehicleId);
  }

  async listVehiclePhotos(tenantSlug: string, vehicleId: string, access?: AccessContext): Promise<VehiclePhotosPayload> {
    await assertVehicleOpsRead(this.prisma, tenantSlug, vehicleId, access);
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenant: { slug: tenantSlug } },
      select: { id: true },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const rows = await this.prisma.vehiclePhoto.findMany({
      where: { vehicleId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: { uploadedBy: { select: { email: true } } },
    });

    return { items: rows.map((r) => this.toPhotoRecord(r)) };
  }

  async addVehiclePhoto(
    tenantSlug: string,
    vehicleId: string,
    dto: CreateVehiclePhotoDto,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<VehiclePhotoRecord> {
    await assertDriverMediaWrite(this.prisma, tenantSlug, vehicleId, access);
    const existing = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenant: { slug: tenantSlug } },
      select: { id: true, tenantId: true, registrationNumber: true },
    });
    if (!existing) throw new NotFoundException('Vehicle not found');

    const maxSort = await this.prisma.vehiclePhoto.aggregate({
      where: { vehicleId },
      _max: { sortOrder: true },
    });

    const photo = await this.prisma.vehiclePhoto.create({
      data: {
        vehicleId,
        fileUrl: dto.fileUrl.trim(),
        fileName: dto.fileName?.trim() || null,
        caption: dto.caption?.trim() || null,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        uploadedByUserId: actorUserId ?? null,
      },
      include: { uploadedBy: { select: { email: true } } },
    });

    await this.audit.logVehicle({
      tenantUuid: existing.tenantId,
      actorUserId: actorUserId ?? undefined,
      action: 'vehicle_photo_add',
      vehicleId,
      meta: { registrationNumber: existing.registrationNumber, photoId: photo.id },
    });

    return this.toPhotoRecord(photo);
  }

  async deleteVehiclePhoto(
    tenantSlug: string,
    vehicleId: string,
    photoId: string,
    actorUserId?: string,
  ): Promise<void> {
    const existing = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenant: { slug: tenantSlug } },
      select: { id: true, tenantId: true, registrationNumber: true },
    });
    if (!existing) throw new NotFoundException('Vehicle not found');

    const photo = await this.prisma.vehiclePhoto.findFirst({
      where: { id: photoId, vehicleId },
    });
    if (!photo) throw new NotFoundException('Photo not found');

    await this.prisma.vehiclePhoto.delete({ where: { id: photoId } });

    await this.audit.logVehicle({
      tenantUuid: existing.tenantId,
      actorUserId: actorUserId ?? undefined,
      action: 'vehicle_photo_delete',
      vehicleId,
      meta: { registrationNumber: existing.registrationNumber, photoId },
    });
  }

  async listOdometerReadings(
    tenantSlug: string,
    vehicleId: string,
    limit = 50,
    access?: AccessContext,
  ): Promise<{
    items: OdometerReadingRecord[];
    vehicleOdometerKm: number;
    timeline: OdometerTimelineAnalysis;
    reconciled: boolean;
  }> {
    await assertVehicleOpsRead(this.prisma, tenantSlug, vehicleId, access);
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenant: { slug: tenantSlug } },
      select: { id: true, odometerKm: true, tenantId: true },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const take = Math.min(Math.max(1, limit), 100);
    const rows = await this.prisma.odometerReading.findMany({
      where: { vehicleId },
      orderBy: { recordedAt: 'desc' },
      take,
      include: { recordedBy: { select: { email: true } } },
    });

    const timeline = await this.odometerSync.analyzeVehicleTimeline(vehicleId);
    const needsReconcile =
      timeline.currentKmFromTimeline != null && timeline.currentKmFromTimeline !== vehicle.odometerKm;
    let vehicleOdometerKm = vehicle.odometerKm;
    let reconciled = false;
    if (needsReconcile) {
      const result = await this.odometerSync.reconcileVehicleOdometerKm(
        vehicleId,
        vehicle.tenantId,
        access?.userId,
      );
      if (result.reconciled) {
        vehicleOdometerKm = result.newKm;
        reconciled = true;
      }
    }

    return {
      vehicleOdometerKm,
      reconciled,
      timeline: {
        currentKmFromTimeline: timeline.currentKmFromTimeline,
        latestRecordedAt: timeline.latestRecordedAt,
        violations: timeline.violations,
        hasCriticalViolations: timeline.hasCriticalViolations,
        isConsistent: timeline.isConsistent,
      },
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

  async previewOdometerEntry(
    tenantSlug: string,
    vehicleId: string,
    odometerKm: number,
    recordedAtIso: string,
    access?: AccessContext,
  ): Promise<OdometerPreviewPayload> {
    await assertVehicleOpsRead(this.prisma, tenantSlug, vehicleId, access);
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenant: { slug: tenantSlug } },
      select: { id: true, odometerKm: true },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    if (!Number.isFinite(odometerKm) || odometerKm < 0) {
      throw new BadRequestException('odometerKm must be a non-negative integer');
    }

    const recordedAt = new Date(recordedAtIso);
    if (Number.isNaN(recordedAt.getTime())) {
      throw new BadRequestException('recordedAt must be a valid ISO date string');
    }

    const existingRows = await this.prisma.odometerReading.findMany({
      where: { vehicleId },
      select: { odometerKm: true, recordedAt: true },
      orderBy: { recordedAt: 'asc' },
    });

    const validation = validateNewOdometerEntry(
      existingRows.map((r) => ({ odometerKm: r.odometerKm, recordedAt: r.recordedAt })),
      { odometerKm: Math.round(odometerKm), recordedAt },
      vehicle.odometerKm,
    );

    return {
      severity: validation.severity,
      messages: validation.messages,
      message: buildOdometerSyncPrimaryMessage(validation, vehicle.odometerKm),
      willUpdateCurrentKm: validation.willUpdateCurrentKm,
      newCurrentKm: validation.newCurrentKm,
      vehicleOdometerKm: vehicle.odometerKm,
      timelineConsistent: validation.timelineAnalysis.isConsistent,
      requiresConfirmation: validation.severity === 'critical',
    };
  }

  async recordOdometerReading(
    tenantSlug: string,
    vehicleId: string,
    dto: RecordOdometerDto,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<{
    reading: OdometerReadingRecord;
    vehicle: VehicleRecord;
    odometerValidation: {
      severity: import('../ops/vehicle-odometer-timeline').OdometerSyncSeverity;
      messages: string[];
      message: string;
      timelineConsistent: boolean;
    };
  }> {
    await assertDriverMediaWrite(this.prisma, tenantSlug, vehicleId, access);
    const existing = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenant: { slug: tenantSlug } },
      include: { tenant: true },
    });
    if (!existing) throw new NotFoundException('Vehicle not found');

    if (!Number.isFinite(dto.odometerKm) || dto.odometerKm < 0) {
      throw new ConflictException('odometerKm must be a non-negative integer');
    }

    const source = dto.source ?? 'manual';
    const km = Math.round(dto.odometerKm);
    const recordedAt = new Date();

    if (source === 'tracking' && km < existing.odometerKm) {
      throw new ConflictException(
        'Citirea din tracking nu poate fi sub km-ul curent al vehiculului. Verificați sincronizarea.',
      );
    }

    const existingRows = await this.prisma.odometerReading.findMany({
      where: { vehicleId },
      select: { odometerKm: true, recordedAt: true },
    });

    const validation = validateNewOdometerEntry(
      existingRows.map((r) => ({ odometerKm: r.odometerKm, recordedAt: r.recordedAt })),
      { odometerKm: km, recordedAt },
      existing.odometerKm,
    );

    const reading = await this.prisma.odometerReading.create({
      data: {
        vehicleId,
        odometerKm: km,
        source,
        sourceRef: dto.sourceRef?.trim() || null,
        notes: dto.notes?.trim() || null,
        recordedAt,
        recordedByUserId: actorUserId ?? null,
      },
      include: { recordedBy: { select: { email: true } } },
    });

    if (validation.willUpdateCurrentKm) {
      await this.prisma.vehicle.update({
        where: { id: vehicleId },
        data: {
          odometerKm: validation.newCurrentKm,
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
        odometerKm: validation.newCurrentKm,
        source,
        previousKm: existing.odometerKm,
        timelineSeverity: validation.severity,
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
      odometerValidation: {
        severity: validation.severity,
        messages: validation.messages,
        message: buildOdometerSyncPrimaryMessage(validation, existing.odometerKm),
        timelineConsistent: validation.timelineAnalysis.isConsistent,
      },
    };
  }

  async addVehicleDocument(
    tenantSlug: string,
    vehicleId: string,
    dto: CreateVehicleDocumentDto,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<VehicleDocument> {
    await assertVehicleOpsWrite(this.prisma, tenantSlug, vehicleId, access);
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
    access?: AccessContext,
  ): Promise<void> {
    await assertVehicleOpsWrite(this.prisma, tenantSlug, vehicleId, access);
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

  private async vehicleWhere(
    tenantUuid: string,
    browse: VehicleBrowseFilters,
    access?: AccessContext,
  ): Promise<Prisma.VehicleWhereInput> {
    const q = browse.q?.trim();
    const statusOk =
      browse.status &&
      ['active', 'inactive', 'in_maintenance', 'decommissioned'].includes(browse.status);

    const parts: Prisma.VehicleWhereInput[] = [{ tenantId: tenantUuid }];

    if (access) {
      if (browse.vehicleScope === 'trip_ops') {
        parts.push(await tripOpsVehicleScope(this.prisma, tenantUuid, access));
      } else {
        parts.push(vehicleClientScope(access));
      }
    }

    if (q && q.length > 0) {
      parts.push({
        OR: [
          { registrationNumber: { contains: q, mode: 'insensitive' } },
          { vin: { contains: q, mode: 'insensitive' } },
          { client: { code: { contains: q, mode: 'insensitive' } } },
          { client: { legalName: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }

    if (statusOk) {
      parts.push({ status: browse.status as PrismaVehicleStatus });
    }

    const clientFilter = await resolveOptionalClientVehicleFilter(
      this.prisma,
      tenantUuid,
      browse.clientId,
    );
    if (clientFilter) {
      parts.push(clientFilter);
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

  async getVehicleMobility(
    tenantSlug: string,
    vehicleId: string,
    access?: AccessContext,
  ): Promise<VehicleMobilityPayload> {
    await assertVehicleOpsRead(this.prisma, tenantSlug, vehicleId, access);
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenant: { slug: tenantSlug } },
      select: { id: true, odometerKm: true },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const [costs, trips, odometerReadings] = await Promise.all([
      this.prisma.costEntry.findMany({
        where: { vehicleId },
        select: {
          id: true,
          category: true,
          incurredOn: true,
          fuelLiters: true,
          odometerKm: true,
          provider: true,
        },
        orderBy: { incurredOn: 'desc' },
        take: 200,
      }),
      this.prisma.trip.findMany({
        where: { vehicleId },
        select: {
          id: true,
          startedAt: true,
          distanceKm: true,
          reference: true,
          originLabel: true,
          destLabel: true,
        },
        orderBy: { startedAt: 'desc' },
        take: 200,
      }),
      this.prisma.odometerReading.findMany({
        where: { vehicleId },
        select: { id: true, recordedAt: true, odometerKm: true, source: true },
        orderBy: { recordedAt: 'desc' },
        take: 100,
      }),
    ]);

    return buildVehicleMobilityPayload({
      vehicleOdometerKm: vehicle.odometerKm,
      costs,
      trips,
      odometerReadings,
    });
  }

  private async applyVehicleItpReminderSync(
    tenantId: string,
    vehicle: VehicleRow,
  ): Promise<boolean> {
    try {
      await this.reminders.syncFromVehicleItpProfile(tenantId, {
        id: vehicle.id,
        registrationNumber: vehicle.registrationNumber,
        itpExpiresOn: vehicle.itpExpiresOn,
        itpReminderOffsetsDays: vehicle.itpReminderOffsetsDays,
        itpReminderMenuSyncEnabled: vehicle.itpReminderMenuSyncEnabled,
      });
      return false;
    } catch (err) {
      console.error('syncFromVehicleItpProfile failed', err);
      return true;
    }
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
      clientId: row.client.code,
      clientRefId: row.client.id,
      clientLegalName: row.client.legalName,
      registrationNumber: row.registrationNumber,
      type: row.type as VehicleRecord['type'],
      brand: row.brand,
      model: row.model,
      vin: row.vin,
      status: row.status as VehicleStatus,
      odometerKm: row.odometerKm,
      fuelType: row.fuelType ?? null,
      itpExpiresOn: row.itpExpiresOn ? row.itpExpiresOn.toISOString() : null,
      itpStationName: row.itpStationName,
      itpReminderOffsetsDays: normalizeReminderOffsets(row.itpReminderOffsetsDays),
      itpReminderMenuSyncEnabled: row.itpReminderMenuSyncEnabled,
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

  private toAcquisitionPayload(row: {
    acquisitionType: string | null;
    acquiredOn: Date | null;
    dealerName: string | null;
    financierName: string | null;
    purchasePriceCents: number | null;
    downPaymentCents: number | null;
    contractNumber: string | null;
    contractStartOn: Date | null;
    contractEndOn: Date | null;
    monthlyPaymentCents: number | null;
    residualValueCents: number | null;
    warrantyExpiresOn: Date | null;
    warrantyKmLimit: number | null;
    warrantyProvider: string | null;
    acquisitionNotes: string | null;
  }): VehicleAcquisitionPayload {
    return {
      acquisitionType: row.acquisitionType as VehicleAcquisitionPayload['acquisitionType'],
      acquiredOn: row.acquiredOn ? row.acquiredOn.toISOString() : null,
      dealerName: row.dealerName,
      financierName: row.financierName,
      purchasePriceCents: row.purchasePriceCents,
      downPaymentCents: row.downPaymentCents,
      contractNumber: row.contractNumber,
      contractStartOn: row.contractStartOn ? row.contractStartOn.toISOString() : null,
      contractEndOn: row.contractEndOn ? row.contractEndOn.toISOString() : null,
      monthlyPaymentCents: row.monthlyPaymentCents,
      residualValueCents: row.residualValueCents,
      warrantyExpiresOn: row.warrantyExpiresOn ? row.warrantyExpiresOn.toISOString() : null,
      warrantyKmLimit: row.warrantyKmLimit,
      warrantyProvider: row.warrantyProvider,
      acquisitionNotes: row.acquisitionNotes,
    };
  }

  private toPhotoRecord(row: {
    id: string;
    vehicleId: string;
    fileUrl: string;
    fileName: string | null;
    caption: string | null;
    sortOrder: number;
    createdAt: Date;
    uploadedBy: { email: string } | null;
  }): VehiclePhotoRecord {
    return {
      id: row.id,
      vehicleId: row.vehicleId,
      fileUrl: row.fileUrl,
      fileName: row.fileName,
      caption: row.caption,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
      uploadedByEmail: row.uploadedBy?.email ?? null,
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
