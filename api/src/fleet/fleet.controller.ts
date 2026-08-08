import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { MembershipRole } from '@prisma/client';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentAccess } from '../iam/current-access.decorator';
import type { AccessContext } from '../iam/access-context.types';
import type { CreateVehicleDocumentDto } from './dto/create-vehicle-document.dto';
import type { CreateVehicleDto } from './dto/create-vehicle.dto';
import type { PatchVehicleDto } from './dto/patch-vehicle.dto';
import type { PatchVehicleCivDto, RecordOdometerDto } from './dto/patch-vehicle-civ.dto';
import type { CreateVehiclePhotoDto, PatchVehicleAcquisitionDto } from './dto/patch-vehicle-acquisition.dto';
import type {
  CreateMaintenancePlanItemDto,
  MarkMaintenancePlanPerformedDto,
  PatchMaintenancePlanItemDto,
} from './dto/maintenance-plan.dto';
import type { VehicleStatus } from './fleet.types';
import { DashboardService } from './dashboard.service';
import { FleetService } from './fleet.service';
import { MaintenancePlanService } from './maintenance-plan.service';
import { VehicleFormBriefService } from './vehicle-form-brief.service';
import { TenantId } from './tenant-id.decorator';
import { DriversService } from '../drivers/drivers.service';
import { assertFuelType, parseFuelType } from '../ops/fuel-types';
import { FLEET_READ_ROLES, FLEET_WRITE_ROLES } from '../iam/role-sets';

@Controller('fleet')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FleetController {
  constructor(
    private readonly fleet: FleetService,
    private readonly maintenancePlan: MaintenancePlanService,
    private readonly dashboard: DashboardService,
    private readonly formBrief: VehicleFormBriefService,
    private readonly drivers: DriversService,
  ) {}

  @Get('dashboard')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer, MembershipRole.client_user)
  getDashboard(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.dashboard.getSnapshot(tenantSlug, access);
  }

  @Get('vehicles/export')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="fleet-vehicles.csv"')
  async exportVehicles(
    @TenantId() tenantId: string,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('clientId') clientId?: string,
  ): Promise<StreamableFile> {
    const csv = await this.fleet.exportVehiclesCsv(tenantId, {
      q: q?.trim(),
      status: parseOptionalStatus(status),
      clientId: clientId?.trim(),
    });
    return new StreamableFile(Buffer.from(csv, 'utf8'));
  }

  @Get('vehicles')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer, MembershipRole.client_user)
  listVehicles(
    @TenantId() tenantId: string,
    @CurrentAccess() access: AccessContext,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('clientId') clientId?: string,
    @Query('vehicleScope') vehicleScope?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(pageSizeStr ?? '50', 10) || 50), 200);
    const scope = vehicleScope?.trim() === 'trip_ops' ? ('trip_ops' as const) : undefined;
    return this.fleet.listVehiclesPaged(
      tenantId,
      {
        page,
        pageSize,
        q: q?.trim(),
        status: parseOptionalStatus(status),
        clientId: clientId?.trim(),
        vehicleScope: scope,
      },
      access,
    );
  }

  @Get('vehicles/:vehicleId')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer, MembershipRole.client_user)
  getVehicle(
    @TenantId() tenantId: string,
    @Param('vehicleId') vehicleId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.fleet.getVehicle(tenantId, vehicleId, access);
  }

  @Get('vehicles/:vehicleId/form-brief')
  @Roles(...FLEET_READ_ROLES)
  getVehicleFormBrief(
    @TenantId() tenantId: string,
    @Param('vehicleId') vehicleId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.formBrief.getBrief(tenantId, vehicleId, access);
  }

  @Post('vehicles')
  @Roles(...FLEET_WRITE_ROLES)
  @HttpCode(201)
  createVehicle(
    @TenantId() tenantId: string,
    @Body() body: unknown,
    @CurrentAccess() access: AccessContext,
    @CurrentUserId() actorUserId?: string,
  ) {
    const dto = assertCreateVehicleDto(body);
    return this.fleet.createVehicle(tenantId, dto, actorUserId, access);
  }

  @Patch('vehicles/:vehicleId')
  @Roles(...FLEET_WRITE_ROLES)
  patchVehicle(
    @TenantId() tenantId: string,
    @Param('vehicleId') vehicleId: string,
    @Body() body: unknown,
    @CurrentAccess() access: AccessContext,
    @CurrentUserId() actorUserId?: string,
  ) {
    const dto = assertPatchVehicleDto(body);
    return this.fleet.patchVehicle(tenantId, vehicleId, dto, actorUserId, access);
  }

  @Get('vehicles/:vehicleId/driver-assignments')
  @Roles(...FLEET_READ_ROLES)
  listVehicleDriverAssignments(
    @TenantId() tenantId: string,
    @Param('vehicleId') vehicleId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.drivers.listVehicleAssignments(tenantId, vehicleId, access);
  }

  @Get('vehicles/:vehicleId/mobility')
  @Roles(...FLEET_READ_ROLES)
  getVehicleMobility(
    @TenantId() tenantId: string,
    @Param('vehicleId') vehicleId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.fleet.getVehicleMobility(tenantId, vehicleId, access);
  }

  @Get('vehicles/:vehicleId/civ')
  @Roles(...FLEET_READ_ROLES)
  getVehicleCiv(
    @TenantId() tenantId: string,
    @Param('vehicleId') vehicleId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.fleet.getVehicleCiv(tenantId, vehicleId, access);
  }

  @Patch('vehicles/:vehicleId/civ')
  @Roles(MembershipRole.tenant_admin)
  patchVehicleCiv(
    @TenantId() tenantId: string,
    @Param('vehicleId') vehicleId: string,
    @Body() body: unknown,
    @CurrentUserId() actorUserId?: string,
  ) {
    const dto = assertPatchVehicleCivDto(body);
    return this.fleet.patchVehicleCiv(tenantId, vehicleId, dto, actorUserId);
  }

  @Post('vehicles/:vehicleId/civ/extract-preview')
  @Roles(MembershipRole.tenant_admin)
  extractCivPreview(
    @TenantId() tenantId: string,
    @Param('vehicleId') vehicleId: string,
    @Body() body: unknown,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.fleet.extractCivPreview(tenantId, vehicleId, body, access);
  }

  @Get('vehicles/:vehicleId/acquisition')
  @Roles(...FLEET_READ_ROLES)
  getVehicleAcquisition(
    @TenantId() tenantId: string,
    @Param('vehicleId') vehicleId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.fleet.getVehicleAcquisition(tenantId, vehicleId, access);
  }

  @Patch('vehicles/:vehicleId/acquisition')
  @Roles(MembershipRole.tenant_admin)
  patchVehicleAcquisition(
    @TenantId() tenantId: string,
    @Param('vehicleId') vehicleId: string,
    @Body() body: unknown,
    @CurrentUserId() actorUserId?: string,
  ) {
    const dto = assertPatchVehicleAcquisitionDto(body);
    return this.fleet.patchVehicleAcquisition(tenantId, vehicleId, dto, actorUserId);
  }

  @Get('vehicles/:vehicleId/photos')
  @Roles(...FLEET_READ_ROLES)
  listVehiclePhotos(
    @TenantId() tenantId: string,
    @Param('vehicleId') vehicleId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.fleet.listVehiclePhotos(tenantId, vehicleId, access);
  }

  @Post('vehicles/:vehicleId/photos')
  @Roles(...FLEET_WRITE_ROLES)
  @HttpCode(201)
  addVehiclePhoto(
    @TenantId() tenantId: string,
    @Param('vehicleId') vehicleId: string,
    @Body() body: unknown,
    @CurrentAccess() access: AccessContext,
    @CurrentUserId() actorUserId?: string,
  ) {
    const dto = assertCreateVehiclePhotoDto(body);
    return this.fleet.addVehiclePhoto(tenantId, vehicleId, dto, actorUserId, access);
  }

  @Delete('vehicles/:vehicleId/photos/:photoId')
  @Roles(MembershipRole.tenant_admin)
  @HttpCode(204)
  deleteVehiclePhoto(
    @TenantId() tenantId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('photoId') photoId: string,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.fleet.deleteVehiclePhoto(tenantId, vehicleId, photoId, actorUserId);
  }

  @Get('vehicles/:vehicleId/odometer-readings')
  @Roles(...FLEET_READ_ROLES)
  listOdometerReadings(
    @TenantId() tenantId: string,
    @Param('vehicleId') vehicleId: string,
    @CurrentAccess() access: AccessContext,
    @Query('limit') limitStr?: string,
  ) {
    const limit = Math.min(Math.max(1, parseInt(limitStr ?? '50', 10) || 50), 100);
    return this.fleet.listOdometerReadings(tenantId, vehicleId, limit, access);
  }

  @Get('vehicles/:vehicleId/odometer-preview')
  @Roles(...FLEET_READ_ROLES)
  previewOdometerEntry(
    @TenantId() tenantId: string,
    @Param('vehicleId') vehicleId: string,
    @CurrentAccess() access: AccessContext,
    @Query('odometerKm') odometerKmStr?: string,
    @Query('recordedAt') recordedAt?: string,
  ) {
    const odometerKm = parseInt(odometerKmStr ?? '', 10);
    if (!recordedAt?.trim() || !Number.isFinite(odometerKm) || odometerKm < 0) {
      throw new BadRequestException('Query params odometerKm and recordedAt are required');
    }
    return this.fleet.previewOdometerEntry(tenantId, vehicleId, odometerKm, recordedAt.trim(), access);
  }

  @Post('vehicles/:vehicleId/odometer-readings')
  @Roles(...FLEET_WRITE_ROLES)
  @HttpCode(201)
  recordOdometerReading(
    @TenantId() tenantId: string,
    @Param('vehicleId') vehicleId: string,
    @Body() body: unknown,
    @CurrentAccess() access: AccessContext,
    @CurrentUserId() actorUserId?: string,
  ) {
    const dto = assertRecordOdometerDto(body);
    return this.fleet.recordOdometerReading(tenantId, vehicleId, dto, actorUserId, access);
  }

  @Get('vehicles/:vehicleId/maintenance-plan')
  @Roles(...FLEET_READ_ROLES)
  listMaintenancePlan(
    @TenantId() tenantId: string,
    @Param('vehicleId') vehicleId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.maintenancePlan.list(tenantId, vehicleId, access);
  }

  @Post('vehicles/:vehicleId/maintenance-plan')
  @Roles(...FLEET_WRITE_ROLES)
  @HttpCode(201)
  createMaintenancePlanItem(
    @TenantId() tenantId: string,
    @Param('vehicleId') vehicleId: string,
    @Body() body: unknown,
    @CurrentAccess() access: AccessContext,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.maintenancePlan.create(tenantId, vehicleId, assertCreateMaintenancePlanDto(body), actorUserId, access);
  }

  @Patch('vehicles/:vehicleId/maintenance-plan/:itemId')
  @Roles(...FLEET_WRITE_ROLES)
  patchMaintenancePlanItem(
    @TenantId() tenantId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('itemId') itemId: string,
    @Body() body: unknown,
    @CurrentAccess() access: AccessContext,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.maintenancePlan.patch(tenantId, vehicleId, itemId, assertPatchMaintenancePlanDto(body), actorUserId, access);
  }

  @Post('vehicles/:vehicleId/maintenance-plan/:itemId/mark-performed')
  @Roles(...FLEET_WRITE_ROLES)
  @HttpCode(200)
  markMaintenancePlanPerformed(
    @TenantId() tenantId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('itemId') itemId: string,
    @Body() body: unknown,
    @CurrentAccess() access: AccessContext,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.maintenancePlan.markPerformed(
      tenantId,
      vehicleId,
      itemId,
      assertMarkMaintenancePlanPerformedDto(body),
      actorUserId,
      access,
    );
  }

  @Delete('vehicles/:vehicleId/maintenance-plan/:itemId')
  @Roles(...FLEET_WRITE_ROLES)
  @HttpCode(204)
  deleteMaintenancePlanItem(
    @TenantId() tenantId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('itemId') itemId: string,
    @CurrentAccess() access: AccessContext,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.maintenancePlan.delete(tenantId, vehicleId, itemId, actorUserId, access);
  }

  @Delete('vehicles/:vehicleId')
  @Roles(...FLEET_WRITE_ROLES)
  @HttpCode(204)
  deleteVehicle(
    @TenantId() tenantId: string,
    @Param('vehicleId') vehicleId: string,
    @CurrentAccess() access: AccessContext,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.fleet.deleteVehicle(tenantId, vehicleId, actorUserId, access);
  }

  @Post('vehicles/:vehicleId/documents')
  @Roles(...FLEET_WRITE_ROLES)
  @HttpCode(201)
  addVehicleDocument(
    @TenantId() tenantId: string,
    @Param('vehicleId') vehicleId: string,
    @Body() body: unknown,
    @CurrentAccess() access: AccessContext,
    @CurrentUserId() actorUserId?: string,
  ) {
    const dto = assertCreateVehicleDocumentDto(body);
    return this.fleet.addVehicleDocument(tenantId, vehicleId, dto, actorUserId, access);
  }
}

function parseOptionalStatus(raw?: string): VehicleStatus | undefined {
  if (!raw?.trim()) return undefined;
  const v = raw.trim();
  const ok = ['active', 'inactive', 'in_maintenance', 'decommissioned'].includes(v);
  if (!ok) throw new BadRequestException('Invalid status filter');
  return v as VehicleStatus;
}

function assertCreateVehicleDto(body: unknown): CreateVehicleDto {
  if (!isRecord(body)) throw new BadRequestException('Invalid JSON body');

  const clientId = asNonEmptyString(body.clientId, 'clientId');
  const registrationNumber = asNonEmptyString(
    body.registrationNumber,
    'registrationNumber',
  );
  const type = asVehicleType(body.type, 'type');
  const fuelType = assertFuelType(body.fuelType, 'fuelType');
  const vin = optionalString(body.vin);
  const brand = optionalString(body.brand);
  const model = optionalString(body.model);
  const odometerKm =
    'odometerKm' in body ? asNonNegativeNumber(body.odometerKm, 'odometerKm') : undefined;
  const itpExpiresOn = optionalIsoDateString(body.itpExpiresOn);
  const itpStationName = optionalString(body.itpStationName);
  const itpReminderOffsetsDays = parseReminderOffsetsField(body, 'itpReminderOffsetsDays');
  const syncItpReminderAction =
    'syncItpReminderAction' in body ? optionalBoolean(body.syncItpReminderAction) : undefined;

  return {
    clientId,
    registrationNumber,
    type,
    fuelType,
    vin,
    brand,
    model,
    odometerKm,
    itpExpiresOn,
    itpStationName,
    itpReminderOffsetsDays,
    syncItpReminderAction,
  };
}

function assertPatchVehicleDto(body: unknown): PatchVehicleDto {
  if (!isRecord(body)) throw new BadRequestException('Invalid JSON body');

  const dto: PatchVehicleDto = {};

  if ('clientId' in body) {
    dto.clientId = asNonEmptyString(body.clientId, 'clientId');
  }
  if ('registrationNumber' in body) {
    dto.registrationNumber = asNonEmptyString(
      body.registrationNumber,
      'registrationNumber',
    );
  }
  if ('type' in body) dto.type = asVehicleType(body.type, 'type');
  if ('fuelType' in body) {
    if (body.fuelType === null) dto.fuelType = null;
    else {
      const parsed = parseFuelType(body.fuelType);
      if (!parsed) throw new BadRequestException('Invalid fuelType');
      dto.fuelType = parsed;
    }
  }
  if ('status' in body) dto.status = asVehicleStatus(body.status, 'status');
  if ('odometerKm' in body) {
    throw new BadRequestException(
      'Odometrul se actualizează doar din tab-ul Odometru al vehiculului.',
    );
  }

  if ('vin' in body) {
    if (body.vin === null) dto.vin = null;
    else dto.vin = optionalString(body.vin) ?? null;
  }
  if ('brand' in body) {
    if (body.brand === null) dto.brand = null;
    else dto.brand = optionalString(body.brand) ?? null;
  }
  if ('model' in body) {
    if (body.model === null) dto.model = null;
    else dto.model = optionalString(body.model) ?? null;
  }

  if ('itpExpiresOn' in body) {
    if (body.itpExpiresOn === null) dto.itpExpiresOn = null;
    else dto.itpExpiresOn = optionalIsoDateString(body.itpExpiresOn);
  }
  if ('itpStationName' in body) {
    if (body.itpStationName === null) dto.itpStationName = null;
    else dto.itpStationName = optionalString(body.itpStationName);
  }
  if ('itpReminderOffsetsDays' in body) {
    dto.itpReminderOffsetsDays = parseReminderOffsetsField(body, 'itpReminderOffsetsDays');
  }
  if ('syncItpReminderAction' in body) {
    dto.syncItpReminderAction = optionalBoolean(body.syncItpReminderAction);
  }

  if (Object.keys(dto).length === 0) {
    throw new BadRequestException('No fields to update');
  }

  return dto;
}

function assertCreateVehicleDocumentDto(body: unknown): CreateVehicleDocumentDto {
  if (!isRecord(body)) throw new BadRequestException('Invalid JSON body');

  const documentTypeCode = asNonEmptyString(body.documentTypeCode, 'documentTypeCode');
  const title = asNonEmptyString(body.title, 'title');
  const expiresOn =
    'expiresOn' in body
      ? body.expiresOn === null
        ? null
        : optionalIsoDateString(body.expiresOn)
      : undefined;
  const fileUrl =
    'fileUrl' in body ? (body.fileUrl === null ? null : optionalString(body.fileUrl)) : undefined;

  return { documentTypeCode, title, expiresOn, fileUrl };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asNonEmptyString(v: unknown, field: string): string {
  if (typeof v !== 'string' || v.trim().length === 0) {
    throw new BadRequestException(`Field "${field}" must be a non-empty string`);
  }
  return v.trim();
}

function optionalString(v: unknown): string | undefined {
  if (v === undefined) return undefined;
  if (v === null) return undefined;
  if (typeof v !== 'string') {
    throw new BadRequestException('Expected string or null');
  }
  const s = v.trim();
  return s.length === 0 ? undefined : s;
}

function optionalIsoDateString(v: unknown): string | undefined {
  if (v === undefined) return undefined;
  if (v === null) return undefined;
  if (typeof v !== 'string' || v.trim().length === 0) {
    throw new BadRequestException('Expected ISO date string or null');
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException('Invalid date');
  }
  return d.toISOString();
}

function asNonNegativeNumber(v: unknown, field: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
    throw new BadRequestException(`Field "${field}" must be a non-negative number`);
  }
  return v;
}

const VEHICLE_TYPES = new Set([
  'car',
  'van_lt_3_5',
  'van_gt_3_5',
  'tractor_unit',
  'trailer',
  'semi_trailer',
]);

function asVehicleType(v: unknown, field: string) {
  if (typeof v !== 'string' || !VEHICLE_TYPES.has(v)) {
    throw new BadRequestException(`Field "${field}" has an invalid vehicle type`);
  }
  return v as CreateVehicleDto['type'];
}

const VEHICLE_STATUSES = new Set([
  'active',
  'inactive',
  'in_maintenance',
  'decommissioned',
]);

function asVehicleStatus(v: unknown, field: string) {
  if (typeof v !== 'string' || !VEHICLE_STATUSES.has(v)) {
    throw new BadRequestException(`Field "${field}" has an invalid status`);
  }
  return v as NonNullable<PatchVehicleDto['status']>;
}

function assertPatchVehicleCivDto(body: unknown): PatchVehicleCivDto {
  if (!isRecord(body)) throw new BadRequestException('Invalid JSON body');
  const dto: PatchVehicleCivDto = {};
  if ('civSeries' in body) {
    dto.civSeries = body.civSeries === null ? null : optionalString(body.civSeries) ?? null;
  }
  if ('civIssuedOn' in body) {
    if (body.civIssuedOn === null) dto.civIssuedOn = null;
    else dto.civIssuedOn = optionalIsoDateString(body.civIssuedOn);
  }
  if ('civRarOffice' in body) {
    dto.civRarOffice = body.civRarOffice === null ? null : optionalString(body.civRarOffice) ?? null;
  }
  if ('civMentions' in body) {
    dto.civMentions = body.civMentions === null ? null : optionalString(body.civMentions) ?? null;
  }
  if ('civImportedFromDocumentId' in body) {
    dto.civImportedFromDocumentId =
      body.civImportedFromDocumentId === null
        ? null
        : optionalString(body.civImportedFromDocumentId) ?? null;
  }
  if ('civProfile' in body) {
    if (body.civProfile === null) dto.civProfile = null;
    else if (isRecord(body.civProfile)) dto.civProfile = body.civProfile as PatchVehicleCivDto['civProfile'];
    else throw new BadRequestException('civProfile must be an object or null');
  }
  if (Object.keys(dto).length === 0) {
    throw new BadRequestException('No fields to update');
  }
  return dto;
}

function parseReminderOffsetsField(
  body: Record<string, unknown>,
  key: string,
): number[] | null | undefined {
  if (!(key in body)) return undefined;
  const raw = body[key];
  if (raw === null) return null;
  if (!Array.isArray(raw)) throw new BadRequestException(`${key} must be an array of numbers or null`);
  const nums = raw.filter((v): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0);
  return nums;
}

function optionalBoolean(v: unknown): boolean | undefined {
  if (v === undefined) return undefined;
  if (typeof v === 'boolean') return v;
  throw new BadRequestException('Expected boolean');
}

const ACQUISITION_TYPES = new Set(['cash', 'financial_leasing', 'operational_leasing']);

function optionalAcquisitionType(v: unknown): PatchVehicleAcquisitionDto['acquisitionType'] | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== 'string' || !ACQUISITION_TYPES.has(v)) {
    throw new BadRequestException('acquisitionType must be cash, financial_leasing, or operational_leasing');
  }
  return v as PatchVehicleAcquisitionDto['acquisitionType'];
}

function optionalCents(v: unknown, field: string): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
    throw new BadRequestException(`Field "${field}" must be a non-negative number or null`);
  }
  return Math.round(v);
}

function optionalPositiveInt(v: unknown, field: string): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
    throw new BadRequestException(`Field "${field}" must be a non-negative integer or null`);
  }
  return v;
}

function assertPatchVehicleAcquisitionDto(body: unknown): PatchVehicleAcquisitionDto {
  if (!isRecord(body)) throw new BadRequestException('Invalid JSON body');
  const dto: PatchVehicleAcquisitionDto = {};
  if ('acquisitionType' in body) dto.acquisitionType = optionalAcquisitionType(body.acquisitionType);
  if ('acquiredOn' in body) {
    if (body.acquiredOn === null) dto.acquiredOn = null;
    else dto.acquiredOn = optionalIsoDateString(body.acquiredOn) ?? null;
  }
  if ('dealerName' in body) {
    dto.dealerName = body.dealerName === null ? null : optionalString(body.dealerName) ?? null;
  }
  if ('financierName' in body) {
    dto.financierName = body.financierName === null ? null : optionalString(body.financierName) ?? null;
  }
  if ('purchasePriceCents' in body) dto.purchasePriceCents = optionalCents(body.purchasePriceCents, 'purchasePriceCents');
  if ('downPaymentCents' in body) dto.downPaymentCents = optionalCents(body.downPaymentCents, 'downPaymentCents');
  if ('contractNumber' in body) {
    dto.contractNumber = body.contractNumber === null ? null : optionalString(body.contractNumber) ?? null;
  }
  if ('contractStartOn' in body) {
    if (body.contractStartOn === null) dto.contractStartOn = null;
    else dto.contractStartOn = optionalIsoDateString(body.contractStartOn) ?? null;
  }
  if ('contractEndOn' in body) {
    if (body.contractEndOn === null) dto.contractEndOn = null;
    else dto.contractEndOn = optionalIsoDateString(body.contractEndOn) ?? null;
  }
  if ('monthlyPaymentCents' in body) {
    dto.monthlyPaymentCents = optionalCents(body.monthlyPaymentCents, 'monthlyPaymentCents');
  }
  if ('residualValueCents' in body) dto.residualValueCents = optionalCents(body.residualValueCents, 'residualValueCents');
  if ('warrantyExpiresOn' in body) {
    if (body.warrantyExpiresOn === null) dto.warrantyExpiresOn = null;
    else dto.warrantyExpiresOn = optionalIsoDateString(body.warrantyExpiresOn) ?? null;
  }
  if ('warrantyKmLimit' in body) {
    dto.warrantyKmLimit = optionalPositiveInt(body.warrantyKmLimit, 'warrantyKmLimit');
  }
  if ('warrantyProvider' in body) {
    dto.warrantyProvider = body.warrantyProvider === null ? null : optionalString(body.warrantyProvider) ?? null;
  }
  if ('acquisitionNotes' in body) {
    dto.acquisitionNotes = body.acquisitionNotes === null ? null : optionalString(body.acquisitionNotes) ?? null;
  }
  if (Object.keys(dto).length === 0) {
    throw new BadRequestException('No fields to update');
  }
  return dto;
}

function assertCreateVehiclePhotoDto(body: unknown): CreateVehiclePhotoDto {
  if (!isRecord(body)) throw new BadRequestException('Invalid JSON body');
  const fileUrl = asNonEmptyString(body.fileUrl, 'fileUrl');
  const dto: CreateVehiclePhotoDto = { fileUrl };
  if ('fileName' in body) {
    dto.fileName = body.fileName === null ? null : optionalString(body.fileName) ?? null;
  }
  if ('caption' in body) {
    dto.caption = body.caption === null ? null : optionalString(body.caption) ?? null;
  }
  return dto;
}

function assertRecordOdometerDto(body: unknown): RecordOdometerDto {
  if (!isRecord(body)) throw new BadRequestException('Invalid JSON body');
  const odometerKm = asNonNegativeNumber(body.odometerKm, 'odometerKm');
  const dto: RecordOdometerDto = { odometerKm: Math.round(odometerKm) };
  if ('notes' in body) {
    dto.notes = body.notes === null ? null : optionalString(body.notes) ?? null;
  }
  if ('sourceRef' in body) {
    dto.sourceRef = body.sourceRef === null ? null : optionalString(body.sourceRef) ?? null;
  }
  if ('source' in body) {
    const s = body.source;
    if (s !== 'manual' && s !== 'tracking' && s !== 'import') {
      throw new BadRequestException('source must be manual, tracking, or import');
    }
    dto.source = s;
  }
  return dto;
}

const PLAN_TRIGGER_MODES = new Set(['time', 'km', 'whichever_first']);

function assertCreateMaintenancePlanDto(body: unknown): CreateMaintenancePlanItemDto {
  if (!isRecord(body)) throw new BadRequestException('Invalid JSON body');
  const title = asNonEmptyString(body.title, 'title');
  const dto: CreateMaintenancePlanItemDto = { title };
  if ('category' in body) dto.category = body.category === null ? null : optionalString(body.category) ?? null;
  if ('notes' in body) dto.notes = body.notes === null ? null : optionalString(body.notes) ?? null;
  if ('sortOrder' in body) dto.sortOrder = asNonNegativeNumber(body.sortOrder, 'sortOrder');
  if ('isActive' in body) dto.isActive = optionalBoolean(body.isActive);
  if ('intervalDays' in body) {
    dto.intervalDays =
      body.intervalDays === null ? null : asPositiveInt(body.intervalDays, 'intervalDays');
  }
  if ('intervalKm' in body) {
    dto.intervalKm = body.intervalKm === null ? null : asPositiveInt(body.intervalKm, 'intervalKm');
  }
  if ('triggerMode' in body) {
    if (typeof body.triggerMode !== 'string' || !PLAN_TRIGGER_MODES.has(body.triggerMode)) {
      throw new BadRequestException('Invalid triggerMode');
    }
    dto.triggerMode = body.triggerMode as CreateMaintenancePlanItemDto['triggerMode'];
  }
  if ('lastServiceOn' in body) {
    if (body.lastServiceOn === null) dto.lastServiceOn = null;
    else dto.lastServiceOn = optionalIsoDateString(body.lastServiceOn);
  }
  if ('lastServiceKm' in body) {
    dto.lastServiceKm =
      body.lastServiceKm === null ? null : asNonNegativeNumber(body.lastServiceKm, 'lastServiceKm');
  }
  if ('nextDueOn' in body) {
    if (body.nextDueOn === null) dto.nextDueOn = null;
    else dto.nextDueOn = optionalIsoDateString(body.nextDueOn);
  }
  if ('dueOdometerKm' in body) {
    dto.dueOdometerKm =
      body.dueOdometerKm === null ? null : asNonNegativeNumber(body.dueOdometerKm, 'dueOdometerKm');
  }
  if ('dueManualOverride' in body) dto.dueManualOverride = optionalBoolean(body.dueManualOverride);
  if ('reminderOffsetsDays' in body) {
    dto.reminderOffsetsDays = parseReminderOffsetsField(body, 'reminderOffsetsDays') ?? null;
  }
  if ('reminderOffsetsKm' in body) {
    dto.reminderOffsetsKm = parseReminderOffsetsKmField(body, 'reminderOffsetsKm') ?? null;
  }
  if ('syncReminderAction' in body) dto.syncReminderAction = optionalBoolean(body.syncReminderAction);
  if ('preferredProvider' in body) {
    dto.preferredProvider =
      body.preferredProvider === null ? null : optionalString(body.preferredProvider) ?? null;
  }
  if ('estimatedCostCents' in body) {
    dto.estimatedCostCents =
      body.estimatedCostCents === null
        ? null
        : asNonNegativeNumber(body.estimatedCostCents, 'estimatedCostCents');
  }
  return dto;
}

function assertPatchMaintenancePlanDto(body: unknown): PatchMaintenancePlanItemDto {
  if (!isRecord(body)) throw new BadRequestException('Invalid JSON body');
  const dto: PatchMaintenancePlanItemDto = {};
  if ('title' in body) dto.title = asNonEmptyString(body.title, 'title');
  if ('category' in body) dto.category = body.category === null ? null : optionalString(body.category) ?? null;
  if ('notes' in body) dto.notes = body.notes === null ? null : optionalString(body.notes) ?? null;
  if ('sortOrder' in body) dto.sortOrder = asNonNegativeNumber(body.sortOrder, 'sortOrder');
  if ('isActive' in body) dto.isActive = optionalBoolean(body.isActive);
  if ('intervalDays' in body) {
    dto.intervalDays =
      body.intervalDays === null ? null : asPositiveInt(body.intervalDays, 'intervalDays');
  }
  if ('intervalKm' in body) {
    dto.intervalKm = body.intervalKm === null ? null : asPositiveInt(body.intervalKm, 'intervalKm');
  }
  if ('triggerMode' in body) {
    if (typeof body.triggerMode !== 'string' || !PLAN_TRIGGER_MODES.has(body.triggerMode)) {
      throw new BadRequestException('Invalid triggerMode');
    }
    dto.triggerMode = body.triggerMode as PatchMaintenancePlanItemDto['triggerMode'];
  }
  if ('lastServiceOn' in body) {
    if (body.lastServiceOn === null) dto.lastServiceOn = null;
    else dto.lastServiceOn = optionalIsoDateString(body.lastServiceOn);
  }
  if ('lastServiceKm' in body) {
    dto.lastServiceKm =
      body.lastServiceKm === null ? null : asNonNegativeNumber(body.lastServiceKm, 'lastServiceKm');
  }
  if ('nextDueOn' in body) {
    if (body.nextDueOn === null) dto.nextDueOn = null;
    else dto.nextDueOn = optionalIsoDateString(body.nextDueOn);
  }
  if ('dueOdometerKm' in body) {
    dto.dueOdometerKm =
      body.dueOdometerKm === null ? null : asNonNegativeNumber(body.dueOdometerKm, 'dueOdometerKm');
  }
  if ('dueManualOverride' in body) dto.dueManualOverride = optionalBoolean(body.dueManualOverride);
  if ('reminderOffsetsDays' in body) {
    dto.reminderOffsetsDays = parseReminderOffsetsField(body, 'reminderOffsetsDays') ?? null;
  }
  if ('reminderOffsetsKm' in body) {
    dto.reminderOffsetsKm = parseReminderOffsetsKmField(body, 'reminderOffsetsKm') ?? null;
  }
  if ('syncReminderAction' in body) dto.syncReminderAction = optionalBoolean(body.syncReminderAction);
  if ('preferredProvider' in body) {
    dto.preferredProvider =
      body.preferredProvider === null ? null : optionalString(body.preferredProvider) ?? null;
  }
  if ('estimatedCostCents' in body) {
    dto.estimatedCostCents =
      body.estimatedCostCents === null
        ? null
        : asNonNegativeNumber(body.estimatedCostCents, 'estimatedCostCents');
  }
  if (Object.keys(dto).length === 0) {
    throw new BadRequestException('No fields to update');
  }
  return dto;
}

function assertMarkMaintenancePlanPerformedDto(body: unknown): MarkMaintenancePlanPerformedDto {
  if (!isRecord(body)) throw new BadRequestException('Invalid JSON body');
  const dto: MarkMaintenancePlanPerformedDto = {};
  if ('performedOn' in body) {
    if (body.performedOn === null) dto.performedOn = null;
    else dto.performedOn = optionalIsoDateString(body.performedOn);
  }
  if ('performedKm' in body) {
    dto.performedKm =
      body.performedKm === null ? null : asNonNegativeNumber(body.performedKm, 'performedKm');
  }
  if ('notes' in body) dto.notes = body.notes === null ? null : optionalString(body.notes) ?? null;
  return dto;
}

function asPositiveInt(v: unknown, field: string): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v <= 0) {
    throw new BadRequestException(`Field "${field}" must be a positive integer`);
  }
  return v;
}

function parseReminderOffsetsKmField(
  body: Record<string, unknown>,
  key: string,
): number[] | null | undefined {
  if (!(key in body)) return undefined;
  const raw = body[key];
  if (raw === null) return null;
  if (!Array.isArray(raw)) throw new BadRequestException(`${key} must be an array of numbers or null`);
  const nums = raw.filter((v): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0);
  return nums;
}
