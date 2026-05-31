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
import { isDocumentTypeCode } from './document-types';
import { normalizeReminderOffsets } from './document-reminders';
import type {
  CreateDocumentInput,
  DocumentBrowseFilters,
  DocumentExpiryStatus,
  PatchDocumentInput,
} from './documents.service';
import { DocumentsService } from './documents.service';

@Controller('documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get('export')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="documents.csv"')
  async exportCsv(@TenantId() tenantSlug: string, @Query() q: Record<string, string | undefined>) {
    const csv = await this.documents.exportCsv(tenantSlug, parseDocumentBrowseQuery(q));
    return new StreamableFile(Buffer.from(csv, 'utf8'));
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
    return this.documents.list(tenantSlug, {
      page,
      pageSize,
      ...parseDocumentBrowseQuery(q),
    });
  }

  @Get(':id')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  getById(@TenantId() tenantSlug: string, @Param('id') id: string) {
    return this.documents.getById(tenantSlug, id);
  }

  @Post()
  @Roles(MembershipRole.tenant_admin)
  @HttpCode(201)
  create(
    @TenantId() tenantSlug: string,
    @Body() body: unknown,
    @CurrentUserId() actorUserId?: string,
  ) {
    const dto = assertCreateDocumentDto(body);
    return this.documents.create(tenantSlug, dto, actorUserId);
  }

  @Patch(':id')
  @Roles(MembershipRole.tenant_admin)
  patch(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUserId() actorUserId?: string,
  ) {
    const dto = assertPatchDocumentDto(body);
    return this.documents.patch(tenantSlug, id, dto, actorUserId);
  }

  @Delete(':id')
  @Roles(MembershipRole.tenant_admin)
  @HttpCode(204)
  async remove(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @CurrentUserId() actorUserId?: string,
  ) {
    await this.documents.delete(tenantSlug, id, actorUserId);
  }
}

function parseDocumentBrowseQuery(
  q: Record<string, string | undefined>,
): DocumentBrowseFilters {
  const registrationNumber = q['registrationNumber']?.trim();
  const clientId = q['clientId']?.trim();
  const documentTypeCode = q['documentTypeCode']?.trim();
  const searchQ = q['q']?.trim();
  const expiresFrom = q['expiresFrom']?.trim();
  const expiresTo = q['expiresTo']?.trim();
  const expiryStatus = parseExpiryStatus(q['expiryStatus']);
  return {
    ...(registrationNumber ? { registrationNumber } : {}),
    ...(clientId ? { clientId } : {}),
    ...(documentTypeCode ? { documentTypeCode } : {}),
    ...(searchQ ? { q: searchQ } : {}),
    ...(expiresFrom ? { expiresFrom } : {}),
    ...(expiresTo ? { expiresTo } : {}),
    ...(expiryStatus ? { expiryStatus } : {}),
  };
}

function parseExpiryStatus(raw?: string): DocumentExpiryStatus | undefined {
  if (!raw?.trim()) return undefined;
  const v = raw.trim();
  if (v === 'none' || v === 'valid' || v === 'expiring' || v === 'expired') {
    return v;
  }
  throw new BadRequestException(
    'Invalid expiryStatus; use none, valid, expiring, or expired',
  );
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

function assertCreateDocumentDto(body: unknown): CreateDocumentInput {
  if (!isRecord(body)) throw new BadRequestException('Invalid JSON body');
  const vehicleId = asNonEmptyString(body.vehicleId, 'vehicleId');
  const documentTypeCode = asDocumentTypeCode(body.documentTypeCode, 'documentTypeCode');
  const title = asNonEmptyString(body.title, 'title');
  const expiresOn =
    'expiresOn' in body
      ? body.expiresOn === null
        ? null
        : optionalIsoDateString(body.expiresOn)
      : undefined;
  const fileUrl =
    'fileUrl' in body ? (body.fileUrl === null ? null : optionalString(body.fileUrl)) : undefined;
  const fileName =
    'fileName' in body ? (body.fileName === null ? null : optionalString(body.fileName)) : undefined;
  const reminderOffsetsDays = parseReminderOffsetsField(body, 'reminderOffsetsDays');
  const syncReminderAction =
    'syncReminderAction' in body ? optionalBoolean(body.syncReminderAction) : undefined;
  return {
    vehicleId,
    documentTypeCode,
    title,
    expiresOn,
    fileUrl,
    fileName,
    reminderOffsetsDays,
    syncReminderAction,
  };
}

function assertPatchDocumentDto(body: unknown): PatchDocumentInput {
  if (!isRecord(body)) throw new BadRequestException('Invalid JSON body');
  const dto: PatchDocumentInput = {};

  if ('vehicleId' in body) dto.vehicleId = asNonEmptyString(body.vehicleId, 'vehicleId');
  if ('documentTypeCode' in body) {
    dto.documentTypeCode = asDocumentTypeCode(body.documentTypeCode, 'documentTypeCode');
  }
  if ('title' in body) dto.title = asNonEmptyString(body.title, 'title');
  if ('expiresOn' in body) {
    dto.expiresOn = body.expiresOn === null ? null : optionalIsoDateString(body.expiresOn);
    if (body.expiresOn !== null && dto.expiresOn === undefined) {
      throw new BadRequestException('Field "expiresOn" must be a valid ISO date string or null');
    }
  }
  if ('fileUrl' in body) {
    dto.fileUrl = body.fileUrl === null ? null : optionalString(body.fileUrl);
  }
  if ('fileName' in body) {
    dto.fileName = body.fileName === null ? null : optionalString(body.fileName);
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

function asDocumentTypeCode(v: unknown, field: string) {
  if (typeof v !== 'string' || !isDocumentTypeCode(v.trim())) {
    throw new BadRequestException(`Field "${field}" must be a known document type code`);
  }
  return v.trim() as CreateDocumentInput['documentTypeCode'];
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

function optionalString(v: unknown): string | null | undefined {
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

function optionalBoolean(v: unknown): boolean | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'boolean') throw new BadRequestException('Expected boolean');
  return v;
}
