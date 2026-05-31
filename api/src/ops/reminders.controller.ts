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
import { MembershipRole, ReminderSourceType } from '@prisma/client';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TenantId } from '../fleet/tenant-id.decorator';
import type { ReminderListFilterStatus } from './document-reminders';
import { normalizeReminderOffsets } from './document-reminders';
import { normalizeReminderOffsetsKm } from './reminder-status';
import type {
  CreateReminderInput,
  PatchReminderInput,
  ReminderBrowseFilters,
} from './reminders.service';
import { RemindersService } from './reminders.service';

@Controller('reminders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  @Get('export')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="reminders.csv"')
  async exportCsv(@TenantId() tenantSlug: string, @Query() q: Record<string, string | undefined>) {
    const csv = await this.reminders.exportCsv(tenantSlug, parseReminderBrowseQuery(q));
    return new StreamableFile(Buffer.from(csv, 'utf8'));
  }

  @Get('context/:vehicleId')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  vehicleContext(@TenantId() tenantSlug: string, @Param('vehicleId') vehicleId: string) {
    return this.reminders.vehicleContext(tenantSlug, vehicleId);
  }

  @Get()
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  list(
    @TenantId() tenantSlug: string,
    @Query() q: Record<string, string | undefined>,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(pageSizeStr ?? '50', 10) || 50), 200);
    return this.reminders.list(tenantSlug, {
      page,
      pageSize,
      ...parseReminderBrowseQuery(q),
    });
  }

  @Get(':id')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  getById(@TenantId() tenantSlug: string, @Param('id') id: string) {
    return this.reminders.getById(tenantSlug, id);
  }

  @Post()
  @Roles(MembershipRole.tenant_admin)
  @HttpCode(201)
  create(
    @TenantId() tenantSlug: string,
    @Body() body: unknown,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.reminders.create(tenantSlug, assertCreateReminderDto(body), actorUserId);
  }

  @Patch(':id')
  @Roles(MembershipRole.tenant_admin)
  patch(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.reminders.patch(tenantSlug, id, assertPatchReminderDto(body), actorUserId);
  }

  @Delete(':id')
  @Roles(MembershipRole.tenant_admin)
  @HttpCode(204)
  async remove(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @CurrentUserId() actorUserId?: string,
  ) {
    await this.reminders.delete(tenantSlug, id, actorUserId);
  }
}

function parseReminderBrowseQuery(q: Record<string, string | undefined>): ReminderBrowseFilters {
  const registrationNumber = q['registrationNumber']?.trim();
  const clientId = q['clientId']?.trim();
  const vehicleId = q['vehicleId']?.trim();
  const searchQ = q['q']?.trim();
  const dueFrom = q['dueFrom']?.trim();
  const dueTo = q['dueTo']?.trim();
  const sourceType = parseSourceType(q['sourceType']);
  const status = parseReminderListStatus(q['status']);
  return {
    ...(registrationNumber ? { registrationNumber } : {}),
    ...(clientId ? { clientId } : {}),
    ...(vehicleId ? { vehicleId } : {}),
    ...(searchQ ? { q: searchQ } : {}),
    ...(dueFrom ? { dueFrom } : {}),
    ...(dueTo ? { dueTo } : {}),
    ...(sourceType ? { sourceType } : {}),
    ...(status ? { status } : {}),
  };
}

function parseSourceType(raw?: string): ReminderSourceType | undefined {
  if (!raw?.trim()) return undefined;
  const v = raw.trim();
  if (v === 'document' || v === 'maintenance' || v === 'custom' || v === 'cost') return v;
  throw new BadRequestException('Invalid sourceType; use document, maintenance, cost, or custom');
}

function parseReminderListStatus(raw?: string): ReminderListFilterStatus | undefined {
  if (!raw?.trim()) return undefined;
  const v = raw.trim();
  if (v === 'all' || v === 'action' || v === 'upcoming' || v === 'expired') return v;
  throw new BadRequestException('Invalid status; use all, action, upcoming, or expired');
}

function parseOffsetsField(body: Record<string, unknown>, field: string): number[] | null | undefined {
  if (!(field in body)) return undefined;
  const v = body[field];
  if (v === null) return null;
  const normalized = normalizeReminderOffsets(v);
  if (!normalized) {
    throw new BadRequestException(`Field "${field}" must be an array of integers between 0 and 365`);
  }
  return normalized;
}

function parseOffsetsKmField(body: Record<string, unknown>, field: string): number[] | null | undefined {
  if (!(field in body)) return undefined;
  const v = body[field];
  if (v === null) return null;
  const normalized = normalizeReminderOffsetsKm(v);
  if (!normalized) {
    throw new BadRequestException(`Field "${field}" must be an array of integers between 0 and 500000`);
  }
  return normalized;
}

function assertCreateReminderDto(body: unknown): CreateReminderInput {
  if (!isRecord(body)) throw new BadRequestException('Invalid JSON body');
  const vehicleId = asNonEmptyString(body.vehicleId, 'vehicleId');
  const sourceType = parseSourceType(asNonEmptyString(body.sourceType, 'sourceType'));
  if (!sourceType) throw new BadRequestException('Invalid sourceType');
  const title = asNonEmptyString(body.title, 'title');
  return {
    vehicleId,
    sourceType,
    title,
    notes: 'notes' in body ? optionalString(body.notes) : undefined,
    vehicleDocumentId:
      'vehicleDocumentId' in body
        ? body.vehicleDocumentId === null
          ? null
          : optionalString(body.vehicleDocumentId)
        : undefined,
    maintenanceEntryId:
      'maintenanceEntryId' in body
        ? body.maintenanceEntryId === null
          ? null
          : optionalString(body.maintenanceEntryId)
        : undefined,
    dueOn:
      'dueOn' in body ? (body.dueOn === null ? null : optionalIsoDateString(body.dueOn)) : undefined,
    reminderOffsetsDays: parseOffsetsField(body, 'reminderOffsetsDays'),
    dueOdometerKm: 'dueOdometerKm' in body ? optionalInt(body.dueOdometerKm) : undefined,
    reminderOffsetsKm: parseOffsetsKmField(body, 'reminderOffsetsKm'),
    intervalDays: 'intervalDays' in body ? optionalInt(body.intervalDays) : undefined,
    intervalKm: 'intervalKm' in body ? optionalInt(body.intervalKm) : undefined,
    lastPerformedOn:
      'lastPerformedOn' in body
        ? body.lastPerformedOn === null
          ? null
          : optionalIsoDateString(body.lastPerformedOn)
        : undefined,
    lastPerformedOdometerKm:
      'lastPerformedOdometerKm' in body ? optionalInt(body.lastPerformedOdometerKm) : undefined,
    isActive: 'isActive' in body ? optionalBoolean(body.isActive) : undefined,
  };
}

function assertPatchReminderDto(body: unknown): PatchReminderInput {
  if (!isRecord(body)) throw new BadRequestException('Invalid JSON body');
  const dto: PatchReminderInput = {};
  if ('vehicleId' in body) dto.vehicleId = asNonEmptyString(body.vehicleId, 'vehicleId');
  if ('sourceType' in body) {
    const st = parseSourceType(asNonEmptyString(body.sourceType, 'sourceType'));
    if (!st) throw new BadRequestException('Invalid sourceType');
    dto.sourceType = st;
  }
  if ('title' in body) dto.title = asNonEmptyString(body.title, 'title');
  if ('notes' in body) dto.notes = body.notes === null ? null : optionalString(body.notes);
  if ('vehicleDocumentId' in body) {
    dto.vehicleDocumentId =
      body.vehicleDocumentId === null ? null : optionalString(body.vehicleDocumentId);
  }
  if ('maintenanceEntryId' in body) {
    dto.maintenanceEntryId =
      body.maintenanceEntryId === null ? null : optionalString(body.maintenanceEntryId);
  }
  if ('dueOn' in body) dto.dueOn = body.dueOn === null ? null : optionalIsoDateString(body.dueOn);
  if ('reminderOffsetsDays' in body) dto.reminderOffsetsDays = parseOffsetsField(body, 'reminderOffsetsDays');
  if ('dueOdometerKm' in body) dto.dueOdometerKm = optionalInt(body.dueOdometerKm);
  if ('reminderOffsetsKm' in body) dto.reminderOffsetsKm = parseOffsetsKmField(body, 'reminderOffsetsKm');
  if ('intervalDays' in body) dto.intervalDays = optionalInt(body.intervalDays);
  if ('intervalKm' in body) dto.intervalKm = optionalInt(body.intervalKm);
  if ('lastPerformedOn' in body) {
    dto.lastPerformedOn =
      body.lastPerformedOn === null ? null : optionalIsoDateString(body.lastPerformedOn);
  }
  if ('lastPerformedOdometerKm' in body) {
    dto.lastPerformedOdometerKm = optionalInt(body.lastPerformedOdometerKm);
  }
  if ('isActive' in body) dto.isActive = optionalBoolean(body.isActive);
  if (Object.keys(dto).length === 0) throw new BadRequestException('No fields to update');
  return dto;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asNonEmptyString(v: unknown, field: string): string {
  if (typeof v !== 'string' || !v.trim()) throw new BadRequestException(`${field} is required`);
  return v.trim();
}

function optionalString(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string') throw new BadRequestException('Expected string');
  const t = v.trim();
  return t || undefined;
}

function optionalIsoDateString(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string') throw new BadRequestException('Expected ISO date string');
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new BadRequestException('Invalid date');
  return d.toISOString();
}

function optionalInt(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== 'number' || !Number.isInteger(v)) {
    throw new BadRequestException('Expected integer');
  }
  return v;
}

function optionalBoolean(v: unknown): boolean | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'boolean') throw new BadRequestException('Expected boolean');
  return v;
}
