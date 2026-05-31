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
import type { CostBrowseFilters, CreateCostInput, PatchCostInput } from './costs.service';
import { CostsService } from './costs.service';
import { normalizeReminderOffsets } from './document-reminders';

@Controller('costs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CostsController {
  constructor(private readonly costs: CostsService) {}

  @Get('export')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="costs.csv"')
  async exportCsv(@TenantId() tenantSlug: string, @Query() q: Record<string, string | undefined>) {
    const csv = await this.costs.exportCsv(tenantSlug, parseCostBrowseQuery(q));
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
    return this.costs.list(tenantSlug, {
      page,
      pageSize,
      ...parseCostBrowseQuery(q),
    });
  }

  @Get(':id')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  getById(@TenantId() tenantSlug: string, @Param('id') id: string) {
    return this.costs.getById(tenantSlug, id);
  }

  @Post()
  @Roles(MembershipRole.tenant_admin)
  @HttpCode(201)
  create(
    @TenantId() tenantSlug: string,
    @Body() body: unknown,
    @CurrentUserId() actorUserId?: string,
  ) {
    const dto = assertCreateCostDto(body);
    return this.costs.create(tenantSlug, dto, actorUserId);
  }

  @Patch(':id')
  @Roles(MembershipRole.tenant_admin)
  patch(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUserId() actorUserId?: string,
  ) {
    const dto = assertPatchCostDto(body);
    return this.costs.patch(tenantSlug, id, dto, actorUserId);
  }

  @Delete(':id')
  @Roles(MembershipRole.tenant_admin)
  @HttpCode(204)
  async remove(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @CurrentUserId() actorUserId?: string,
  ) {
    await this.costs.delete(tenantSlug, id, actorUserId);
  }
}

function parseCostBrowseQuery(q: Record<string, string | undefined>): CostBrowseFilters {
  const registrationNumber = q['registrationNumber']?.trim();
  const clientId = q['clientId']?.trim();
  const category = q['category']?.trim();
  const provider = q['provider']?.trim();
  const searchQ = q['q']?.trim();
  const incurredFrom = q['incurredFrom']?.trim();
  const incurredTo = q['incurredTo']?.trim();
  return {
    ...(registrationNumber ? { registrationNumber } : {}),
    ...(clientId ? { clientId } : {}),
    ...(category ? { category } : {}),
    ...(provider ? { provider } : {}),
    ...(searchQ ? { q: searchQ } : {}),
    ...(incurredFrom ? { incurredFrom } : {}),
    ...(incurredTo ? { incurredTo } : {}),
  };
}

function assertCreateCostDto(body: unknown): CreateCostInput {
  if (!isRecord(body)) throw new BadRequestException('Invalid JSON body');
  const vehicleId = asNonEmptyString(body.vehicleId, 'vehicleId');
  const category = asNonEmptyString(body.category, 'category');
  const amountCents = asNonNegativeInt(body.amountCents, 'amountCents');
  return {
    vehicleId,
    category,
    provider: optionalNullableString(body.provider),
    amountCents,
    odometerKm: optionalNullableNonNegativeInt(body.odometerKm, 'odometerKm'),
    invoiceNumber: optionalNullableString(body.invoiceNumber),
    invoiceDate:
      'invoiceDate' in body
        ? body.invoiceDate === null
          ? null
          : optionalIsoDateString(body.invoiceDate)
        : undefined,
    invoiceAttachmentUrl: optionalNullableString(body.invoiceAttachmentUrl),
    incurredOn: optionalIsoDateString(body.incurredOn),
    notes: optionalNullableString(body.notes),
    nextDueOn:
      'nextDueOn' in body
        ? body.nextDueOn === null
          ? null
          : optionalIsoDateString(body.nextDueOn)
        : undefined,
    reminderOffsetsDays: parseReminderOffsetsField(body, 'reminderOffsetsDays'),
    syncReminderAction:
      'syncReminderAction' in body ? optionalBoolean(body.syncReminderAction) : undefined,
  };
}

function assertPatchCostDto(body: unknown): PatchCostInput {
  if (!isRecord(body)) throw new BadRequestException('Invalid JSON body');
  const dto: PatchCostInput = {};

  if ('vehicleId' in body) dto.vehicleId = asNonEmptyString(body.vehicleId, 'vehicleId');
  if ('category' in body) dto.category = asNonEmptyString(body.category, 'category');
  if ('provider' in body) dto.provider = optionalNullableString(body.provider);
  if ('amountCents' in body) dto.amountCents = asNonNegativeInt(body.amountCents, 'amountCents');
  if ('odometerKm' in body) {
    dto.odometerKm = optionalNullableNonNegativeInt(body.odometerKm, 'odometerKm');
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
  if ('incurredOn' in body) {
    const iso = optionalIsoDateString(body.incurredOn);
    if (iso === undefined) {
      throw new BadRequestException('Field "incurredOn" must be a valid ISO date string');
    }
    dto.incurredOn = iso;
  }
  if ('notes' in body) dto.notes = optionalNullableString(body.notes);
  if ('nextDueOn' in body) {
    dto.nextDueOn = body.nextDueOn === null ? null : optionalIsoDateString(body.nextDueOn);
    if (body.nextDueOn !== null && dto.nextDueOn === undefined) {
      throw new BadRequestException('Field "nextDueOn" must be a valid ISO date string or null');
    }
  }
  if ('reminderOffsetsDays' in body) {
    dto.reminderOffsetsDays = parseReminderOffsetsField(body, 'reminderOffsetsDays');
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

function asNonNegativeInt(v: unknown, field: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isInteger(v) || v < 0) {
    throw new BadRequestException(`Field "${field}" must be a non-negative integer`);
  }
  return v;
}

function optionalNullableNonNegativeInt(
  v: unknown,
  field: string,
): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  return asNonNegativeInt(v, field);
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
