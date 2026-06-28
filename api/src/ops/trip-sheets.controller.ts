import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { MembershipRole, TripSheetDocType } from '@prisma/client';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TenantId } from '../fleet/tenant-id.decorator';
import type {
  GenerateTripSheetInput,
  TripSheetBrowseFilters,
} from './trip-sheets.service';
import { TripSheetsService } from './trip-sheets.service';

@Controller('trip-sheets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TripSheetsController {
  constructor(private readonly tripSheets: TripSheetsService) {}

  @Get()
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  list(
    @TenantId() tenantSlug: string,
    @Query() q: Record<string, string | undefined>,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(pageSizeStr ?? '20', 10) || 20), 50);
    return this.tripSheets.list(tenantSlug, {
      page,
      pageSize,
      ...parseTripSheetBrowseQuery(q),
    });
  }

  @Get(':docId/pdf')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  @Header('Content-Type', 'application/pdf')
  async downloadPdf(@TenantId() tenantSlug: string, @Param('docId') docId: string) {
    const buf = await this.tripSheets.getPdfBuffer(tenantSlug, docId);
    const safeId = docId.replace(/[^a-zA-Z0-9_-]/g, '');
    return new StreamableFile(buf, {
      disposition: `attachment; filename="trip-sheet-${safeId}.pdf"`,
    });
  }

  @Get(':docId')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  getOne(@TenantId() tenantSlug: string, @Param('docId') docId: string) {
    return this.tripSheets.getById(tenantSlug, docId);
  }

  @Post('generate')
  @Roles(MembershipRole.tenant_admin)
  @HttpCode(201)
  generate(
    @TenantId() tenantSlug: string,
    @Body() body: unknown,
    @CurrentUserId() actorUserId?: string,
  ) {
    const dto = assertGenerateDto(body);
    return this.tripSheets.generate(tenantSlug, dto, actorUserId);
  }
}

function parseTripSheetBrowseQuery(q: Record<string, string | undefined>): TripSheetBrowseFilters {
  const registrationNumber = q['registrationNumber']?.trim();
  const clientId = q['clientId']?.trim();
  const searchQ = q['q']?.trim();
  const periodFrom = q['periodFrom']?.trim();
  const periodTo = q['periodTo']?.trim();
  const createdFrom = q['createdFrom']?.trim();
  const createdTo = q['createdTo']?.trim();
  const docTypeRaw = q['docType']?.trim();
  let docType: TripSheetBrowseFilters['docType'];
  if (docTypeRaw === 'trip_sheet' || docTypeRaw === 'faz_monthly') {
    docType = docTypeRaw;
  }
  return {
    ...(registrationNumber ? { registrationNumber } : {}),
    ...(clientId ? { clientId } : {}),
    ...(searchQ ? { q: searchQ } : {}),
    ...(periodFrom ? { periodFrom } : {}),
    ...(periodTo ? { periodTo } : {}),
    ...(createdFrom ? { createdFrom } : {}),
    ...(createdTo ? { createdTo } : {}),
    ...(docType ? { docType } : {}),
  };
}

function assertGenerateDto(body: unknown): GenerateTripSheetInput {
  if (!isRecord(body)) throw new BadRequestException('Invalid JSON body');

  const docTypeRaw = asNonEmptyString(body.docType, 'docType');
  if (docTypeRaw !== 'trip_sheet' && docTypeRaw !== 'faz_monthly') {
    throw new BadRequestException('docType must be trip_sheet or faz_monthly');
  }
  const docType = docTypeRaw as TripSheetDocType;

  const periodStart = asNonEmptyString(body.periodStart, 'periodStart');
  const periodEnd = asNonEmptyString(body.periodEnd, 'periodEnd');

  let vehicleIds: string[] = [];
  if (Array.isArray(body.vehicleIds)) {
    vehicleIds = body.vehicleIds
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      .map((v) => v.trim());
  }
  if (vehicleIds.length === 0) {
    throw new BadRequestException('vehicleIds must be a non-empty array');
  }

  const driverId =
    body.driverId === undefined || body.driverId === null
      ? null
      : typeof body.driverId === 'string'
        ? body.driverId.trim() || null
        : (() => {
            throw new BadRequestException('driverId must be a string or null');
          })();

  const driverName =
    body.driverName === undefined || body.driverName === null
      ? null
      : typeof body.driverName === 'string'
        ? body.driverName.trim() || null
        : (() => {
            throw new BadRequestException('driverName must be a string or null');
          })();

  const clientId =
    body.clientId === undefined || body.clientId === null
      ? null
      : typeof body.clientId === 'string'
        ? body.clientId.trim() || null
        : (() => {
            throw new BadRequestException('clientId must be a string or null');
          })();

  return { docType, periodStart, periodEnd, vehicleIds, driverId, driverName, clientId };
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
