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
import type { CreateVehicleDocumentDto } from './dto/create-vehicle-document.dto';
import type { CreateVehicleDto } from './dto/create-vehicle.dto';
import type { PatchVehicleDto } from './dto/patch-vehicle.dto';
import type { PatchVehicleCivDto, RecordOdometerDto } from './dto/patch-vehicle-civ.dto';
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

@Controller('fleet')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FleetController {
  constructor(
    private readonly fleet: FleetService,
    private readonly maintenancePlan: MaintenancePlanService,
    private readonly dashboard: DashboardService,
    private readonly formBrief: VehicleFormBriefService,
  ) {}

  @Get('dashboard')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  getDashboard(@TenantId() tenantSlug: string) {
    return this.dashboard.getSnapshot(tenantSlug);
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
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  listVehicles(
    @TenantId() tenantId: string,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('clientId') clientId?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(pageSizeStr ?? '50', 10) || 50), 200);
    return this.fleet.listVehiclesPaged(tenantId, {
      page,
      pageSize,
      q: q?.trim(),
      status: parseOptionalStatus(status),
      clientId: clientId?.trim(),
    });
  }

  @Get('vehicles/:vehicleId')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  getVehicle(@TenantId() tenantId: string, @Param('vehicleId') vehicleId: string) {
    return this.fleet.getVehicle(tenantId, vehicleId);
  }

  @Get('vehicles/:vehicleId/form-brief')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  getVehicleFormBrief(@TenantId() tenantId: string, @Param('vehicleId') vehicleId: string) {
    return this.formBrief.getBrief(tenantId, vehicleId);
  }

  @Post('vehicles')
  @Roles(MembershipRole.tenant_admin)
  @HttpCode(201)
  createVehicle(
    @TenantId() tenantId: string,
    @Body() body: unknown,
    @CurrentUserId() actorUserId?: string,
  ) {
    const dto = assertCreateVehicleDto(body);
    return this.fleet.createVehicle(tenantId, dto, actorUserId);
  }

  @Patch('vehicles/:vehicleId')
  @Roles(MembershipRole.tenant_admin)
  patchVehicle(
    @TenantId() tenantId: string,
    @Param('vehicleId') vehicleId: string,
    @Body() body: unknown,
    @CurrentUserId() actorUserId?: string,
  ) {
    const dto = assertPatchVehicleDto(body);
    return this.fleet.patchVehicle(tenantId, vehicleId, dto, actorUserId);
  }

  @Get('vehicles/:vehicleId/mobility')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  getVehicleMobility(@TenantId() tenantId: string, @Param('vehicleId') vehicleId: string) {
    return this.fleet.getVehicleMobility(tenantId, vehicleId);
  }

  @Get('vehicles/:vehicleId/civ')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  getVehicleCiv(@TenantId() tenantId: string, @Param('vehicleId') vehicleId: string) {
    return this.fleet.getVehicleCiv(tenantId, vehicleId);
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

  @Get('vehicles/:vehicleId/odometer-readings')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  listOdometerReadings(
    @TenantId() tenantId: string,
    @Param('vehicleId') vehicleId: string,
    @Query('limit') limitStr?: string,
  ) {
    const limit = Math.min(Math.max(1, parseInt(limitStr ?? '50', 10) || 50), 100);
    return this.fleet.listOdometerReadings(tenantId, vehicleId, limit);
  }

  @Post('vehicles/:vehicleId/odometer-readings')
  @Roles(MembershipRole.tenant_admin)
  @HttpCode(201)
  recordOdometerReading(
    @TenantId() tenantId: string,
    @Param('vehicleId') vehicleId: string,
    @Body() body: unknown,
    @CurrentUserId() actorUserId?: string,
  ) {
    const dto = assertRecordOdometerDto(body);
    return this.fleet.recordOdometerReading(tenantId, vehicleId, dto, actorUserId);
  }

  @Get('vehicles/:vehicleId/maintenance-plan')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  listMaintenancePlan(@TenantId() tenantId: string, @Param('vehicleId') vehicleId: string) {
    return this.maintenancePlan.list(tenantId, vehicleId);
  }

  @Post('vehicles/:vehicleId/maintenance-plan')
  @Roles(MembershipRole.tenant_admin)
  @HttpCode(201)
  createMaintenancePlanItem(
    @TenantId() tenantId: string,
    @Param('vehicleId') vehicleId: string,
    @Body() body: unknown,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.maintenancePlan.create(tenantId, vehicleId, assertCreateMaintenancePlanDto(body), actorUserId);
  }

  @Patch('vehicles/:vehicleId/maintenance-plan/:itemId')
  @Roles(MembershipRole.tenant_admin)
  patchMaintenancePlanItem(
    @TenantId() tenantId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('itemId') itemId: string,
    @Body() body: unknown,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.maintenancePlan.patch(tenantId, vehicleId, itemId, assertPatchMaintenancePlanDto(body), actorUserId);
  }

  @Post('vehicles/:vehicleId/maintenance-plan/:itemId/mark-performed')
  @Roles(MembershipRole.tenant_admin)
  @HttpCode(200)
  markMaintenancePlanPerformed(
    @TenantId() tenantId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('itemId') itemId: string,
    @Body() body: unknown,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.maintenancePlan.markPerformed(
      tenantId,
      vehicleId,
      itemId,
      assertMarkMaintenancePlanPerformedDto(body),
      actorUserId,
    );
  }

  @Delete('vehicles/:vehicleId/maintenance-plan/:itemId')
  @Roles(MembershipRole.tenant_admin)
  @HttpCode(204)
  deleteMaintenancePlanItem(
    @TenantId() tenantId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('itemId') itemId: string,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.maintenancePlan.delete(tenantId, vehicleId, itemId, actorUserId);
  }

  @Delete('vehicles/:vehicleId')
  @Roles(MembershipRole.tenant_admin)
  @HttpCode(204)
  deleteVehicle(
    @TenantId() tenantId: string,
    @Param('vehicleId') vehicleId: string,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.fleet.deleteVehicle(tenantId, vehicleId, actorUserId);
  }

  @Post('vehicles/:vehicleId/documents')
  @Roles(MembershipRole.tenant_admin)
  @HttpCode(201)
  addVehicleDocument(
    @TenantId() tenantId: string,
    @Param('vehicleId') vehicleId: string,
    @Body() body: unknown,
    @CurrentUserId() actorUserId?: string,
  ) {
    const dto = assertCreateVehicleDocumentDto(body);
    return this.fleet.addVehicleDocument(tenantId, vehicleId, dto, actorUserId);
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
