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
import { TenantId } from '../fleet/tenant-id.decorator';
import { isMaintenanceCostAllocationCode } from './maintenance-cost-allocation';
import { normalizeReminderOffsets } from './document-reminders';
import { normalizeReminderOffsetsKm } from './reminder-status';
import type {
  CreateMaintenanceInput,
  MaintenanceBrowseFilters,
  PatchMaintenanceInput,
} from './maintenance.service';
import { MaintenanceService } from './maintenance.service';

@Controller('maintenance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Get('export')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="maintenance.csv"')
  async exportCsv(@TenantId() tenantSlug: string, @Query() q: Record<string, string | undefined>) {
    const csv = await this.maintenance.exportCsv(tenantSlug, parseMaintenanceBrowseQuery(q));
    return new StreamableFile(Buffer.from(csv, 'utf8'));
  }

  @Get()
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  listEntries(
    @TenantId() tenantSlug: string,
    @Query() q: Record<string, string | undefined>,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(pageSizeStr ?? '50', 10) || 50), 200);
    return this.maintenance.list(tenantSlug, {
      page,
      pageSize,
      ...parseMaintenanceBrowseQuery(q),
    });
  }

  @Get(':id')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  getById(@TenantId() tenantSlug: string, @Param('id') id: string) {
    return this.maintenance.getById(tenantSlug, id);
  }

  @Post()
  @Roles(MembershipRole.tenant_admin)
  @HttpCode(201)
  create(
    @TenantId() tenantSlug: string,
    @Body() body: unknown,
    @CurrentUserId() actorUserId?: string,
  ) {
    const dto = assertCreateMaintenanceDto(body);
    return this.maintenance.create(tenantSlug, dto, actorUserId);
  }

  @Patch(':id')
  @Roles(MembershipRole.tenant_admin)
  patch(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUserId() actorUserId?: string,
  ) {
    const dto = assertPatchMaintenanceDto(body);
    return this.maintenance.patch(tenantSlug, id, dto, actorUserId);
  }

  @Delete(':id')
  @Roles(MembershipRole.tenant_admin)
  @HttpCode(204)
  async remove(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @CurrentUserId() actorUserId?: string,
  ) {
    await this.maintenance.delete(tenantSlug, id, actorUserId);
  }
}

function parseMaintenanceBrowseQuery(
  q: Record<string, string | undefined>,
): MaintenanceBrowseFilters {
  const registrationNumber = q['registrationNumber']?.trim();
  const clientId = q['clientId']?.trim();
  const provider = q['provider']?.trim();
  const searchQ = q['q']?.trim();
  const performedFrom = q['performedFrom']?.trim();
  const performedTo = q['performedTo']?.trim();
  return {
    ...(registrationNumber ? { registrationNumber } : {}),
    ...(clientId ? { clientId } : {}),
    ...(provider ? { provider } : {}),
    ...(searchQ ? { q: searchQ } : {}),
    ...(performedFrom ? { performedFrom } : {}),
    ...(performedTo ? { performedTo } : {}),
  };
}

function assertCreateMaintenanceDto(body: unknown): CreateMaintenanceInput {
  if (!isRecord(body)) throw new BadRequestException('Invalid JSON body');
  const vehicleId = asNonEmptyString(body.vehicleId, 'vehicleId');
  const title = asNonEmptyString(body.title, 'title');
  const rawAlloc = body.costAllocationCode;
  const trimmedAlloc = typeof rawAlloc === 'string' ? rawAlloc.trim() : '';
  if (!isMaintenanceCostAllocationCode(trimmedAlloc)) {
    throw new BadRequestException(
      'Field "costAllocationCode" is required and must be one of the predefined allocation codes',
    );
  }
  return {
    vehicleId,
    title,
    provider: optionalNullableString(body.provider),
    costAllocationCode: trimmedAlloc,
    invoiceNumber: optionalNullableString(body.invoiceNumber),
    invoiceDate:
      'invoiceDate' in body
        ? body.invoiceDate === null
          ? null
          : optionalIsoDateString(body.invoiceDate)
        : undefined,
    invoiceAttachmentUrl: optionalNullableString(body.invoiceAttachmentUrl),
    performedAt:
      'performedAt' in body
        ? body.performedAt === null
          ? null
          : optionalIsoDateString(body.performedAt)
        : undefined,
    odometerKm: optionalNonNegativeInt(body.odometerKm, 'odometerKm'),
    notes: optionalNullableString(body.notes),
    costCents: optionalNonNegativeInt(body.costCents, 'costCents'),
    warrantyRepair: 'warrantyRepair' in body ? optionalBoolean(body.warrantyRepair) : undefined,
    potentialCostCents: optionalNonNegativeInt(body.potentialCostCents, 'potentialCostCents'),
    damageClaimFileNumber: optionalNullableString(body.damageClaimFileNumber),
    insurerName: optionalNullableString(body.insurerName),
    nextDueOn:
      'nextDueOn' in body
        ? body.nextDueOn === null
          ? null
          : optionalIsoDateString(body.nextDueOn)
        : undefined,
    reminderOffsetsDays: parseReminderOffsetsField(body, 'reminderOffsetsDays'),
    dueOdometerKm: optionalNullableNonNegativeInt(body.dueOdometerKm, 'dueOdometerKm'),
    reminderOffsetsKm: parseReminderOffsetsKmField(body, 'reminderOffsetsKm'),
    syncReminderAction:
      'syncReminderAction' in body ? optionalBoolean(body.syncReminderAction) : undefined,
  };
}

function assertPatchMaintenanceDto(body: unknown): PatchMaintenanceInput {
  if (!isRecord(body)) throw new BadRequestException('Invalid JSON body');
  const dto: PatchMaintenanceInput = {};

  if ('vehicleId' in body) dto.vehicleId = asNonEmptyString(body.vehicleId, 'vehicleId');
  if ('title' in body) dto.title = asNonEmptyString(body.title, 'title');
  if ('provider' in body) dto.provider = optionalNullableString(body.provider);
  if ('performedAt' in body) {
    dto.performedAt =
      body.performedAt === null ? null : optionalIsoDateString(body.performedAt);
    if (body.performedAt !== null && dto.performedAt === undefined) {
      throw new BadRequestException('Field "performedAt" must be a valid ISO date string or null');
    }
  }
  if ('odometerKm' in body) {
    if (body.odometerKm === null) dto.odometerKm = null;
    else dto.odometerKm = optionalNonNegativeInt(body.odometerKm, 'odometerKm') ?? undefined;
  }
  if ('notes' in body) dto.notes = optionalNullableString(body.notes);
  if ('costCents' in body) {
    if (body.costCents === null) dto.costCents = null;
    else dto.costCents = optionalNonNegativeInt(body.costCents, 'costCents') ?? undefined;
  }
  if ('warrantyRepair' in body) dto.warrantyRepair = optionalBoolean(body.warrantyRepair);
  if ('potentialCostCents' in body) {
    if (body.potentialCostCents === null) dto.potentialCostCents = null;
    else dto.potentialCostCents = optionalNonNegativeInt(body.potentialCostCents, 'potentialCostCents') ?? undefined;
  }
  if ('damageClaimFileNumber' in body) {
    dto.damageClaimFileNumber = optionalNullableString(body.damageClaimFileNumber);
  }
  if ('insurerName' in body) dto.insurerName = optionalNullableString(body.insurerName);
  if ('costAllocationCode' in body) {
    const raw = body.costAllocationCode;
    if (typeof raw !== 'string') {
      throw new BadRequestException(
        'Field "costAllocationCode" must be one of the predefined allocation codes',
      );
    }
    const trimmedAlloc = raw.trim();
    if (!isMaintenanceCostAllocationCode(trimmedAlloc)) {
      throw new BadRequestException(
        'Field "costAllocationCode" must be one of the predefined allocation codes',
      );
    }
    dto.costAllocationCode = trimmedAlloc;
  }
  if ('invoiceNumber' in body) dto.invoiceNumber = optionalNullableString(body.invoiceNumber);
  if ('invoiceDate' in body) {
    dto.invoiceDate = body.invoiceDate === null ? null : optionalIsoDateString(body.invoiceDate);
    if (body.invoiceDate !== null && dto.invoiceDate === undefined) {
      throw new BadRequestException('Field "invoiceDate" must be a valid ISO date string or null');
    }
  }
  if ('invoiceAttachmentUrl' in body) {
    dto.invoiceAttachmentUrl = optionalNullableString(body.invoiceAttachmentUrl);
  }
  if ('nextDueOn' in body) {
    dto.nextDueOn = body.nextDueOn === null ? null : optionalIsoDateString(body.nextDueOn);
    if (body.nextDueOn !== null && dto.nextDueOn === undefined) {
      throw new BadRequestException('Field "nextDueOn" must be a valid ISO date string or null');
    }
  }
  if ('reminderOffsetsDays' in body) {
    dto.reminderOffsetsDays = parseReminderOffsetsField(body, 'reminderOffsetsDays');
  }
  if ('dueOdometerKm' in body) {
    dto.dueOdometerKm = optionalNullableNonNegativeInt(body.dueOdometerKm, 'dueOdometerKm');
  }
  if ('reminderOffsetsKm' in body) {
    dto.reminderOffsetsKm = parseReminderOffsetsKmField(body, 'reminderOffsetsKm');
  }
  if ('syncReminderAction' in body) {
    dto.syncReminderAction = optionalBoolean(body.syncReminderAction);
  }

  if (Object.keys(dto).length === 0) {
    throw new BadRequestException('No fields to update');
  }

  return dto;
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

function optionalNullableString(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== 'string') {
    throw new BadRequestException('Expected string or null');
  }
  const s = v.trim();
  return s.length === 0 ? null : s;
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

function optionalNonNegativeInt(v: unknown, field: string): number | undefined {
  if (v === undefined) return undefined;
  if (v === null) return undefined;
  if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isInteger(v) || v < 0) {
    throw new BadRequestException(`Field "${field}" must be a non-negative integer`);
  }
  return v;
}

function parseReminderOffsetsField(
  body: Record<string, unknown>,
  field: string,
): number[] | null | undefined {
  if (!(field in body)) return undefined;
  const v = body[field];
  if (v === null) return null;
  const normalized = normalizeReminderOffsets(v);
  if (!normalized) {
    throw new BadRequestException(
      `Field "${field}" must be an array of integers between 0 and 365 (max 10 unique values)`,
    );
  }
  return normalized;
}

function optionalBoolean(v: unknown): boolean | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'boolean') throw new BadRequestException('Expected boolean');
  return v;
}

function optionalNullableNonNegativeInt(
  v: unknown,
  field: string,
): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  return optionalNonNegativeInt(v, field);
}

function parseReminderOffsetsKmField(
  body: Record<string, unknown>,
  field: string,
): number[] | null | undefined {
  if (!(field in body)) return undefined;
  const v = body[field];
  if (v === null) return null;
  const normalized = normalizeReminderOffsetsKm(v);
  if (!normalized) {
    throw new BadRequestException(
      `Field "${field}" must be an array of integers between 0 and 500000 (max 10 unique values)`,
    );
  }
  return normalized;
}
